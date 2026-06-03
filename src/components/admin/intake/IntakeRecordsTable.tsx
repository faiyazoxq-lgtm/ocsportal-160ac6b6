import type { IntakeRecord } from "@/types/intake";
import { ParseConfidenceBadge } from "./ParseConfidenceBadge";
import { IntakeChannelBadge } from "./IntakeChannelBadge";
import { DuplicateStatusBadge } from "./DuplicateStatusBadge";
import { DispatchReadinessBadge } from "./DispatchReadinessBadge";
import { QueuePriorityChip } from "./QueuePriorityChip";
import { computeDispatchReadiness } from "@/lib/dispatchReadiness";
import { Paperclip, LifeBuoy, RotateCw, Layers, Sparkles, Trash2, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PotentialWorkOrderCountBadge } from "./PotentialWorkOrderCountBadge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { deleteIntakeRecord } from "@/lib/gmail.functions";
import { getIntakePdf } from "@/lib/intakePdf.functions";
import { toast } from "sonner";

interface Props {
  rows: IntakeRecord[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRowClick: (id: string) => void;
}

const STATE_TONE: Record<string, string> = {
  received: "bg-muted text-muted-foreground",
  parsing: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  parsed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  needs_review: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  duplicate_suspected: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200",
  approved: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-200",
  rejected: "bg-muted text-muted-foreground line-through",
  converted: "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200",
};

export function IntakeRecordsTable({ rows, isLoading, error, onRowClick }: Props) {
  const qc = useQueryClient();
  const deleteFn = useServerFn(deleteIntakeRecord);
  const pdfFn = useServerFn(getIntakePdf);
  const pdfMut = useMutation({
    mutationFn: async (id: string) => pdfFn({ data: { intakeId: id } }),
    onSuccess: ({ base64, filename }) => {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "application/pdf" }),
      );
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't build PDF"),
  });
  const openPdf = (id: string) => pdfMut.mutate(id);
  const deleteMut = useMutation({
    mutationFn: (id: string) => {
      const input = window.prompt(
        "This permanently removes the intake order from OCS Portal.\n\nType DELETE to confirm:",
      );
      if (input == null) return Promise.reject(new Error("cancelled"));
      return deleteFn({ data: { intakeId: id, confirmation: input } });
    },
    onSuccess: () => {
      toast.success("Intake order deleted");
      qc.invalidateQueries({ queryKey: ["intake_records"] });
    },
    onError: (e: Error) => {
      if (e.message === "cancelled") return;
      toast.error(e.message || "Delete failed");
    },
  });

  if (isLoading) return <div className="h-32 animate-pulse rounded-md bg-muted/40" />;
  if (error)
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        Couldn't load intake records.
      </div>
    );
  if (!rows || rows.length === 0)
    return (
      <div className="rounded-md border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        No intake records yet.
      </div>
    );

  return (
    <>
    {/* Mobile: stacked cards */}
    <div className="space-y-2 md:hidden">
      {rows.map((r) => {
        const ex = r.extracted_fields_json ?? {};
        const rd = computeDispatchReadiness(r);
        const topBlocker = rd.blockers[0];
        const rowTone =
          rd.status === "needs_review"
            ? "border-red-500 bg-red-300 hover:bg-red-400/80 dark:border-red-600 dark:bg-red-800/60"
            : rd.status === "ready"
              ? "border-yellow-400 bg-yellow-200 hover:bg-yellow-300/80 dark:border-yellow-700 dark:bg-yellow-900/40"
              : rd.status === "converted"
                ? "border-green-500 bg-green-300 hover:bg-green-400/80 dark:border-green-600 dark:bg-green-800/60"
                : "border-border bg-card hover:bg-accent/40";
        return (
          <div
            key={r.id}
            onClick={() => onRowClick(r.id)}
            className={`cursor-pointer rounded-md border p-3 ${rowTone}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="break-words text-sm font-semibold text-foreground">
                  {ex.job_summary || ex.order_no || "—"}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {ex.client_name ?? "Unknown client"} · {ex.postcode ?? "no postcode"}
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="Open as PDF"
                title="Open work order as PDF"
                disabled={pdfMut.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  openPdf(r.id);
                }}
                className="inline-flex items-center justify-center rounded-sm border border-border bg-background p-1.5 text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
              >
                <FileText className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Delete intake order"
                disabled={deleteMut.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMut.mutate(r.id);
                }}
                className="inline-flex items-center justify-center rounded-sm border border-border bg-background p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <DispatchReadinessBadge status={rd.status} score={rd.score} />
              <QueuePriorityChip priority={r.suggested_categorization_json?.priority_level ?? null} />
              <span
                className={`rounded-sm px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${STATE_TONE[r.parse_status] ?? "bg-muted"}`}
              >
                {r.parse_status}
              </span>
              <IntakeChannelBadge source={r.source_type} />
              <ParseConfidenceBadge label="P" value={r.parse_confidence} />
              <ParseConfidenceBadge label="C" value={r.categorization_confidence} />
              {((r.duplicate_candidates_json?.length ?? 0) > 0 ||
                r.duplicate_review_status === "confirmed" ||
                r.duplicate_review_status === "linked") && (
                <DuplicateStatusBadge
                  status={r.duplicate_review_status}
                  topScore={r.duplicate_confidence}
                  candidateCount={r.duplicate_candidates_json?.length ?? 0}
                />
              )}
              <PotentialWorkOrderCountBadge record={r} size="sm" />
            </div>
            {(r.source_sender || r.source_subject) && (
              <div className="mt-2 truncate text-xs text-muted-foreground">
                {r.source_sender ? <span className="text-foreground">{r.source_sender}</span> : null}
                {r.source_sender && r.source_subject ? " · " : ""}
                {r.source_subject}
              </div>
            )}
            {topBlocker && (
              <div className="mt-1 text-[11px] text-destructive">
                ⚠ {topBlocker.label}: {topBlocker.message}
              </div>
            )}
            <div className="mt-1 flex items-center justify-between">
              <TraceChips record={r} />
              <div className="text-[10px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        );
      })}
    </div>

    {/* Desktop/tablet: table */}
    <div className="hidden overflow-x-auto rounded-md border border-border bg-card md:block">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">State</th>
            <th className="px-3 py-2 text-left">Source</th>
            <th className="px-3 py-2 text-left">Summary</th>
            <th className="px-3 py-2 text-left">Confidence</th>
            <th className="px-3 py-2 text-left">Received</th>
            <th className="px-3 py-2 text-right"> </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ex = r.extracted_fields_json ?? {};
            const rd = computeDispatchReadiness(r);
            const rowTone =
              rd.status === "needs_review"
                ? "bg-red-300 hover:bg-red-400/80 dark:bg-red-800/60"
                : rd.status === "ready"
                  ? "bg-yellow-200 hover:bg-yellow-300/80 dark:bg-yellow-900/40"
                  : rd.status === "converted"
                    ? "bg-green-300 hover:bg-green-400/80 dark:bg-green-800/60"
                    : "hover:bg-accent/40";
            return (
              <tr
                key={r.id}
                onClick={() => onRowClick(r.id)}
                className={`cursor-pointer border-t border-border ${rowTone}`}
              >
                <td className="px-3 py-2">
                  {(() => {
                    const topBlocker = rd.blockers[0];
                    return (
                      <div className="flex flex-col gap-1">
                        <DispatchReadinessBadge status={rd.status} score={rd.score} />
                        <div className="flex items-center gap-1">
                          <QueuePriorityChip priority={r.suggested_categorization_json?.priority_level ?? null} />
                          <span
                            className={`rounded-sm px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${STATE_TONE[r.parse_status] ?? "bg-muted"}`}
                            title={`parse_status: ${r.parse_status}`}
                          >
                            {r.parse_status}
                          </span>
                        </div>
                        {topBlocker && (
                          <div className="max-w-[180px] truncate text-[10px] text-destructive" title={topBlocker.message}>
                            ⚠ {topBlocker.label}: {topBlocker.message}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  <IntakeChannelBadge source={r.source_type} />
                  {(r.source_sender || r.source_subject) && (
                    <div className="mt-1 max-w-[200px] truncate text-foreground">
                      {r.source_sender ?? r.source_subject}
                    </div>
                  )}
                  {r.source_subject && r.source_sender && (
                    <div className="max-w-[200px] truncate">{r.source_subject}</div>
                  )}
                  {r.source_reference && (
                    <div className="max-w-[200px] truncate">{r.source_reference}</div>
                  )}
                  <TraceChips record={r} />
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-foreground">{ex.job_summary || ex.order_no || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {ex.client_name ?? "Unknown client"} · {ex.postcode ?? "no postcode"}
                  </div>
                  <div className="mt-1">
                    <PotentialWorkOrderCountBadge record={r} size="sm" />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <ParseConfidenceBadge label="P" value={r.parse_confidence} />
                    <ParseConfidenceBadge label="C" value={r.categorization_confidence} />
                    {((r.duplicate_candidates_json?.length ?? 0) > 0 ||
                      r.duplicate_review_status === "confirmed" ||
                      r.duplicate_review_status === "linked") && (
                      <DuplicateStatusBadge
                        status={r.duplicate_review_status}
                        topScore={r.duplicate_confidence}
                        candidateCount={r.duplicate_candidates_json?.length ?? 0}
                      />
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Open as PDF"
                    title="Open work order as PDF"
                    disabled={pdfMut.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      openPdf(r.id);
                    }}
                    className="inline-flex items-center justify-center rounded-sm border border-border bg-background p-1.5 text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete intake order"
                    title="Delete intake order (type DELETE to confirm)"
                    disabled={deleteMut.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMut.mutate(r.id);
                    }}
                    className="inline-flex items-center justify-center rounded-sm border border-border bg-background p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

function TraceChips({ record }: { record: IntakeRecord }) {
  const payload = (record.raw_payload_json ?? {}) as {
    recovered?: boolean;
    reanalyzed?: boolean;
    work_orders_total?: number;
    work_order_index?: number | null;
    ai_scanned_attachments?: number;
    source_attachments?: Array<unknown>;
  };
  const total = payload.work_orders_total ?? 1;
  const attachCount = payload.source_attachments?.length ?? 0;
  const chips: React.ReactNode[] = [];
  if (payload.recovered) {
    chips.push(
      <span
        key="rec"
        className="inline-flex items-center gap-1 rounded-sm bg-amber-50 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
        title="Recovered from previously missed email"
      >
        <LifeBuoy className="h-2.5 w-2.5" /> Recovered
      </span>,
    );
  }
  if (payload.reanalyzed) {
    chips.push(
      <span
        key="re"
        className="inline-flex items-center gap-1 rounded-sm bg-sky-50 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-sky-800 dark:bg-sky-900/30 dark:text-sky-200"
        title="Re-analyzed by latest sync"
      >
        <RotateCw className="h-2.5 w-2.5" /> Re-analyzed
      </span>,
    );
  }
  if (total > 1) {
    chips.push(
      <span
        key="multi"
        className="inline-flex items-center gap-1 rounded-sm bg-indigo-50 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200"
        title="One of multiple candidates extracted from a single email"
      >
        <Layers className="h-2.5 w-2.5" /> Job {payload.work_order_index ?? "?"} / {total}
      </span>,
    );
  }
  if (record.ocr_used) {
    chips.push(
      <span
        key="ocr"
        className="inline-flex items-center gap-1 rounded-sm bg-emerald-50 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
        title="Attachment text extracted by OCR / vision"
      >
        <Sparkles className="h-2.5 w-2.5" /> Attach OCR
      </span>,
    );
  }
  if (attachCount > 0) {
    chips.push(
      <span
        key="att"
        className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-1 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground"
        title={`${attachCount} attachment${attachCount === 1 ? "" : "s"}`}
      >
        <Paperclip className="h-2.5 w-2.5" /> {attachCount}
      </span>,
    );
  } else if (record.source_file_path) {
    chips.push(
      <span
        key="att-file"
        className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-1 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground"
      >
        <Paperclip className="h-2.5 w-2.5" /> file
      </span>,
    );
  }
  if (chips.length === 0) return null;
  return <div className="mt-1 flex flex-wrap gap-1">{chips}</div>;
}