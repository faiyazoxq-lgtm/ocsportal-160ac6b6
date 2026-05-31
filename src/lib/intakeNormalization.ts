import type { IntakeExtractedFields, IntakeSuggestedCategorization } from "@/types/intake";

export const NORMALIZATION_VERSION = "norm-v1";

export interface NormalizedAddress {
  line_1: string | null;
  city: string | null;
  postcode: string | null;
  postcode_zone: string | null;
}

export interface NormalizedIntakeFields {
  client_name: string | null;
  client_id_suggested: string | null;
  address: NormalizedAddress;
  contact_phone: string | null;
  job_type: string | null;
  complexity_level: "basic" | "intermediate" | "advanced" | null;
}

export type NormalizationWarningSeverity = "info" | "warn";

export interface NormalizationWarning {
  field:
    | "client_name"
    | "address_line_1"
    | "postcode"
    | "postcode_zone"
    | "contact_phone"
    | "primary_trade"
    | "complexity_level";
  severity: NormalizationWarningSeverity;
  message: string;
}

export interface NormalizationPreview {
  version: string;
  normalized: NormalizedIntakeFields;
  warnings: NormalizationWarning[];
  changed: Partial<Record<NormalizationWarning["field"], { from: string | null; to: string | null }>>;
}

// --- helpers ---

function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase())
    .replace(/\b(Of|The|And|On|In|At)\b/g, (m) => m.toLowerCase());
}

// --- Postcode (UK) ---

const UK_POSTCODE_RE = /^([A-PR-UWYZ][A-HK-Y]?[0-9][0-9A-HJKPSTUW]?)\s*([0-9][ABD-HJLNP-UW-Z]{2})$/i;

export function normalizePostcode(raw: string | null | undefined): { value: string | null; valid: boolean } {
  if (!raw) return { value: null, valid: false };
  const cleaned = raw.replace(/\s+/g, "").toUpperCase();
  const m = cleaned.match(/^([A-Z]{1,2}[0-9][0-9A-Z]?)([0-9][A-Z]{2})$/);
  if (!m) return { value: collapseWs(raw).toUpperCase() || null, valid: false };
  const value = `${m[1]} ${m[2]}`;
  return { value, valid: UK_POSTCODE_RE.test(value) };
}

export function derivePostcodeZone(normalizedPostcode: string | null): string | null {
  if (!normalizedPostcode) return null;
  const outward = normalizedPostcode.split(" ")[0] ?? "";
  // Outward = area letters + district digits. Zone = area letters + first district digit.
  const m = outward.match(/^([A-Z]{1,2})([0-9][A-Z0-9]?)$/);
  if (!m) return outward || null;
  return `${m[1]}${m[2].charAt(0)}`;
}

// --- Phone (UK-leaning, lightweight) ---

export function normalizePhone(raw: string | null | undefined): { value: string | null; valid: boolean } {
  if (!raw) return { value: null, valid: false };
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return { value: null, valid: false };
  // +44 prefix handling
  let national = digits;
  if (digits.startsWith("+44")) national = "0" + digits.slice(3);
  else if (digits.startsWith("0044")) national = "0" + digits.slice(4);
  if (!national.startsWith("0")) {
    return { value: digits, valid: false };
  }
  // Format common UK shapes
  if (national.length === 11 && national.startsWith("07")) {
    return { value: `${national.slice(0, 5)} ${national.slice(5, 8)} ${national.slice(8)}`, valid: true };
  }
  if (national.length === 11 && (national.startsWith("020") || national.startsWith("011") || national.startsWith("013"))) {
    return { value: `${national.slice(0, 3)} ${national.slice(3, 7)} ${national.slice(7)}`, valid: true };
  }
  if (national.length >= 10 && national.length <= 12) {
    return { value: national, valid: true };
  }
  return { value: national, valid: false };
}

// --- Client name ---

const CLIENT_SUFFIX_RE = /\b(ltd\.?|limited|llp|plc|inc\.?|gmbh|the)\b/gi;

export function canonicalClientKey(name: string): string {
  return name
    .toLowerCase()
    .replace(CLIENT_SUFFIX_RE, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ClientLite {
  id: string;
  client_name: string;
}

export function normalizeClient(
  raw: string | null | undefined,
  clients: ClientLite[],
): { display: string | null; matchedId: string | null; ambiguous: boolean } {
  if (!raw || !raw.trim()) return { display: null, matchedId: null, ambiguous: false };
  const display = collapseWs(raw);
  const key = canonicalClientKey(display);
  if (!key) return { display, matchedId: null, ambiguous: false };
  const matches = clients.filter((c) => canonicalClientKey(c.client_name) === key);
  if (matches.length === 1) {
    return { display: matches[0].client_name, matchedId: matches[0].id, ambiguous: false };
  }
  if (matches.length > 1) {
    return { display: matches[0].client_name, matchedId: matches[0].id, ambiguous: true };
  }
  // Fuzzy contains
  const contains = clients.filter((c) => {
    const ck = canonicalClientKey(c.client_name);
    return ck && (ck.includes(key) || key.includes(ck));
  });
  if (contains.length === 1) {
    return { display: contains[0].client_name, matchedId: contains[0].id, ambiguous: false };
  }
  return { display, matchedId: null, ambiguous: contains.length > 1 };
}

// --- Address ---

export function normalizeAddressLine(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = collapseWs(raw.replace(/[,;]+/g, ", "));
  if (!cleaned) return null;
  return titleCase(cleaned).replace(/\bUk\b/g, "UK");
}

export function normalizeCity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = collapseWs(raw);
  if (!cleaned) return null;
  return titleCase(cleaned);
}

// --- Trade / job type ---

const TRADE_MAP: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: "plumbing", patterns: [/plumb/i, /\btap\b/i, /leak/i, /pipe/i, /waste/i, /sink/i, /toilet/i, /wc\b/i] },
  { canonical: "heating", patterns: [/boiler/i, /radiator/i, /heating/i, /immersion/i, /thermostat/i] },
  { canonical: "gas", patterns: [/\bgas\b/i, /gas safe/i] },
  { canonical: "electrical", patterns: [/electric/i, /rcd/i, /consumer unit/i, /socket/i, /downlight/i, /lighting/i] },
  { canonical: "drainage", patterns: [/drain/i, /sewer/i, /blockage/i] },
  { canonical: "damp-mould", patterns: [/damp/i, /mould/i, /mold/i, /condensation/i] },
  { canonical: "carpentry", patterns: [/carpent/i, /joinery/i, /door/i, /window frame/i] },
  { canonical: "painting", patterns: [/paint/i, /decorat/i] },
  { canonical: "plastering", patterns: [/plaster/i, /skim/i] },
  { canonical: "roofing", patterns: [/roof/i, /tile/i, /gutter/i] },
  { canonical: "multi-trade", patterns: [/multi/i, /handyman/i, /snag/i, /general/i] },
];

export const CANONICAL_TRADES = TRADE_MAP.map((t) => t.canonical);

export function normalizeTrade(
  raw: string | null | undefined,
  jobText?: string | null,
): { value: string | null; matched: boolean; ambiguous: boolean } {
  const combined = `${raw ?? ""} ${jobText ?? ""}`.trim();
  if (!combined) return { value: null, matched: false, ambiguous: false };
  if (raw) {
    const exact = TRADE_MAP.find((t) => t.canonical.toLowerCase() === raw.trim().toLowerCase());
    if (exact) return { value: exact.canonical, matched: true, ambiguous: false };
  }
  const hits = TRADE_MAP.filter((t) => t.patterns.some((p) => p.test(combined)));
  if (hits.length === 1) return { value: hits[0].canonical, matched: true, ambiguous: false };
  if (hits.length > 1) {
    // Prefer the one that matches the explicit raw token, else first hit
    if (raw) {
      const inRaw = hits.find((t) => t.patterns.some((p) => p.test(raw)));
      if (inRaw) return { value: inRaw.canonical, matched: true, ambiguous: true };
    }
    return { value: hits[0].canonical, matched: true, ambiguous: true };
  }
  return { value: raw ? collapseWs(raw).toLowerCase() : null, matched: false, ambiguous: false };
}

// --- Complexity (mostly pass-through, sanitize unknown) ---

const COMPLEXITIES = ["basic", "intermediate", "advanced"] as const;
export function normalizeComplexity(raw: string | null | undefined): "basic" | "intermediate" | "advanced" | null {
  if (!raw) return null;
  const v = raw.toLowerCase().trim();
  if ((COMPLEXITIES as readonly string[]).includes(v)) return v as "basic" | "intermediate" | "advanced";
  if (/easy|simple|minor/.test(v)) return "basic";
  if (/medium|standard/.test(v)) return "intermediate";
  if (/complex|hard|major|urgent/.test(v)) return "advanced";
  return null;
}

// --- Top-level computation ---

export function computeNormalizationPreview(args: {
  extracted: IntakeExtractedFields;
  categorization: IntakeSuggestedCategorization;
  clients: ClientLite[];
}): NormalizationPreview {
  const { extracted: ex, categorization: cat, clients } = args;
  const warnings: NormalizationWarning[] = [];
  const changed: NormalizationPreview["changed"] = {};

  // Client
  const client = normalizeClient(ex.client_name, clients);
  if (client.ambiguous) {
    warnings.push({
      field: "client_name",
      severity: "warn",
      message: "Multiple clients match — confirm before conversion.",
    });
  } else if (ex.client_name && !client.matchedId) {
    warnings.push({
      field: "client_name",
      severity: "info",
      message: "No existing client matched — will use raw name on conversion.",
    });
  }
  if ((ex.client_name ?? null) !== (client.display ?? null)) {
    changed.client_name = { from: ex.client_name ?? null, to: client.display };
  }

  // Address
  const line1 = normalizeAddressLine(ex.address_line_1);
  const city = normalizeCity(ex.city);
  if ((ex.address_line_1 ?? null) !== (line1 ?? null)) {
    changed.address_line_1 = { from: ex.address_line_1 ?? null, to: line1 };
  }

  // Postcode
  const pc = normalizePostcode(ex.postcode);
  if (!pc.valid && ex.postcode) {
    warnings.push({
      field: "postcode",
      severity: "warn",
      message: "Postcode could not be validated as a UK format.",
    });
  }
  if ((ex.postcode ?? null) !== (pc.value ?? null)) {
    changed.postcode = { from: ex.postcode ?? null, to: pc.value };
  }

  // Zone
  const derivedZone = derivePostcodeZone(pc.value);
  const existingZone = cat.postcode_zone ?? ex.postcode_zone ?? null;
  const zone = derivedZone ?? existingZone;
  if (existingZone && derivedZone && existingZone.toUpperCase() !== derivedZone) {
    warnings.push({
      field: "postcode_zone",
      severity: "info",
      message: `Existing zone "${existingZone}" replaced by derived "${derivedZone}".`,
    });
  }
  if ((existingZone ?? null) !== (zone ?? null)) {
    changed.postcode_zone = { from: existingZone, to: zone };
  }

  // Phone
  const ph = normalizePhone(ex.contact_phone);
  if (ex.contact_phone && !ph.valid) {
    warnings.push({
      field: "contact_phone",
      severity: "info",
      message: "Phone could not be parsed as a standard UK number.",
    });
  }
  if ((ex.contact_phone ?? null) !== (ph.value ?? null)) {
    changed.contact_phone = { from: ex.contact_phone ?? null, to: ph.value };
  }

  // Trade
  const jobText = `${ex.job_summary ?? ""} ${ex.job_description ?? ""}`;
  const trade = normalizeTrade(cat.primary_trade, jobText);
  if (trade.ambiguous) {
    warnings.push({
      field: "primary_trade",
      severity: "warn",
      message: "Multiple trade keywords detected — confirm primary trade.",
    });
  } else if (cat.primary_trade && !trade.matched) {
    warnings.push({
      field: "primary_trade",
      severity: "info",
      message: `"${cat.primary_trade}" did not map to a known trade.`,
    });
  }
  if ((cat.primary_trade ?? null) !== (trade.value ?? null)) {
    changed.primary_trade = { from: cat.primary_trade ?? null, to: trade.value };
  }

  // Complexity
  const complexity = normalizeComplexity(cat.complexity_level);
  if (cat.complexity_level && !complexity) {
    warnings.push({
      field: "complexity_level",
      severity: "info",
      message: `Complexity "${cat.complexity_level}" not recognised.`,
    });
  }
  if ((cat.complexity_level ?? null) !== (complexity ?? null)) {
    changed.complexity_level = { from: cat.complexity_level ?? null, to: complexity };
  }

  return {
    version: NORMALIZATION_VERSION,
    normalized: {
      client_name: client.display,
      client_id_suggested: client.matchedId,
      address: { line_1: line1, city, postcode: pc.value, postcode_zone: zone },
      contact_phone: ph.value,
      job_type: trade.value,
      complexity_level: complexity,
    },
    warnings,
    changed,
  };
}