import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({ intakeId: z.string().uuid() });

type Strength = "strong" | "possible" | "weak";

interface Candidate {
  target_type: "work_order" | "intake_record";
  work_order_id: string;
  order_no: string;
  score: number;
  match_strength: Strength;
  reasons: string[];
  matched_at: string | null;
}

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
function normPostcode(p: string | null | undefined): string {
  return (p ?? "").toUpperCase().replace(/\s+/g, "");
}
function tokens(s: string | null | undefined): Set<string> {
  const STOP = new Set(["the","a","and","of","to","at","in","is","on","for","with","no","not"]);
  return new Set(
    norm(s).split(" ").filter((t) => t.length > 2 && !STOP.has(t)),
  );
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => { if (b.has(t)) inter++; });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
function strengthOf(score: number): Strength {
  if (score >= 0.8) return "strong";
  if (score >= 0.5) return "possible";
  return "weak";
}

interface SourceLike {
  id: string;
  order_no: string | null;
  client_id?: string | null;
  client_name?: string | null;
  address_line_1: string | null;
  postcode: string | null;
  job_summary: string | null;
  job_description: string | null;
  contact_phone?: string | null;
  source_subject?: string | null;
  original_filename?: string | null;
  created_at: string;
}

function scoreAgainst(
  src: SourceLike,
  cand: SourceLike,
  opts: { recentMs: number },
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Same order number — very strong
  if (src.order_no && cand.order_no && norm(src.order_no) === norm(cand.order_no)) {
    score = Math.max(score, 0.95);
    reasons.push("same order number");
  }

  const sPc = normPostcode(src.postcode);
  const cPc = normPostcode(cand.postcode);
  const samePostcode = sPc.length > 0 && sPc === cPc;

  const sAddr = norm(src.address_line_1);
  const cAddr = norm(cand.address_line_1);
  const addrSim = sAddr && cAddr ? jaccard(tokens(sAddr), tokens(cAddr)) : 0;

  if (samePostcode && addrSim >= 0.6) {
    score = Math.max(score, 0.88);
    reasons.push("same postcode + matching address");
  } else if (samePostcode && addrSim >= 0.3) {
    score = Math.max(score, 0.65);
    reasons.push("same postcode + similar address");
  } else if (samePostcode) {
    score = Math.max(score, 0.45);
    reasons.push("same postcode");
  } else if (addrSim >= 0.7) {
    score = Math.max(score, 0.55);
    reasons.push("similar address");
  }

  // Client match (by id preferred, else name)
  const sameClient =
    (!!src.client_id && src.client_id === cand.client_id) ||
    (!!src.client_name && norm(src.client_name) === norm(cand.client_name));
  if (sameClient && samePostcode) {
    score = Math.max(score, 0.7);
    if (!reasons.includes("same client + postcode")) reasons.push("same client + postcode");
  } else if (sameClient) {
    reasons.push("same client");
    score += 0.1;
  }

  // Job text similarity
  const jobSim = jaccard(
    tokens(`${src.job_summary ?? ""} ${src.job_description ?? ""}`),
    tokens(`${cand.job_summary ?? ""} ${cand.job_description ?? ""}`),
  );
  if (jobSim >= 0.6) {
    score = Math.max(score, 0.7);
    reasons.push("very similar job text");
  } else if (jobSim >= 0.35) {
    score += 0.1;
    reasons.push("similar job text");
  }

  // Contact phone match
  const sPhone = (src.contact_phone ?? "").replace(/\D+/g, "");
  const cPhone = (cand.contact_phone ?? "").replace(/\D+/g, "");
  if (sPhone.length >= 7 && sPhone === cPhone) {
    score = Math.max(score, 0.75);
    reasons.push("same contact phone");
  }

  // Source subject / filename match (intake-only)
  if (src.source_subject && cand.source_subject && norm(src.source_subject) === norm(cand.source_subject)) {
    score += 0.1;
    reasons.push("same source subject");
  }
  if (src.original_filename && cand.original_filename && norm(src.original_filename) === norm(cand.original_filename)) {
    score += 0.1;
    reasons.push("same source file");
  }

  // Timing proximity boost
  const dt = Math.abs(new Date(src.created_at).getTime() - new Date(cand.created_at).getTime());
  if (dt <= opts.recentMs && score > 0.3) {
    score += 0.05;
    reasons.push("recent timing");
  }

  return { score: Math.min(score, 1), reasons };
}

export const detectIntakeDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roleRow, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "dispatcher")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) throw new Error("Only dispatchers can run duplicate detection");

    const { data: rec, error: recErr } = await supabase
      .from("intake_records")
      .select("*")
      .eq("id", data.intakeId)
      .maybeSingle();
    if (recErr) throw new Error(recErr.message);
    if (!rec) throw new Error("Intake record not found");

    const ex = (rec.extracted_fields_json ?? {}) as Record<string, string | null>;
    const src: SourceLike = {
      id: rec.id,
      order_no: ex.order_no ?? null,
      client_id: (rec.suggested_categorization_json as Record<string, string> | null)?.client_id ?? null,
      client_name: ex.client_name ?? null,
      address_line_1: ex.address_line_1 ?? null,
      postcode: ex.postcode ?? null,
      job_summary: ex.job_summary ?? null,
      job_description: ex.job_description ?? null,
      contact_phone: ex.contact_phone ?? null,
      source_subject: rec.source_subject ?? null,
      original_filename: rec.original_filename ?? null,
      created_at: rec.created_at,
    };

    // Pull recent work orders (last 120 days) — limited set for matching
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString();
    const { data: wos } = await supabase
      .from("work_orders")
      .select(
        "id, order_no, client_id, address_line_1, postcode, job_summary, job_description, created_at",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    // Pull other intake records still in pipeline
    const { data: others } = await supabase
      .from("intake_records")
      .select(
        "id, extracted_fields_json, source_subject, original_filename, created_at, parse_status",
      )
      .neq("id", rec.id)
      .in("parse_status", ["received", "parsing", "parsed", "needs_review", "duplicate_suspected", "approved"])
      .order("created_at", { ascending: false })
      .limit(200);

    const RECENT_MS = 1000 * 60 * 60 * 24 * 7;
    const candidates: Candidate[] = [];

    for (const w of wos ?? []) {
      const { score, reasons } = scoreAgainst(
        src,
        {
          id: w.id,
          order_no: w.order_no,
          client_id: w.client_id,
          address_line_1: w.address_line_1,
          postcode: w.postcode,
          job_summary: w.job_summary,
          job_description: w.job_description,
          created_at: w.created_at,
        },
        { recentMs: RECENT_MS },
      );
      if (score >= 0.45) {
        candidates.push({
          target_type: "work_order",
          work_order_id: w.id,
          order_no: w.order_no ?? "—",
          score,
          match_strength: strengthOf(score),
          reasons,
          matched_at: w.created_at,
        });
      }
    }

    for (const o of others ?? []) {
      const oex = (o.extracted_fields_json ?? {}) as Record<string, string | null>;
      const { score, reasons } = scoreAgainst(
        src,
        {
          id: o.id,
          order_no: oex.order_no ?? null,
          client_name: oex.client_name ?? null,
          address_line_1: oex.address_line_1 ?? null,
          postcode: oex.postcode ?? null,
          job_summary: oex.job_summary ?? null,
          job_description: oex.job_description ?? null,
          contact_phone: oex.contact_phone ?? null,
          source_subject: o.source_subject ?? null,
          original_filename: o.original_filename ?? null,
          created_at: o.created_at,
        },
        { recentMs: RECENT_MS },
      );
      if (score >= 0.5) {
        candidates.push({
          target_type: "intake_record",
          work_order_id: o.id,
          order_no: oex.order_no ?? `intake ${o.id.slice(0, 6)}`,
          score,
          match_strength: strengthOf(score),
          reasons,
          matched_at: o.created_at,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const top = candidates.slice(0, 10);
    const topScore = top[0]?.score ?? 0;
    const aggregateReasons = Array.from(
      new Set(top.flatMap((c) => c.reasons)),
    ).slice(0, 8);

    const hasStrong = top.some((c) => c.match_strength === "strong");
    const reviewStatus =
      top.length === 0
        ? "none"
        : rec.duplicate_review_status === "confirmed" ||
            rec.duplicate_review_status === "dismissed" ||
            rec.duplicate_review_status === "linked"
          ? rec.duplicate_review_status
          : "open";

    const nextParseStatus =
      hasStrong && reviewStatus === "open" && rec.parse_status !== "converted" && rec.parse_status !== "rejected"
        ? "duplicate_suspected"
        : rec.parse_status === "duplicate_suspected" && !hasStrong
          ? "needs_review"
          : rec.parse_status;

    const { error: upErr } = await supabase
      .from("intake_records")
      .update({
        duplicate_candidates_json: top as never,
        duplicate_rationale_json: aggregateReasons as never,
        duplicate_confidence: topScore,
        duplicate_review_status: reviewStatus,
        duplicate_scanned_at: new Date().toISOString(),
        parse_status: nextParseStatus,
      })
      .eq("id", rec.id);
    if (upErr) throw new Error(upErr.message);

    await supabase.from("parsing_review_actions").insert({
      intake_record_id: rec.id,
      reviewer_profile_id: userId,
      action_type: "duplicate_scan",
      previous_values_json: {
        duplicate_confidence: rec.duplicate_confidence,
        duplicate_review_status: rec.duplicate_review_status,
      } as never,
      next_values_json: {
        candidate_count: top.length,
        top_score: topScore,
        review_status: reviewStatus,
      } as never,
      note: `Scanned ${(wos?.length ?? 0) + (others?.length ?? 0)} records · ${top.length} candidate(s)`,
    });

    return { ok: true, candidates: top, topScore, reviewStatus };
  });

const ResolveInput = z.object({
  intakeId: z.string().uuid(),
  decision: z.enum(["dismissed", "confirmed", "linked"]),
  workOrderId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
});

export const resolveDuplicateReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResolveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "dispatcher")
      .maybeSingle();
    if (!roleRow) throw new Error("Only dispatchers can resolve duplicate reviews");

    const { data: rec, error: recErr } = await supabase
      .from("intake_records")
      .select("id, parse_status, duplicate_review_status")
      .eq("id", data.intakeId)
      .maybeSingle();
    if (recErr) throw new Error(recErr.message);
    if (!rec) throw new Error("Intake record not found");

    const patch: Record<string, unknown> = {
      duplicate_review_status: data.decision,
      duplicate_resolved_at: new Date().toISOString(),
      duplicate_resolved_by: userId,
    };

    if (data.decision === "dismissed") {
      // Move back to parsed/needs_review depending on prior state
      if (rec.parse_status === "duplicate_suspected") {
        patch.parse_status = "needs_review";
      }
    } else if (data.decision === "confirmed" || data.decision === "linked") {
      patch.parse_status = "rejected";
      patch.rejection_reason = data.decision === "linked"
        ? `Linked duplicate of ${data.workOrderId ?? "existing record"}`
        : "Confirmed duplicate";
      patch.reviewed_by = userId;
      patch.reviewed_at = new Date().toISOString();
      if (data.workOrderId) patch.converted_work_order_id = data.workOrderId;
    }

    const { error: upErr } = await supabase
      .from("intake_records")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", rec.id);
    if (upErr) throw new Error(upErr.message);

    await supabase.from("parsing_review_actions").insert({
      intake_record_id: rec.id,
      reviewer_profile_id: userId,
      action_type: `duplicate_${data.decision}`,
      previous_values_json: {
        parse_status: rec.parse_status,
        duplicate_review_status: rec.duplicate_review_status,
      } as never,
      next_values_json: {
        decision: data.decision,
        work_order_id: data.workOrderId ?? null,
      } as never,
      note: data.note ?? null,
    });

    return { ok: true };
  });