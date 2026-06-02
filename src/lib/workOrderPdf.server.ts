import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function safe(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length ? v : "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
}

function fmtDateTime(v: unknown): string {
  if (!v || typeof v !== "string") return "—";
  try {
    return new Date(v).toLocaleString("en-GB", { timeZone: "Europe/London" });
  } catch {
    return v;
  }
}

/**
 * Generates a PDF summarising a work order. Returns raw bytes.
 */
export async function buildWorkOrderPdf(workOrderId: string): Promise<{
  bytes: Uint8Array;
  filename: string;
  orderNo: string;
  summary: string;
} | null> {
  const { data: wo, error } = await supabaseAdmin
    .from("work_orders")
    .select("*")
    .eq("id", workOrderId)
    .maybeSingle();
  if (error || !wo) return null;

  const woAny = wo as Record<string, any>;

  let clientName = "—";
  if (woAny.client_id) {
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("client_name, client_type, contact_name, contact_email, contact_phone")
      .eq("id", woAny.client_id)
      .maybeSingle();
    if (client) {
      clientName = (client as any).client_name ?? "—";
      woAny.__client = client;
    }
  }

  const { data: assignments } = await supabaseAdmin
    .from("work_order_assignments")
    .select("assignment_role, assignment_status, engineer_id")
    .eq("work_order_id", workOrderId);

  let engineerLines: string[] = [];
  if (assignments && assignments.length > 0) {
    const engineerIds = Array.from(
      new Set(assignments.map((a: any) => a.engineer_id).filter(Boolean)),
    );
    const { data: engineers } = await supabaseAdmin
      .from("engineers")
      .select("id, display_name")
      .in("id", engineerIds);
    const nameById = new Map<string, string>();
    for (const e of engineers ?? [])
      nameById.set((e as any).id, (e as any).display_name);
    engineerLines = assignments.map(
      (a: any) =>
        `${nameById.get(a.engineer_id) ?? a.engineer_id} (${a.assignment_role}, ${a.assignment_status})`,
    );
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]); // A4
  const margin = 40;
  let y = 802;
  const lineH = 14;

  const drawText = (text: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) => {
    const size = opts?.size ?? 10;
    const f = opts?.bold ? bold : font;
    const color = opts?.color ?? [0, 0, 0];
    const maxWidth = 595 - margin * 2;
    // simple word wrap
    const words = text.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      const width = f.widthOfTextAtSize(test, size);
      if (width > maxWidth && line) {
        if (y < margin) {
          page = pdf.addPage([595, 842]);
          y = 802;
        }
        page.drawText(line, { x: margin, y, size, font: f, color: rgb(color[0], color[1], color[2]) });
        y -= lineH;
        line = w;
      } else {
        line = test;
      }
    }
    if (line) {
      if (y < margin) {
        page = pdf.addPage([595, 842]);
        y = 802;
      }
      page.drawText(line, { x: margin, y, size, font: f, color: rgb(color[0], color[1], color[2]) });
      y -= lineH;
    }
  };

  const drawKV = (label: string, value: string) => {
    if (y < margin + lineH) {
      page = pdf.addPage([595, 842]);
      y = 802;
    }
    page.drawText(label, { x: margin, y, size: 9, font: bold, color: rgb(0.35, 0.35, 0.35) });
    page.drawText(value.slice(0, 200), { x: margin + 140, y, size: 10, font, color: rgb(0, 0, 0) });
    y -= lineH;
  };

  const spacer = (n = 6) => {
    y -= n;
  };

  drawText("OCS Work Order", { bold: true, size: 18 });
  spacer(2);
  drawText(`${safe(woAny.order_no)}  ·  ${safe(woAny.current_status)}`, { size: 11, color: [0.3, 0.3, 0.3] });
  spacer(10);

  drawText("Job", { bold: true, size: 12 });
  drawKV("Summary", safe(woAny.job_summary));
  if (woAny.job_description) drawText(safe(woAny.job_description));
  spacer();

  drawText("Client", { bold: true, size: 12 });
  drawKV("Name", clientName);
  if (woAny.__client) {
    drawKV("Type", safe(woAny.__client.client_type));
    drawKV("Contact", safe(woAny.__client.contact_name));
    drawKV("Phone", safe(woAny.__client.contact_phone));
    drawKV("Email", safe(woAny.__client.contact_email));
  }
  spacer();

  drawText("Location", { bold: true, size: 12 });
  drawKV(
    "Address",
    [woAny.address_line_1, woAny.address_line_2, woAny.city, woAny.postcode]
      .filter(Boolean)
      .join(", ") || "—",
  );
  drawKV("Postcode zone", safe(woAny.postcode_zone));
  spacer();

  drawText("Scope", { bold: true, size: 12 });
  drawKV("Trade tags", safe(woAny.trade_tags));
  drawKV("Priority", safe(woAny.priority_level));
  drawKV("Engineers req.", safe(woAny.engineers_required));
  drawKV("Est. duration", woAny.estimated_duration_minutes ? `${woAny.estimated_duration_minutes} min` : "—");
  drawKV("Spend cap exc VAT", woAny.estimated_value_amount != null ? `£${woAny.estimated_value_amount}` : "—");
  spacer();

  drawText("Schedule", { bold: true, size: 12 });
  drawKV("Diary date", safe(woAny.diary_date));
  drawKV("Slot", safe(woAny.diary_slot_label));
  drawKV("Start", fmtDateTime(woAny.scheduled_start_at));
  drawKV("End", fmtDateTime(woAny.scheduled_end_at));
  spacer();

  drawText("Assignments", { bold: true, size: 12 });
  if (engineerLines.length === 0) drawText("None");
  else for (const l of engineerLines) drawText(`• ${l}`);
  spacer();

  if (woAny.review_outcome || woAny.current_outcome_reason) {
    drawText("Outcome", { bold: true, size: 12 });
    drawKV("Review outcome", safe(woAny.review_outcome));
    drawKV("Outcome reason", safe(woAny.current_outcome_reason));
    spacer();
  }

  if (woAny.admin_notes) {
    drawText("Admin notes", { bold: true, size: 12 });
    drawText(safe(woAny.admin_notes));
    spacer();
  }

  spacer(10);
  drawText(
    `Created ${fmtDateTime(woAny.created_at)}  ·  Updated ${fmtDateTime(woAny.updated_at)}`,
    { size: 8, color: [0.45, 0.45, 0.45] },
  );

  const bytes = await pdf.save();
  return {
    bytes,
    filename: `${safe(woAny.order_no).replace(/[^A-Za-z0-9_-]+/g, "_")}.pdf`,
    orderNo: safe(woAny.order_no),
    summary: safe(woAny.job_summary),
  };
}
