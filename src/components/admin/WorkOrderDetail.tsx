import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useWorkOrder } from "@/hooks/useWorkOrders";
import { StatusBadge, PriorityBadge, ConfidenceCell } from "./StatusBadge";
import { WorkOrderSyncPanel } from "./WorkOrderSyncPanel";
import { PlannerSyncPanel } from "./PlannerSyncPanel";
import { Lock, CloudOff } from "lucide-react";

export function WorkOrderDetail({
  workOrderId,
  open,
  onOpenChange,
  onAssign,
}: {
  workOrderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign?: (workOrderId: string) => void;
}) {
  const { data, isLoading, error } = useWorkOrder(workOrderId);
  const leadAssignment = data?.assignments.find(
    (a) => a.assignment_role === "lead" && a.assignment_status !== "removed",
  );
  const supportAssignments =
    data?.assignments.filter(
      (a) => a.assignment_role === "support" && a.assignment_status !== "removed",
    ) ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-base">
            {data ? `Work order ${data.order_no}` : "Work order"}
          </SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="mt-6 text-sm text-muted-foreground">Loading job…</div>
        )}
        {error && (
          <div className="mt-6 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            Couldn't load this work order.
          </div>
        )}
        {data && (
          <div className="mt-4 space-y-6 pb-10 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={data.current_status} />
              <PriorityBadge priority={data.priority_level} />
              {data.duplicate_flag && (
                <span className="rounded-sm bg-red-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-red-900">
                  Possible duplicate
                </span>
              )}
              {data.field_lock_active && (
                <span className="inline-flex items-center gap-1 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                  <Lock className="h-3 w-3" />
                  Field-locked
                </span>
              )}
              {data.pending_sync_flag && (
                <span className="inline-flex items-center gap-1 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                  <CloudOff className="h-3 w-3" />
                  Pending sync
                </span>
              )}
              {onAssign && (
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={() => onAssign(data.id)}
                >
                  Assign engineers
                </Button>
              )}
            </div>

            <Section title="Field sync & evidence">
              <WorkOrderSyncPanel wo={data} />
            </Section>

            <Section title="Planner sheet sync">
              <PlannerSyncPanel wo={data} />
            </Section>

            <Section title="Job">
              <Field label="Summary" value={data.job_summary} />
              <Field label="Description" value={data.job_description} pre />
              <Field label="Source" value={data.source_channel} />
            </Section>

            <Section title="Client">
              <Field label="Client" value={data.client?.client_name} />
              <Field label="Client type" value={data.client?.client_type} />
            </Section>

            <Section title="Site">
              <Field
                label="Address"
                value={[data.address_line_1, data.address_line_2, data.city]
                  .filter(Boolean)
                  .join(", ")}
              />
              <Field label="Postcode" value={data.postcode} />
              <Field label="Zone" value={data.postcode_zone} />
            </Section>

            <Section title="Categorization">
              <Field label="Primary trade" value={data.primary_trade} />
              <Field label="Trade tags" value={data.trade_tags?.join(", ")} />
              <Field label="Complexity" value={data.complexity_level} />
              <Field
                label="Certifications"
                value={data.certification_tags?.join(", ")}
              />
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-[11px] uppercase text-muted-foreground">
                    Parsing confidence
                  </div>
                  <ConfidenceCell value={data.parsing_confidence} />
                </div>
                <div>
                  <div className="text-[11px] uppercase text-muted-foreground">
                    Categorization
                  </div>
                  <ConfidenceCell value={data.categorization_confidence} />
                </div>
              </div>
            </Section>

            <Section title="Planning">
              <Field
                label="Estimated duration"
                value={
                  data.estimated_duration_minutes != null
                    ? `${data.estimated_duration_minutes} min`
                    : null
                }
              />
              <Field
                label="Estimated value"
                value={
                  data.estimated_value_amount != null
                    ? `£${Number(data.estimated_value_amount).toFixed(2)}`
                    : null
                }
              />
              <Field
                label="Engineers required"
                value={String(data.engineers_required)}
              />
              <Field label="Diary date" value={data.diary_date} />
              <Field label="Diary slot" value={data.diary_slot_label} />
              <Field label="Tools / materials" value={data.tools_materials_hint} />
            </Section>

            <Section title="Assignments">
              <Field
                label="Lead engineer"
                value={
                  leadAssignment
                    ? `${leadAssignment.engineer?.display_name ?? "Unknown"} · ${leadAssignment.assignment_status}`
                    : null
                }
              />
              <div>
                <div className="text-xs text-muted-foreground">Support engineers</div>
                {supportAssignments.length === 0 ? (
                  <div className="text-xs text-muted-foreground">—</div>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {supportAssignments.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between rounded-sm border border-border bg-secondary px-2 py-1 text-xs"
                      >
                        <span>{a.engineer?.display_name ?? "Unknown engineer"}</span>
                        <span className="text-muted-foreground">{a.assignment_status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Section>

            <Section title="Admin notes">
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {data.admin_notes || (
                  <span className="text-muted-foreground">No notes yet.</span>
                )}
              </p>
            </Section>

            <Section title="Event history">
              <p className="text-xs text-muted-foreground">
                Activity log will appear here once events are recorded.
              </p>
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2 rounded-md border border-border bg-card p-3">
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  pre,
}: {
  label: string;
  value: string | null | undefined;
  pre?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-2 text-xs">
      <div className="text-muted-foreground">{label}</div>
      <div className={pre ? "whitespace-pre-wrap" : ""}>
        {value ? value : <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}