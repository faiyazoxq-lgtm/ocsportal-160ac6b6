import type { IntakeRecord } from "@/types/intake";
import { Phone, CheckCircle2, Split, Eye, XCircle } from "lucide-react";

interface ValidationLike {
  blockers: Array<{ key: string; label: string; message: string }>;
  warnings: Array<{ key: string; label: string; message: string }>;
  canApprove: boolean;
}

interface Props {
  record: IntakeRecord;
  validation: ValidationLike;
}

/**
 * Compact, read-only guidance bar shown above the conversion actions in the
 * intake review drawer. Tells dispatcher/boss the recommended next action
 * based on extraction state, missing fields, and multi-candidate context.
 * The actual buttons (Save, Reject, Approve & convert) remain unchanged
 * below — this only signals which one is appropriate right now.
 */
export function IntakeNextActionsBar({ record, validation }: Props) {
  const payload = (record.raw_payload_json ?? {}) as {
    work_orders_total?: number;
    work_order_index?: number | null;
    ai_scanned_attachments?: number;
    recovered?: boolean;
  };
  const total = payload.work_orders_total ?? 1;
  const phone = record.extracted_fields_json?.contact_phone;

  const items: Array<{
    key: string;
    icon: typeof Phone;
    label: string;
    detail: string;
    tone: "primary" | "warn" | "muted" | "ok";
  }> = [];

  if (validation.blockers.length > 0) {
    items.push({
      key: "verify",
      icon: Phone,
      label: phone ? `Verify by phone (${phone})` : "Verify by phone/email",
      detail: `${validation.blockers.length} blocker${validation.blockers.length === 1 ? "" : "s"} — confirm with client before dispatch.`,
      tone: "warn",
    });
    items.push({
      key: "review",
      icon: Eye,
      label: "Keep in review",
      detail: "Save edits as you confirm details; leave in needs_review until complete.",
      tone: "muted",
    });
  } else if (!validation.canApprove) {
    items.push({
      key: "warn",
      icon: Eye,
      label: "Acknowledge warnings",
      detail: `${validation.warnings.length} soft warning${validation.warnings.length === 1 ? "" : "s"} — review and override to approve.`,
      tone: "warn",
    });
  } else {
    items.push({
      key: "convert",
      icon: CheckCircle2,
      label: "Create work order",
      detail: "Approve & convert moves this into Awaiting Dispatch.",
      tone: "ok",
    });
  }

  if (total > 1) {
    items.push({
      key: "split",
      icon: Split,
      label: `Multi-job email (${payload.work_order_index ?? "?"} of ${total})`,
      detail: "Each candidate is a separate intake row — verify and convert each one independently.",
      tone: "primary",
    });
  }

  if (record.parse_status === "rejected") {
    items.length = 0;
    items.push({
      key: "rejected",
      icon: XCircle,
      label: "Already rejected",
      detail: record.rejection_reason ?? "No reason recorded.",
      tone: "muted",
    });
  }

  if (items.length === 0) return null;

  const toneClass: Record<typeof items[number]["tone"], string> = {
    primary: "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-200",
    warn: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200",
    ok: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200",
    muted: "border-border bg-muted/40 text-muted-foreground",
  };

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Suggested next actions
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li
              key={it.key}
              className={`flex items-start gap-2 rounded-sm border px-2 py-1.5 text-xs ${toneClass[it.tone]}`}
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium">{it.label}</div>
                <div className="text-[11px] opacity-80">{it.detail}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}