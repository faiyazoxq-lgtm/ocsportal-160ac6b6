import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useCreateWorkOrder } from "@/hooks/useWorkOrders";
import type { ComplexityLevel, PriorityLevel } from "@/types/workOrders";

const COMPLEXITY: ComplexityLevel[] = ["basic", "intermediate", "advanced"];
const PRIORITY: PriorityLevel[] = ["low", "normal", "high", "urgent"];

export function CreateWorkOrderDialog() {
  const [open, setOpen] = useState(false);
  const { data: clients } = useClients();
  const create = useCreateWorkOrder();

  const [form, setForm] = useState({
    order_no: "",
    client_id: "",
    address_line_1: "",
    postcode: "",
    job_summary: "",
    job_description: "",
    primary_trade: "",
    complexity_level: "intermediate" as ComplexityLevel,
    priority_level: "normal" as PriorityLevel,
    estimated_duration_minutes: "",
    estimated_value_amount: "",
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      order_no: form.order_no.trim(),
      client_id: form.client_id || null,
      address_line_1: form.address_line_1 || null,
      postcode: form.postcode || null,
      job_summary: form.job_summary || null,
      job_description: form.job_description || null,
      primary_trade: form.primary_trade || null,
      complexity_level: form.complexity_level,
      priority_level: form.priority_level,
      estimated_duration_minutes: form.estimated_duration_minutes
        ? Number(form.estimated_duration_minutes)
        : null,
      estimated_value_amount: form.estimated_value_amount
        ? Number(form.estimated_value_amount)
        : null,
    });
    setOpen(false);
    setForm((f) => ({ ...f, order_no: "", job_summary: "", job_description: "" }));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Create work order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New work order</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 text-sm">
          <Row label="Order number" required>
            <Input
              required
              value={form.order_no}
              onChange={(e) => set("order_no", e.target.value)}
            />
          </Row>
          <Row label="Client">
            <Select
              value={form.client_id}
              onValueChange={(v) => set("client_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {(clients ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Address line 1" full>
            <Input
              value={form.address_line_1}
              onChange={(e) => set("address_line_1", e.target.value)}
            />
          </Row>
          <Row label="Postcode">
            <Input
              value={form.postcode}
              onChange={(e) => set("postcode", e.target.value.toUpperCase())}
            />
          </Row>
          <Row label="Primary trade">
            <Input
              value={form.primary_trade}
              onChange={(e) => set("primary_trade", e.target.value)}
              placeholder="e.g. plumbing"
            />
          </Row>
          <Row label="Job summary" full>
            <Input
              value={form.job_summary}
              onChange={(e) => set("job_summary", e.target.value)}
            />
          </Row>
          <Row label="Job description" full>
            <Textarea
              rows={3}
              value={form.job_description}
              onChange={(e) => set("job_description", e.target.value)}
            />
          </Row>
          <Row label="Complexity">
            <Select
              value={form.complexity_level}
              onValueChange={(v) => set("complexity_level", v as ComplexityLevel)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMPLEXITY.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Priority">
            <Select
              value={form.priority_level}
              onValueChange={(v) => set("priority_level", v as PriorityLevel)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITY.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Estimated duration (min)">
            <Input
              type="number"
              inputMode="numeric"
              value={form.estimated_duration_minutes}
              onChange={(e) => set("estimated_duration_minutes", e.target.value)}
            />
          </Row>
          <Row label="Estimated value (£)">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={form.estimated_value_amount}
              onChange={(e) => set("estimated_value_amount", e.target.value)}
            />
          </Row>

          {create.error && (
            <div className="col-span-2 rounded-sm border border-red-200 bg-red-50 p-2 text-xs text-red-900">
              {(create.error as Error).message}
            </div>
          )}

          <DialogFooter className="col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create work order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Row({
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