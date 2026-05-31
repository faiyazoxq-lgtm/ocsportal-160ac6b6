import type { PersonRow } from "@/types/people";

export function PersonTypeBadge({ row }: { row: PersonRow }) {
  if (row.kind === "external_contact") {
    return (
      <span className="inline-flex items-center rounded-md bg-gradient-to-b from-slate-200 to-slate-300 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(0,0,0,0.15)] ring-1 ring-slate-400/60">
        External
      </span>
    );
  }
  const role = row.role ?? "engineer";
  const styles: Record<string, string> = {
    boss:
      "bg-gradient-to-b from-red-500 to-red-700 text-white ring-1 ring-red-800/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_1px_2px_rgba(0,0,0,0.25)]",
    dispatcher:
      "bg-gradient-to-b from-emerald-500 to-emerald-700 text-white ring-1 ring-emerald-800/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_1px_2px_rgba(0,0,0,0.25)]",
    engineer:
      "bg-gradient-to-b from-blue-500 to-blue-700 text-white ring-1 ring-blue-800/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_1px_2px_rgba(0,0,0,0.25)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${styles[role] ?? "bg-muted text-muted-foreground"}`}
    >
      {role}
    </span>
  );
}

export function AccountStatusBadge({ row }: { row: PersonRow }) {
  if (row.kind === "external_contact") {
    if (row.archived_at) {
      return (
        <span className="inline-flex items-center rounded-md bg-gradient-to-b from-zinc-300 to-zinc-400 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-zinc-800 ring-1 ring-zinc-500/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
          Archived
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-md border border-border bg-background/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Directory only
      </span>
    );
  }
  if (row.is_active) {
    return (
      <span className="inline-flex items-center rounded-md bg-gradient-to-b from-emerald-100 to-emerald-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-900 ring-1 ring-emerald-400/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
        Can sign in
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-gradient-to-b from-amber-100 to-amber-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-900 ring-1 ring-amber-400/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
      Disabled
    </span>
  );
}