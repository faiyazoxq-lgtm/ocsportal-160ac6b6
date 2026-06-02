import { useMemo } from "react";
import { useContacts } from "./useContacts";
import { useTenantContacts } from "./useTenantContacts";
import { useExternalContacts } from "./useExternalContacts";

export type CombinedContactKind = "engineer" | "staff" | "tenant" | "external";

export interface CombinedContactRow {
  key: string;
  kind: CombinedContactKind;
  name: string;
  subtitle: string | null;
  phone: string | null;
  email: string | null;
  organization: string | null;
  /** profiles.id for staff/engineer-with-login, engineers.id for engineer-only, external_contacts.id otherwise. */
  refId: string;
  /** true when the row links to a chat profile via /contacts/$id */
  linkable: boolean;
}

/**
 * Combined, deduplicated, role-free view of every contact source.
 * Engineers (linked + engineer-only) come from useContacts.
 * Tenants come from useTenantContacts.
 * Other external contacts come from useExternalContacts.
 * Internal staff roles are never surfaced as labels.
 */
export function useCombinedContactsView() {
  const people = useContacts();
  const tenants = useTenantContacts();
  const external = useExternalContacts();

  const rows = useMemo<CombinedContactRow[]>(() => {
    const out: CombinedContactRow[] = [];
    for (const p of people.data ?? []) {
      const isEngineer = !!p.engineer;
      out.push({
        key: `p:${p.profile_id}`,
        kind: isEngineer ? "engineer" : "staff",
        name: p.full_name || p.email || "Unnamed",
        subtitle: isEngineer
          ? [null, p.engineer?.covered_postcode_zones?.slice(0, 3).join(", ")]
              .filter(Boolean)
              .join(" · ") || null
          : p.job_title,
        phone: p.phone,
        email: p.email,
        organization: null,
        refId: p.profile_id,
        linkable: !p.engineer_only,
      });
    }
    for (const t of tenants.data ?? []) {
      if (t.archived_at) continue;
      out.push({
        key: `t:${t.id}`,
        kind: "tenant",
        name: t.name,
        subtitle: t.organization,
        phone: t.phone,
        email: t.email,
        organization: t.organization,
        refId: t.id,
        linkable: false,
      });
    }
    for (const c of external.data ?? []) {
      if (c.archived_at) continue;
      out.push({
        key: `e:${c.id}`,
        kind: "external",
        name: c.name,
        subtitle: c.organization,
        phone: c.phone,
        email: c.email,
        organization: c.organization,
        refId: c.id,
        linkable: false,
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [people.data, tenants.data, external.data]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      engineers: rows.filter((r) => r.kind === "engineer").length,
      clients: rows.filter((r) => r.kind === "tenant").length,
      external: rows.filter((r) => r.kind === "external").length,
    }),
    [rows],
  );

  return {
    rows,
    counts,
    isLoading: people.isLoading || tenants.isLoading || external.isLoading,
    error: people.error ?? tenants.error ?? external.error,
  };
}