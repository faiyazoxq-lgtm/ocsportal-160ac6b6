import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAddCommunicationEntry, useWorkOrderContacts } from "@/hooks/useCommunications";
import {
  COMMUNICATION_TYPES,
  FOLLOW_UP_STATUSES,
  type CommunicationType,
  type CommunicationDirection,
  type FollowUpStatus,
} from "@/types/communications";
import { toast } from "sonner";

export function AddCommunicationEntryDrawer({
  workOrderId,
  open,
  onOpenChange,
}: {
  workOrderId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: linked = [] } = useWorkOrderContacts(open ? workOrderId : null);
  const add = useAddCommunicationEntry();

  const [contactId, setContactId] = useState<string>("");
  const [type, setType] = useState<CommunicationType>("call");
  const [direction, setDirection] = useState<CommunicationDirection>("outbound");
  const [subject, setSubject] = useState("");
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState<FollowUpStatus>("information_given");
  const [needsFollowUp, setNeedsFollowUp] = useState(false);
  const [dueAt, setDueAt] = useState("");

  const reset = () => {
    setContactId(""); setType("call"); setDirection("outbound");
    setSubject(""); setSummary(""); setOutcome("information_given");
    setNeedsFollowUp(false); setDueAt("");
  };

  const submit = async () => {
    try {
      await add.mutateAsync({
        work_order_id: workOrderId,
        external_contact_id: contactId || null,
        communication_type: type,
        direction,
        subject: subject || null,
        summary: summary || null,
        outcome,
        requires_follow_up: needsFollowUp,
        follow_up_due_at: needsFollowUp && dueAt ? new Date(dueAt).toISOString() : null,
        follow_up_status: needsFollowUp ? "awaiting_response" : null,
      });
      toast.success("Communication logged");
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message ?? "Failed to log communication");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Log communication</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <Label className="text-xs">Contact</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger><SelectValue placeholder="— none (general note) —" /></SelectTrigger>
              <SelectContent>
                {linked.map((l) => (
                  <SelectItem key={l.id} value={l.external_contact_id}>
                    {l.contact?.name}{l.contact?.organization ? ` · ${l.contact.organization}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as CommunicationType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMMUNICATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Direction</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as CommunicationDirection)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Outbound</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short subject" />
          </div>
          <div>
            <Label className="text-xs">Summary</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} placeholder="What happened?" />
          </div>
          <div>
            <Label className="text-xs">Outcome</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as FollowUpStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FOLLOW_UP_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2">
            <Checkbox checked={needsFollowUp} onCheckedChange={(v) => setNeedsFollowUp(!!v)} />
            <span className="text-sm">Requires follow-up</span>
          </label>
          {needsFollowUp && (
            <div>
              <Label className="text-xs">Follow-up due</Label>
              <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={add.isPending}>Save</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}