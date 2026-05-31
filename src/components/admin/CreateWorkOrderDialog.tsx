import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Hash, UserCog, Sparkles, PlusCircle, AlertTriangle } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useCreateWorkOrder, useWorkOrder } from "@/hooks/useWorkOrders";
import { useEngineers } from "@/hooks/useEngineers";
import { useAssignWorkOrder } from "@/hooks/useAssignments";
import type { ClientType, ComplexityLevel, PriorityLevel } from "@/types/workOrders";
import { toast } from "sonner";
import { WorkOrderDocument } from "./WorkOrderDocument";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const COMPLEXITY: ComplexityLevel[] = ["basic", "intermediate", "advanced"];
const PRIORITY: PriorityLevel[] = ["low", "normal", "high", "urgent"];
const CLIENT_TYPES: ClientType[] = ["council", "agency", "landlord", "private"];
const ADD_NEW_CLIENT_VALUE = "__add_new_client__";

export function CreateWorkOrderDialog({
  triggerLabel = "Create work order",
  triggerSize = "sm",
  triggerVariant,
}: {
  triggerLabel?: string;
  triggerSize?: "sm" | "default";
  triggerVariant?: "default" | "outline" | "secondary";
} = {}) {
  const [open, setOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const { data: previewWo } = useWorkOrder(previewId);
  const { data: clients } = useClients();
  const { data: engineers } = useEngineers();
  const create = useCreateWorkOrder();
  const assign = useAssignWorkOrder();
  const qc = useQueryClient();
  const [addClientOpen, setAddClientOpen] = useState(false);

  const [form, setForm] = useState({
    client_id: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    postcode: "",
    contact_name: "",
    contact_phone: "",
    job_summary: "",
    job_description: "",
    primary_trade: "",
    complexity_level: "intermediate" as ComplexityLevel,
    priority_level: "normal" as PriorityLevel,
    estimated_duration_hours: "",
    estimated_value_amount: "",
    diary_date: "",
    diary_slot_label: "",
    schedule_notes: "",
    lead_engineer_id: "",
    support_engineer_ids: [] as string[],
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleSupport(id: string) {
    setForm((f) =>
      f.support_engineer_ids.includes(id)
        ? { ...f, support_engineer_ids: f.support_engineer_ids.filter((x) => x !== id) }
        : { ...f, support_engineer_ids: [...f.support_engineer_ids, id] },
    );
  }

  function resetForm() {
    setForm({
      client_id: "",
      address_line_1: "",
      address_line_2: "",
      city: "",
      postcode: "",
      contact_name: "",
      contact_phone: "",
      job_summary: "",
      job_description: "",
      primary_trade: "",
      complexity_level: "intermediate",
      priority_level: "normal",
      estimated_duration_hours: "",
      estimated_value_amount: "",
      diary_date: "",
      diary_slot_label: "",
      schedule_notes: "",
      lead_engineer_id: "",
      support_engineer_ids: [],
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const created = await create.mutateAsync({
        client_id: form.client_id || null,
        address_line_1: form.address_line_1 || null,
        address_line_2: form.address_line_2 || null,
        city: form.city || null,
        postcode: form.postcode || null,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        job_summary: form.job_summary || null,
        job_description: form.job_description || null,
        primary_trade: form.primary_trade || null,
        complexity_level: form.complexity_level,
        priority_level: form.priority_level,
        estimated_duration_minutes: form.estimated_duration_hours
          ? Math.round(Number(form.estimated_duration_hours) * 60)
          : null,
        estimated_value_amount: form.estimated_value_amount
          ? Number(form.estimated_value_amount)
          : null,
        diary_date: form.diary_date || null,
        diary_slot_label: form.diary_slot_label || null,
        schedule_notes: form.schedule_notes || null,
      });

      if (form.lead_engineer_id && created?.id) {
        await assign.mutateAsync({
          work_order_id: created.id,
          lead_engineer_id: form.lead_engineer_id,
          support_engineer_ids: form.support_engineer_ids,
          diary_date: form.diary_date || null,
          diary_slot_label: form.diary_slot_label || null,
          engineers_required:
            1 + form.support_engineer_ids.filter((x) => x && x !== form.lead_engineer_id).length,
        });
        toast.success(`Work order ${created.order_no} created & assigned`);
      } else {
        toast.success(`Work order ${created?.order_no ?? ""} created`);
      }
      setOpen(false);
      resetForm();
      if (created?.id) setPreviewId(created.id);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  // Allow ANY active engineer to be selected as lead; warn (don't block) when unsuited.
  const leadEngineers = (engineers ?? []).filter((e) => e.active_status);
  const supportEngineers = (engineers ?? []).filter((e) => e.active_status);

  const selectedLead = leadEngineers.find((e) => e.id === form.lead_engineer_id);
  const complexityRank: Record<ComplexityLevel, number> = {
    basic: 1,
    intermediate: 2,
    advanced: 3,
  };
  const leadWarnings: string[] = [];
  if (selectedLead) {
    if (!selectedLead.can_lead) {
      leadWarnings.push("Not flagged as lead-capable in their profile.");
    }
    if (
      complexityRank[selectedLead.complexity_cap] <
      complexityRank[form.complexity_level]
    ) {
      leadWarnings.push(
        `Complexity cap is "${selectedLead.complexity_cap}", job requires "${form.complexity_level}".`,
      );
    }
    const trade = form.primary_trade.trim().toLowerCase();
    if (trade) {
      const matches =
        (selectedLead.primary_trade ?? "").toLowerCase().includes(trade) ||
        selectedLead.trade_tags.some((t) => t.toLowerCase().includes(trade));
      if (!matches) {
        leadWarnings.push(`No "${form.primary_trade}" skill listed on their profile.`);
      }
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={triggerSize} variant={triggerVariant} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[95vh] w-[calc(100vw-0.75rem)] max-w-3xl overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle>New work order</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs sm:col-span-2">
            <Hash className="h-4 w-4 text-primary" />
            <span className="font-semibold text-primary">Order number is auto-generated</span>
            <span className="text-muted-foreground">
              — a unique <span className="font-mono">WO-YYYY-00000</span> reference is assigned on submit.
            </span>
          </div>
          <Row label="Client / agency" full>
            <Select
              value={form.client_id}
              onValueChange={(v) => {
                if (v === ADD_NEW_CLIENT_VALUE) {
                  setAddClientOpen(true);
                  return;
                }
                set("client_id", v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {(clients ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.client_name}
                  </SelectItem>
                ))}
                <SelectItem value={ADD_NEW_CLIENT_VALUE} className="text-primary">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <PlusCircle className="h-3.5 w-3.5" /> Add new client / agency…
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Address line 1">
            <Input
              value={form.address_line_1}
              onChange={(e) => set("address_line_1", e.target.value)}
            />
          </Row>
          <Row label="Address line 2">
            <Input
              value={form.address_line_2}
              onChange={(e) => set("address_line_2", e.target.value)}
            />
          </Row>
          <Row label="City">
            <Input
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </Row>
          <Row label="Postcode">
            <Input
              value={form.postcode}
              onChange={(e) => set("postcode", e.target.value.toUpperCase())}
            />
          </Row>
          <Row label="Contact / tenant name">
            <Input
              value={form.contact_name}
              onChange={(e) => set("contact_name", e.target.value)}
            />
          </Row>
          <Row label="Contact phone">
            <Input
              value={form.contact_phone}
              onChange={(e) => set("contact_phone", e.target.value)}
            />
          </Row>
          <Row label="Primary trade">
            <Input
              value={form.primary_trade}
              onChange={(e) => set("primary_trade", e.target.value)}
              placeholder="e.g. plumbing"
            />
          </Row>
          <Row label="Skill level required">
            <Select
              value={form.complexity_level}
              onValueChange={(v) => set("complexity_level", v as ComplexityLevel)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMPLEXITY.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Priority">
            <Select
              value={form.priority_level}
              onValueChange={(v) => set("priority_level", v as PriorityLevel)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITY.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Job summary" full>
            <Input
              value={form.job_summary}
              onChange={(e) => set("job_summary", e.target.value)}
            />
          </Row>
          <Row label="Job description" full>
            <Textarea
              rows={3}
              value={form.job_description}
              onChange={(e) => set("job_description", e.target.value)}
            />
          </Row>
          <Row label="Estimated duration (min)">
            <Input
              type="number"
              inputMode="numeric"
              value={form.estimated_duration_minutes}
              onChange={(e) => set("estimated_duration_minutes", e.target.value)}
            />
          </Row>
          <Row label="Estimated value (£)">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={form.estimated_value_amount}
              onChange={(e) => set("estimated_value_amount", e.target.value)}
            />
          </Row>

          <Row label="Preferred diary date">
            <Input
              type="date"
              value={form.diary_date}
              onChange={(e) => set("diary_date", e.target.value)}
            />
          </Row>
          <Row label="Diary slot">
            <Input
              value={form.diary_slot_label}
              onChange={(e) => set("diary_slot_label", e.target.value)}
              placeholder="e.g. AM, PM, 09:00"
            />
          </Row>
          <Row label="Schedule notes" full>
            <Textarea
              rows={2}
              value={form.schedule_notes}
              onChange={(e) => set("schedule_notes", e.target.value)}
              placeholder="Access notes, parking, key contact, etc."
            />
          </Row>

          <div className="col-span-2 mt-2 overflow-hidden rounded-lg border-2 border-primary/30 bg-gradient-to-b from-primary/5 to-card shadow-sm">
            <div className="flex items-center justify-between border-b border-primary/20 bg-primary/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-primary" />
                <Label className="text-[12px] font-semibold uppercase tracking-wider text-primary">
                  Assign engineers
                </Label>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Optional — leave blank to create unassigned
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-foreground">
                  <Sparkles className="h-3 w-3 text-primary" /> Lead engineer
                </Label>
                <Select
                  value={form.lead_engineer_id}
                  onValueChange={(v) => set("lead_engineer_id", v)}
                >
                  <SelectTrigger className="h-10 border-primary/30 bg-background font-medium shadow-sm focus:ring-2 focus:ring-primary/40">
                    <SelectValue placeholder="Choose a lead engineer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadEngineers.length === 0 ? (
                      <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                        No active engineers
                      </div>
                    ) : (
                      leadEngineers.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          <span className="font-medium">{e.display_name}</span>
                          {e.primary_trade ? (
                            <span className="text-muted-foreground"> · {e.primary_trade}</span>
                          ) : null}
                          {!e.can_lead ? (
                            <span className="ml-1 text-[10px] uppercase text-amber-600">
                              · support only
                            </span>
                          ) : null}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {leadWarnings.length > 0 && (
                  <div className="mt-1.5 rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                    <div className="mb-0.5 flex items-center gap-1 font-semibold">
                      <AlertTriangle className="h-3 w-3" />
                      Assigning anyway — please review:
                    </div>
                    <ul className="list-disc pl-4">
                      {leadWarnings.map((w) => <li key={w}>{w}</li>)}
                    </ul>
                  </div>
                )}
                {form.lead_engineer_id && (
                  <button
                    type="button"
                    onClick={() => set("lead_engineer_id", "")}
                    className="mt-1 text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Clear lead
                  </button>
                )}
              </div>
              <div>
                <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-foreground">
                  Support engineers
                </Label>
                <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-background">
                  {supportEngineers.length === 0 ? (
                    <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                      No engineers
                    </div>
                  ) : (
                    supportEngineers.map((e) => {
                      const isLead = e.id === form.lead_engineer_id;
                      const checked = form.support_engineer_ids.includes(e.id);
                      return (
                        <label
                          key={e.id}
                          className={`flex cursor-pointer items-center gap-2 border-b border-border px-2 py-1.5 text-xs last:border-b-0 ${
                            isLead ? "opacity-50" : ""
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={isLead}
                            onCheckedChange={() => toggleSupport(e.id)}
                          />
                          <span className="truncate">
                            {e.display_name}
                            {e.primary_trade ? ` · ${e.primary_trade}` : ""}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {create.error && (
            <div className="rounded-sm border border-red-200 bg-red-50 p-2 text-xs text-red-900 sm:col-span-2">
              {(create.error as Error).message}
            </div>
          )}
          {assign.error && (
            <div className="rounded-sm border border-red-200 bg-red-50 p-2 text-xs text-red-900 sm:col-span-2">
              Assignment error: {(assign.error as Error).message}
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:col-span-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || assign.isPending}>
              {create.isPending || assign.isPending
                ? "Saving…"
                : form.lead_engineer_id
                  ? "Create & assign"
                  : "Create work order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <AddClientDialog
      open={addClientOpen}
      onOpenChange={setAddClientOpen}
      onCreated={async (id) => {
        await qc.invalidateQueries({ queryKey: ["clients"] });
        set("client_id", id);
      }}
    />
    {previewWo && (
      <WorkOrderDocument
        wo={previewWo}
        open={!!previewId}
        onOpenChange={(v) => !v && setPreviewId(null)}
      />
    )}
    </>
  );
}

function Row({
  label,
  children,
  full,
  required,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  required?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <Label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-red-600">*</span>}
      </Label>
      {children}
    </div>
  );
}

function AddClientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void | Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_name: "",
    client_type: "agency" as ClientType,
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    billing_notes: "",
  });

  function reset() {
    setForm({
      client_name: "",
      client_type: "agency",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      billing_notes: "",
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_name.trim()) {
      toast.error("Client name is required");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          client_name: form.client_name.trim(),
          client_type: form.client_type,
          contact_name: form.contact_name.trim() || null,
          contact_email: form.contact_email.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          billing_notes: form.billing_notes.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success(`${form.client_name} added`);
      await onCreated(data.id);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Add client / agency</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 text-sm">
          <div>
            <Label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
              Name <span className="text-red-600">*</span>
            </Label>
            <Input
              autoFocus
              value={form.client_name}
              onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
              Type
            </Label>
            <Select
              value={form.client_type}
              onValueChange={(v) => setForm((f) => ({ ...f, client_type: v as ClientType }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLIENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
              Contact name
            </Label>
            <Input
              value={form.contact_name}
              onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
                Phone
              </Label>
              <Input
                value={form.contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
              Billing notes
            </Label>
            <Textarea
              rows={2}
              value={form.billing_notes}
              onChange={(e) => setForm((f) => ({ ...f, billing_notes: e.target.value }))}
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Add client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}