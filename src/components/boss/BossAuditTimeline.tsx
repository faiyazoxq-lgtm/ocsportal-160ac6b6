import { useBossAuditLog } from "@/hooks/useBossJobOverrides";
import { BOSS_ACTION_LABEL } from "@/types/boss";

export function BossAuditTimeline() {
  const { data, isLoading } = useBossAuditLog(200);
  if (isLoading) return <p className="text-xs text-muted-foreground">Loading audit log…</p>;
  if (!data?.length) return <p className="text-xs text-muted-foreground">No boss-level actions recorded yet.</p>;
  return (
    <ul className="space-y-2">
      {data.map((e) => (
        <li key={e.id} className="rounded-md border border-border bg-card p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">
              {BOSS_ACTION_LABEL[e.action_type] ?? e.action_type}
            </span>
            <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
          </div>
          <div className="mt-1 text-muted-foreground">
            {e.target_type ? `${e.target_type} · ${e.target_id?.slice(0, 8) ?? ""}` : "—"}
            {e.reason ? ` · ${e.reason}` : ""}
          </div>
        </li>
      ))}
    </ul>
  );
}