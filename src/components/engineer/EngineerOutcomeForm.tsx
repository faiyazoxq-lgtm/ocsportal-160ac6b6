import { useMemo } from "react";
import { CheckCircle2, AlertCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { useQueuedMutation } from "@/hooks/useQueuedMutation";
import { useEvidenceFiles } from "@/hooks/useEvidenceFiles";
import { useOfflineJobDraft } from "@/hooks/useOfflineJobDraft";
import { OfflineDraftNotice } from "./OfflineDraftNotice";
import {
  UNIVERSAL_CHECKLIST,
  INCOMPLETE_REASONS,
} from "@/types/engineerField";
import type { IncompleteReason } from "@/types/workOrders";
import { EngineerChecklist } from "./EngineerChecklist";
import { EngineerEvidenceCapture } from "./EngineerEvidenceCapture";

type Outcome = "complete" | "incomplete";

const REQUIRED_UNIVERSAL_KEYS = UNIVERSAL_CHECKLIST.filter(
  // Everything except advisory + additional_issue (those are informational)
  (i) => !["advisory_note", "additional_issue"].includes(i.key),
).map((i) => i.key);

export function EngineerOutcomeForm({
  workOrderId,
  primaryTrade,
  onSubmitted,
}: {
  workOrderId: string;
  primaryTrade: string | null;
  onSubmitted?: () => void;
}) {
  const { draft, update: updateDraft, clear: clearDraft, hasDraft } =
    useOfflineJobDraft(workOrderId);
  const outcome = draft.outcome as Outcome;
  const reason = draft.reason as IncompleteReason | "";
  const notes = draft.notes;
  const advisoryNotes = draft.advisoryNotes;
  const checklist = draft.checklist;
  const setOutcome = (v: Outcome) => updateDraft({ outcome: v });
  const setReason = (v: IncompleteReason | "") => updateDraft({ reason: v });
  const setNotes = (v: string) => updateDraft({ notes: v });
  const setAdvisoryNotes = (v: string) => updateDraft({ advisoryNotes: v });
  const setChecklist = (v: Record<string, boolean>) =>
    updateDraft({ checklist: v });
  const { data: files = [] } = useEvidenceFiles(workOrderId);
  const evidence = useMemo(
    () => ({
      arrival: files.some((f) => f.file_kind === "arrival_photo"),
      before_leaving: files.some((f) => f.file_kind === "before_leave_photo"),
      signature: true,
    }),
    [files],
  );
  const submitOutcome = useQueuedMutation(workOrderId);

  const errors = useMemo(() => {
    const e: string[] = [];
    const missingUniversal = REQUIRED_UNIVERSAL_KEYS.filter((k) => !checklist[k]);
    if (missingUniversal.length) e.push(`${missingUniversal.length} universal checklist item(s) not ticked`);
    if (!evidence.arrival) e.push("Arrival photo required");
    if (!evidence.before_leaving) e.push("Before-leaving photo required");
    if (outcome === "incomplete" && !reason) e.push("Select an incomplete reason");
    if (notes.trim().length < 5) e.push("Job details required (min 5 characters)");
    return e;
  }, [checklist, evidence, outcome, reason, notes]);

  const canSubmit = errors.length === 0 && !submitOutcome.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    submitOutcome.mutate(
      {
        type: outcome === "complete" ? "submit_complete" : "submit_incomplete",
        payload: {
          reason: outcome === "incomplete" ? (reason as IncompleteReason) : null,
          notes,
          checklist,
          advisory_notes: advisoryNotes.trim() || null,
        },
      },
      {
        onSuccess: (res) => {
          toast.success(res.queued ? "Submitted (offline)" : "Submitted", {
            description: res.queued
              ? "Saved locally — will sync when back online."
              : outcome === "complete"
                ? "Job submitted as complete. Returned to dispatcher review."
                : "Job submitted as incomplete. Dispatcher will follow up.",
          });
          // Local draft no longer needed once the submission is in the queue / synced
          clearDraft();
          onSubmitted?.();
        },
        onError: (err) =>
          toast.error("Submission failed", {
            description: err instanceof Error ? err.message : "Unknown error",
          }),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Submit outcome</h3>
        <p className="text-xs text-muted-foreground">
          Lead engineers complete this and return the job to dispatcher review.
        </p>
      </div>

      {hasDraft ? (
        <OfflineDraftNotice updatedAt={draft.updated_at} onDiscard={clearDraft} />
      ) : null}

      {/* Outcome toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setOutcome("complete")}
          className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium ${
            outcome === "complete"
              ? "border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
              : "border-border bg-card text-foreground hover:bg-accent/30"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Complete
        </button>
        <button
          type="button"
          onClick={() => setOutcome("incomplete")}
          className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium ${
            outcome === "incomplete"
              ? "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
              : "border-border bg-card text-foreground hover:bg-accent/30"
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          Incomplete
        </button>
      </div>

      {outcome === "incomplete" ? (
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Reason
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as IncompleteReason | "")}
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select reason…</option>
            {INCOMPLETE_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {/* Checklist */}
      <EngineerChecklist
        primaryTrade={primaryTrade}
        values={checklist}
        onChange={setChecklist}
      />

      {/* Evidence */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Evidence
        </h4>
        <EngineerEvidenceCapture workOrderId={workOrderId} fileKind="arrival_photo" required />
        <EngineerEvidenceCapture workOrderId={workOrderId} fileKind="before_leave_photo" required />
        <EngineerEvidenceCapture workOrderId={workOrderId} fileKind="general_evidence" />
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Job details (required)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
          rows={3}
          maxLength={1000}
          placeholder={
            outcome === "incomplete"
              ? "What blocked completion? What's needed next? (min 5 characters)"
              : "Describe the work carried out, parts used, findings. (min 5 characters)"
          }
          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {/* Advisory notes — surfaces back to customer follow-up */}
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Advisory note for customer (optional)
        </label>
        <textarea
          value={advisoryNotes}
          onChange={(e) => setAdvisoryNotes(e.target.value.slice(0, 500))}
          rows={2}
          maxLength={500}
          placeholder="Anything the customer should be told or followed up on (e.g. recommend service, ageing part)."
          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
        />
        <p className="text-[11px] text-muted-foreground">
          Visible to dispatcher for customer follow-up. Not a formal quote.
        </p>
      </div>

      {/* Validation summary */}
      {errors.length ? (
        <ul className="space-y-1 rounded-sm border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {errors.map((e) => (
            <li key={e} className="flex items-start gap-1.5">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {e}
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
        {submitOutcome.isPending ? "Submitting…" : `Submit ${outcome}`}
      </button>
    </div>
  );
}