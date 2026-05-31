import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link as RouterLink } from "@tanstack/react-router";
import { ExternalLink, Search, Loader2 } from "lucide-react";
import type { IntakeRecord, IntakeDuplicateCandidate } from "@/types/intake";
import { DuplicateReasonBadge } from "./DuplicateReasonBadge";
import { DuplicateStatusBadge } from "./DuplicateStatusBadge";
import { DuplicateDecisionBar } from "./DuplicateDecisionBar";
import { useDetectDuplicates } from "@/hooks/useDuplicates";
import { toast } from "sonner";

interface Props {
  record: IntakeRecord;
}

function strengthOf(score: number): "strong" | "possible" | "weak" {
  if (score >= 0.8) return "strong";
  if (score >= 0.5) return "possible";
  return "weak";
}

const STRENGTH_TONE: Record<string, string> = {
  strong: "border-l-4 border-l-red-500 bg-red-50/60 dark:bg-red-900/10",
  possible: "border-l-4 border-l-amber-500 bg-amber-50/60 dark:bg-amber-900/10",
  weak: "border-l-4 border-l-border bg-card",
};

export function DuplicateCandidatesPanel({ record }: Props) {
  const candidates = (record.duplicate_candidates_json ?? []) as IntakeDuplicateCandidate[];
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | undefined>(
    candidates.find((c) => c.target_type === "work_order")?.work_order_id,
  );
  const detect = useDetectDuplicates();

  const reviewStatus = record.duplicate_review_status ?? "open";
  const topScore = record.duplicate_confidence ?? candidates[0]?.score ?? null;

  const lastScanned = record.duplicate_scanned_at
    ? new Date(record.duplicate_scanned_at).toLocaleString()
    : "never";

  async function runScan() {
    try {
      const r = await detect.mutateAsync({ intakeId: record.id });
      toast.success(
        r.candidates.length === 0
          ? "No duplicate candidates found"
          : `Found ${r.candidates.length} candidate(s) · top ${Math.round(r.topScore * 100)}%`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Duplicate review
          </div>
          <DuplicateStatusBadge
            status={reviewStatus}
            topScore={topScore}
            candidateCount={candidates.length}
          />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Last scanned: {lastScanned}</span>
          <Button size="sm" variant="outline" className="h-7" onClick={runScan} disabled={detect.isPending}>
            {detect.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Search className="mr-1 h-3 w-3" />
            )}
            {record.duplicate_scanned_at ? "Re-scan" : "Run duplicate scan"}
          </Button>
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="px-3 py-4 text-xs text-muted-foreground">
          {record.duplicate_scanned_at
            ? "No duplicate candidates found in the recent records window."
            : "Run a duplicate scan to compare against recent work orders and intake records."}
        </div>
      ) : (
        <>
          {(record.duplicate_rationale_json ?? []).length > 0 && (
            <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Why suspected:
              </span>
              {(record.duplicate_rationale_json ?? []).map((r) => (
                <DuplicateReasonBadge key={r} reason={r} />
              ))}
            </div>
          )}

          <ul className="divide-y divide-border">
            {candidates.map((c) => {
              const strength = c.match_strength ?? strengthOf(c.score);
              const tone = STRENGTH_TONE[strength];
              const selected = c.target_type === "work_order" && selectedWorkOrderId === c.work_order_id;
              return (
                <li
                  key={`${c.target_type}-${c.work_order_id}`}
                  className={`px-3 py-2 text-sm ${tone} ${selected ? "ring-1 ring-inset ring-primary/40" : ""}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{c.order_no}</span>
                        <span className="rounded-sm bg-background/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {c.target_type === "work_order" ? "work order" : "intake"}
                        </span>
                        <span
                          className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${
                            strength === "strong"
                              ? "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200"
                              : strength === "possible"
                                ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {strength} · {Math.round(c.score * 100)}%
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(c.reasons ?? (c.reason ? [c.reason] : [])).map((r, i) => (
                          <DuplicateReasonBadge key={`${r}-${i}`} reason={r} />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {c.target_type === "work_order" ? (
                        <>
                          <RouterLink
                            to="/admin/dispatch"
                            search={{ wo: c.work_order_id } as never}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-accent/40"
                          >
                            <ExternalLink className="h-3 w-3" /> Open
                          </RouterLink>
                          <Button
                            size="sm"
                            variant={selected ? "default" : "outline"}
                            className="h-7"
                            onClick={() => setSelectedWorkOrderId(c.work_order_id)}
                          >
                            {selected ? "Selected" : "Select to link"}
                          </Button>
                        </>
                      ) : (
                        <RouterLink
                          to="/admin/intake"
                          search={{ focus: c.work_order_id } as never}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-accent/40"
                        >
                          <ExternalLink className="h-3 w-3" /> Open intake
                        </RouterLink>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <DuplicateDecisionBar record={record} selectedWorkOrderId={selectedWorkOrderId} />
        </>
      )}
    </section>
  );
}