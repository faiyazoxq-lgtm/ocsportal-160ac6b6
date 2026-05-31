import { useMemo } from "react";
import type {
  IntakeExtractedFields,
  IntakeRecord,
  IntakeSuggestedCategorization,
} from "@/types/intake";

export type FieldStatus =
  | "ok"
  | "caution"
  | "missing"
  | "edited"
  | "parser_failed";

export interface FieldReviewState {
  key: string;
  label: string;
  status: FieldStatus;
  confidence: number | null;
  value: string | null;
  required: boolean;
  originalValue: string | null;
}

export interface ReviewBlocker {
  key: string;
  label: string;
  message: string;
}

export interface ReviewWarning {
  key: string;
  label: string;
  message: string;
}

export interface ReviewValidation {
  fields: FieldReviewState[];
  blockers: ReviewBlocker[];
  warnings: ReviewWarning[];
  editedCount: number;
  canApprove: boolean;
  nextIssueKey: string | null;
}

const CAUTION_THRESHOLD = 0.6;
const RELIABLE_THRESHOLD = 0.85;

// Fields surfaced to the dispatcher review form, in jump order.
const REVIEW_FIELDS: { key: keyof IntakeExtractedFields; label: string; required?: boolean }[] = [
  { key: "order_no", label: "Order no" },
  { key: "client_name", label: "Client name", required: true },
  { key: "address_line_1", label: "Address", required: true },
  { key: "city", label: "City" },
  { key: "postcode", label: "Postcode", required: true },
  { key: "job_summary", label: "Job summary" },
  { key: "job_description", label: "Description" },
  { key: "contact_name", label: "Contact name" },
  { key: "contact_phone", label: "Contact phone" },
];

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

/**
 * Compute per-field review status, blockers (must-fix before conversion),
 * and warnings (overridable). Pure function of the record + the
 * (possibly dirty) editor state — no network, no side effects.
 */
export function useReviewValidation(opts: {
  record: IntakeRecord | null | undefined;
  extracted: IntakeExtractedFields;
  categorization: IntakeSuggestedCategorization;
  overrideWarnings: boolean;
}): ReviewValidation {
  const { record, extracted, categorization, overrideWarnings } = opts;

  return useMemo<ReviewValidation>(() => {
    if (!record) {
      return {
        fields: [],
        blockers: [],
        warnings: [],
        editedCount: 0,
        canApprove: false,
        nextIssueKey: null,
      };
    }

    const conf = record.extraction_confidence_by_field ?? {};
    const base = (record.extracted_fields_json ?? {}) as Record<string, unknown>;
    const missingFromParser = new Set(record.missing_fields_json ?? []);
    const hasParser = !!record.parser_version;

    const fields: FieldReviewState[] = REVIEW_FIELDS.map((f) => {
      const value = asString((extracted as Record<string, unknown>)[f.key]);
      const originalValue = asString(base[f.key as string]);
      const c = conf[f.key as string];
      const confidence = typeof c === "number" ? c : null;
      const isEdited = hasParser && value !== originalValue;

      let status: FieldStatus;
      if (!value) {
        status = "missing";
      } else if (isEdited) {
        status = "edited";
      } else if (missingFromParser.has(f.key as string) && originalValue === null) {
        status = "parser_failed";
      } else if (confidence === null) {
        status = "ok";
      } else if (confidence >= RELIABLE_THRESHOLD) {
        status = "ok";
      } else if (confidence >= CAUTION_THRESHOLD) {
        status = "caution";
      } else {
        status = "caution";
      }

      return {
        key: f.key as string,
        label: f.label,
        status,
        confidence,
        value,
        required: !!f.required,
        originalValue,
      };
    });

    const blockers: ReviewBlocker[] = [];
    const warnings: ReviewWarning[] = [];

    // --- Hard blockers (required for conversion) ---
    const addr = asString(extracted.address_line_1);
    if (!addr) {
      blockers.push({ key: "address_line_1", label: "Address", message: "Site address required before conversion" });
    }
    const postcode = asString(extracted.postcode);
    if (!postcode) {
      blockers.push({ key: "postcode", label: "Postcode", message: "Postcode required before conversion" });
    }
    const jobText = asString(extracted.job_summary) ?? asString(extracted.job_description);
    if (!jobText) {
      blockers.push({
        key: "job_summary",
        label: "Job description",
        message: "Provide a job summary or description",
      });
    }
    const clientKnown =
      !!asString(extracted.client_name) ||
      !!asString(extracted.client_id) ||
      !!asString(categorization.client_id);
    if (!clientKnown) {
      blockers.push({ key: "client_name", label: "Client", message: "Client/company required before conversion" });
    }

    // --- Soft warnings (overridable) ---
    if (typeof record.parse_confidence === "number" && record.parse_confidence < CAUTION_THRESHOLD) {
      warnings.push({
        key: "parse_confidence",
        label: "Parser",
        message: `Overall parser confidence ${Math.round(record.parse_confidence * 100)}% — review fields below`,
      });
    }
    if (record.parse_error) {
      warnings.push({
        key: "parse_error",
        label: "Parser",
        message: `Parser reported: ${record.parse_error}`,
      });
    }
    if (!asString(categorization.postcode_zone) && postcode) {
      warnings.push({
        key: "postcode_zone",
        label: "Postcode zone",
        message: "Zone not set — dispatch grouping may be imprecise",
      });
    }
    if (!asString(extracted.contact_phone)) {
      warnings.push({
        key: "contact_phone",
        label: "Contact phone",
        message: "No contact phone — engineer may struggle to reach site",
      });
    }
    for (const f of fields) {
      if (f.required) continue;
      if (f.status === "caution" && f.confidence !== null) {
        warnings.push({
          key: f.key,
          label: f.label,
          message: `Low parser confidence (${Math.round(f.confidence * 100)}%) — verify before approval`,
        });
      }
    }

    const editedCount = fields.filter((f) => f.status === "edited").length;

    // Next issue: blockers first, then caution/missing non-required
    const blockerKeys = new Set(blockers.map((b) => b.key));
    let nextIssueKey: string | null = null;
    for (const f of fields) {
      if (blockerKeys.has(f.key)) {
        nextIssueKey = f.key;
        break;
      }
    }
    if (!nextIssueKey) {
      const issue = fields.find((f) => f.status === "caution" || f.status === "parser_failed");
      nextIssueKey = issue?.key ?? null;
    }

    const canApprove = blockers.length === 0 && (warnings.length === 0 || overrideWarnings);

    return {
      fields,
      blockers,
      warnings,
      editedCount,
      canApprove,
      nextIssueKey,
    };
  }, [record, extracted, categorization, overrideWarnings]);
}