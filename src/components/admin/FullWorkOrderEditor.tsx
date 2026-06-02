import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useUpdateWorkOrderFull,
  type FullEditableWorkOrder,
} from "@/hooks/useUpdateWorkOrderFull";
import type {
  WorkOrderWithRelations,
  PriorityLevel,
  ComplexityLevel,
  WorkOrderStatus,
} from "@/types/workOrders";

const PRIORITY: PriorityLevel[] = ["low", "normal", "high", "urgent"];
const COMPLEXITY: ComplexityLevel[] = ["basic", "intermediate", "advanced"];
const STATUSES: WorkOrderStatus[] = [
  "ingested",
  "parsed_ready",
  "categorized",
  "ready_for_dispatch",
  "scheduled_in_sheet",
  "assigned",
  "accepted",
  "en_route",
  "on_site",
  "field_in_progress",
  "field_submitted_complete",
  "field_submitted_incomplete",
  "dispatcher_review",
  "follow_up_required",
  "admin_attention",
  "closed",
  "cancelled",
];

/**
 * Dispatcher / Boss full work-order editor. Lets ops staff fix any field
 * at any time. RLS restricts writes to dispatcher/boss; engineer access
 * remains gated through EngineerWorkOrderEditor.
 */
export function FullWorkOrderEditor({ wo }: { wo: WorkOrderWithRelations }) {
  const [open, setOpen] = useState(false);
  const [patch, setPatch] = useState<FullEditableWorkOrder>({});
  const mut = useUpdateWorkOrderFull(wo.id);

  function set<K extends keyof FullEditableWorkOrder>(
    key: K,
    value: FullEditableWorkOrder[K],
  ) {
    setPatch((p) => ({ ...p, [key]: value }));
  }

  function val<K extends keyof FullEditableWorkOrder>(
    key: K,
  ): FullEditableWorkOrder[K] {
    if (key in patch) return patch[key];
    return (wo as unknown as Record<string, FullEditableWorkOrder[K]>)[key as string];
  }

  const dirty = Object.keys(patch).length > 0;

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-1"
      >
        <Pencil className="h-3.5 w-3.5" /> Edit work order
      </Button>
    );
  }

  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-3 text-xs">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Edit any field
        </h4>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPatch({});
          }}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" /> Close
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Text label="Order #" v={val("order_no") ?? ""} onChange={(v) => set("order_no", v)} />
        <Text label="Summary" v={val("job_summary") ?? ""} onChange={(v) => set("job_summary", v)} />
        <Area label="Description" v={val("job_description") ?? ""} onChange={(v) => set("job_description", v)} full />
        <Text label="Address line 1" v={val("address_line_1") ?? ""} onChange={(v) => set("address_line_1", v)} />
        <Text label="Address line 2" v={val("address_line_2") ?? ""} onChange={(v) => set("address_line_2", v)} />
        <Text label="City" v={val("city") ?? ""} onChange={(v) => set("city", v)} />
        <Text label="Postcode" v={val("postcode") ?? ""} onChange={(v) => set("postcode", v)} />
        <Text label="Postcode zone" v={val("postcode_zone") ?? ""} onChange={(v) => set("postcode_zone", v)} />
        <Text label="Primary trade" v={val("primary_trade") ?? ""} onChange={(v) => set("primary_trade", v)} />
        <Select
          label="Priority"
          v={(val("priority_level") as string) ?? "normal"}
          onChange={(v) => set("priority_level", v as PriorityLevel)}
          options={PRIORITY}
        />
        <Num
          label="Est. duration (min)"
          v={val("estimated_duration_minutes") ?? null}
          onChange={(v) => set("estimated_duration_minutes", v)}
        />
        <Num
          label="Est. value (£)"
          v={val("estimated_value_amount") ?? null}
          onChange={(v) => set("estimated_value_amount", v)}
        />
        <Num
          label="Engineers required"
          v={val("engineers_required") ?? null}
          onChange={(v) => set("engineers_required", v ?? 1)}
        />
        <Text label="Diary date" v={val("diary_date") ?? ""} onChange={(v) => set("diary_date", v)} placeholder="YYYY-MM-DD" />
        <Text label="Diary slot" v={val("diary_slot_label") ?? ""} onChange={(v) => set("diary_slot_label", v)} />
        <Area label="Tools / materials" v={val("tools_materials_hint") ?? ""} onChange={(v) => set("tools_materials_hint", v)} full />
        <Area label="Schedule notes" v={val("schedule_notes") ?? ""} onChange={(v) => set("schedule_notes", v)} full />
        <Area label="Admin notes" v={val("admin_notes") ?? ""} onChange={(v) => set("admin_notes", v)} full />
        <Select
          label="Status (override)"
          v={val("current_status") ?? wo.current_status}
          onChange={(v) => set("current_status", v as WorkOrderStatus)}
          options={STATUSES}
          full
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setPatch({})}
          disabled={!dirty || mut.isPending}
        >
          Reset
        </Button>
        <Button
          size="sm"
          onClick={() => {
            // Coerce empty strings to null for nullable fields
            const cleaned: FullEditableWorkOrder = {};
            for (const [k, v] of Object.entries(patch)) {
              (cleaned as Record<string, unknown>)[k] =
                typeof v === "string" && v.trim() === "" ? null : v;
            }
            mut.mutate(cleaned, {
              onSuccess: () => {
                toast.success("Work order updated");
                setPatch({});
              },
              onError: (e) =>
                toast.error("Couldn't save", {
                  description: e instanceof Error ? e.message : "Unknown error",
                }),
            });
          }}
          disabled={!dirty || mut.isPending}
          className="gap-1"
        >
          <Save className="h-3.5 w-3.5" />
          {mut.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </section>
  );
}

function Text({
  label,
  v,
  onChange,
  placeholder,
  full,
}: {
  label: string;
  v: string;
  onChange: (v: string) => void;
  placeholder?: string;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type="text"
        value={v}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-sm border border-input bg-background px-2 py-1 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring/30"
      />
    </label>
  );
}

function Area({
  label,
  v,
  onChange,
  full,
}: {
  label: string;
  v: string;
  onChange: (v: string) => void;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <textarea
        value={v}
        rows={2}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-sm border border-input bg-background px-2 py-1 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring/30"
      />
    </label>
  );
}

function Num({
  label,
  v,
  onChange,
}: {
  label: string;
  v: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        value={v ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        className="mt-0.5 w-full rounded-sm border border-input bg-background px-2 py-1 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring/30"
      />
    </label>
  );
}

function Select({
  label,
  v,
  onChange,
  options,
  full,
}: {
  label: string;
  v: string;
  onChange: (v: string) => void;
  options: readonly string[];
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        value={v}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-sm border border-input bg-background px-2 py-1 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring/30"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "" ? "—" : o}
          </option>
        ))}
      </select>
    </label>
  );
}