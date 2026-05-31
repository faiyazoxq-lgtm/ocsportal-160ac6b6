import type { IntakeRecord } from "@/types/intake";
import { ParseConfidenceBadge } from "./ParseConfidenceBadge";
import { IntakeChannelBadge } from "./IntakeChannelBadge";
import { Paperclip } from "lucide-react";

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
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">State</th>
            <th className="px-3 py-2 text-left">Source</th>
            <th className="px-3 py-2 text-left">Summary</th>
            <th className="px-3 py-2 text-left">Confidence</th>
            <th className="px-3 py-2 text-left">Received</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ex = r.extracted_fields_json ?? {};
            return (
              <tr
                key={r.id}
                onClick={() => onRowClick(r.id)}
                className="cursor-pointer border-t border-border hover:bg-accent/40"
              >
                <td className="px-3 py-2">
                  <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${STATE_TONE[r.parse_status] ?? "bg-muted"}`}>
                    {r.parse_status}
                  </span>
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
                  {r.source_file_path && (
                    <div className="mt-0.5 inline-flex items-center gap-1 text-[10px]">
                      <Paperclip className="h-3 w-3" /> attached
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-foreground">{ex.job_summary || ex.order_no || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {ex.client_name ?? "Unknown client"} · {ex.postcode ?? "no postcode"}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <ParseConfidenceBadge label="P" value={r.parse_confidence} />
                    <ParseConfidenceBadge label="C" value={r.categorization_confidence} />
                    {(r.duplicate_candidates_json?.length ?? 0) > 0 && (
                      <ParseConfidenceBadge label="Dup" value={r.duplicate_confidence} />
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}