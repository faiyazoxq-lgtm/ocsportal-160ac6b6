import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Palette, RotateCcw } from "lucide-react";
import type { WorkOrderStatus } from "@/types/workOrders";
import { updateStatusColors } from "@/lib/companySettings.functions";
import { useSiteSettings, readableInk } from "@/hooks/useSiteSettings";
import {
  DEFAULT_STATUS_COLORS,
  STATUS_COLOR_PRESETS,
  WORK_ORDER_STATUSES,
} from "@/lib/statusColors";

export function WorkOrderStatusColorSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useSiteSettings();
  const save = useServerFn(updateStatusColors);
  const mutate = useMutation({
    mutationFn: (v: Record<string, string>) => save({ data: { status_colors: v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site_settings"] }),
  });

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (data?.status_colors) {
      const merged: Record<string, string> = {};
      for (const s of WORK_ORDER_STATUSES) {
        merged[s] = data.status_colors[s] ?? DEFAULT_STATUS_COLORS[s];
      }
      setDraft(merged);
    }
  }, [data?.status_colors]);

  const onChange = (status: WorkOrderStatus, hex: string) => {
    setDraft((prev) => ({ ...prev, [status]: hex }));
  };

  const onSave = async () => {
    setErr(null);
    try {
      // Only persist overrides that differ from defaults to keep payload small
      const out: Record<string, string> = {};
      for (const s of WORK_ORDER_STATUSES) {
        if (draft[s] && draft[s].toLowerCase() !== DEFAULT_STATUS_COLORS[s].toLowerCase()) {
          out[s] = draft[s];
        }
      }
      await mutate.mutateAsync(out);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const onResetAll = () => {
    const reset: Record<string, string> = {};
    for (const s of WORK_ORDER_STATUSES) reset[s] = DEFAULT_STATUS_COLORS[s];
    setDraft(reset);
  };

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Work-order status colours</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick the row colour used on the dispatch board for each status. Changes apply
            instantly across the app for every signed-in user.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onResetAll}
            type="button"
            className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[11px] font-medium hover:bg-accent"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
          <button
            onClick={onSave}
            disabled={mutate.isPending}
            className="rounded-sm bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {mutate.isPending ? "Saving…" : "Save colours"}
          </button>
        </div>
      </header>

      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <ul className="divide-y divide-border rounded-sm border border-border">
          {WORK_ORDER_STATUSES.map((status) => {
            const hex = draft[status] ?? DEFAULT_STATUS_COLORS[status];
            return (
              <li
                key={status}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="inline-block h-6 w-12 shrink-0 rounded-sm border border-border shadow-inner"
                    style={{ backgroundColor: hex }}
                  />
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: hex, color: readableInk(hex) }}
                  >
                    {status.replace(/_/g, " ")}
                  </span>
                </div>
                <StatusColorDropdown
                  value={hex}
                  onChange={(v) => onChange(status, v)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StatusColorDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const presetMatch = STATUS_COLOR_PRESETS.find(
    (p) => p.hex.toLowerCase() === value.toLowerCase(),
  );
  return (
    <div className="flex items-center gap-2">
      <select
        value={presetMatch?.hex ?? "__custom"}
        onChange={(e) => {
          if (e.target.value !== "__custom") onChange(e.target.value);
        }}
        className="rounded-sm border border-input bg-background px-2 py-1 text-xs"
      >
        {STATUS_COLOR_PRESETS.map((p) => (
          <option key={p.hex} value={p.hex}>
            {p.label}
          </option>
        ))}
        {!presetMatch && <option value="__custom">Custom ({value})</option>}
      </select>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-9 cursor-pointer rounded-sm border border-input bg-background"
        title="Custom colour"
      />
    </div>
  );
}