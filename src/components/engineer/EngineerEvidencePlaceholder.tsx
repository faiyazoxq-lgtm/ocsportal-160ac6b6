import { useState } from "react";
import { Camera, Check, PenLine } from "lucide-react";

/**
 * Placeholder evidence capture. No upload — just toggles a local marker so the
 * submission validation can verify the engineer has captured each required
 * piece of evidence. Real storage upload will be wired in a later prompt.
 */
export function EvidencePlaceholder({
  kind,
  captured,
  onCapture,
  disabled,
}: {
  kind: "arrival" | "before_leaving" | "signature";
  captured: boolean;
  onCapture: () => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const meta = {
    arrival: { label: "Arrival photo", Icon: Camera },
    before_leaving: { label: "Before-leaving photo", Icon: Camera },
    signature: { label: "Customer signature", Icon: PenLine },
  }[kind];

  const Icon = meta.Icon;

  const handle = async () => {
    setBusy(true);
    // Simulated capture — real upload will hook in here.
    await new Promise((r) => setTimeout(r, 150));
    onCapture();
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled || busy}
      className={`flex w-full items-center justify-between gap-2 rounded-sm border px-3 py-2.5 text-left text-sm transition-colors ${
        captured
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
          : "border-dashed border-border bg-card text-foreground hover:bg-accent/30"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span>{meta.label}</span>
      </span>
      {captured ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium">
          <Check className="h-3.5 w-3.5" />
          Captured
        </span>
      ) : (
        <span className="text-xs font-medium text-muted-foreground">Tap to capture</span>
      )}
    </button>
  );
}