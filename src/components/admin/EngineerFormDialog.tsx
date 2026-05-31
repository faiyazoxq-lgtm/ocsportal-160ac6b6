import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpsertEngineer } from "@/hooks/useEngineers";
import type { Engineer, EngineerInput } from "@/types/engineers";
import type { ComplexityLevel } from "@/types/workOrders";

const COMPLEXITY: ComplexityLevel[] = ["basic", "intermediate", "advanced"];

const EMPTY: EngineerInput = {
  display_name: "",
  engineer_code: "",
  primary_trade: "",
  trade_tags: [],
  certification_tags: [],
  covered_postcode_zones: [],
  complexity_cap: "intermediate",
  can_lead: true,
  can_support: true,
  active_status: true,
  notes: "",
};

function toCsv(arr: string[]) {
  return arr.join(", ");
}
function fromCsv(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function EngineerFormDialog({
  open,
  onOpenChange,
  engineer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engineer?: Engineer | null;
}) {
  const upsert = useUpsertEngineer();
  const [form, setForm] = useState<EngineerInput>(EMPTY);
  const [tradeCsv, setTradeCsv] = useState("");
  const [certCsv, setCertCsv] = useState("");
  const [zoneCsv, setZoneCsv] = useState("");

  useEffect(() => {
    if (open) {
      if (engineer) {
        setForm({
          display_name: engineer.display_name,
          engineer_code: engineer.engineer_code ?? "",
          primary_trade: engineer.primary_trade ?? "",
          trade_tags: engineer.trade_tags,
          certification_tags: engineer.certification_tags,
          covered_postcode_zones: engineer.covered_postcode_zones,
          complexity_cap: engineer.complexity_cap,
          can_lead: engineer.can_lead,
          can_support: engineer.can_support,
          active_status: engineer.active_status,
          notes: engineer.notes ?? "",
        });
        setTradeCsv(toCsv(engineer.trade_tags));
        setCertCsv(toCsv(engineer.certification_tags));
        setZoneCsv(toCsv(engineer.covered_postcode_zones));
      } else {
        setForm(EMPTY);
        setTradeCsv("");
        setCertCsv("");
        setZoneCsv("");
      }
    }
  }, [open, engineer]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await upsert.mutateAsync({
      ...form,
      trade_tags: fromCsv(tradeCsv),
      certification_tags: fromCsv(certCsv),
      covered_postcode_zones: fromCsv(zoneCsv).map((z) => z.toUpperCase()),
      id: engineer?.id,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{engineer ? "Edit engineer" : "New engineer"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Display name" required>
            <Input
              required
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
          </Field>
          <Field label="Engineer code">
            <Input
              value={form.engineer_code ?? ""}
              onChange={(e) =>
                setForm({ ...form, engineer_code: e.target.value.toUpperCase() })
              }
            />
          </Field>
          <Field label="Primary trade">
            <Input
              value={form.primary_trade ?? ""}
              onChange={(e) => setForm({ ...form, primary_trade: e.target.value })}
              placeholder="e.g. plumbing"
            />
          </Field>
          <Field label="Complexity cap">
            <Select
              value={form.complexity_cap}
              onValueChange={(v) =>
                setForm({ ...form, complexity_cap: v as ComplexityLevel })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPLEXITY.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Trade tags (comma separated)" full>
            <Input
              value={tradeCsv}
              onChange={(e) => setTradeCsv(e.target.value)}
              placeholder="plumbing, drainage"
            />
          </Field>
          <Field label="Certifications (comma separated)" full>
            <Input
              value={certCsv}
              onChange={(e) => setCertCsv(e.target.value)}
              placeholder="gas_safe, niceic"
            />
          </Field>
          <Field label="Covered postcode zones (comma separated)" full>
            <Input
              value={zoneCsv}
              onChange={(e) => setZoneCsv(e.target.value)}
              placeholder="SE, SW, EC"
            />
          </Field>
          <Field label="Notes" full>
            <Textarea
              rows={3}
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <label className="col-span-1 flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.can_lead}
              onCheckedChange={(c) => setForm({ ...form, can_lead: c === true })}
            />
            <span>Can lead jobs</span>
          </label>
          <label className="col-span-1 flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.can_support}
              onCheckedChange={(c) => setForm({ ...form, can_support: c === true })}
            />
            <span>Can support jobs</span>
          </label>
          <label className="col-span-1 flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.active_status}
              onCheckedChange={(c) =>
                setForm({ ...form, active_status: c === true })
              }
            />
            <span>Active</span>
          </label>

          {upsert.error && (
            <div className="col-span-2 rounded-sm border border-red-200 bg-red-50 p-2 text-xs text-red-900">
              {(upsert.error as Error).message}
            </div>
          )}

          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : engineer ? "Save changes" : "Create engineer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  full,
  required,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  required?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <Label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-red-600">*</span>}
      </Label>
      {children}
    </div>
  );
}