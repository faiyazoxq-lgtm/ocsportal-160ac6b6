import { useState } from "react";
import { useExternalContactMutations } from "@/hooks/usePeopleDirectory";
import type { PersonRow } from "@/types/people";

export function ExternalContactEditorDrawer({
  row,
  mode,
  onClose,
}: {
  row: PersonRow | null;
  mode: "create" | "edit";
  onClose: () => void;
}) {
  const { upsert } = useExternalContactMutations();
  const [name, setName] = useState(row?.display_name ?? "");
  const [organization, setOrg] = useState(row?.organization ?? "");
  const [roleLabel, setRoleLabel] = useState(row?.role_label ?? "");
  const [email, setEmail] = useState(row?.email ?? "");
  const [phone, setPhone] = useState(row?.phone ?? "");
  const [contactType, setContactType] = useState(row?.external_type ?? "other");
  const [notes, setNotes] = useState(row?.notes ?? "");
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    try {
      await upsert.mutateAsync({
        id: row?.external_contact_id ?? undefined,
        name,
        organization: organization || null,
        role_label: roleLabel || null,
        email: email || null,
        phone: phone || null,
        contact_type: contactType,
        notes: notes || null,
      });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 md:items-stretch">
      <div className="h-full w-full max-w-md overflow-y-auto bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            {mode === "create" ? "New external contact" : "Edit external contact"}
          </h3>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:underline">
            Close
          </button>
        </div>
        <div className="space-y-3 text-xs">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className="pd-input" />
          </Field>
          <Field label="Organization / company">
            <input value={organization ?? ""} onChange={(e) => setOrg(e.target.value)} className="pd-input" />
          </Field>
          <Field label="Role / title">
            <input value={roleLabel ?? ""} onChange={(e) => setRoleLabel(e.target.value)} className="pd-input" />
          </Field>
          <Field label="Email">
            <input value={email ?? ""} onChange={(e) => setEmail(e.target.value)} className="pd-input" />
          </Field>
          <Field label="Phone">
            <input value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} className="pd-input" />
          </Field>
          <Field label="Type">
            <select
              value={contactType ?? "other"}
              onChange={(e) => setContactType(e.target.value)}
              className="pd-input"
            >
              <option value="client">Client</option>
              <option value="tenant">Tenant</option>
              <option value="landlord">Landlord</option>
              <option value="agency">Agency</option>
              <option value="supplier">Supplier</option>
              <option value="contractor">Contractor</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Notes">
            <textarea
              value={notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="pd-input"
            />
          </Field>
          {err && <p className="text-destructive">{err}</p>}
          <button
            onClick={submit}
            disabled={!name || upsert.isPending}
            className="w-full rounded-sm bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {mode === "create" ? "Create contact" : "Save"}
          </button>
        </div>
        <style>{`.pd-input { width: 100%; border: 1px solid hsl(var(--input)); background: hsl(var(--background)); border-radius: 4px; padding: 6px 8px; font-size: 12px; color: hsl(var(--foreground)); }`}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 font-medium text-foreground">{label}</div>
      {children}
    </label>
  );
}