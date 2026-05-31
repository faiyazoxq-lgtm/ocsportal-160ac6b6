import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import type { WorkOrderWithRelations } from "@/types/workOrders";

/**
 * Printable work-order document.
 *
 * Visual format mirrors the sample work-order PDFs supplied by clients
 * (centred A4 sheet, On Call Service header, "Work Order No" banner,
 * Property Address / Tenants Details two-column block, Work Order Details
 * table with Estimate / Cost columns and a Completion Required By footer).
 */
export function WorkOrderDocument({
  wo,
  open,
  onOpenChange,
}: {
  wo: WorkOrderWithRelations;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  function handlePrint() {
    // Scope @media print rules to .wo-print-root via the global styles below.
    window.print();
  }

  const fullAddress = [
    wo.address_line_1,
    wo.address_line_2,
    wo.city,
    wo.postcode,
  ].filter(Boolean);

  const tenantName = wo.client?.client_name ?? null;
  // We don't have tenant phone/email on the work_order itself; the
  // dispatcher's contact info lives on the linked client record.
  const dateStr = new Date(wo.created_at).toLocaleDateString("en-GB");
  const completionDate = wo.diary_date
    ? new Date(wo.diary_date).toLocaleDateString("en-GB")
    : "TBC";

  const estimate = wo.estimated_value_amount
    ? `£${Number(wo.estimated_value_amount).toFixed(2)}`
    : "£0.00";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-3xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">
          Work order {wo.order_no} document
        </DialogTitle>
        {/* Toolbar (hidden in print) */}
        <div className="wo-print-hide flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
          <div className="text-xs font-medium text-muted-foreground">
            Work Order · {wo.order_no}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </Button>
          </div>
        </div>

        <div className="max-h-[80vh] overflow-y-auto bg-neutral-100 p-4 sm:p-8">
          <div
            className="wo-print-root mx-auto bg-white p-6 text-[13px] leading-snug text-neutral-900 shadow-sm sm:p-10"
            style={{ fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif', maxWidth: "780px" }}
          >
            {/* Header: sender + date */}
            <div className="grid grid-cols-2 gap-6 pb-3">
              <div className="space-y-0.5">
                <div className="font-semibold">On Call Service</div>
                <div>128 City Road</div>
                <div>London</div>
                <div>EC1V 2NX</div>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-y-1 text-[12.5px]">
                <div>Date</div>
                <div>{dateStr}</div>
                <div>Telephone</div>
                <div>020 3621 6213</div>
                <div>Fax</div>
                <div>&nbsp;</div>
                <div>E-mail</div>
                <div>job@oncallservice.co.uk</div>
              </div>
            </div>
            <hr className="border-t border-neutral-400" />

            {/* Work order number banner */}
            <div className="mt-4 border border-neutral-400 px-3 py-2 text-[13px]">
              <span className="font-semibold">Work Order No</span>
              <span className="ml-4 font-semibold tracking-wide">{wo.order_no}</span>
              <span className="ml-6 text-neutral-600">
                (Please quote this number on your invoice)
              </span>
            </div>

            {/* Summary */}
            <div className="mt-4">
              <span className="font-semibold">Work Order Summary</span>{" "}
              <span>{wo.job_summary ?? "—"}</span>
            </div>

            {/* Property + Tenants */}
            <div className="mt-4 grid grid-cols-2 gap-8">
              <div>
                <div className="mb-1 font-semibold">Property Address</div>
                {fullAddress.length === 0 ? (
                  <div className="text-neutral-500">No address on record</div>
                ) : (
                  fullAddress.map((line, i) => <div key={i}>{line}</div>)
                )}
              </div>
              <div>
                <div className="mb-1 font-semibold">Tenants Details</div>
                {tenantName ? <div>{tenantName}</div> : <div className="text-neutral-500">—</div>}
                {wo.client?.client_type && (
                  <div className="text-neutral-600">{wo.client.client_type}</div>
                )}
              </div>
            </div>

            {/* Details table */}
            <table className="mt-5 w-full border-collapse border border-neutral-400 text-[12.5px]">
              <thead>
                <tr className="bg-neutral-50">
                  <th className="w-2/3 border border-neutral-400 px-2 py-1.5 text-left font-semibold">
                    Work Order Details
                  </th>
                  <th className="w-1/6 border border-neutral-400 px-2 py-1.5 text-left font-semibold">
                    Estimate
                  </th>
                  <th className="w-1/6 border border-neutral-400 px-2 py-1.5 text-left font-semibold">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="whitespace-pre-wrap border border-neutral-400 px-2 py-2 align-top">
                    {wo.job_description ?? wo.job_summary ?? "—"}
                  </td>
                  <td className="border border-neutral-400 px-2 py-2 align-top">{estimate}</td>
                  <td className="border border-neutral-400 px-2 py-2 align-top">£0.00</td>
                </tr>
                <tr>
                  <td className="border border-neutral-400 px-2 py-2 align-top">
                    <div>
                      <span className="font-semibold">Completion Required By</span>{" "}
                      <span>{completionDate}</span>
                    </div>
                    <div className="mt-2 italic font-semibold">
                      Please advise if cost to exceed Estimate
                    </div>
                  </td>
                  <td className="border border-neutral-400 px-2 py-2 align-top">
                    <div className="font-semibold">Totals</div>
                    <div className="mt-1">{estimate}</div>
                  </td>
                  <td className="border border-neutral-400 px-2 py-2 align-top">
                    <div>&nbsp;</div>
                    <div className="mt-1">£0.00</div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Footnote */}
            <div className="mt-6 text-[11.5px] text-neutral-700">
              Please send invoices to job@oncallservice.co.uk
            </div>
            <div className="mt-1 text-[11px] text-neutral-600">
              If the job requires you to collect keys from our office, concierge etc. for
              access, we will need a photo of you returning the keys to be sent to us along
              with your completion photos before we make payment for your invoice.
            </div>

            <hr className="my-4 border-t border-neutral-300" />
            <div className="text-[10.5px] leading-tight text-neutral-600">
              On Call Service · 128 City Road, London, EC1V 2NX · job@oncallservice.co.uk
              <br />
              Priority: {wo.priority_level} · Status: {wo.current_status}
              {wo.primary_trade ? ` · Trade: ${wo.primary_trade}` : ""}
            </div>
          </div>
        </div>

        {/* Print-only scoping: hide everything except the document */}
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            .wo-print-root, .wo-print-root * { visibility: visible !important; }
            .wo-print-root { position: absolute; left: 0; top: 0; box-shadow: none !important; }
            .wo-print-hide { display: none !important; }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}