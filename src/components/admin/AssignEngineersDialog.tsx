import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEngineers } from "@/hooks/useEngineers";
import { useAllAvailability } from "@/hooks/useEngineerAvailability";
import { useAssignWorkOrder } from "@/hooks/useAssignments";
import { useWorkOrder } from "@/hooks/useWorkOrders";
import { AssignmentSuggestionPanel } from "@/components/admin/dispatch/AssignmentSuggestionPanel";
import { isBlockedOnDate } from "@/lib/availabilityBlocks";
import type { Engineer } from "@/types/engineers";
import type { WorkOrderWithRelations } from "@/types/workOrders";

const COMPLEXITY_RANK = { basic: 1, intermediate: 2, advanced: 3 } as const;

function scoreEngineer(e: Engineer, wo: WorkOrderWithRelations) {
  if (!e.active_status) return { score: -1, hints: ["inactive"] };
  const hints: string[] = [];
  let score = 0;
  if (wo.primary_trade && e.primary_trade === wo.primary_trade) {
    score += 4;
    hints.push("primary trade match");
  }
  const tagOverlap = (wo.trade_tags ?? []).filter((t) => e.trade_tags.includes(t));
  if (tagOverlap.length) {
    score += tagOverlap.length;
    hints.push(`${tagOverlap.length} trade tag${tagOverlap.length > 1 ? "s" : ""}`);
  }
  const certMissing = (wo.certification_tags ?? []).filter(
    (c) => !e.certification_tags.includes(c),
  );
  if (certMissing.length) {
    score -= certMissing.length * 2;
    hints.push(`missing cert: ${certMissing.join(", ")}`);
  }
  if (wo.postcode_zone && e.covered_postcode_zones.includes(wo.postcode_zone)) {
    score += 2;
    hints.push(`covers ${wo.postcode_zone}`);
  }
  if (wo.complexity_level) {
    if (COMPLEXITY_RANK[e.complexity_cap] >= COMPLEXITY_RANK[wo.complexity_level]) {
      score += 1;
    } else {
      score -= 3;
      hints.push(`complexity cap below ${wo.complexity_level}`);
    }
  }
  return { score, hints };
}

export function AssignEngineersDialog({
  workOrderId,
  open,
  onOpenChange,
  onScheduleInDiary,
}: {
  workOrderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduleInDiary?: (workOrderId: string) => void;
}) {
  const { data: wo } = useWorkOrder(workOrderId);
  const { data: engineers } = useEngineers();
  const { data: availability } = useAllAvailability();
  const assign = useAssignWorkOrder();

  const [leadId, setLeadId] = useState<string>("");
  const [supportIds, setSupportIds] = useState<string[]>([]);
  const [diaryDate, setDiaryDate] = useState<string>("");
  const [diarySlot, setDiarySlot] = useState<string>("");
  const [required, setRequired] = useState<number>(1);

  useEffect(() => {
    if (!open || !wo) return;
    const existingLead = wo.assignments.find(
      (a) => a.assignment_role === "lead" && a.assignment_status !== "removed",
    );
    const existingSupport = wo.assignments
      .filter((a) => a.assignment_role === "support" && a.assignment_status !== "removed")
      .map((a) => a.engineer?.id ?? "")
      .filter(Boolean);
    setLeadId(existingLead?.engineer?.id ?? "");
    setSupportIds(existingSupport);
    setDiaryDate(wo.diary_date ?? "");
    setDiarySlot(wo.diary_slot_label ?? "");
    setRequired(wo.engineers_required ?? 1);
  }, [open, wo]);

  const ranked = useMemo(() => {
    if (!wo || !engineers) return [];
    return engineers
      .map((e) => ({ e, ...scoreEngineer(e, wo) }))
      .sort((a, b) => b.score - a.score);
  }, [wo, engineers]);

  const availabilityByEngineer = useMemo(() => {
    const map = new Map<string, number>();
    (availability ?? []).forEach((a) => {
      map.set(a.engineer_id, (map.get(a.engineer_id) ?? 0) + 1);
    });
    return map;
  }, [availability]);

  // Per-engineer "is blocked on the currently-selected diary date" lookup.
  const blockedOnDate = useMemo(() => {
    const map = new Map<string, { blocked: boolean; note?: string }>();
    if (!diaryDate || !availability) return map;
    (engineers ?? []).forEach((e) => {
      map.set(e.id, isBlockedOnDate(availability, e.id, diaryDate));
    });
    return map;
  }, [diaryDate, availability, engineers]);

  const leadBlocked = leadId ? blockedOnDate.get(leadId)?.blocked : false;
  const blockedSupportNames = useMemo(() => {
    return supportIds
      .map((id) => {
        const e = (engineers ?? []).find((x) => x.id === id);
        const b = blockedOnDate.get(id);
        return b?.blocked && e ? e.display_name : null;
      })
      .filter((n): n is string => !!n);
  }, [supportIds, engineers, blockedOnDate]);
  const hasBlockingConflict = !!leadBlocked || blockedSupportNames.length > 0;

  async function save() {
    if (!workOrderId || !leadId) return;
    await assign.mutateAsync({
      work_order_id: workOrderId,
      lead_engineer_id: leadId,
      support_engineer_ids: supportIds,
      diary_date: diaryDate || null,
      diary_slot_label: diarySlot || null,
      engineers_required: Number.isFinite(required) ? required : 1,
    });
    onOpenChange(false);
  }

  async function saveAndSchedule() {
    if (!workOrderId || !leadId) return;
    await assign.mutateAsync({
      work_order_id: workOrderId,
      lead_engineer_id: leadId,
      support_engineer_ids: supportIds,
      diary_date: diaryDate || null,
      diary_slot_label: diarySlot || null,
      engineers_required: Number.isFinite(required) ? required : 1,
    });
    onOpenChange(false);
    onScheduleInDiary?.(workOrderId);
  }

  function toggleSupport(id: string) {
    setSupportIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Assign engineers {wo ? `· ${wo.order_no}` : ""}
          </DialogTitle>
        </DialogHeader>

        {wo && (
          <div className="rounded-md border border-border bg-secondary p-3 text-xs">
            <div className="font-medium text-foreground">{wo.job_summary || "—"}</div>
            <div className="mt-0.5 text-muted-foreground">
              {wo.primary_trade || "trade ?"} · {wo.complexity_level || "complexity ?"} ·
              zone {wo.postcode_zone || "—"} · {wo.postcode || ""}
            </div>
          </div>
        )}

        {wo && (
          <AssignmentSuggestionPanel
            workOrder={wo}
            selectedLeadId={leadId}
            selectedSupportIds={supportIds}
            onPickLead={(id) => setLeadId(id)}
            onPickSupport={(id) => toggleSupport(id)}
            onApplySuggestedPairing={(leadIdSug, supportIdsSug) => {
              setLeadId(leadIdSug);
              setSupportIds(supportIdsSug.filter((id) => id !== leadIdSug));
            }}
          />
        )}

        <div className="grid grid-cols-3 gap-3 text-sm">
          <Field label="Diary date">
            <Input
              type="date"
              value={diaryDate}
              onChange={(e) => setDiaryDate(e.target.value)}
            />
          </Field>
          <Field label="Diary slot">
            <Input
              value={diarySlot}
              onChange={(e) => setDiarySlot(e.target.value)}
              placeholder="e.g. AM, PM, 09:00"
            />
          </Field>
          <Field label="Engineers required">
            <Input
              type="number"
              min={1}
              value={required}
              onChange={(e) => setRequired(Number(e.target.value) || 1)}
            />
          </Field>
        </div>

        <div className="mt-2">
          <Label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
            Lead engineer
          </Label>
          <Select value={leadId} onValueChange={setLeadId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a lead engineer" />
            </SelectTrigger>
            <SelectContent>
              {ranked
                .filter(({ e }) => e.can_lead && e.active_status)
                .map(({ e, score, hints }) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.display_name} · score {score}
                    {hints.length ? ` · ${hints.slice(0, 2).join(", ")}` : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3">
          <Label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
            Support engineers
          </Label>
          <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-card">
            {ranked.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No engineers available.
              </div>
            ) : (
              ranked.map(({ e, score, hints }) => {
                const isLead = e.id === leadId;
                const checked = supportIds.includes(e.id);
                return (
                  <label
                    key={e.id}
                    className={`flex cursor-pointer items-start gap-3 border-b border-border px-3 py-2 text-xs last:border-b-0 ${
                      isLead ? "bg-muted/60" : ""
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={isLead}
                      onCheckedChange={() => toggleSupport(e.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">
                        {e.display_name}
                        {e.engineer_code ? (
                          <span className="ml-1 text-muted-foreground">
                            ({e.engineer_code})
                          </span>
                        ) : null}
                        {isLead && (
                          <span className="ml-2 rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-emerald-900">
                            lead
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground">
                        {e.primary_trade || "—"} · cap {e.complexity_cap} · zones{" "}
                        {e.covered_postcode_zones.join(", ") || "—"}
                      </div>
                      <div className="text-muted-foreground">
                        score {score}
                        {hints.length ? ` · ${hints.join(" · ")}` : ""}
                        {availabilityByEngineer.get(e.id)
                          ? ` · ${availabilityByEngineer.get(e.id)} availability rule(s)`
                          : ""}
                      </div>
                      {blockedOnDate.get(e.id)?.blocked ? (
                        <div className="mt-1 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-800">
                          Unavailable on {diaryDate}
                          {blockedOnDate.get(e.id)?.note
                            ? ` · ${blockedOnDate.get(e.id)?.note}`
                            : ""}
                        </div>
                      ) : null}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {hasBlockingConflict && (
          <div className="rounded-sm border border-red-300 bg-red-50 p-2 text-xs font-medium text-red-900">
            {leadBlocked
              ? "Selected lead engineer is unavailable on this date."
              : null}
            {blockedSupportNames.length
              ? ` Support unavailable: ${blockedSupportNames.join(", ")}.`
              : null}{" "}
            Change the diary date or pick a different engineer to save.
          </div>
        )}

        {assign.error && (
          <div className="rounded-sm border border-red-200 bg-red-50 p-2 text-xs text-red-900">
            {(assign.error as Error).message}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {onScheduleInDiary && (
            <Button
              variant="outline"
              onClick={saveAndSchedule}
              disabled={!leadId || assign.isPending || hasBlockingConflict}
            >
              Save & schedule slot…
            </Button>
          )}
          <Button onClick={save} disabled={!leadId || assign.isPending || hasBlockingConflict}>
            {assign.isPending ? "Saving…" : "Save assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}