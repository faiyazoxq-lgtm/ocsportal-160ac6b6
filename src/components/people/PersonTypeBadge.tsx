import type { PersonRow } from "@/types/people";

export function PersonTypeBadge({ row }: { row: PersonRow }) {
  if (row.kind === "external_contact") {
    return (
      <span className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        External
      </span>
    );
  }
  const role = row.role ?? "engineer";
  const styles: Record<string, string> = {
    boss: "bg-violet-100 text-violet-900",
    dispatcher: "bg-sky-100 text-sky-900",
    engineer: "bg-emerald-100 text-emerald-900",
  };
  return (
    <span
      className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[role] ?? "bg-muted text-muted-foreground"}`}
    >
      {role}
    </span>
  );
}

export function AccountStatusBadge({ row }: { row: PersonRow }) {
  if (row.kind === "external_contact") {
    if (row.archived_at) {
      return (
        <span className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
          Archived
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-sm border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
        Directory only
      </span>
    );
  }
  if (row.is_active) {
    return (
      <span className="inline-flex items-center rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-900">
        Can sign in
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
      Disabled
    </span>
  );
}