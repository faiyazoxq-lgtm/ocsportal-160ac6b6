import { Pencil } from "lucide-react";

/**
 * Shows a small "Updated" badge when a work order has been modified after
 * initial creation (more than ~60s after created_at). Visible across all
 * views — engineer cards, admin detail, etc.
 */
export function WorkOrderUpdatedBadge({
  createdAt,
  updatedAt,
  className = "",
}: {
  createdAt: string | null | undefined;
  updatedAt: string | null | undefined;
  className?: string;
}) {
  if (!createdAt || !updatedAt) return null;
  const created = new Date(createdAt).getTime();
  const updated = new Date(updatedAt).getTime();
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return null;
  if (updated - created < 60_000) return null;

  const when = new Date(updatedAt);
  const label = `Updated ${formatRelative(when)}`;

  return (
    <span
      title={when.toLocaleString()}
      className={`inline-flex items-center gap-1 rounded-sm border border-sky-300/70 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-800 dark:bg-sky-950/40 dark:text-sky-100 ${className}`}
    >
      <Pencil className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}