import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search,
  Send,
  Phone,
  UserPlus,
  ArchiveRestore,
  Archive,
  Pencil,
  KeyRound,
  ShieldOff,
  ShieldCheck,
  Mail,
  Building2,
  Sparkles,
} from "lucide-react";
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
          return r.kind === "app_user" || r.kind === "engineer_only";
        case "engineer":
          return (
            (r.kind === "app_user" && r.role === "engineer") ||
            r.kind === "engineer_only"
          );
        case "dispatcher":
          return r.kind === "app_user" && r.role === "dispatcher";
        case "boss":
          return r.kind === "app_user" && r.role === "boss";
        case "external":
          return r.kind === "external_contact";
        case "active":
          return (
            (r.kind === "app_user" && r.is_active) ||
            (r.kind === "engineer_only" && r.is_active) ||
            (r.kind === "external_contact" && !r.archived_at)
          );
        case "disabled":
          return (
            (r.kind === "app_user" && r.is_active === false) ||
            (r.kind === "engineer_only" && r.is_active === false)
          );
        case "archived":
          return r.kind === "external_contact" && !!r.archived_at;
      }
    });
  }, [data, q, filter]);

  const handlers = (r: PersonRow) => ({
    onEditStaff: () => setEditStaff(toStaffRow(r)),
    onEditExt: () => setEditExt(r),
    onTogglePassword: () => {
      const newPw = window.prompt("Temporary password (min 8). User must change after sign-in.");
      if (!newPw || newPw.length < 8) return;
      const reason = window.prompt("Reason for setting temp password?") ?? undefined;
      if (r.profile_id) staff.setTempPassword.mutate({ profileId: r.profile_id, tempPassword: newPw, reason });
    },
    onResetPassword: () => {
      const reason = window.prompt("Reason for password reset?") ?? undefined;
      if (r.profile_id && r.email) staff.resetPassword.mutate({ profileId: r.profile_id, email: r.email, reason });
    },
    onToggleActive: () => {
      const reason = window.prompt(r.is_active ? "Reason for disabling?" : "Reason for reactivating?") ?? undefined;
      if (r.profile_id) staff.setActive.mutate({ profileId: r.profile_id, active: !r.is_active, reason });
    },
    onToggleArchived: () => {
      if (r.external_contact_id) ext.setArchived.mutate({ id: r.external_contact_id, archived: !r.archived_at });
    },
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="rounded-xl border border-border/70 bg-gradient-to-b from-card to-card/60 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, company…"
              className="h-10 rounded-lg border-border/70 bg-background/80 pl-9 text-sm shadow-inner focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>
          <div className="flex items-center gap-2">
            {mode === "boss" && (
              <button
                onClick={() => setCreateStaff(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-gradient-to-b from-primary to-primary/80 px-3.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground shadow-sm ring-1 ring-primary/60 transition hover:shadow-md hover:brightness-110"
              >
                <UserPlus className="h-4 w-4" /> New staff
              </button>
            )}
            {(mode === "boss" || mode === "dispatcher") && (
              <button
                onClick={() => setCreateExt(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3.5 text-xs font-semibold uppercase tracking-wider text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground"
              >
                <UserPlus className="h-4 w-4" /> New external
              </button>
            )}
          </div>
        </div>
        <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition ${
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "border border-border/70 bg-background/60 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="rounded-xl border border-border/70 bg-card p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-10 text-center text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-card/50 p-10 text-center text-sm text-muted-foreground">
          No people match.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <PersonCard key={r.key} row={r} mode={mode} {...handlers(r)} />
          ))}
        </div>
      )}

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

const ROLE_THEME: Record<string, { ring: string; bar: string; chip: string; initials: string }> = {
  boss: {
    ring: "ring-red-400/40",
    bar: "bg-gradient-to-r from-red-500 via-rose-400 to-red-600 shadow-[inset_0_-1px_0_rgba(0,0,0,0.2)]",
    chip: "bg-red-50 text-red-900 ring-1 ring-red-300",
    initials:
      "bg-gradient-to-b from-red-400 via-red-500 to-red-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_4px_rgba(0,0,0,0.25)]",
  },
  dispatcher: {
    ring: "ring-emerald-400/40",
    bar: "bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-600 shadow-[inset_0_-1px_0_rgba(0,0,0,0.2)]",
    chip: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-300",
    initials:
      "bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_4px_rgba(0,0,0,0.25)]",
  },
  engineer: {
    ring: "ring-blue-400/40",
    bar: "bg-gradient-to-r from-blue-500 via-sky-400 to-blue-600 shadow-[inset_0_-1px_0_rgba(0,0,0,0.2)]",
    chip: "bg-blue-50 text-blue-900 ring-1 ring-blue-300",
    initials:
      "bg-gradient-to-b from-blue-400 via-blue-500 to-blue-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_4px_rgba(0,0,0,0.25)]",
  },
  external: {
    ring: "ring-zinc-400/40",
    bar: "bg-gradient-to-r from-zinc-300 via-zinc-200 to-zinc-400 shadow-[inset_0_-1px_0_rgba(0,0,0,0.2)]",
    chip: "bg-zinc-50 text-zinc-900 ring-1 ring-zinc-300",
    initials:
      "bg-gradient-to-b from-zinc-300 via-zinc-400 to-zinc-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)]",
  },
};

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "·";
}

function PersonCard({
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
  const themeKey =
    row.kind === "external_contact" ? "external" : (row.role ?? "engineer");
  const theme = ROLE_THEME[themeKey] ?? ROLE_THEME.engineer;
  const isAppUser = row.kind === "app_user";
  const canEdit =
    (isAppUser && mode === "boss") ||
    (!isAppUser && (mode === "boss" || mode === "dispatcher"));

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-border/70 bg-gradient-to-b from-card to-card/70 shadow-sm ring-1 ${theme.ring} transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/5`}
    >
      {/* Prestige top bar */}
      <div className={`h-1 w-full ${theme.bar}`} />

      <div className="p-4">
        {/* Header: avatar + name + badges */}
        <div className="flex items-start gap-3">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-bold tracking-wide ring-2 ring-background ${theme.initials}`}
          >
            {getInitials(row.display_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-base font-semibold text-foreground">
                {row.display_name}
              </h3>
              {isAppUser && row.role === "boss" && (
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-red-500" />
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <PersonTypeBadge row={row} />
              <AccountStatusBadge row={row} />
            </div>
          </div>
        </div>

        {/* Engineer skills */}
        <EngineerSkillChips row={row} />

        {/* Contact + org */}
        <div className="mt-4 space-y-2 text-[13px] leading-snug text-foreground/80">
          {row.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{row.email}</span>
            </div>
          )}
          {row.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-medium tabular-nums">{row.phone}</span>
            </div>
          )}
          {(row.organization || row.role_label) && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {row.organization}
                {row.organization && row.role_label ? " · " : ""}
                {row.role_label}
              </span>
            </div>
          )}
          {row.external_type && (
            <span
              className={`inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${theme.chip}`}
            >
              {row.external_type}
            </span>
          )}
        </div>

        {/* Actions footer */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          {/* Quick contact */}
          <div className="flex items-center gap-1">
            {isAppUser && row.profile_id && (
              <Link
                to="/contacts/$id"
                params={{ id: row.profile_id }}
                search={{ msg: 1 }}
                title="Message"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground transition hover:border-primary/50 hover:text-primary"
              >
                <Send className="h-3.5 w-3.5" />
              </Link>
            )}
            {row.phone && (
              <a
                href={`tel:${row.phone}`}
                title="Call"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground transition hover:border-primary/50 hover:text-primary"
              >
                <Phone className="h-3.5 w-3.5" />
              </a>
            )}
            {isAppUser && mode === "boss" && (
              <>
                <button
                  onClick={onResetPassword}
                  title="Send password reset email"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                >
                  <Mail className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={onTogglePassword}
                  title="Set temporary password"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={onToggleActive}
                  title={row.is_active ? "Disable account" : "Reactivate account"}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background transition ${
                    row.is_active
                      ? "border-border/70 text-muted-foreground hover:border-amber-400 hover:text-amber-600"
                      : "border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                  }`}
                >
                  {row.is_active ? (
                    <ShieldOff className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  )}
                </button>
              </>
            )}
            {!isAppUser && (mode === "boss" || mode === "dispatcher") && (
              <button
                onClick={onToggleArchived}
                title={row.archived_at ? "Restore" : "Archive"}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground transition hover:border-primary/50 hover:text-primary"
              >
                {row.archived_at ? (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>

          {/* Primary edit CTA */}
          {canEdit && (
            <button
              onClick={isAppUser ? onEditStaff : onEditExt}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-gradient-to-b from-primary to-primary/85 px-3 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground shadow-sm ring-1 ring-primary/60 transition hover:shadow-md hover:brightness-110"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>
      </div>
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
    work_email: null,
    role: (r.role ?? "engineer") as BossStaffRow["role"],
    is_active: r.is_active ?? true,
    disabled_at: null,
    password_reset_requested_at: null,
    created_at: r.created_at,
  };
}