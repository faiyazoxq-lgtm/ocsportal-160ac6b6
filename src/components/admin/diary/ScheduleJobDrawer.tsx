import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Map } from "lucide-react";
import { useWorkOrder } from "@/hooks/useWorkOrders";
import { useEngineers } from "@/hooks/useEngineers";
import { useScheduleJob, findJobIssues } from "@/hooks/useDiaryPlanning";
import { useAssignWorkOrder } from "@/hooks/useAssignments";
import { ScheduleConflictBadge } from "./ScheduleConflictBadge";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SchedulingSuggestionCard } from "@/components/admin/recommendations/SchedulingSuggestionCard";
import { toast } from "sonner";

export function ScheduleJobDrawer({
  workOrderId,
  onClose,
}: {
  workOrderId: string | null;
  onClose: () => void;
}) {
  const open = !!workOrderId;
  const { data: wo } = useWorkOrder(workOrderId);
  const { data: engineers } = useEngineers();
  const schedule = useScheduleJob();
  const assign = useAssignWorkOrder();

  const [date, setDate] = useState("");
  const [slotLabel, setSlotLabel] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [duration, setDuration] = useState("");
  const [status, setStatus] = useState<"planned" | "confirmed" | "tentative">("planned");
  const [notes, setNotes] = useState("");
  const [leadId, setLeadId] = useState<string>("");
  const [supportIds, setSupportIds] = useState<string[]>([]);

  useEffect(() => {
    if (!wo) return;
    setDate(wo.diary_date ?? "");
    setSlotLabel(wo.diary_slot_label ?? "");
    setStartAt(wo.scheduled_start_at ? wo.scheduled_start_at.slice(0, 16) : "");
    setEndAt(wo.scheduled_end_at ? wo.scheduled_end_at.slice(0, 16) : "");
    setDuration(wo.estimated_duration_minutes ? String(wo.estimated_duration_minutes) : "");
    setStatus((wo.diary_slot_status as "planned" | "confirmed" | "tentative") ?? "planned");
    setNotes(wo.schedule_notes ?? "");
    const active = (wo.assignments ?? []).filter((a) =>
      ["assigned", "accepted"].includes(a.assignment_status),
    );
    setLeadId(active.find((a) => a.assignment_role === "lead")?.engineer?.id ?? "");
    setSupportIds(
      active
        .filter((a) => a.assignment_role === "support")
        .map((a) => a.engineer?.id ?? "")
        .filter(Boolean),
    );
  }, [wo]);

  if (!workOrderId) return null;
  const issues = wo ? findJobIssues(wo) : [];
  const isReschedule = !!wo?.diary_date;

  const handleSave = async () => {
    if (!wo) return;
    try {
      const currentLead =
        (wo.assignments ?? []).find(
          (a) =>
            a.assignment_role === "lead" &&
            ["assigned", "accepted"].includes(a.assignment_status),
        )?.engineer?.id ?? "";
      const currentSupports = (wo.assignments ?? [])
        .filter(
          (a) =>
            a.assignment_role === "support" &&
            ["assigned", "accepted"].includes(a.assignment_status),
        )
        .map((a) => a.engineer?.id ?? "")
        .filter(Boolean);
      const assignmentsChanged =
        leadId !== currentLead ||
        supportIds.length !== currentSupports.length ||
        supportIds.some((id) => !currentSupports.includes(id));

      if (leadId && assignmentsChanged) {
        await assign.mutateAsync({
          work_order_id: wo.id,
          lead_engineer_id: leadId,
          support_engineer_ids: supportIds,
          diary_date: date || null,
          diary_slot_label: slotLabel || null,
          engineers_required: wo.engineers_required,
        });
      }

      await schedule.mutateAsync({
        work_order_id: wo.id,
        diary_date: date || null,
        diary_slot_label: slotLabel || null,
        scheduled_start_at: startAt ? new Date(startAt).toISOString() : null,
        scheduled_end_at: endAt ? new Date(endAt).toISOString() : null,
        diary_slot_status: status,
        schedule_notes: notes || null,
        estimated_duration_minutes: duration ? Number(duration) : null,
        isReschedule,
      });
      toast.success(isReschedule ? "Job rescheduled" : "Job scheduled");
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleUnschedule = async () => {
    if (!wo) return;
    try {
      await schedule.mutateAsync({
        work_order_id: wo.id,
        diary_date: null,
        diary_slot_label: null,
        scheduled_start_at: null,
        scheduled_end_at: null,
        diary_slot_status: null,
        isReschedule: true,
      });
      toast.success("Job unscheduled");
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const activeEngineers = (engineers ?? []).filter((e) => e.active_status);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {isReschedule ? "Reschedule" : "Schedule"} job
            {wo && <span className="text-sm font-normal text-muted-foreground">· {wo.order_no}</span>}
            {wo && <StatusBadge status={wo.current_status} />}
          </SheetTitle>
        </SheetHeader>

        {!wo ? (
          <div className="mt-6 h-32 animate-pulse rounded-sm bg-muted/40" />
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-sm border border-border bg-card p-3">
              <div className="text-sm font-medium">{wo.job_summary}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {wo.client?.client_name} · {wo.primary_trade ?? "—"} · {wo.postcode ?? "—"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {wo.address_line_1} {wo.city}
              </div>
              {issues.length > 0 && (
                <div className="mt-2">
                  <ScheduleConflictBadge issues={issues} />
                </div>
              )}
              {wo.field_lock_active && (
                <div className="mt-2 rounded-sm border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  Engineer is currently on site — your changes will still save and override the field lock.
                </div>
              )}
            </div>

            <SchedulingSuggestionCard workOrder={wo} />

            <div className="grid grid-cols-2 gap-3 rounded-sm border border-border bg-card p-3">
              <Field label="Diary date" type="date" value={date} onChange={setDate} />
              <Field label="Slot label" value={slotLabel} onChange={setSlotLabel} placeholder="e.g. AM" />
              <Field label="Start" type="datetime-local" value={startAt} onChange={setStartAt} />
              <Field label="End" type="datetime-local" value={endAt} onChange={setEndAt} />
              <Field label="Duration (min)" type="number" value={duration} onChange={setDuration} />
              <label className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                  className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="planned">Planned</option>
                  <option value="tentative">Tentative</option>
                  <option value="confirmed">Confirmed</option>
                </select>
              </label>
            </div>

            <div className="rounded-sm border border-border bg-card p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Engineers
              </h3>
              <label className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                Lead
                <select
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="">— select lead —</option>
                  {activeEngineers
                    .filter((e) => e.can_lead)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.display_name} ({e.primary_trade ?? "—"})
                      </option>
                    ))}
                </select>
              </label>
              {wo.engineers_required > 1 && (
                <label className="mt-2 block text-[11px] uppercase tracking-wide text-muted-foreground">
                  Support engineers
                  <select
                    multiple
                    value={supportIds}
                    onChange={(e) =>
                      setSupportIds(Array.from(e.target.selectedOptions).map((o) => o.value))
                    }
                    className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-xs"
                    size={Math.min(6, activeEngineers.length)}
                  >
                    {activeEngineers
                      .filter((e) => e.id !== leadId)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.display_name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </div>

            <label className="block text-[11px] uppercase tracking-wide text-muted-foreground">
              Schedule notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-xs"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={schedule.isPending || assign.isPending}
              >
                {isReschedule ? "Save changes" : "Schedule"}
              </Button>
              {isReschedule && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUnschedule}
                  disabled={schedule.isPending}
                >
                  Unschedule
                </Button>
              )}
              <Link
                to="/admin/map"
                className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Map className="h-3.5 w-3.5" />
                Map view
              </Link>
            </div>

            {wo.rescheduled_at && (
              <div className="text-[10px] text-muted-foreground">
                Last rescheduled {new Date(wo.rescheduled_at).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-[11px] uppercase tracking-wide text-muted-foreground">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-xs text-foreground"
      />
    </label>
  );
}