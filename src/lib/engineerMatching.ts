import type { Engineer, EngineerAvailability, WorkOrderAssignment } from "@/types/engineers";
import type { IntakeRecord } from "@/types/intake";
import type { WorkOrderWithRelations } from "@/types/workOrders";

export type MatchStrength = "strong" | "possible" | "weak" | "unsuitable";

export interface MatchReason {
  key: string;
  label: string;
  /** positive | neutral | warning */
  tone: "positive" | "neutral" | "warning";
}

export interface EngineerMatch {
  engineer: Engineer;
  score: number; // 0..100
  strength: MatchStrength;
  reasons: MatchReason[];
  blockers: MatchReason[];
  leadSuitable: boolean;
  supportSuitable: boolean;
  activeLoad: number;
}

export interface MatchContext {
  primaryTrade: string | null;
  complexity: "basic" | "intermediate" | "advanced" | null;
  postcodeZone: string | null;
  engineersRequired: number;
  certifications: string[];
}

const COMPLEXITY_RANK: Record<string, number> = { basic: 1, intermediate: 2, advanced: 3 };

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** Derive a matching context from an intake record + draft edits. */
export function buildMatchContext(
  record: Pick<IntakeRecord, "extracted_fields_json" | "suggested_categorization_json" | "normalized_fields_json"> | null,
): MatchContext {
  const ex = record?.extracted_fields_json ?? {};
  const cat = record?.suggested_categorization_json ?? {};
  const nf = (record?.normalized_fields_json ?? {}) as Record<string, unknown>;

  const normTrade = typeof nf.primary_trade === "string" ? (nf.primary_trade as string) : null;
  const normZone = typeof nf.postcode_zone === "string" ? (nf.postcode_zone as string) : null;

  return {
    primaryTrade: normTrade || cat.primary_trade || null,
    complexity: cat.complexity_level ?? null,
    postcodeZone: normZone || cat.postcode_zone || ex.postcode_zone || null,
    engineersRequired: Math.max(1, cat.engineers_required ?? 1),
    certifications: [],
  };
}

/** Derive a matching context from a dispatch-ready work order. */
export function buildMatchContextFromWorkOrder(
  wo: Pick<
    WorkOrderWithRelations,
    "primary_trade" | "complexity_level" | "postcode_zone" | "engineers_required" | "certification_tags"
  > | null,
): MatchContext {
  if (!wo) {
    return { primaryTrade: null, complexity: null, postcodeZone: null, engineersRequired: 1, certifications: [] };
  }
  return {
    primaryTrade: wo.primary_trade ?? null,
    complexity: wo.complexity_level ?? null,
    postcodeZone: wo.postcode_zone ?? null,
    engineersRequired: Math.max(1, wo.engineers_required ?? 1),
    certifications: wo.certification_tags ?? [],
  };
}

function isCurrentlyAvailable(eng: Engineer, slots: EngineerAvailability[]): { available: boolean | null; note?: string } {
  if (!slots || slots.length === 0) return { available: null }; // unknown — degrade gracefully
  const now = Date.now();
  for (const s of slots) {
    if (s.engineer_id !== eng.id) continue;
    const start = s.start_at ? new Date(s.start_at).getTime() : null;
    const end = s.end_at ? new Date(s.end_at).getTime() : null;
    const inWindow =
      (start == null || start <= now) && (end == null || end >= now);
    if (!inWindow) continue;
    if (s.availability_type === "time_off" || s.availability_type === "unavailable_block") {
      return { available: false, note: s.note ?? "Time off / unavailable" };
    }
    if (s.availability_type === "working_hours") {
      return { available: true };
    }
  }
  return { available: null };
}

export function scoreEngineer(
  eng: Engineer,
  ctx: MatchContext,
  availability: EngineerAvailability[],
  activeAssignments: WorkOrderAssignment[],
): EngineerMatch {
  const reasons: MatchReason[] = [];
  const blockers: MatchReason[] = [];
  let score = 50; // neutral baseline

  if (!eng.active_status) {
    blockers.push({ key: "inactive", label: "Inactive engineer", tone: "warning" });
    score -= 50;
  }

  // Trade fit.
  const trade = norm(ctx.primaryTrade);
  if (trade) {
    const primary = norm(eng.primary_trade);
    const tags = (eng.trade_tags ?? []).map(norm);
    if (primary && primary === trade) {
      reasons.push({ key: "trade_primary", label: `Primary trade ${eng.primary_trade}`, tone: "positive" });
      score += 25;
    } else if (tags.includes(trade)) {
      reasons.push({ key: "trade_secondary", label: `Trade tag ${ctx.primaryTrade}`, tone: "positive" });
      score += 15;
    } else {
      blockers.push({ key: "trade_mismatch", label: `No ${ctx.primaryTrade} trade`, tone: "warning" });
      score -= 20;
    }
  } else {
    reasons.push({ key: "trade_unknown", label: "Trade not specified", tone: "neutral" });
  }

  // Complexity cap.
  if (ctx.complexity) {
    const need = COMPLEXITY_RANK[ctx.complexity] ?? 0;
    const cap = COMPLEXITY_RANK[eng.complexity_cap] ?? 0;
    if (cap >= need) {
      if (cap === need) {
        reasons.push({ key: "complexity_exact", label: `Skill level ${eng.complexity_cap}`, tone: "positive" });
        score += 8;
      } else {
        reasons.push({ key: "complexity_over", label: `Skill cap ${eng.complexity_cap}`, tone: "positive" });
        score += 5;
      }
    } else {
      blockers.push({
        key: "complexity_under",
        label: `Skill cap ${eng.complexity_cap} below ${ctx.complexity}`,
        tone: "warning",
      });
      score -= 25;
    }
  }

  // Zone fit.
  if (ctx.postcodeZone) {
    const zones = (eng.covered_postcode_zones ?? []).map((z) => z.toUpperCase());
    const zoneU = ctx.postcodeZone.toUpperCase();
    if (zones.length === 0) {
      reasons.push({ key: "zone_unknown", label: "No zone coverage set", tone: "neutral" });
    } else if (zones.includes(zoneU)) {
      reasons.push({ key: "zone_match", label: `Covers ${zoneU}`, tone: "positive" });
      score += 15;
    } else {
      // Prefix match (e.g. SW covers SW1, SW2…)
      const prefixHit = zones.some((z) => zoneU.startsWith(z));
      if (prefixHit) {
        reasons.push({ key: "zone_prefix", label: `Adjacent zone (${zoneU})`, tone: "positive" });
        score += 8;
      } else {
        reasons.push({ key: "zone_miss", label: `Outside ${zoneU}`, tone: "warning" });
        score -= 10;
      }
    }
  }

  // Availability.
  const avail = isCurrentlyAvailable(eng, availability);
  if (avail.available === true) {
    reasons.push({ key: "available", label: "Currently available", tone: "positive" });
    score += 8;
  } else if (avail.available === false) {
    blockers.push({ key: "unavailable", label: avail.note ?? "Currently unavailable", tone: "warning" });
    score -= 30;
  } else {
    reasons.push({ key: "availability_unknown", label: "Availability not tracked", tone: "neutral" });
  }

  // Load.
  const load = activeAssignments.filter(
    (a) => a.engineer_id === eng.id && (a.assignment_status === "assigned" || a.assignment_status === "accepted"),
  ).length;
  if (load === 0) {
    reasons.push({ key: "load_free", label: "No open jobs", tone: "positive" });
    score += 4;
  } else if (load <= 2) {
    reasons.push({ key: "load_light", label: `${load} open job${load === 1 ? "" : "s"}`, tone: "neutral" });
  } else if (load <= 4) {
    reasons.push({ key: "load_busy", label: `${load} open jobs`, tone: "warning" });
    score -= 4;
  } else {
    reasons.push({ key: "load_overloaded", label: `${load} open jobs — overloaded`, tone: "warning" });
    score -= 10;
  }

  // Lead/support suitability.
  const leadSuitable = eng.can_lead && eng.active_status && blockers.length === 0;
  const supportSuitable = eng.active_status && !blockers.some((b) => b.key === "unavailable" || b.key === "inactive");

  if (eng.can_lead) {
    reasons.push({ key: "can_lead", label: "Lead-capable", tone: "positive" });
    score += 3;
  }

  // Clamp + classify.
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  let strength: MatchStrength;
  if (blockers.length > 0) strength = "unsuitable";
  else if (score >= 80) strength = "strong";
  else if (score >= 60) strength = "possible";
  else strength = "weak";

  return {
    engineer: eng,
    score,
    strength,
    reasons,
    blockers,
    leadSuitable,
    supportSuitable,
    activeLoad: load,
  };
}

export interface AssignmentSuggestion {
  matches: EngineerMatch[];
  lead: EngineerMatch | null;
  supports: EngineerMatch[];
  context: MatchContext;
  warnings: string[];
}

export function buildAssignmentSuggestion(
  engineers: Engineer[],
  availability: EngineerAvailability[],
  activeAssignments: WorkOrderAssignment[],
  ctx: MatchContext,
): AssignmentSuggestion {
  const matches = engineers
    .map((e) => scoreEngineer(e, ctx, availability, activeAssignments))
    .sort((a, b) => {
      // unsuitable last; then score desc; then lighter load
      const aU = a.strength === "unsuitable" ? 1 : 0;
      const bU = b.strength === "unsuitable" ? 1 : 0;
      if (aU !== bU) return aU - bU;
      if (b.score !== a.score) return b.score - a.score;
      return a.activeLoad - b.activeLoad;
    });

  const suitable = matches.filter((m) => m.strength !== "unsuitable");
  const lead = suitable.find((m) => m.leadSuitable) ?? null;
  const need = Math.max(1, ctx.engineersRequired);
  const supports: EngineerMatch[] = [];
  if (need > 1 && lead) {
    for (const m of suitable) {
      if (m.engineer.id === lead.engineer.id) continue;
      if (!m.supportSuitable) continue;
      supports.push(m);
      if (supports.length >= need - 1) break;
    }
  }

  const warnings: string[] = [];
  if (engineers.length === 0) warnings.push("No engineer profiles configured");
  if (!ctx.primaryTrade) warnings.push("Trade not yet identified — matching by location/availability only");
  if (!lead) warnings.push("No strong lead engineer found — manual selection recommended");
  if (need > 1 && supports.length < need - 1) warnings.push(`Job needs ${need} engineers — only ${supports.length + (lead ? 1 : 0)} suitable found`);

  return { matches, lead, supports, context: ctx, warnings };
}

export const STRENGTH_LABEL: Record<MatchStrength, string> = {
  strong: "Strong fit",
  possible: "Possible fit",
  weak: "Weak fit",
  unsuitable: "Not suitable",
};

export const STRENGTH_TONE: Record<MatchStrength, string> = {
  strong: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700",
  possible: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-700",
  weak: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700",
  unsuitable: "bg-muted text-muted-foreground border-border",
};