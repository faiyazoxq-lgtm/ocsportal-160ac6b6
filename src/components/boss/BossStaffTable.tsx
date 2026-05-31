import { useState } from "react";
import { useBossStaffList, useBossStaffManagement } from "@/hooks/useBossStaffManagement";
import type { BossStaffRow } from "@/types/boss";
import { BossUserEditorDrawer } from "./BossUserEditorDrawer";

export function BossStaffTable() {
  const { data, isLoading } = useBossStaffList();
  const { setActive, resetPassword, setTempPassword } = useBossStaffManagement();
  const [editing, setEditing] = useState<BossStaffRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Staff accounts</h2>
        <button
          onClick={() => setCreating(true)}
          className="rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          New staff account
        </button>
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : !data?.length ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No staff accounts.</td></tr>
            ) : (
              data.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-foreground">{s.full_name ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.email}</td>
                  <td className="px-3 py-2"><span className="rounded-sm bg-muted px-2 py-0.5 text-[10px] uppercase">{s.role}</span></td>
                  <td className="px-3 py-2">
                    {s.is_active ? (
                      <span className="text-emerald-700 dark:text-emerald-400">Active</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">Disabled</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button className="mr-2 text-primary hover:underline" onClick={() => setEditing(s)}>Edit</button>
                    <button
                      className="mr-2 text-primary hover:underline"
                      onClick={() => {
                        const reason = window.prompt("Reason for password reset?") ?? undefined;
                        resetPassword.mutate({ profileId: s.id, email: s.email, reason });
                      }}
                    >Reset password</button>
                    <button
                      className="mr-2 text-primary hover:underline"
                      onClick={() => {
                        const tempPassword = window.prompt(
                          "Temporary password (min 8 chars). Share securely with the user — they must change it after first sign-in.",
                        );
                        if (!tempPassword || tempPassword.length < 8) return;
                        const reason = window.prompt("Reason for setting temporary password?") ?? undefined;
                        setTempPassword.mutate({ profileId: s.id, tempPassword, reason });
                      }}
                    >Set temp password</button>
                    <button
                      className="text-primary hover:underline"
                      onClick={() => {
                        const reason = window.prompt(
                          s.is_active ? "Reason for disabling?" : "Reason for reactivating?",
                        ) ?? undefined;
                        setActive.mutate({ profileId: s.id, active: !s.is_active, reason });
                      }}
                    >{s.is_active ? "Disable" : "Reactivate"}</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {(editing || creating) && (
        <BossUserEditorDrawer
          mode={creating ? "create" : "edit"}
          row={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}