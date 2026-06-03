import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useExternalContactMutations } from "@/hooks/usePeopleDirectory";
import type { PersonRow } from "@/types/people";
import { useDirtyBlocker } from "@/hooks/useDirtyBlocker";

/**
 * Page-level form for creating or editing an external contact. Replaces
 * the old ExternalContactEditorDrawer popup. Save and Cancel both
 * navigate back to /boss/members.
 */
export function ExternalContactEditorForm({
  mode,
  row,
}: {
  mode: "create" | "edit";
  row: PersonRow | null;
}) {
  const navigate = useNavigate();
  const { upsert } = useExternalContactMutations();
  const [name, setName] = useState(row?.display_name ?? "");
  const [organization, setOrg] = useState(row?.organization ?? "");
  const [roleLabel, setRoleLabel] = useState(row?.role_label ?? "");
  const [email, setEmail] = useState(row?.email ?? "");
  const [phone, setPhone] = useState(row?.phone ?? "");
  const [contactType, setContactType] = useState(row?.external_type ?? "other");
  const [notes, setNotes] = useState(row?.notes ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const isDirty =
    !justSaved &&
    (mode === "create"
      ? !!(name || organization || roleLabel || email || phone || notes)
      : name !== (row?.display_name ?? "") ||
        (organization ?? "") !== (row?.organization ?? "") ||
        (roleLabel ?? "") !== (row?.role_label ?? "") ||
        (email ?? "") !== (row?.email ?? "") ||
        (phone ?? "") !== (row?.phone ?? "") ||
        (contactType ?? "other") !== (row?.external_type ?? "other") ||
        (notes ?? "") !== (row?.notes ?? ""));

  useDirtyBlocker(isDirty);

  const goBack = () => navigate({ to: "/boss/members" });

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
      setJustSaved(true);
      setTimeout(goBack, 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <header>
        <h1 className="text-base font-semibold text-foreground">
          {mode === "create" ? "New external contact" : "Edit external contact"}
        </h1>
        <p className="text-xs text-muted-foreground">
          {mode === "create"
            ? "Tenant, landlord, agency, supplier, or other non-login contact."
            : `Editing ${row?.display_name ?? "contact"}.`}
        </p>
      </header>

      <div className="space-y-3 text-xs">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className="ext-input" />
        </Field>
        <Field label="Organization / company">
          <input value={organization ?? ""} onChange={(e) => setOrg(e.target.value)} className="ext-input" />
        </Field>
        <Field label="Role / title">
          <input value={roleLabel ?? ""} onChange={(e) => setRoleLabel(e.target.value)} className="ext-input" />
        </Field>
        <Field label="Email">
          <input value={email ?? ""} onChange={(e) => setEmail(e.target.value)} className="ext-input" />
        </Field>
        <Field label="Phone">
          <input value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} className="ext-input" />
        </Field>
        <Field label="Type">
          <select
            value={contactType ?? "other"}
            onChange={(e) => setContactType(e.target.value)}
            className="ext-input"
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
            className="ext-input"
          />
        </Field>
        {err && <p className="text-destructive">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={submit}
            disabled={!name || upsert.isPending}
            className="rounded-sm bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {upsert.isPending
              ? "Saving…"
              : mode === "create"
              ? "Create contact"
              : "Save"}
          </button>
          <button
            type="button"
            onClick={goBack}
            className="rounded-sm border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      </div>
      <style>{`.ext-input { width: 100%; border: 1px solid hsl(var(--input)); background: hsl(var(--background)); border-radius: 4px; padding: 6px 8px; font-size: 12px; color: hsl(var(--foreground)); }`}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 font-medium text-foreground">{label}</div>
      {children}
    </label>
  );
}