import { useMemo, useState } from "react";
import { CalendarX, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useMyAvailability,
  useRemoveMyUnavailable,
  useSetMyUnavailable,
} from "@/hooks/useMyAvailability";

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  } catch {
    return d;
  }
}

/**
 * Mobile-friendly card that lets an engineer mark themselves unavailable
 * for a day (or a short range) and remove existing blocks.
 */
export function EngineerAvailabilityBlocker() {
  const list = useMyAvailability();
  const add = useSetMyUnavailable();
  const del = useRemoveMyUnavailable();
  const today = isoToday();

  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");

  const blocks = useMemo(
    () =>
      (list.data ?? []).filter(
        (a) =>
          a.availability_type === "unavailable_block" ||
          a.availability_type === "time_off",
      ),
    [list.data],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!start) return;
    if (end && end < start) {
      toast.error("End date can't be before start date.");
      return;
    }
    try {
      await add.mutateAsync({ startDate: start, endDate: end || null, note: note || null });
      toast.success("Marked unavailable. Dispatcher and Boss have been notified.");
      setStart(today);
      setEnd("");
      setNote("");
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarX className="h-4 w-4 text-amber-700" />
          <h2 className="text-sm font-semibold text-foreground">My availability</h2>
        </div>
        {!open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Mark unavailable
          </Button>
        )}
      </header>

      {open && (
        <form
          onSubmit={submit}
          className="mb-3 grid gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
                Unavailable from
              </Label>
              <Input
                type="date"
                min={today}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
                Until (optional)
              </Label>
              <Input
                type="date"
                min={start || today}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                placeholder="Same day"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
              Reason (optional)
            </Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. medical appointment"
              maxLength={200}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={add.isPending}>
              {add.isPending ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Saving…
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </div>
        </form>
      )}

      {list.isLoading ? (
        <div className="h-16 animate-pulse rounded-md bg-muted/40" />
      ) : blocks.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
          You haven't blocked any days. You'll be available for assignment by default.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-background">
          {blocks.map((b) => {
            const sameDay =
              b.start_at &&
              b.end_at &&
              new Date(b.start_at).toDateString() === new Date(b.end_at).toDateString();
            return (
              <li
                key={b.id}
                className="flex items-start justify-between gap-2 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-foreground">
                    {fmt(b.start_at)}
                    {b.end_at && !sameDay ? ` → ${fmt(b.end_at)}` : ""}
                  </div>
                  {b.note ? (
                    <div className="truncate text-muted-foreground">{b.note}</div>
                  ) : null}
                  <div className="mt-0.5 inline-flex items-center rounded-full bg-amber-200/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                    {b.availability_type === "time_off" ? "time off" : "unavailable"}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Remove block"
                  onClick={() => {
                    if (confirm("Remove this unavailable day?")) del.mutate(b.id);
                  }}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}