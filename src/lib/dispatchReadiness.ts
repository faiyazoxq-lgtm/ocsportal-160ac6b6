import type { IntakeRecord } from "@/types/intake";

export type DispatchReadinessStatus =
  | "ready"
  | "needs_review"
  | "blocked"
  | "duplicate_pending"
  | "parse_failed"
  | "incomplete"
  | "converted"
  | "rejected";

export interface ReadinessIssue {
  key: string;
  label: string;
  message: string;
}

export interface DispatchReadiness {
  status: DispatchReadinessStatus;
  score: number; // 0..100
  readyForConversion: boolean;
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
  priorityRank: number; // smaller = more urgent for sort
}

const PARSE_OK = 0.6;
const PARSE_STRONG = 0.85;

function s(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t.length === 0 ? null : t;
}

function priorityWeight(p: string | null | undefined): number {
  switch (p) {
    case "urgent":
      return 0;
    case "high":
      return 1;
    case "normal":
      return 2;
    case "low":
      return 3;
    default:
      return 2;
  }
}

function statusWeight(st: DispatchReadinessStatus): number {
  // Smaller = sort earlier (more actionable first).
  switch (st) {
    case "ready":
      return 0;
    case "duplicate_pending":
      return 1;
    case "needs_review":
      return 2;
    case "incomplete":
      return 3;
    case "parse_failed":
      return 4;
    case "blocked":
      return 5;
    case "rejected":
      return 8;
    case "converted":
      return 9;
  }
}

/**
 * Pure derivation of dispatch-readiness from an intake record. No I/O.
 * Reuses the same signals as useReviewValidation but operates without the
 * draft editor state so it can run for any row in the queue.
 */
export function computeDispatchReadiness(record: IntakeRecord): DispatchReadiness {
  const blockers: ReadinessIssue[] = [];
  const warnings: ReadinessIssue[] = [];

  const ex = record.extracted_fields_json ?? {};
  const cat = record.suggested_categorization_json ?? {};

  // Terminal states first.
  if (record.parse_status === "converted") {
    return {
      status: "converted",
      score: 100,
      readyForConversion: false,
      blockers,
      warnings,
      priorityRank: 9000,
    };
  }
  if (record.parse_status === "rejected") {
    return {
      status: "rejected",
      score: 0,
      readyForConversion: false,
      blockers: [{ key: "rejected", label: "Rejected", message: record.rejection_reason ?? "Intake rejected" }],
      warnings,
      priorityRank: 9500,
    };
  }

  // Parse failures.
  const parseFailed =
    !!record.parse_error ||
    record.capture_status === "failed" ||
    (record.parser_version != null && record.parsing_completed_at == null && !!record.parsing_started_at && !record.extracted_text);
  if (parseFailed) {
    blockers.push({
      key: "parse_error",
      label: "Parser",
      message: record.parse_error ?? "Parser did not complete — re-run parser",
    });
  }

  // Critical fields.
  if (!s(ex.address_line_1)) {
    blockers.push({ key: "address_line_1", label: "Address", message: "Site address required" });
  }
  if (!s(ex.postcode)) {
    blockers.push({ key: "postcode", label: "Postcode", message: "Postcode required" });
  }
  if (!s(ex.job_summary) && !s(ex.job_description)) {
    blockers.push({ key: "job_summary", label: "Job", message: "Job summary or description required" });
  }
  const clientKnown = !!s(ex.client_name) || !!s(ex.client_id) || !!s(cat.client_id);
  if (!clientKnown) {
    blockers.push({ key: "client_name", label: "Client", message: "Client/company required" });
  }

  // Duplicate gating.
  const dupCount = record.duplicate_candidates_json?.length ?? 0;
  const dupOpen =
    (record.duplicate_review_status === "open" || record.duplicate_review_status == null) &&
    dupCount > 0;
  const topDup = (record.duplicate_candidates_json ?? []).reduce(
    (m, c) => Math.max(m, c.score ?? 0),
    0,
  );
  if (dupOpen && topDup >= 0.5) {
    blockers.push({
      key: "duplicate",
      label: "Duplicate",
      message: `${dupCount} possible match${dupCount === 1 ? "" : "es"} — resolve before conversion`,
    });
  } else if (dupOpen) {
    warnings.push({
      key: "duplicate_weak",
      label: "Duplicate",
      message: `${dupCount} weak match${dupCount === 1 ? "" : "es"} pending review`,
    });
  }

  // Confidence warnings.
  if (typeof record.parse_confidence === "number" && record.parse_confidence < PARSE_OK) {
    warnings.push({
      key: "parse_confidence",
      label: "Parser",
      message: `Parser confidence ${Math.round(record.parse_confidence * 100)}%`,
    });
  }
  if ((record.parsing_issues_json?.length ?? 0) > 0) {
    warnings.push({
      key: "parsing_issues",
      label: "Parser",
      message: `${record.parsing_issues_json.length} parser note${record.parsing_issues_json.length === 1 ? "" : "s"}`,
    });
  }

  // Normalization signals.
  const normWarnings = record.normalization_warnings_json ?? [];
  if (normWarnings.length > 0) {
    warnings.push({
      key: "normalization",
      label: "Normalization",
      message: `${normWarnings.length} normalization warning${normWarnings.length === 1 ? "" : "s"}`,
    });
  } else if (
    record.normalization_version == null &&
    (s(ex.postcode) || s(ex.client_name))
  ) {
    warnings.push({
      key: "normalization_missing",
      label: "Normalization",
      message: "Normalization not yet applied",
    });
  }

  // Zone hint.
  if (!s(cat.postcode_zone) && s(ex.postcode)) {
    warnings.push({
      key: "postcode_zone",
      label: "Zone",
      message: "Postcode zone not set — dispatch grouping may be imprecise",
    });
  }

  // Classify status.
  let status: DispatchReadinessStatus;
  if (parseFailed) {
    status = "parse_failed";
  } else if (blockers.some((b) => b.key === "duplicate")) {
    status = "duplicate_pending";
  } else if (
    blockers.some((b) =>
      ["address_line_1", "postcode", "job_summary", "client_name"].includes(b.key),
    )
  ) {
    status = "incomplete";
  } else if (blockers.length > 0) {
    status = "blocked";
  } else if (warnings.length > 0) {
    status = "needs_review";
  } else {
    status = "ready";
  }

  // Score: start from 100, subtract for blockers/warnings, weight by parse confidence.
  let score = 100;
  score -= blockers.length * 20;
  score -= warnings.length * 6;
  if (typeof record.parse_confidence === "number") {
    if (record.parse_confidence < PARSE_OK) score -= 15;
    else if (record.parse_confidence < PARSE_STRONG) score -= 5;
  }
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  // Priority rank: status bucket, then urgency, then age (older first).
  const ageMs = Date.now() - new Date(record.received_at ?? record.created_at).getTime();
  const ageHours = Math.max(0, ageMs / 3_600_000);
  const priorityRank =
    statusWeight(status) * 1000 +
    priorityWeight(cat.priority_level ?? null) * 100 -
    Math.min(ageHours, 99); // older boosts priority slightly

  return {
    status,
    score,
    readyForConversion: status === "ready",
    blockers,
    warnings,
    priorityRank,
  };
}

export const READINESS_LABEL: Record<DispatchReadinessStatus, string> = {
  ready: "Ready",
  needs_review: "Needs review",
  incomplete: "Incomplete",
  duplicate_pending: "Duplicate pending",
  parse_failed: "Parse failed",
  blocked: "Blocked",
  converted: "Converted",
  rejected: "Rejected",
};

export const READINESS_TONE: Record<DispatchReadinessStatus, string> = {
  ready: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700",
  needs_review: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700",
  incomplete: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-700",
  duplicate_pending: "bg-red-100 text-red-900 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700",
  parse_failed: "bg-red-100 text-red-900 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700",
  blocked: "bg-destructive/10 text-destructive border-destructive/40",
  converted: "bg-muted text-muted-foreground border-border",
  rejected: "bg-muted text-muted-foreground border-border line-through",
};