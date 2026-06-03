import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  IntakeAdditionalContact,
  IntakeExtractedFields,
} from "@/types/intake";

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
 * Build a printable PDF preview of an intake record's extracted work-order
 * details. Used by the dispatcher intake list so a job can be reviewed /
 * shared as a document before it is converted into a real work order.
 */
export async function buildIntakePdf(intakeId: string): Promise<{
  bytes: Uint8Array;
  filename: string;
} | null> {
  const { data: rec, error } = await supabaseAdmin
    .from("intake_records")
    .select("*")
    .eq("id", intakeId)
    .maybeSingle();
  if (error || !rec) return null;

  const r = rec as Record<string, any>;
  const ex: IntakeExtractedFields = (r.extracted_fields_json ?? {}) as IntakeExtractedFields;
  const cat = (r.suggested_categorization_json ?? {}) as Record<string, unknown>;
  const extras: IntakeAdditionalContact[] = (ex.additional_contacts ?? []) ?? [];

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  const margin = 40;
  let y = 802;
  const lineH = 14;

  const drawText = (
    text: string,
    opts?: { bold?: boolean; size?: number; color?: [number, number, number] },
  ) => {
    const size = opts?.size ?? 10;
    const f = opts?.bold ? bold : font;
    const color = opts?.color ?? [0, 0, 0];
    const maxWidth = 595 - margin * 2;
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

  drawText("Intake Work Order Preview", { bold: true, size: 18 });
  spacer(2);
  drawText(`${safe(ex.order_no ?? r.source_reference)}  ·  ${safe(r.parse_status)}`, {
    size: 11,
    color: [0.3, 0.3, 0.3],
  });
  spacer(10);

  drawText("Job", { bold: true, size: 12 });
  drawKV("Summary", safe(ex.job_summary));
  if (ex.job_description) drawText(safe(ex.job_description));
  spacer();

  drawText("Site", { bold: true, size: 12 });
  drawKV(
    "Address",
    [ex.address_line_1, ex.city, ex.postcode].filter(Boolean).join(", ") || "—",
  );
  drawKV("Postcode zone", safe(ex.postcode_zone));
  spacer();

  drawText("Primary contact", { bold: true, size: 12 });
  drawKV("Name", safe(ex.contact_name));
  drawKV("Phone", safe(ex.contact_phone));
  spacer();

  drawText("Agency / tenant", { bold: true, size: 12 });
  drawKV("Agency", safe(ex.agency_name ?? ex.client_name));
  drawKV("Tenant", safe(ex.tenant_name));
  drawKV("Tenant phone", safe(ex.tenant_phone));
  drawKV("Tenant email", safe(ex.tenant_email));
  spacer();

  if (extras.length > 0) {
    drawText("Additional contacts", { bold: true, size: 12 });
    for (const c of extras) {
      const parts = [c.name, c.phone, c.email, c.role ? `(${c.role})` : null]
        .filter(Boolean)
        .join(" · ");
      drawText(`• ${parts || "—"}`);
    }
    spacer();
  }

  drawText("Categorization", { bold: true, size: 12 });
  drawKV("Priority", safe(cat.priority_level));
  drawKV("Engineers req.", safe(cat.engineers_required));
  spacer();

  if (ex.additional_notes) {
    drawText("Notes", { bold: true, size: 12 });
    drawText(safe(ex.additional_notes));
    spacer();
  }

  drawText("Source", { bold: true, size: 12 });
  drawKV("Channel", safe(r.source_type));
  drawKV("From", safe(r.source_sender));
  drawKV("Subject", safe(r.source_subject));
  drawKV("Received", fmtDateTime(r.received_at ?? r.created_at));
  spacer(10);

  drawText(`Generated ${fmtDateTime(new Date().toISOString())}`, {
    size: 8,
    color: [0.45, 0.45, 0.45],
  });

  const bytes = await pdf.save();
  const ref = safe(ex.order_no ?? r.source_reference ?? r.id).replace(
    /[^A-Za-z0-9_-]+/g,
    "_",
  );
  return { bytes, filename: `intake_${ref}.pdf` };
}
