import { useState } from "react";
import { Download, Share, X } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

/**
 * Lightweight install nudge for the engineer shell. Uses native prompt where
 * available (Android/Chromium) and shows an iOS hint otherwise. Soft-dismiss
 * is stored locally with a 14-day TTL so engineers aren't nagged.
 */
export function InstallAppPrompt() {
  const { canPrompt, showIosHint, installed, promptInstall, dismiss } =
    usePWAInstall();
  const [busy, setBusy] = useState(false);
  const [iosExpanded, setIosExpanded] = useState(false);

  if (installed) return null;
  if (!canPrompt && !showIosHint) return null;

  return (
    <div className="mx-3 mt-3 flex items-start gap-2 rounded-md border border-border bg-card p-3 text-xs shadow-sm">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Download className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">
          Install OCS on your phone
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Faster launch, works through patchy signal, fewer taps to start a job.
        </p>
        {showIosHint && iosExpanded ? (
          <div className="mt-2 rounded-sm bg-muted/50 p-2 text-[11px] leading-snug text-foreground">
            On iPhone: tap <Share className="mx-0.5 inline h-3 w-3" /> Share,
            then <span className="font-semibold">Add to Home Screen</span>.
          </div>
        ) : null}
        <div className="mt-2 flex gap-2">
          {canPrompt ? (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await promptInstall();
                setBusy(false);
              }}
              className="inline-flex h-8 items-center rounded-sm bg-primary px-3 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Install app
            </button>
          ) : showIosHint ? (
            <button
              type="button"
              onClick={() => setIosExpanded((v) => !v)}
              className="inline-flex h-8 items-center rounded-sm bg-primary px-3 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
            >
              {iosExpanded ? "Hide steps" : "How to install"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-8 items-center rounded-sm border border-border bg-background px-3 text-[11px] font-medium text-muted-foreground hover:bg-accent"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="-mr-1 -mt-1 rounded-sm p-1 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss install prompt"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}