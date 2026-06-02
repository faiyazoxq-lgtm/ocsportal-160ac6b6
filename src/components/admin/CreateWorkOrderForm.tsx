import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  UserCog,
  Sparkles,
  PlusCircle,
  AlertTriangle,
  Trash2,
  Users,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
} from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useCreateWorkOrder } from "@/hooks/useWorkOrders";
import { useEngineers } from "@/hooks/useEngineers";
import { useAssignWorkOrder } from "@/hooks/useAssignments";
import type { ClientType, PriorityLevel } from "@/types/workOrders";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const PRIORITY: PriorityLevel[] = ["low", "normal", "high", "urgent"];
const CLIENT_TYPES: ClientType[] = ["council", "agency", "landlord", "private"];
const ADD_NEW_CLIENT_VALUE = "__add_new_client__";

type DraftContact = {
  name: string;
  phone: string;
  role_label: string;
  contact_type: "tenant" | "landlord" | "agency" | "council" | "contractor" | "other";
};

const CONTACT_TYPES: DraftContact["contact_type"][] = [
  "tenant",
  "landlord",
  "agency",
  "council",
  "contractor",
  "other",
];

function emptyContact(): DraftContact {
  return { name: "", phone: "", role_label: "", contact_type: "tenant" };
}

export interface CreatedWorkOrder {
  id: string;
  order_no: string;
}

/**
 * Full-page work order creation form. Replaces the previous popup so
 * dispatchers / boss can fill it out on a dedicated page. The parent
 * route handles what happens after a successful create (e.g. showing
 * the downloadable work-order popup).
 */
export function CreateWorkOrderForm({
  onCreated,
  onCancel,
}: {
  onCreated: (wo: CreatedWorkOrder) => void;
  onCancel?: () => void;
}) {
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
    job_summary: "",
    job_description: "",
    priority_level: "normal" as PriorityLevel,
    estimated_duration_hours: "",
    estimated_value_amount: "",
    diary_date: "",
    diary_slot_label: "",
    schedule_notes: "",
    lead_engineer_id: "",
    support_engineer_ids: [] as string[],
  });
  const [contacts, setContacts] = useState<DraftContact[]>([emptyContact()]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

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

  function updateContact(i: number, patch: Partial<DraftContact>) {
    setContacts((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function addContact() {
    setContacts((cs) => [...cs, emptyContact()]);
  }
  function removeContact(i: number) {
    setContacts((cs) => (cs.length <= 1 ? [emptyContact()] : cs.filter((_, idx) => idx !== i)));
  }

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    setPendingFiles((prev) => [...prev, ...arr]);
  }
  function removeFile(i: number) {
    setPendingFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function uploadAttachments(workOrderId: string, userId: string | null) {
    if (pendingFiles.length === 0) return;
    setUploadProgress({ done: 0, total: pendingFiles.length });
    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      const mime = file.type || "application/octet-stream";
      const asPdf = mime === "application/pdf";
      const bucket = asPdf ? "work-order-source-docs" : "work-order-evidence";
      const fileKind = asPdf ? "source_pdf" : "general_evidence";
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${workOrderId}/${fileKind}/${Date.now()}-${i}-${safeName}`;
      const up = await supabase.storage.from(bucket).upload(path, file, {
        contentType: mime,
        upsert: false,
      });
      if (up.error) throw up.error;
      const ins = await supabase
        .from("work_order_files")
        .insert({
          work_order_id: workOrderId,
          file_kind: fileKind,
          storage_bucket: bucket,
          storage_path: path,
          mime_type: mime,
          byte_size: file.size,
          captured_by_profile_id: userId,
          uploaded_offline: false,
          sync_status: "synced",
          metadata_json: {
            admin_upload: true,
            display_name: file.name,
            uploaded_during: "work_order_creation",
          } as never,
        } as never);
      if (ins.error) throw ins.error;
      setUploadProgress({ done: i + 1, total: pendingFiles.length });
    }
  }

  async function linkContacts(workOrderId: string, userId: string | null) {
    const valid = contacts.filter((c) => c.name.trim() || c.phone.trim());
    if (valid.length === 0) return;
    for (let i = 0; i < valid.length; i++) {
      const c = valid[i];
      const { data: ec, error: ecErr } = await supabase
        .from("external_contacts")
        .insert({
          name: c.name.trim() || "(unnamed)",
          phone: c.phone.trim() || null,
          role_label: c.role_label.trim() || null,
          contact_type: c.contact_type,
          created_by: userId,
        })
        .select("id")
        .single();
      if (ecErr) throw ecErr;
      const { error: linkErr } = await supabase.from("work_order_external_contacts").insert({
        work_order_id: workOrderId,
        external_contact_id: ec.id,
        relationship_label: c.role_label.trim() || null,
        is_primary: i === 0,
        created_by: userId,
      });
      if (linkErr) throw linkErr;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const primary = contacts.find((c) => c.name.trim() || c.phone.trim());
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      const created = await create.mutateAsync({
        client_id: form.client_id || null,
        address_line_1: form.address_line_1 || null,
        address_line_2: form.address_line_2 || null,
        city: form.city || null,
        postcode: form.postcode || null,
        contact_name: primary?.name?.trim() || null,
        contact_phone: primary?.phone?.trim() || null,
        job_summary: form.job_summary || null,
        job_description: form.job_description || null,
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

      if (created?.id) {
        try {
          await linkContacts(created.id, userId);
        } catch (err) {
          toast.error(`Saved order, but contacts failed: ${(err as Error).message}`);
        }
        try {
          await uploadAttachments(created.id, userId);
        } catch (err) {
          toast.error(`Saved order, but uploads failed: ${(err as Error).message}`);
        }
      }

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
      if (created?.id) {
        onCreated({ id: created.id, order_no: created.order_no });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadProgress(null);
    }
  }

  const leadEngineers = (engineers ?? []).filter((e) => e.active_status);
  const supportEngineers = (engineers ?? []).filter((e) => e.active_status);

  const selectedLead = leadEngineers.find((e) => e.id === form.lead_engineer_id);
  const leadWarnings: string[] = [];
  if (selectedLead) {
    if (!selectedLead.can_lead) {
      leadWarnings.push("Not flagged as lead-capable in their profile.");
    }
  }

  return (
    <>
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
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
        <Row label="Address" full>
          <Textarea
            rows={2}
            value={form.address_line_1}
            onChange={(e) => set("address_line_1", e.target.value)}
            placeholder="Street, building, city — full address"
          />
        </Row>
        <Row label="Postcode">
          <Input
            value={form.postcode}
            onChange={(e) => set("postcode", e.target.value.toUpperCase())}
          />
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

        {/* Contacts section */}
        <div className="col-span-2 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <Label className="text-[12px] font-semibold uppercase tracking-wider text-foreground">
                Site contacts
              </Label>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs"
              onClick={addContact}
            >
              <PlusCircle className="h-3.5 w-3.5" /> Add contact
            </Button>
          </div>
          <div className="space-y-2 p-3">
            {contacts.map((c, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 rounded-md border border-border bg-background p-2 sm:grid-cols-[1fr_1fr_140px_140px_auto]"
              >
                <Input
                  placeholder="Name"
                  value={c.name}
                  onChange={(e) => updateContact(i, { name: e.target.value })}
                />
                <Input
                  placeholder="Phone"
                  inputMode="tel"
                  value={c.phone}
                  onChange={(e) => updateContact(i, { phone: e.target.value })}
                />
                <Input
                  placeholder="Role (e.g. tenant)"
                  value={c.role_label}
                  onChange={(e) => updateContact(i, { role_label: e.target.value })}
                />
                <Select
                  value={c.contact_type}
                  onValueChange={(v) =>
                    updateContact(i, { contact_type: v as DraftContact["contact_type"] })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTACT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  onClick={() => removeContact(i)}
                  aria-label="Remove contact"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              The first contact with details becomes the primary site contact.
            </p>
          </div>
        </div>

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
        <Row label="Spend limit cap exc VAT (£)">
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

        {/* Job media attachments */}
        <div className="col-span-2 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
            <Paperclip className="h-4 w-4 text-primary" />
            <Label className="text-[12px] font-semibold uppercase tracking-wider text-foreground">
              Job media
            </Label>
          </div>
          <div className="space-y-3 p-3">
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  Attach photos, videos or documents (PDFs, quotes, briefs). They&apos;ll be saved
                  against this work order.
                </div>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
                  <PlusCircle className="h-3.5 w-3.5" /> Add files
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {pendingFiles.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {pendingFiles.map((f, i) => {
                    const Icon = f.type.startsWith("image/")
                      ? ImageIcon
                      : f.type.startsWith("video/")
                        ? VideoIcon
                        : FileText;
                    return (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between gap-2 rounded-sm border border-border bg-background px-2 py-1 text-xs"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{f.name}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {(f.size / 1024).toFixed(0)} KB
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remove file"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {uploadProgress && (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Uploading {uploadProgress.done} / {uploadProgress.total}…
                </div>
              )}
            </div>
          </div>
        </div>

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

        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={create.isPending || assign.isPending || !!uploadProgress}>
            {create.isPending || assign.isPending || uploadProgress
              ? uploadProgress
                ? `Uploading ${uploadProgress.done}/${uploadProgress.total}…`
                : "Saving…"
              : form.lead_engineer_id
                ? "Create & assign"
                : "Create work order"}
          </Button>
        </div>
      </form>

      <AddClientDialog
        open={addClientOpen}
        onOpenChange={setAddClientOpen}
        onCreated={async (id) => {
          await qc.invalidateQueries({ queryKey: ["clients"] });
          set("client_id", id);
        }}
      />
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