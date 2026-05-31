import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useCreateIntakeSource } from "@/hooks/useIntakeSources";
import type { IntakeSourceType } from "@/types/intake";

interface Props {
  defaultSource?: IntakeSourceType;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
}

export function AddManualIntakeDialog({ defaultSource = "manual", triggerLabel, triggerVariant = "outline" }: Props) {
  const [open, setOpen] = useState(false);
  const [sourceType, setSourceType] = useState<IntakeSourceType>(defaultSource);
  const [sender, setSender] = useState("");
  const [subject, setSubject] = useState("");
  const [reference, setReference] = useState("");
  const [rawText, setRawText] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const create = useCreateIntakeSource();

  function reset() {
    setSourceType(defaultSource);
    setSender("");
    setSubject("");
    setReference("");
    setRawText("");
    setNotes("");
    setFile(null);
  }

  async function submit() {
    if (!sender && !subject && !rawText && !file) {
      toast.error("Add at least a sender, subject, raw text, or file");
      return;
    }
    if (file && file.size > 20 * 1024 * 1024) {
      toast.error("File too large (max 20MB)");
      return;
    }
    try {
      await create.mutateAsync({
        source_type: sourceType,
        source_sender: sender.trim() || null,
        source_subject: subject.trim() || null,
        source_reference: reference.trim() || null,
        raw_text: rawText.trim() || null,
        notes: notes.trim() || null,
        file,
      });
      toast.success("Intake source captured");
      setOpen(false);
      reset();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          {triggerLabel ?? "Add intake source"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Capture inbound work-order source</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Channel</Label>
              <Select value={sourceType} onValueChange={(v) => setSourceType(v as IntakeSourceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual entry</SelectItem>
                  <SelectItem value="email">Email (forwarded)</SelectItem>
                  <SelectItem value="upload">File upload</SelectItem>
                  <SelectItem value="webhook">Webhook / API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Reference</Label>
              <Input maxLength={255} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ticket #, msg-id, etc." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Sender</Label>
              <Input maxLength={255} value={sender} onChange={(e) => setSender(e.target.value)} placeholder="repairs@client.gov.uk" />
            </div>
            <div>
              <Label className="text-xs">Subject</Label>
              <Input maxLength={255} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Boiler fault at NW1…" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Raw text / message body</Label>
            <Textarea rows={5} maxLength={20000} value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder="Paste the email body or webhook payload here…" />
          </div>
          <div>
            <Label className="text-xs">Original source file (optional)</Label>
            <Input type="file" accept=".pdf,.eml,.msg,.png,.jpg,.jpeg,.webp,.txt,.json,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file && (
              <div className="mt-1 text-[11px] text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(1)} KB
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs">Internal notes (optional)</Label>
            <Textarea rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Capturing…" : "Capture source"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}