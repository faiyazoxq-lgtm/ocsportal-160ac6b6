import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useWorkOrder, useDeleteWorkOrder } from "@/hooks/useWorkOrders";
import { StatusBadge, PriorityBadge, ConfidenceCell } from "./StatusBadge";
import { WorkOrderSyncPanel } from "./WorkOrderSyncPanel";
import { PlannerSyncPanel } from "./PlannerSyncPanel";
import { WorkOrderDocumentsPanel, FileAuditList } from "@/components/documents/WorkOrderDocumentsPanel";
import { CommunicationLogPanel } from "@/components/admin/communications/CommunicationLogPanel";
import { Lock, CloudOff, MapPin, FileText, Trash2 } from "lucide-react";
import { buildMapsUrl, buildTelUrl } from "@/lib/mapsUrl";
import { WorkOrderDocument } from "./WorkOrderDocument";
import { useState } from "react";
import { toast } from "sonner";
import { WorkOrderUpdatedBadge } from "@/components/engineer/WorkOrderUpdatedBadge";
import { FullWorkOrderEditor } from "./FullWorkOrderEditor";
import { InlineEditableField } from "./InlineEditableField";
import { useUpdateWorkOrderFull } from "@/hooks/useUpdateWorkOrderFull";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function WorkOrderDetail({
  workOrderId,
  open,
  onOpenChange,
  onAssign,
  onSchedule,
}: {
  workOrderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign?: (workOrderId: string) => void;
  onSchedule?: (workOrderId: string) => void;
}) {
  const { data, isLoading, error } = useWorkOrder(workOrderId);
  const [docOpen, setDocOpen] = useState(false);
  const deleteWO = useDeleteWorkOrder();
  const update = useUpdateWorkOrderFull(workOrderId ?? "");
  const saveField = <K extends string>(
    field: K,
    transform: (raw: string) => unknown = (v) => (v === "" ? null : v),
  ) => async (raw: string) => {
    await update.mutateAsync({ [field]: transform(raw) } as never);
  };
  const toNum = (raw: string) => {
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
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
              <WorkOrderUpdatedBadge
                createdAt={data.created_at}
                updatedAt={data.updated_at}
              />
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
              <Button
                size="sm"
                variant="outline"
                className={onAssign ? "" : "ml-auto"}
                onClick={() => setDocOpen(true)}
              >
                <FileText className="mr-1 h-3.5 w-3.5" />
                View document
              </Button>
              {onSchedule && (
                <Button
                  size="sm"
                  variant="outline"
                  className={onAssign ? "" : "ml-auto"}
                  onClick={() => onSchedule(data.id)}
                  
                >
                  {data.diary_date ? "Reschedule" : "Schedule in diary"}
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete work order {data.order_no}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the work order and all its assignments,
                      events, and related records. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        deleteWO.mutate(data.id, {
                          onSuccess: () => {
                            toast.success(`Deleted work order ${data.order_no}`);
                            onOpenChange(false);
                          },
                          onError: (e) =>
                            toast.error(`Couldn't delete: ${(e as Error).message}`),
                        });
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <Section title="Field sync & evidence">
              <WorkOrderSyncPanel wo={data} />
            </Section>

            <Section title="Documents & media">
              <WorkOrderDocumentsPanel workOrderId={data.id} canUpload />
            </Section>

            <Section title="External communications">
              <CommunicationLogPanel workOrderId={data.id} />
            </Section>

            <Section title="Planner sheet sync">
              <PlannerSyncPanel wo={data} />
            </Section>

            <Section title="Job">
              <InlineEditableField
                label="Summary"
                value={data.job_summary}
                onSave={saveField("job_summary")}
              />
              <InlineEditableField
                label="Description"
                value={data.job_description}
                type="textarea"
                pre
                onSave={saveField("job_description")}
              />
              <Field label="Source" value={data.source_channel} />
            </Section>

            <Section title="Client">
              <Field label="Client" value={data.client?.client_name} />
              <Field label="Client type" value={data.client?.client_type} />
            </Section>

            <Section title="Site">
              <InlineEditableField
                label="Address"
                value={data.address_line_1}
                onSave={saveField("address_line_1")}
              />
              <InlineEditableField
                label="Address line 2"
                value={data.address_line_2}
                onSave={saveField("address_line_2")}
              />
              <InlineEditableField
                label="City"
                value={data.city}
                onSave={saveField("city")}
              />
              <InlineEditableField
                label="Postcode"
                value={data.postcode}
                onSave={saveField("postcode")}
              />
              <Field label="Zone" value={data.postcode_zone} />
              <SiteQuickActions
                mapsUrl={buildMapsUrl({
                  lat: data.latitude,
                  lng: data.longitude,
                  address: [data.address_line_1, data.city].filter(Boolean).join(", "),
                  postcode: data.postcode,
                })}
              />
            </Section>

            <Section title="Categorization">
              <InlineEditableField
                label="Primary trade"
                value={data.primary_trade}
                onSave={saveField("primary_trade")}
              />
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
              <InlineEditableField
                label="Estimated duration"
                value={data.estimated_duration_minutes}
                type="number"
                display={(v) => (v != null && v !== "" ? `${v} min` : <span className="text-muted-foreground">—</span>)}
                onSave={saveField("estimated_duration_minutes", toNum)}
              />
              <InlineEditableField
                label="Estimated value"
                value={data.estimated_value_amount}
                type="number"
                display={(v) => (v != null && v !== "" ? `£${Number(v).toFixed(2)}` : <span className="text-muted-foreground">—</span>)}
                onSave={saveField("estimated_value_amount", toNum)}
              />
              <InlineEditableField
                label="Engineers required"
                value={data.engineers_required}
                type="number"
                onSave={saveField("engineers_required", (v) => Number(v) || 1)}
              />
              <InlineEditableField
                label="Diary date"
                value={data.diary_date}
                type="date"
                onSave={saveField("diary_date")}
              />
              <Field label="Diary slot" value={data.diary_slot_label} />
              <InlineEditableField
                label="Tools / materials"
                value={data.tools_materials_hint}
                type="textarea"
                onSave={saveField("tools_materials_hint")}
              />
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
              <InlineEditableField
                label="Notes"
                value={data.admin_notes}
                type="textarea"
                pre
                onSave={saveField("admin_notes")}
              />
            </Section>

            <Section title="Edit work order">
              <FullWorkOrderEditor wo={data} />
            </Section>

            <Section title="File audit">
              <FileAuditList workOrderId={data.id} />
            </Section>
          </div>
        )}
      </SheetContent>
      {data && (
        <WorkOrderDocument wo={data} open={docOpen} onOpenChange={setDocOpen} />
      )}
    </Sheet>
  );
}

function SiteQuickActions({ mapsUrl }: { mapsUrl: string | null }) {
  if (!mapsUrl) return null;
  return (
    <div className="pt-1">
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
      >
        <MapPin className="h-3.5 w-3.5" /> Open in Maps
      </a>
    </div>
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