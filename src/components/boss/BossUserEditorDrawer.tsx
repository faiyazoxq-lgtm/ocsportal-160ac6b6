import { useState } from "react";
import { useBossStaffManagement } from "@/hooks/useBossStaffManagement";
import type { BossStaffRow } from "@/types/boss";
import { EngineerProfileSection } from "@/components/people/EngineerProfileSection";

export function BossUserEditorDrawer({
  mode, row, onClose,
}: { mode: "create" | "edit"; row: BossStaffRow | null; onClose: () => void }) {
  const { createAccount, updateProfile } = useBossStaffManagement();
  const [email, setEmail] = useState(row?.email ?? "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(row?.full_name ?? "");
  const [phone, setPhone] = useState(row?.phone ?? "");
  const [role, setRole] = useState<BossStaffRow["role"]>(row?.role ?? "engineer");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    try {
      if (mode === "create") {
        await createAccount.mutateAsync({ email, password, role, full_name: fullName || null, phone: phone || null });
      } else if (row) {
        await updateProfile.mutateAsync({
          profileId: row.id, full_name: fullName, phone, role, reason: reason || undefined,
        });
      }
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 md:items-stretch">
      <div className="h-full w-full max-w-md overflow-y-auto bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{mode === "create" ? "New staff account" : "Edit profile"}</h3>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:underline">Close</button>
        </div>
        <div className="space-y-3 text-xs">
          <Field label="Email">
            <input disabled={mode === "edit"} value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </Field>
          {mode === "create" && (
            <Field label="Initial password (min 8)">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
            </Field>
          )}
          <Field label="Full name">
            <input value={fullName ?? ""} onChange={(e) => setFullName(e.target.value)} className="input" />
          </Field>
          <Field label="Phone">
            <input value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} className="input" />
          </Field>
          <Field label="Role">
            <select value={role} onChange={(e) => setRole(e.target.value as BossStaffRow["role"])} className="input">
              <option value="engineer">Engineer</option>
              <option value="dispatcher">Dispatcher</option>
              <option value="boss">Boss</option>
            </select>
          </Field>
          {mode === "edit" && (
            <Field label="Reason (for audit)">
              <input value={reason} onChange={(e) => setReason(e.target.value)} className="input" />
            </Field>
          )}
          {err && <p className="text-destructive">{err}</p>}
          <button onClick={submit} className="w-full rounded-sm bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            {mode === "create" ? "Create account" : "Save changes"}
          </button>
          {mode === "edit" && row && role === "engineer" && (
            <div className="pt-2">
              <EngineerProfileSection profileId={row.id} displayName={fullName || row.email} />
            </div>
          )}
        </div>
      </div>
      <style>{`.input { width: 100%; border: 1px solid hsl(var(--input)); background: hsl(var(--background)); border-radius: 4px; padding: 6px 8px; font-size: 12px; color: hsl(var(--foreground)); }`}</style>
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