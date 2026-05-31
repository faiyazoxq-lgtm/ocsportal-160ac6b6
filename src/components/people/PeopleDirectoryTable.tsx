import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Send, Phone, UserPlus, ArchiveRestore, Archive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePeopleDirectory, useExternalContactMutations } from "@/hooks/usePeopleDirectory";
import { useBossStaffManagement } from "@/hooks/useBossStaffManagement";
import { BossUserEditorDrawer } from "@/components/boss/BossUserEditorDrawer";
import { ExternalContactEditorDrawer } from "./ExternalContactEditorDrawer";
import { PersonTypeBadge, AccountStatusBadge } from "./PersonTypeBadge";
import { EngineerSkillChips } from "./EngineerSkillChips";
import type { PersonRow, PersonFilterKind } from "@/types/people";
import type { BossStaffRow } from "@/types/boss";

type Mode = "boss" | "dispatcher" | "view";

const FILTERS: { value: PersonFilterKind; label: string }[] = [
  { value: "all", label: "All people" },
  { value: "staff", label: "Staff only" },
  { value: "engineer", label: "Engineers" },
  { value: "dispatcher", label: "Admins" },
  { value: "boss", label: "Boss" },
  { value: "external", label: "External" },
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
  { value: "archived", label: "Archived" },
];

export function PeopleDirectoryTable({ mode }: { mode: Mode }) {
  const { data, isLoading, error } = usePeopleDirectory();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<PersonFilterKind>("all");
  const [editStaff, setEditStaff] = useState<BossStaffRow | null>(null);
  const [createStaff, setCreateStaff] = useState(false);
  const [editExt, setEditExt] = useState<PersonRow | null>(null);
  const [createExt, setCreateExt] = useState(false);

  const staff = useBossStaffManagement();
  const ext = useExternalContactMutations();

  const filtered = useMemo(() => {
    const rows = data ?? [];
    return rows.filter((r) => {
      if (q) {
        const hay = [r.display_name, r.email, r.organization, r.role_label, r.role]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      switch (filter) {
        case "all":
          return true;
        case "staff":
          return r.kind === "app_user";
        case "engineer":
          return r.kind === "app_user" && r.role === "engineer";
        case "dispatcher":
          return r.kind === "app_user" && r.role === "dispatcher";
        case "boss":
          return r.kind === "app_user" && r.role === "boss";
        case "external":
          return r.kind === "external_contact";
        case "active":
          return (r.kind === "app_user" && r.is_active) || (r.kind === "external_contact" && !r.archived_at);
        case "disabled":
          return r.kind === "app_user" && r.is_active === false;
        case "archived":
          return r.kind === "external_contact" && !!r.archived_at;
      }
    });
  }, [data, q, filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, company…" className="pl-7" />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as PersonFilterKind)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        {mode === "boss" && (
          <button
            onClick={() => setCreateStaff(true)}
            className="inline-flex items-center gap-1 rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <UserPlus className="h-3.5 w-3.5" /> New staff
          </button>
        )}
        {(mode === "boss" || mode === "dispatcher") && (
          <button
            onClick={() => setCreateExt(true)}
            className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <UserPlus className="h-3.5 w-3.5" /> New external
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Org / details</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : error ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-destructive">{(error as Error).message}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No people match.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.key} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">{r.display_name}</div>
                    <EngineerSkillChips row={r} />
                  </td>
                  <td className="px-3 py-2"><PersonTypeBadge row={r} /></td>
                  <td className="px-3 py-2"><AccountStatusBadge row={r} /></td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.email && <div className="truncate">{r.email}</div>}
                    {r.phone && <div>{r.phone}</div>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.organization || r.role_label ? (
                      <div className="truncate">
                        {r.organization}{r.organization && r.role_label ? " · " : ""}{r.role_label}
                      </div>
                    ) : null}
                    {r.external_type && (
                      <div className="text-[10px] uppercase tracking-wider">{r.external_type}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <RowActions
                      row={r}
                      mode={mode}
                      onEditStaff={() => setEditStaff(toStaffRow(r))}
                      onEditExt={() => setEditExt(r)}
                      onTogglePassword={() => {
                        const newPw = window.prompt("Temporary password (min 8). User must change after sign-in.");
                        if (!newPw || newPw.length < 8) return;
                        const reason = window.prompt("Reason for setting temp password?") ?? undefined;
                        if (r.profile_id) staff.setTempPassword.mutate({ profileId: r.profile_id, tempPassword: newPw, reason });
                      }}
                      onResetPassword={() => {
                        const reason = window.prompt("Reason for password reset?") ?? undefined;
                        if (r.profile_id && r.email) staff.resetPassword.mutate({ profileId: r.profile_id, email: r.email, reason });
                      }}
                      onToggleActive={() => {
                        const reason = window.prompt(r.is_active ? "Reason for disabling?" : "Reason for reactivating?") ?? undefined;
                        if (r.profile_id) staff.setActive.mutate({ profileId: r.profile_id, active: !r.is_active, reason });
                      }}
                      onToggleArchived={() => {
                        if (r.external_contact_id)
                          ext.setArchived.mutate({ id: r.external_contact_id, archived: !r.archived_at });
                      }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(editStaff || createStaff) && (
        <BossUserEditorDrawer
          mode={createStaff ? "create" : "edit"}
          row={editStaff}
          onClose={() => { setEditStaff(null); setCreateStaff(false); }}
        />
      )}
      {(editExt || createExt) && (
        <ExternalContactEditorDrawer
          mode={createExt ? "create" : "edit"}
          row={editExt}
          onClose={() => { setEditExt(null); setCreateExt(false); }}
        />
      )}
    </div>
  );
}

function RowActions({
  row,
  mode,
  onEditStaff,
  onEditExt,
  onTogglePassword,
  onResetPassword,
  onToggleActive,
  onToggleArchived,
}: {
  row: PersonRow;
  mode: Mode;
  onEditStaff: () => void;
  onEditExt: () => void;
  onTogglePassword: () => void;
  onResetPassword: () => void;
  onToggleActive: () => void;
  onToggleArchived: () => void;
}) {
  if (row.kind === "app_user") {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {row.profile_id && (
          <Link
            to="/contacts/$id"
            params={{ id: row.profile_id }}
            search={{ msg: 1 }}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <Send className="h-3 w-3" /> Message
          </Link>
        )}
        {row.phone && (
          <a href={`tel:${row.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
            <Phone className="h-3 w-3" /> Call
          </a>
        )}
        {mode === "boss" && (
          <>
            <button className="text-primary hover:underline" onClick={onEditStaff}>Edit</button>
            <button className="text-primary hover:underline" onClick={onResetPassword}>Reset pw</button>
            <button className="text-primary hover:underline" onClick={onTogglePassword}>Temp pw</button>
            <button className="text-primary hover:underline" onClick={onToggleActive}>
              {row.is_active ? "Disable" : "Reactivate"}
            </button>
          </>
        )}
      </div>
    );
  }
  // external contact
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {row.phone && (
        <a href={`tel:${row.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
          <Phone className="h-3 w-3" /> Call
        </a>
      )}
      {mode === "boss" && (
        <>
          <button className="text-primary hover:underline" onClick={onEditExt}>Edit</button>
          <button className="inline-flex items-center gap-1 text-primary hover:underline" onClick={onToggleArchived}>
            {row.archived_at ? (<><ArchiveRestore className="h-3 w-3" /> Restore</>) : (<><Archive className="h-3 w-3" /> Archive</>)}
          </button>
        </>
      )}
    </div>
  );
}

function toStaffRow(r: PersonRow): BossStaffRow | null {
  if (r.kind !== "app_user" || !r.profile_id || !r.email) return null;
  return {
    id: r.profile_id,
    email: r.email,
    full_name: r.display_name === r.email ? null : r.display_name,
    phone: r.phone,
    role: (r.role ?? "engineer") as BossStaffRow["role"],
    is_active: r.is_active ?? true,
    disabled_at: null,
    password_reset_requested_at: null,
    created_at: r.created_at,
  };
}