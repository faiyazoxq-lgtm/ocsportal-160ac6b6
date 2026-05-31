import type { PersonRow } from "@/types/people";

/** Compact summary chips for an engineer person row in the directory list. */
export function EngineerSkillChips({ row }: { row: PersonRow }) {
  if (row.kind !== "app_user" || row.role !== "engineer" || !row.engineer) return null;
  const e = row.engineer;
  const skillCount = (e.trade_tags?.length ?? 0) + (e.certification_tags?.length ?? 0);
  const zones = e.covered_postcode_zones ?? [];
  return (
    <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
      {e.primary_trade && (
        <span className="rounded-sm bg-muted px-1.5 py-0.5 font-medium uppercase tracking-wider">
          {e.primary_trade}
        </span>
      )}
      {skillCount > 0 && (
        <span className="rounded-sm bg-muted px-1.5 py-0.5">{skillCount} skill{skillCount === 1 ? "" : "s"}</span>
      )}
      {e.can_lead && (
        <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-primary">Lead</span>
      )}
      {e.can_support !== false && (
        <span className="rounded-sm bg-accent/10 px-1.5 py-0.5 text-accent-foreground">Support</span>
      )}
      {!e.can_lead && e.can_support === false && (
        <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-destructive">No assignment role</span>
      )}
      {zones.length > 0 && (
        <span className="rounded-sm bg-muted px-1.5 py-0.5">
          {zones.slice(0, 3).join(", ")}{zones.length > 3 ? ` +${zones.length - 3}` : ""}
        </span>
      )}
      {e.active_status === false && (
        <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-destructive">Eng inactive</span>
      )}
    </div>
  );
}

/** Coverage summary used inside the editor drawer header. */
export function EngineerCoverageSummary({
  primaryTrade, tradeTags, certTags, zones,
}: {
  primaryTrade: string | null;
  tradeTags: string[];
  certTags: string[];
  zones: string[];
}) {
  return (
    <div className="rounded-sm border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
      <div><span className="font-medium text-foreground">Primary trade:</span> {primaryTrade || "—"}</div>
      <div><span className="font-medium text-foreground">Skills:</span> {tradeTags.length ? tradeTags.join(", ") : "—"}</div>
      <div><span className="font-medium text-foreground">Certifications:</span> {certTags.length ? certTags.join(", ") : "—"}</div>
      <div><span className="font-medium text-foreground">Coverage:</span> {zones.length ? zones.join(", ") : "—"}</div>
    </div>
  );
}