import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useReviewAction } from "@/hooks/usePostCompletionQueue";
import type { ReviewOutcome, WorkOrderStatus } from "@/types/workOrders";
import {
  CheckCircle2,
  RotateCcw,
  FileText,
  MessageSquare,
  AlertTriangle,
  XCircle,
} from "lucide-react";

type Action = {
  key: ReviewOutcome | "send_to_attention";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  next_status: WorkOrderStatus;
  review_outcome: ReviewOutcome;
  follow_up_tags?: string[];
  hint: string;
  tone: "primary" | "outline" | "warn" | "danger";
};

const ACTIONS: Action[] = [
  {
    key: "closed",
    label: "Close job",
    icon: CheckCircle2,
    next_status: "closed",
    review_outcome: "closed",
    hint: "Mark as fully resolved. Job leaves the review queue.",
    tone: "primary",
  },
  {
    key: "follow_up_required",
    label: "Schedule revisit",
    icon: RotateCcw,
    next_status: "follow_up_required",
    review_outcome: "follow_up_required",
    follow_up_tags: ["revisit"],
    hint: "Engineer must return — parts, time, or rework needed.",
    tone: "warn",
  },
  {
    key: "further_quote_needed",
    label: "Quote required",
    icon: FileText,
    next_status: "follow_up_required",
    review_outcome: "further_quote_needed",
    follow_up_tags: ["quote"],
    hint: "Additional work found — needs client quote before continuing.",
    tone: "outline",
  },
  {
    key: "client_update_required",
    label: "Client follow-up",
    icon: MessageSquare,
    next_status: "follow_up_required",
    review_outcome: "client_update_required",
    follow_up_tags: ["client_contact"],
    hint: "Customer needs an update before this can close.",
    tone: "outline",
  },
  {
    key: "send_to_attention",
    label: "Send to admin attention",
    icon: AlertTriangle,
    next_status: "admin_attention",
    review_outcome: "follow_up_required",
    follow_up_tags: ["admin_attention"],
    hint: "Needs deeper review or escalation outside the standard queue.",
    tone: "warn",
  },
  {
    key: "cancelled",
    label: "Cancel job",
    icon: XCircle,
    next_status: "cancelled",
    review_outcome: "cancelled",
    hint: "Cannot proceed — record reason for audit.",
    tone: "danger",
  },
];

export function FollowUpActionBar({
  workOrderId,
  onDone,
}: {
  workOrderId: string;
  onDone?: () => void;
}) {
  const [active, setActive] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const action = useReviewAction();

  const submit = () => {
    if (!active) return;
    if (note.trim().length < 5) {
      toast.error("Add a review note (min 5 chars) for the audit trail.");
      return;
    }
    action.mutate(
      {
        work_order_id: workOrderId,
        review_outcome: active.review_outcome,
        next_status: active.next_status,
        note: note.trim(),
        follow_up_tags: active.follow_up_tags,
      },
      {
        onSuccess: () => {
          toast.success(`Recorded: ${active.label}`);
          setActive(null);
          setNote("");
          onDone?.();
        },
        onError: (e) =>
          toast.error("Failed to save review", {
            description: e instanceof Error ? e.message : "Unknown error",
          }),
      },
    );
  };

  const toneClass = (tone: Action["tone"]) =>
    tone === "primary"
      ? ""
      : tone === "danger"
        ? "border-destructive/40 text-destructive hover:bg-destructive/10"
        : tone === "warn"
          ? "border-amber-300 text-amber-900 hover:bg-amber-50"
          : "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          const isActive = active?.key === a.key;
          return (
            <Button
              key={a.key}
              size="sm"
              variant={a.tone === "primary" && isActive ? "default" : "outline"}
              className={`gap-1.5 ${toneClass(a.tone)} ${
                isActive ? "ring-2 ring-ring/40" : ""
              }`}
              onClick={() => {
                setActive(a);
                setNote("");
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {a.label}
            </Button>
          );
        })}
      </div>

      {active && (
        <div className="rounded-md border border-border bg-card p-3 text-xs">
          <div className="mb-2 text-muted-foreground">{active.hint}</div>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Audit note
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="What's the next operational step? (visible in admin notes + timeline)"
              className="mt-1 w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </label>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {note.length}/500
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setActive(null);
                  setNote("");
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={submit} disabled={action.isPending}>
                {action.isPending ? "Saving…" : `Confirm: ${active.label}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}