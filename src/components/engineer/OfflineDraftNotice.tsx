import { FileClock, X } from "lucide-react";

/**
 * Small banner shown when a previously-saved local draft has been
 * restored into the checklist/outcome form (e.g. after reload or signing
 * back in mid-job). Engineer can dismiss/clear it.
 */
export function OfflineDraftNotice({
  updatedAt,
  onDiscard,
}: {
  updatedAt: number;
  onDiscard: () => void;
}) {
  if (!updatedAt) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <FileClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="flex-1">
        <div className="font-semibold">Draft restored</div>
        <div className="opacity-80">
          We brought back what you had typed at{" "}
          {new Date(updatedAt).toLocaleTimeString()}. Not yet submitted.
        </div>
      </div>
      <button
        type="button"
        onClick={onDiscard}
        aria-label="Discard local draft"
        className="rounded p-1 hover:bg-amber-100/60 dark:hover:bg-amber-900/30"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
