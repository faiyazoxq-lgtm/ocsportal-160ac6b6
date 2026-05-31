import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import {
  useAddAvailability,
  useDeleteAvailability,
  useEngineerAvailability,
} from "@/hooks/useEngineerAvailability";
import type { AvailabilityType } from "@/types/engineers";
import type { Engineer } from "@/types/engineers";

const TYPES: { value: AvailabilityType; label: string }[] = [
  { value: "working_hours", label: "Working hours" },
  { value: "time_off", label: "Time off" },
  { value: "unavailable_block", label: "Unavailable block" },
];

export function EngineerAvailabilityDialog({
  engineer,
  open,
  onOpenChange,
}: {
  engineer: Engineer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const list = useEngineerAvailability(engineer?.id ?? null);
  const add = useAddAvailability();
  const del = useDeleteAvailability();

  const [type, setType] = useState<AvailabilityType>("working_hours");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [rule, setRule] = useState("");
  const [note, setNote] = useState("");

  if (!engineer) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!engineer) return;
    await add.mutateAsync({
      engineer_id: engineer.id,
      availability_type: type,
      start_at: start ? new Date(start).toISOString() : null,
      end_at: end ? new Date(end).toISOString() : null,
      weekday_rule: rule || null,
      note: note || null,
    });
    setStart("");
    setEnd("");
    setRule("");
    setNote("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Availability · {engineer.display_name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="grid grid-cols-2 gap-3 rounded-md border border-border bg-card p-3 text-sm">
          <Row label="Type">
            <Select value={type} onValueChange={(v) => setType(v as AvailabilityType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Weekday rule (optional)">
            <Input
              value={rule}
              onChange={(e) => setRule(e.target.value)}
              placeholder="e.g. Mon-Fri 08:00-17:00"
            />
          </Row>
          <Row label="Start">
            <Input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Row>
          <Row label="End">
            <Input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Row>
          <Row label="Note" full>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Row>
          <div className="col-span-2 flex justify-end">
            <Button type="submit" size="sm" disabled={add.isPending}>
              {add.isPending ? "Adding…" : "Add entry"}
            </Button>
          </div>
        </form>

        <div className="mt-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Existing entries
          </h3>
          {list.isLoading ? (
            <div className="h-20 animate-pulse rounded-md bg-muted/40" />
          ) : !list.data || list.data.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No availability records yet.
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto rounded-md border border-border bg-card text-xs">
              {list.data.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-2 border-b border-border px-3 py-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">
                      {a.availability_type.replace(/_/g, " ")}
                    </div>
                    <div className="text-muted-foreground">
                      {a.weekday_rule
                        ? a.weekday_rule
                        : a.start_at
                          ? `${formatDt(a.start_at)} → ${a.end_at ? formatDt(a.end_at) : "—"}`
                          : "—"}
                    </div>
                    {a.note && <div className="text-muted-foreground">{a.note}</div>}
                  </div>
                  <button
                    type="button"
                    aria-label="Delete entry"
                    onClick={() => del.mutate(a.id)}
                    className="text-muted-foreground hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatDt(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function Row({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <Label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}