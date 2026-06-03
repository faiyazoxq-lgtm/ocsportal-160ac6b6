import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { OCS_LOGO_PNG_BASE64 } from "./ocsLogo.server";
import type {
  IntakeAdditionalContact,
  IntakeExtractedFields,
} from "@/types/intake";

// Brand contact block shown in header + footer of every page
const BRAND_NAME = "OCS · On Call Services";
const BRAND_TAGLINE = "Property maintenance · Dispatch operations";
const BRAND_WEB = "ocsportal.co.uk";
const BRAND_EMAIL = "dispatch@ocsportal.co.uk";

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function safe(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length ? v : "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
}

function fmtDateTime(v: unknown): string {
  if (!v || typeof v !== "string") return "—";
  try {
    return new Date(v).toLocaleString("en-GB", {
      timeZone: "Europe/London",
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return v;
  }
}

function titleCase(s: string): string {
  return s
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatAddress(ex: IntakeExtractedFields): string[] {
  const lines: string[] = [];
  if (ex.address_line_1) lines.push(ex.address_line_1);
  const cityLine = [ex.city, ex.postcode].filter(Boolean).join("  ");
  if (cityLine) lines.push(cityLine);
  return lines.length ? lines : ["—"];
}

/**
 * Build a printable PDF preview of an intake record's extracted work-order
 * details, styled as a polished, luxury-feel work order document.
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
  const extras: IntakeAdditionalContact[] = ex.additional_contacts ?? [];

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  // Embed brand logo (PNG inlined at build time so it works in the Worker runtime)
  let logoImage: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  try {
    logoImage = await pdf.embedPng(decodeBase64(OCS_LOGO_PNG_BASE64));
  } catch {
    logoImage = null;
  }

  // Page geometry
  const W = 595;
  const H = 842;
  const margin = 44;
  const contentW = W - margin * 2;

  // Luxury palette
  const NAVY: [number, number, number] = [0.07, 0.11, 0.20];
  const NAVY_SOFT: [number, number, number] = [0.16, 0.22, 0.34];
  const GOLD: [number, number, number] = [0.78, 0.62, 0.25];
  const INK: [number, number, number] = [0.10, 0.12, 0.16];
  const MUTED: [number, number, number] = [0.42, 0.45, 0.52];
  const HAIRLINE: [number, number, number] = [0.86, 0.87, 0.90];
  const CARD_BG: [number, number, number] = [0.975, 0.97, 0.95];
  const PAGE_BG: [number, number, number] = [0.99, 0.985, 0.975];

  let pageNo = 0;
  const pages: Array<ReturnType<typeof pdf.addPage>> = [];
  let page = newPage();
  let y = H - 170; // start below taller branded header

  function newPage() {
    pageNo += 1;
    const p = pdf.addPage([W, H]);
    pages.push(p);
    // page background
    p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...PAGE_BG) });
    // header band (taller, branded)
    const headerH = 120;
    p.drawRectangle({ x: 0, y: H - headerH, width: W, height: headerH, color: rgb(...NAVY) });
    // gold accent strip
    p.drawRectangle({ x: 0, y: H - headerH - 4, width: W, height: 4, color: rgb(...GOLD) });

    // Logo (left), with brand wordmark + contact block alongside
    let textX = margin;
    if (logoImage) {
      const logoH = 46;
      const ratio = logoImage.width / logoImage.height;
      const logoW = logoH * ratio;
      p.drawImage(logoImage, {
        x: margin,
        y: H - 36 - logoH,
        width: logoW,
        height: logoH,
      });
      textX = margin + logoW + 14;
    }

    // Brand wordmark
    p.drawText(BRAND_NAME, {
      x: textX,
      y: H - 44,
      size: 13,
      font: bold,
      color: rgb(1, 1, 1),
    });
    p.drawText(BRAND_TAGLINE, {
      x: textX,
      y: H - 58,
      size: 8.5,
      font: italic,
      color: rgb(...GOLD),
    });
    // Contact details
    p.drawText(`Web  ${BRAND_WEB}`, {
      x: textX,
      y: H - 78,
      size: 8.5,
      font,
      color: rgb(0.82, 0.86, 0.94),
    });
    p.drawText(`Email  ${BRAND_EMAIL}`, {
      x: textX,
      y: H - 92,
      size: 8.5,
      font,
      color: rgb(0.82, 0.86, 0.94),
    });

    // Document type label, bottom-left of header
    p.drawText("WORK ORDER · Intake preview", {
      x: margin,
      y: H - 112,
      size: 8,
      font: bold,
      color: rgb(...GOLD),
    });

    // top-right reference block
    const ref = safe(ex.order_no ?? r.source_reference ?? r.id);
    const refLabel = "REFERENCE";
    const refW = bold.widthOfTextAtSize(ref, 14);
    p.drawText(refLabel, {
      x: W - margin - Math.max(refW, 90),
      y: H - 44,
      size: 8,
      font: bold,
      color: rgb(...GOLD),
    });
    p.drawText(ref, {
      x: W - margin - refW,
      y: H - 64,
      size: 14,
      font: bold,
      color: rgb(1, 1, 1),
    });
    const stat = titleCase(safe(r.parse_status));
    const statW = font.widthOfTextAtSize(stat, 9);
    p.drawRectangle({
      x: W - margin - statW - 16,
      y: H - 92,
      width: statW + 12,
      height: 16,
      color: rgb(...GOLD),
    });
    p.drawText(stat, {
      x: W - margin - statW - 10,
      y: H - 88,
      size: 9,
      font: bold,
      color: rgb(...NAVY),
    });
    return p;
  }

  function ensure(space: number) {
    if (y - space < 60) {
      page = newPage();
      y = H - 170;
    }
  }

  function wrapText(text: string, maxWidth: number, size: number, f = font): string[] {
    const out: string[] = [];
    const paragraphs = text.split(/\n+/);
    for (const para of paragraphs) {
      const words = para.split(/\s+/);
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (f.widthOfTextAtSize(test, size) > maxWidth && line) {
          out.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) out.push(line);
    }
    return out;
  }

  function sectionTitle(label: string) {
    ensure(34);
    // gold bar + uppercase title
    page.drawRectangle({
      x: margin,
      y: y - 2,
      width: 22,
      height: 2,
      color: rgb(...GOLD),
    });
    page.drawText(label.toUpperCase(), {
      x: margin + 30,
      y: y - 8,
      size: 10,
      font: bold,
      color: rgb(...NAVY_SOFT),
    });
    y -= 18;
    // hairline
    page.drawRectangle({
      x: margin,
      y,
      width: contentW,
      height: 0.6,
      color: rgb(...HAIRLINE),
    });
    y -= 12;
  }

  function card(height: number, opts?: { tint?: [number, number, number] }) {
    ensure(height + 6);
    const top = y;
    page.drawRectangle({
      x: margin,
      y: y - height,
      width: contentW,
      height,
      color: rgb(...(opts?.tint ?? CARD_BG)),
    });
    // left gold accent
    page.drawRectangle({
      x: margin,
      y: y - height,
      width: 3,
      height,
      color: rgb(...GOLD),
    });
    y -= height + 10;
    return top;
  }

  function drawKV(
    x: number,
    yPos: number,
    label: string,
    value: string,
    width: number,
  ) {
    page.drawText(label.toUpperCase(), {
      x,
      y: yPos,
      size: 7.5,
      font: bold,
      color: rgb(...MUTED),
    });
    const lines = wrapText(value || "—", width, 10.5, font);
    let ly = yPos - 13;
    for (const ln of lines.slice(0, 3)) {
      page.drawText(ln, {
        x,
        y: ly,
        size: 10.5,
        font,
        color: rgb(...INK),
      });
      ly -= 13;
    }
    return ly;
  }

  function paragraph(text: string, size = 10.5, color = INK) {
    const lines = wrapText(text, contentW - 24, size, font);
    for (const ln of lines) {
      ensure(size + 4);
      page.drawText(ln, {
        x: margin + 12,
        y,
        size,
        font,
        color: rgb(...color),
      });
      y -= size + 4;
    }
  }

  // ============== BUILD ==============
  // JOB OVERVIEW (hero card)
  const summary = safe(ex.job_summary);
  const summaryLines = wrapText(summary, contentW - 32, 13, bold);
  const descLines = ex.job_description
    ? wrapText(safe(ex.job_description), contentW - 32, 10, font)
    : [];
  const heroH = 22 + summaryLines.length * 16 + (descLines.length ? 8 + descLines.length * 13 : 0) + 14;
  ensure(heroH + 10);
  page.drawRectangle({
    x: margin,
    y: y - heroH,
    width: contentW,
    height: heroH,
    color: rgb(...NAVY),
  });
  page.drawRectangle({
    x: margin,
    y: y - heroH,
    width: 4,
    height: heroH,
    color: rgb(...GOLD),
  });
  let hy = y - 18;
  page.drawText("JOB SUMMARY", {
    x: margin + 16,
    y: hy,
    size: 8,
    font: bold,
    color: rgb(...GOLD),
  });
  hy -= 18;
  for (const ln of summaryLines) {
    page.drawText(ln, {
      x: margin + 16,
      y: hy,
      size: 13,
      font: bold,
      color: rgb(1, 1, 1),
    });
    hy -= 16;
  }
  if (descLines.length) {
    hy -= 4;
    for (const ln of descLines) {
      page.drawText(ln, {
        x: margin + 16,
        y: hy,
        size: 10,
        font,
        color: rgb(0.82, 0.85, 0.90),
      });
      hy -= 13;
    }
  }
  y -= heroH + 18;

  // SITE & DISPATCH (two columns)
  sectionTitle("Site & Dispatch");
  const colW = (contentW - 12) / 2;
  const addrLines = formatAddress(ex);
  const siteH = 24 + Math.max(addrLines.length, 1) * 13 + 20;
  ensure(siteH + 6);
  const siteTop = y;
  // left card (address)
  page.drawRectangle({
    x: margin,
    y: y - siteH,
    width: colW,
    height: siteH,
    color: rgb(...CARD_BG),
  });
  page.drawRectangle({
    x: margin,
    y: y - siteH,
    width: 3,
    height: siteH,
    color: rgb(...GOLD),
  });
  page.drawText("SITE ADDRESS", {
    x: margin + 12,
    y: y - 14,
    size: 7.5,
    font: bold,
    color: rgb(...MUTED),
  });
  let ay = y - 30;
  for (const ln of addrLines) {
    page.drawText(ln, {
      x: margin + 12,
      y: ay,
      size: 11,
      font: bold,
      color: rgb(...INK),
    });
    ay -= 13;
  }
  // right card (dispatch)
  const rx = margin + colW + 12;
  page.drawRectangle({
    x: rx,
    y: y - siteH,
    width: colW,
    height: siteH,
    color: rgb(...CARD_BG),
  });
  page.drawRectangle({
    x: rx,
    y: y - siteH,
    width: 3,
    height: siteH,
    color: rgb(...GOLD),
  });
  const dispW = colW - 24;
  const halfW = (dispW - 8) / 2;
  drawKV(rx + 12, y - 14, "Postcode zone", safe(ex.postcode_zone), halfW);
  drawKV(rx + 12 + halfW + 8, y - 14, "Priority", titleCase(safe(cat.priority_level)), halfW);
  drawKV(rx + 12, y - 14 - 32, "Engineers req.", safe(cat.engineers_required), halfW);
  drawKV(rx + 12 + halfW + 8, y - 14 - 32, "Diary ready", cat.diary_ready ? "Yes" : "No", halfW);
  y = siteTop - siteH - 14;

  // CONTACTS
  sectionTitle("Contacts");

  // Primary site contact (single card)
  const primaryH = 46;
  card(primaryH);
  {
    const top = y + primaryH + 10;
    page.drawText("PRIMARY SITE CONTACT", {
      x: margin + 12,
      y: top - 14,
      size: 7.5,
      font: bold,
      color: rgb(...GOLD),
    });
    page.drawText(safe(ex.contact_name), {
      x: margin + 12,
      y: top - 28,
      size: 12,
      font: bold,
      color: rgb(...INK),
    });
    page.drawText(safe(ex.contact_phone), {
      x: margin + 12,
      y: top - 42,
      size: 10.5,
      font,
      color: rgb(...NAVY_SOFT),
    });
  }

  // Agency + tenant (two columns)
  const acH = 78;
  ensure(acH + 6);
  const acTop = y;
  page.drawRectangle({
    x: margin,
    y: y - acH,
    width: colW,
    height: acH,
    color: rgb(...CARD_BG),
  });
  page.drawRectangle({ x: margin, y: y - acH, width: 3, height: acH, color: rgb(...GOLD) });
  page.drawText("MANAGING AGENCY", {
    x: margin + 12,
    y: y - 14,
    size: 7.5,
    font: bold,
    color: rgb(...GOLD),
  });
  page.drawText(safe(ex.agency_name ?? ex.client_name), {
    x: margin + 12,
    y: y - 30,
    size: 12,
    font: bold,
    color: rgb(...INK),
  });

  page.drawRectangle({
    x: rx,
    y: y - acH,
    width: colW,
    height: acH,
    color: rgb(...CARD_BG),
  });
  page.drawRectangle({ x: rx, y: y - acH, width: 3, height: acH, color: rgb(...GOLD) });
  page.drawText("TENANT / OCCUPIER", {
    x: rx + 12,
    y: y - 14,
    size: 7.5,
    font: bold,
    color: rgb(...GOLD),
  });
  page.drawText(safe(ex.tenant_name), {
    x: rx + 12,
    y: y - 30,
    size: 12,
    font: bold,
    color: rgb(...INK),
  });
  page.drawText(safe(ex.tenant_phone), {
    x: rx + 12,
    y: y - 46,
    size: 10,
    font,
    color: rgb(...NAVY_SOFT),
  });
  page.drawText(safe(ex.tenant_email), {
    x: rx + 12,
    y: y - 60,
    size: 9.5,
    font,
    color: rgb(...MUTED),
  });
  y = acTop - acH - 14;

  // ADDITIONAL CONTACTS
  if (extras.length > 0) {
    sectionTitle("Additional contacts");
    for (const c of extras) {
      const role = c.role ? c.role : "Contact";
      const lineH = 52;
      ensure(lineH + 6);
      const top = y;
      page.drawRectangle({
        x: margin,
        y: y - lineH,
        width: contentW,
        height: lineH,
        color: rgb(...CARD_BG),
      });
      page.drawRectangle({
        x: margin,
        y: y - lineH,
        width: 3,
        height: lineH,
        color: rgb(...GOLD),
      });
      page.drawText(role.toUpperCase(), {
        x: margin + 12,
        y: y - 14,
        size: 7.5,
        font: bold,
        color: rgb(...GOLD),
      });
      page.drawText(safe(c.name), {
        x: margin + 12,
        y: y - 28,
        size: 11,
        font: bold,
        color: rgb(...INK),
      });
      const meta = [c.phone, c.email].filter(Boolean).join("  ·  ") || "—";
      page.drawText(meta, {
        x: margin + 12,
        y: y - 42,
        size: 9.5,
        font,
        color: rgb(...NAVY_SOFT),
      });
      y = top - lineH - 8;
    }
  }

  // NOTES
  if (ex.additional_notes) {
    sectionTitle("Notes");
    const lines = wrapText(safe(ex.additional_notes), contentW - 24, 10.5, font);
    const h = 16 + lines.length * 13;
    ensure(h + 6);
    const top = y;
    page.drawRectangle({
      x: margin,
      y: y - h,
      width: contentW,
      height: h,
      color: rgb(...CARD_BG),
    });
    page.drawRectangle({ x: margin, y: y - h, width: 3, height: h, color: rgb(...GOLD) });
    let ny = y - 16;
    for (const ln of lines) {
      page.drawText(ln, { x: margin + 12, y: ny, size: 10.5, font, color: rgb(...INK) });
      ny -= 13;
    }
    y = top - h - 14;
  }

  // SOURCE
  sectionTitle("Source");
  const srcH = 64;
  ensure(srcH + 6);
  const srcTop = y;
  page.drawRectangle({
    x: margin,
    y: y - srcH,
    width: contentW,
    height: srcH,
    color: rgb(...CARD_BG),
  });
  page.drawRectangle({ x: margin, y: y - srcH, width: 3, height: srcH, color: rgb(...GOLD) });
  const qW = (contentW - 48) / 4;
  drawKV(margin + 12, y - 14, "Channel", titleCase(safe(r.source_type)), qW);
  drawKV(margin + 12 + qW + 12, y - 14, "From", safe(r.source_sender), qW);
  drawKV(margin + 12 + (qW + 12) * 2, y - 14, "Subject", safe(r.source_subject), qW);
  drawKV(
    margin + 12 + (qW + 12) * 3,
    y - 14,
    "Received",
    fmtDateTime(r.received_at ?? r.created_at),
    qW,
  );
  y = srcTop - srcH - 8;

  // FOOTERS on every page
  const generated = `Generated ${fmtDateTime(new Date().toISOString())}`;
  pages.forEach((p, idx) => {
    p.drawRectangle({
      x: margin,
      y: 54,
      width: contentW,
      height: 0.8,
      color: rgb(...HAIRLINE),
    });
    // Gold accent tick on footer
    p.drawRectangle({
      x: margin,
      y: 52,
      width: 22,
      height: 2,
      color: rgb(...GOLD),
    });
    p.drawText(BRAND_NAME, {
      x: margin,
      y: 38,
      size: 8.5,
      font: bold,
      color: rgb(...NAVY),
    });
    p.drawText(`${BRAND_WEB}  ·  ${BRAND_EMAIL}`, {
      x: margin,
      y: 26,
      size: 8,
      font,
      color: rgb(...NAVY_SOFT),
    });
    p.drawText(generated, {
      x: margin,
      y: 14,
      size: 7.5,
      font: italic,
      color: rgb(...MUTED),
    });
    const pageStr = `Page ${idx + 1} of ${pages.length}`;
    const w = font.widthOfTextAtSize(pageStr, 8);
    p.drawText(pageStr, {
      x: W - margin - w,
      y: 26,
      size: 8,
      font: bold,
      color: rgb(...NAVY),
    });
  });

  const bytes = await pdf.save();
  const ref = safe(ex.order_no ?? r.source_reference ?? r.id).replace(
    /[^A-Za-z0-9_-]+/g,
    "_",
  );
  return { bytes, filename: `intake_${ref}.pdf` };
}
