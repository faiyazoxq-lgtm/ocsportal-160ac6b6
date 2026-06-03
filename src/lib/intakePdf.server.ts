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
    opts?: { maxLines?: number; valueSize?: number },
  ) {
    const valueSize = opts?.valueSize ?? 10.5;
    const maxLines = opts?.maxLines ?? 4;
    page.drawText(label.toUpperCase(), {
      x,
      y: yPos,
      size: 7.5,
      font: bold,
      color: rgb(...MUTED),
    });
    const lines = wrapText(value || "—", width, valueSize, font).slice(0, maxLines);
    let ly = yPos - 13;
    for (const ln of lines) {
      page.drawText(ln, {
        x,
        y: ly,
        size: valueSize,
        font,
        color: rgb(...INK),
      });
      ly -= valueSize + 2.5;
    }
    // Total vertical space consumed (label + value lines)
    const consumed = 13 + lines.length * (valueSize + 2.5);
    return { nextY: ly, height: consumed };
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

  // SITE & DISPATCH (two columns) — heights are content-driven
  sectionTitle("Site & Dispatch");
  const colW = (contentW - 12) / 2;
  const rx = margin + colW + 12;
  const pad = 12;
  const addrLines = formatAddress(ex);
  // measure left card
  const addrInnerW = colW - pad * 2;
  const wrappedAddr: string[] = [];
  for (const ln of addrLines) wrappedAddr.push(...wrapText(ln, addrInnerW, 11, bold));
  const leftH = 14 + 14 + wrappedAddr.length * 13 + pad;
  // measure right card (2 rows × 2 cols KV grid)
  const dispInnerW = colW - pad * 2;
  const halfW = (dispInnerW - 10) / 2;
  const rowAH = Math.max(
    13 + wrapText(safe(ex.postcode_zone) || "—", halfW, 10.5, font).slice(0, 2).length * 13,
    13 + wrapText(titleCase(safe(cat.priority_level)) || "—", halfW, 10.5, font).slice(0, 2).length * 13,
  );
  const rowBH = Math.max(
    13 + wrapText(safe(cat.engineers_required) || "—", halfW, 10.5, font).slice(0, 2).length * 13,
    13 + wrapText(cat.diary_ready ? "Yes" : "No", halfW, 10.5, font).slice(0, 2).length * 13,
  );
  const rightH = 14 + rowAH + 10 + rowBH + pad;
  const sdH = Math.max(leftH, rightH, 70);
  ensure(sdH + 10);
  const sdTop = y;
  // left card (address)
  page.drawRectangle({ x: margin, y: y - sdH, width: colW, height: sdH, color: rgb(...CARD_BG) });
  page.drawRectangle({ x: margin, y: y - sdH, width: 3, height: sdH, color: rgb(...GOLD) });
  page.drawText("SITE ADDRESS", {
    x: margin + pad, y: y - 14, size: 7.5, font: bold, color: rgb(...GOLD),
  });
  {
    let ay = y - 30;
    for (const ln of wrappedAddr) {
      page.drawText(ln, { x: margin + pad, y: ay, size: 11, font: bold, color: rgb(...INK) });
      ay -= 13;
    }
  }
  // right card (dispatch)
  page.drawRectangle({ x: rx, y: y - sdH, width: colW, height: sdH, color: rgb(...CARD_BG) });
  page.drawRectangle({ x: rx, y: y - sdH, width: 3, height: sdH, color: rgb(...GOLD) });
  drawKV(rx + pad, y - 14, "Postcode zone", safe(ex.postcode_zone), halfW, { maxLines: 2 });
  drawKV(rx + pad + halfW + 10, y - 14, "Priority", titleCase(safe(cat.priority_level)), halfW, { maxLines: 2 });
  drawKV(rx + pad, y - 14 - rowAH - 10, "Engineers req.", safe(cat.engineers_required), halfW, { maxLines: 2 });
  drawKV(rx + pad + halfW + 10, y - 14 - rowAH - 10, "Diary ready", cat.diary_ready ? "Yes" : "No", halfW, { maxLines: 2 });
  y = sdTop - sdH - 14;

  // CONTACTS
  sectionTitle("Contacts");

  // Primary site contact — full-width, content-driven
  {
    const innerW = contentW - pad * 2;
    const nameLines = wrapText(safe(ex.contact_name), innerW, 12, bold);
    const phoneLines = wrapText(safe(ex.contact_phone), innerW, 10.5, font);
    const h = 14 + nameLines.length * 14 + 4 + phoneLines.length * 13 + pad;
    ensure(h + 6);
    const top = y;
    page.drawRectangle({ x: margin, y: y - h, width: contentW, height: h, color: rgb(...CARD_BG) });
    page.drawRectangle({ x: margin, y: y - h, width: 3, height: h, color: rgb(...GOLD) });
    page.drawText("PRIMARY SITE CONTACT", {
      x: margin + pad, y: y - 14, size: 7.5, font: bold, color: rgb(...GOLD),
    });
    let py = y - 28;
    for (const ln of nameLines) {
      page.drawText(ln, { x: margin + pad, y: py, size: 12, font: bold, color: rgb(...INK) });
      py -= 14;
    }
    py -= 2;
    for (const ln of phoneLines) {
      page.drawText(ln, { x: margin + pad, y: py, size: 10.5, font, color: rgb(...NAVY_SOFT) });
      py -= 13;
    }
    y = top - h - 10;
  }

  // Agency + tenant (two columns, content-driven)
  {
    const innerW = colW - pad * 2;
    const agencyName = safe(ex.agency_name ?? ex.client_name);
    const agencyLines = wrapText(agencyName, innerW, 12, bold);
    const leftBodyH = agencyLines.length * 14;

    const tenantNameLines = wrapText(safe(ex.tenant_name), innerW, 12, bold);
    const tenantPhoneLines = wrapText(safe(ex.tenant_phone), innerW, 10, font);
    const tenantEmailLines = wrapText(safe(ex.tenant_email), innerW, 9.5, font);
    const rightBodyH =
      tenantNameLines.length * 14 + 2 +
      tenantPhoneLines.length * 12 + 2 +
      tenantEmailLines.length * 11;

    const acH = Math.max(14 + 14 + leftBodyH + pad, 14 + 14 + rightBodyH + pad, 60);
    ensure(acH + 6);
    const acTop = y;
    // left
    page.drawRectangle({ x: margin, y: y - acH, width: colW, height: acH, color: rgb(...CARD_BG) });
    page.drawRectangle({ x: margin, y: y - acH, width: 3, height: acH, color: rgb(...GOLD) });
    page.drawText("MANAGING AGENCY", {
      x: margin + pad, y: y - 14, size: 7.5, font: bold, color: rgb(...GOLD),
    });
    {
      let ly = y - 30;
      for (const ln of agencyLines) {
        page.drawText(ln, { x: margin + pad, y: ly, size: 12, font: bold, color: rgb(...INK) });
        ly -= 14;
      }
    }
    // right
    page.drawRectangle({ x: rx, y: y - acH, width: colW, height: acH, color: rgb(...CARD_BG) });
    page.drawRectangle({ x: rx, y: y - acH, width: 3, height: acH, color: rgb(...GOLD) });
    page.drawText("TENANT / OCCUPIER", {
      x: rx + pad, y: y - 14, size: 7.5, font: bold, color: rgb(...GOLD),
    });
    {
      let ry = y - 30;
      for (const ln of tenantNameLines) {
        page.drawText(ln, { x: rx + pad, y: ry, size: 12, font: bold, color: rgb(...INK) });
        ry -= 14;
      }
      ry -= 2;
      for (const ln of tenantPhoneLines) {
        page.drawText(ln, { x: rx + pad, y: ry, size: 10, font, color: rgb(...NAVY_SOFT) });
        ry -= 12;
      }
      ry -= 2;
      for (const ln of tenantEmailLines) {
        page.drawText(ln, { x: rx + pad, y: ry, size: 9.5, font, color: rgb(...MUTED) });
        ry -= 11;
      }
    }
    y = acTop - acH - 14;
  }

  // ADDITIONAL CONTACTS — content-driven
  if (extras.length > 0) {
    sectionTitle("Additional contacts");
    const innerW = contentW - pad * 2;
    for (const c of extras) {
      const role = c.role ? c.role : "Contact";
      const nameLines = wrapText(safe(c.name), innerW, 11, bold);
      const meta = [c.phone, c.email].filter(Boolean).join("  ·  ") || "—";
      const metaLines = wrapText(meta, innerW, 9.5, font);
      const lineH = 14 + nameLines.length * 13 + 2 + metaLines.length * 12 + pad;
      ensure(lineH + 6);
      const top = y;
      page.drawRectangle({ x: margin, y: y - lineH, width: contentW, height: lineH, color: rgb(...CARD_BG) });
      page.drawRectangle({ x: margin, y: y - lineH, width: 3, height: lineH, color: rgb(...GOLD) });
      page.drawText(role.toUpperCase(), {
        x: margin + pad, y: y - 14, size: 7.5, font: bold, color: rgb(...GOLD),
      });
      let cy = y - 28;
      for (const ln of nameLines) {
        page.drawText(ln, { x: margin + pad, y: cy, size: 11, font: bold, color: rgb(...INK) });
        cy -= 13;
      }
      cy -= 2;
      for (const ln of metaLines) {
        page.drawText(ln, { x: margin + pad, y: cy, size: 9.5, font, color: rgb(...NAVY_SOFT) });
        cy -= 12;
      }
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

  // SOURCE — 2×2 grid so long emails/subjects wrap cleanly
  sectionTitle("Source");
  {
    const innerW = contentW - pad * 2;
    const cellW = (innerW - 16) / 2;
    const channel = titleCase(safe(r.source_type));
    const fromStr = safe(r.source_sender);
    const subject = safe(r.source_subject);
    const received = fmtDateTime(r.received_at ?? r.created_at);
    const rowH = (a: string, b: string) => Math.max(
      13 + wrapText(a, cellW, 10.5, font).slice(0, 3).length * 13,
      13 + wrapText(b, cellW, 10.5, font).slice(0, 3).length * 13,
    );
    const r1 = rowH(channel, fromStr);
    const r2 = rowH(subject, received);
    const srcH = 14 + r1 + 10 + r2 + pad;
    ensure(srcH + 6);
    const srcTop = y;
    page.drawRectangle({ x: margin, y: y - srcH, width: contentW, height: srcH, color: rgb(...CARD_BG) });
    page.drawRectangle({ x: margin, y: y - srcH, width: 3, height: srcH, color: rgb(...GOLD) });
    drawKV(margin + pad, y - 14, "Channel", channel, cellW, { maxLines: 3 });
    drawKV(margin + pad + cellW + 16, y - 14, "From", fromStr, cellW, { maxLines: 3 });
    drawKV(margin + pad, y - 14 - r1 - 10, "Subject", subject, cellW, { maxLines: 3 });
    drawKV(margin + pad + cellW + 16, y - 14 - r1 - 10, "Received", received, cellW, { maxLines: 3 });
    y = srcTop - srcH - 8;
  }

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
