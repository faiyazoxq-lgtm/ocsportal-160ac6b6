import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useBossStaffManagement } from "@/hooks/useBossStaffManagement";
import type { BossStaffRow } from "@/types/boss";
import { EngineerProfileSection } from "@/components/people/EngineerProfileSection";
import { useDirtyBlocker } from "@/hooks/useDirtyBlocker";

/**
 * Page-level form for creating or editing a staff account. Replaces the
 * old BossUserEditorDrawer popup. Save and Cancel both navigate back to
 * the people directory at /boss/members.
 */
export function StaffEditorForm({
  mode,
  row,
}: {
  mode: "create" | "edit";
  row: BossStaffRow | null;
}) {
  const navigate = useNavigate();
  const { createAccount, updateProfile } = useBossStaffManagement();
  const [email, setEmail] = useState(row?.email ?? "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(row?.full_name ?? "");
  const [phone, setPhone] = useState(row?.phone ?? "");
  const [workEmail, setWorkEmail] = useState(row?.work_email ?? "");
  const [role, setRole] = useState<BossStaffRow["role"]>(row?.role ?? "engineer");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const isDirty =
    !justSaved &&
    (mode === "create"
      ? !!(email || password || fullName || phone || workEmail)
      : email !== (row?.email ?? "") ||
        (fullName ?? "") !== (row?.full_name ?? "") ||
        (phone ?? "") !== (row?.phone ?? "") ||
        (workEmail ?? "") !== (row?.work_email ?? "") ||
        role !== (row?.role ?? "engineer") ||
        !!reason);

  useDirtyBlocker(isDirty);

  const goBack = () => navigate({ to: "/boss/members" });

  const submit = async () => {
    setErr(null);
    setSubmitting(true);
    try {
      if (mode === "create") {
        const created = await createAccount.mutateAsync({
          email,
          password,
          role,
          full_name: fullName || null,
          phone: phone || null,
        });
        if (workEmail) {
          await updateProfile.mutateAsync({
            profileId: created.userId,
            work_email: workEmail,
          });
        }
      } else if (row) {
        await updateProfile.mutateAsync({
          profileId: row.id,
          full_name: fullName,
          phone,
          work_email: workEmail || null,
          role,
          reason: reason || undefined,
        });
      }
      setJustSaved(true);
      // Defer to next tick so blocker sees the cleared dirty flag.
      setTimeout(goBack, 0);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">
            {mode === "create" ? "New staff account" : "Edit staff member"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {mode === "create"
              ? "Create a sign-in account for a new staff member."
              : `Editing ${row?.full_name ?? row?.email ?? "staff member"}.`}
          </p>
        </div>
      </header>

      <div className="space-y-3 text-xs">
        <Field label="Email">
          <input
            disabled={mode === "edit"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="staff-input"
          />
        </Field>
        {mode === "create" && (
          <Field label="Initial password (min 8)">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="staff-input"
            />
          </Field>
        )}
        <Field label="Full name">
          <input
            value={fullName ?? ""}
            onChange={(e) => setFullName(e.target.value)}
            className="staff-input"
          />
        </Field>
        <Field label="Phone">
          <input
            value={phone ?? ""}
            onChange={(e) => setPhone(e.target.value)}
            className="staff-input"
          />
        </Field>
        <Field label="Work email">
          <input
            type="email"
            value={workEmail ?? ""}
            onChange={(e) => setWorkEmail(e.target.value)}
            placeholder="name@yourcompany.com"
            className="staff-input"
          />
        </Field>
        <Field label="Role">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as BossStaffRow["role"])}
            className="staff-input"
          >
            <option value="engineer">Engineer</option>
            <option value="dispatcher">Dispatcher</option>
            <option value="boss">Boss</option>
          </select>
        </Field>
        {mode === "edit" && (
          <Field label="Reason (for audit)">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="staff-input"
            />
          </Field>
        )}
        {err && <p className="text-destructive">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-sm bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting
              ? "Saving…"
              : mode === "create"
              ? "Create account"
              : "Save changes"}
          </button>
          <button
            type="button"
            onClick={goBack}
            className="rounded-sm border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-accent"
          >
            Cancel
          </button>
        </div>

        {mode === "edit" && row && role === "engineer" && (
          <div className="pt-3">
            <EngineerProfileSection
              profileId={row.id}
              displayName={fullName || row.email}
            />
          </div>
        )}
      </div>
      <style>{`.staff-input { width: 100%; border: 1px solid hsl(var(--input)); background: hsl(var(--background)); border-radius: 4px; padding: 6px 8px; font-size: 12px; color: hsl(var(--foreground)); }`}</style>
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