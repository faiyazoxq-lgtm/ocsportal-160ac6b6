import type { ReactNode } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";

/**
 * Wrap a data-bound engineer view. If the live query failed AND we're offline
 * AND we have no cached children to show, render a friendly fallback instead
 * of a raw error. When `hasCachedContent` is true, we trust the children to
 * render whatever was last hydrated.
 */
export function OfflineRouteFallback({
  loading,
  error,
  hasCachedContent,
  onRetry,
  children,
  title = "Can't reach the server",
  hint = "You appear to be offline. Cached jobs will still open from your list.",
}: {
  loading?: boolean;
  error?: unknown;
  hasCachedContent?: boolean;
  onRetry?: () => void;
  children: ReactNode;
  title?: string;
  hint?: string;
}) {
  const { offline } = useOfflineStatus();

  if (loading) return <>{children}</>;
  if (!error) return <>{children}</>;
  if (hasCachedContent) return <>{children}</>;

  const message = error instanceof Error ? error.message : String(error);

  return (
    <div className="rounded-md border border-dashed border-border bg-card p-6 text-center">
      <CloudOff className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {offline ? hint : message}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1 rounded-sm border border-border bg-background px-3 py-1.5 text-[11px] font-medium hover:bg-accent"
        >
          <RefreshCw className="h-3 w-3" />
          Try again
        </button>
      ) : null}
    </div>
  );
}