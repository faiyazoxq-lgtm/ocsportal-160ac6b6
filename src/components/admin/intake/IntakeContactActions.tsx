import { useState } from "react";
import { Mail, Phone, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { IntakeRecord } from "@/types/intake";

interface Props {
  record: IntakeRecord;
  missingLabels: string[];
}

/**
 * Quick "contact the customer" action strip shown in the intake review
 * drawer. Lets the dispatcher fire off a pre-filled reply requesting any
 * missing details, place a call, then mark the contact attempt complete
 * so it stops shouting from the priority queue.
 */
export function IntakeContactActions({ record, missingLabels }: Props) {
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  const ex = record.extracted_fields_json ?? {};
  const recipient =
    record.source_sender ||
    ex.agent_email ||
    ex.tenant_email ||
    "";
  const phone =
    ex.contact_phone ||
    ex.tenant_phone ||
    "";
  const orderRef = ex.order_no || record.source_reference || record.id.slice(0, 8);
  const clientName = ex.client_name || ex.agency_name || "team";

  const missingList = missingLabels.length
    ? missingLabels.map((m) => `  • ${m}`).join("\n")
    : "  • (any further details you can share to help us dispatch)";

  const subject = `Re: ${record.source_subject || `Work order ${orderRef}`} — additional details required`;
  const body = [
    `Hi ${clientName},`,
    "",
    "Thanks for the job request. Before we can dispatch an engineer we need a few more details:",
    "",
    missingList,
    "",
    "Could you reply with these as soon as possible so we can book the visit?",
    "",
    "Many thanks,",
    "On Call Services",
  ].join("\n");

  const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const tel = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "";

  async function markComplete() {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("parsing_review_actions").insert({
        intake_record_id: record.id,
        reviewer_profile_id: u.user?.id ?? null,
        action_type: "contact_attempted",
        previous_values_json: { missing: missingLabels } as never,
        next_values_json: { contacted_at: new Date().toISOString() } as never,
        note: "Customer contacted for missing details",
      });
      setCompleted(true);
      toast.success("Marked as contacted");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-200">
          Contact customer — fill missing details
        </div>
        {completed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
            <CheckCircle2 className="h-3 w-3" /> Contacted
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          asChild
          size="sm"
          variant="default"
          disabled={!recipient}
          title={recipient ? `Reply to ${recipient}` : "No sender address on this intake"}
        >
          <a href={recipient ? mailto : undefined}>
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Reply requesting details
          </a>
        </Button>
        <Button
          asChild
          size="sm"
          variant="outline"
          disabled={!tel}
          title={phone ? `Call ${phone}` : "No phone number captured"}
        >
          <a href={tel || undefined}>
            <Phone className="mr-1.5 h-3.5 w-3.5" />
            {phone ? `Call ${phone}` : "Call (no number)"}
          </a>
        </Button>
        <Button
          size="sm"
          variant={completed ? "outline" : "secondary"}
          onClick={markComplete}
          disabled={saving || completed}
        >
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
          {completed ? "Marked complete" : "Mark contact complete"}
        </Button>
      </div>
      {missingLabels.length > 0 && (
        <div className="mt-2 text-[11px] text-amber-900/80 dark:text-amber-200/80">
          Reply template includes: {missingLabels.join(", ")}
        </div>
      )}
    </div>
  );
}