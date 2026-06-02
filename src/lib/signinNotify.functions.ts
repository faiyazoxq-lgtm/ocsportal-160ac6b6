import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTelegramMessage } from "@/services/telegramSend.server";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  const browser =
    /Edg\/[\d.]+/.exec(ua)?.[0]?.replace("/", " ") ??
    /OPR\/[\d.]+/.exec(ua)?.[0]?.replace("/", " ") ??
    /Chrome\/[\d.]+/.exec(ua)?.[0]?.replace("/", " ") ??
    /Firefox\/[\d.]+/.exec(ua)?.[0]?.replace("/", " ") ??
    /Safari\/[\d.]+/.exec(ua)?.[0]?.replace("/", " ") ??
    "Unknown browser";
  const os =
    /Windows NT [\d.]+/.exec(ua)?.[0] ??
    /Mac OS X [\d_]+/.exec(ua)?.[0]?.replace(/_/g, ".") ??
    /Android [\d.]+/.exec(ua)?.[0] ??
    /iPhone OS [\d_]+/.exec(ua)?.[0]?.replace(/_/g, ".") ??
    /Linux/.exec(ua)?.[0] ??
    "Unknown OS";
  const device = /iPhone|iPad|Android/.test(ua) ? "Mobile" : "Desktop";
  return { browser, os, device };
}

async function enrichIp(ip: string | null): Promise<{
  city?: string;
  region?: string;
  country?: string;
  org?: string;
  postal?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
} | null> {
  if (!ip || ip === "127.0.0.1" || ip === "::1") return null;
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { "User-Agent": "ocs-portal/1.0" },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    if (j.error) return null;
    return {
      city: typeof j.city === "string" ? j.city : undefined,
      region: typeof j.region === "string" ? j.region : undefined,
      country: typeof j.country_name === "string" ? j.country_name : undefined,
      org: typeof j.org === "string" ? j.org : undefined,
      postal: typeof j.postal === "string" ? j.postal : undefined,
      timezone: typeof j.timezone === "string" ? j.timezone : undefined,
      latitude: typeof j.latitude === "number" ? j.latitude : undefined,
      longitude: typeof j.longitude === "number" ? j.longitude : undefined,
    };
  } catch {
    return null;
  }
}

const Input = z.object({
  userId: z.string().uuid(),
  method: z.enum(["password", "google", "unknown"]).optional(),
});

export const notifySignIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const headers = getRequestHeaders() as Record<string, string | undefined>;
    const h = (name: string) => headers[name.toLowerCase()];

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, role")
      .eq("id", data.userId)
      .maybeSingle();

    const { data: bossRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "boss");
    const bossIds = (bossRoles ?? []).map((r) => r.user_id as string);
    if (!bossIds.length) return { delivered: 0, reason: "no_bosses" };

    const { data: contacts } = await supabaseAdmin
      .from("user_contact_profiles")
      .select("profile_id, telegram_chat_id")
      .in("profile_id", bossIds);
    const chatIds = (contacts ?? [])
      .map((c) => c.telegram_chat_id as string | null)
      .filter((c): c is string => !!c);
    if (!chatIds.length) return { delivered: 0, reason: "no_telegram_linked" };

    const cfIp =
      h("cf-connecting-ip") ??
      h("x-real-ip") ??
      (h("x-forwarded-for")?.split(",")[0]?.trim() ?? null);
    let ip: string | null = cfIp ?? null;
    try {
      if (!ip) ip = getRequestIP({ xForwardedFor: true }) ?? null;
    } catch {
      /* noop */
    }

    const cfCity = h("cf-ipcity");
    const cfRegion = h("cf-ipregion") ?? h("cf-region");
    const cfCountry = h("cf-ipcountry");
    const cfLat = h("cf-iplatitude");
    const cfLon = h("cf-iplongitude");
    const cfTz = h("cf-iptimezone") ?? h("cf-timezone");

    const enriched = !cfCity || !cfCountry ? await enrichIp(ip) : null;

    const city = cfCity ?? enriched?.city;
    const region = cfRegion ?? enriched?.region;
    const country = cfCountry ?? enriched?.country;
    const lat = cfLat ?? (enriched?.latitude != null ? String(enriched.latitude) : undefined);
    const lon = cfLon ?? (enriched?.longitude != null ? String(enriched.longitude) : undefined);
    const tz = cfTz ?? enriched?.timezone;
    const isp = enriched?.org;
    const postal = enriched?.postal;

    const ua = h("user-agent") ?? "";
    const { browser, os, device } = parseUserAgent(ua);
    const lang = h("accept-language")?.split(",")[0]?.trim();
    const referer = h("referer");
    const host = h("host") ?? h(":authority");

    const locParts = [city, region, country].filter(Boolean).join(", ");
    const mapLink =
      lat && lon
        ? `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lon}`)}`
        : null;

    const lines: string[] = [];
    lines.push(`🔐 <b>OCS sign-in</b>`);
    lines.push("");
    lines.push(
      `<b>User:</b> ${escapeHtml(profile?.full_name || profile?.email || data.userId)}` +
        (profile?.email && profile?.full_name ? ` (${escapeHtml(profile.email)})` : "") +
        (profile?.role ? ` · <i>${escapeHtml(profile.role)}</i>` : ""),
    );
    lines.push(`<b>Method:</b> ${escapeHtml(data.method ?? "unknown")}`);
    lines.push(
      `<b>When:</b> ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`,
    );
    lines.push("");
    if (locParts)
      lines.push(
        `📍 <b>Location:</b> ${escapeHtml(locParts)}${postal ? ` ${escapeHtml(postal)}` : ""}`,
      );
    if (tz) lines.push(`🕒 <b>Timezone:</b> ${escapeHtml(tz)}`);
    if (mapLink) lines.push(`🗺 <a href="${mapLink}">Open on map</a>`);
    if (ip)
      lines.push(
        `🌐 <b>IP:</b> <code>${escapeHtml(ip)}</code>${isp ? ` · ${escapeHtml(isp)}` : ""}`,
      );
    lines.push("");
    lines.push(
      `💻 <b>Device:</b> ${escapeHtml(device)} · ${escapeHtml(os)} · ${escapeHtml(browser)}`,
    );
    if (lang) lines.push(`🗣 <b>Language:</b> ${escapeHtml(lang)}`);
    if (host) lines.push(`🔗 <b>Host:</b> <code>${escapeHtml(host)}</code>`);
    if (referer)
      lines.push(`↩ <b>Referer:</b> <code>${escapeHtml(referer.slice(0, 200))}</code>`);

    const text = lines.join("\n");

    const unique = Array.from(new Set(chatIds));
    const results = await Promise.all(
      unique.map((chatId) =>
        sendTelegramMessage({ chatId, text, parseMode: "HTML" }),
      ),
    );
    const delivered = results.filter((r) => r.ok).length;
    return { delivered, attempted: unique.length };
  });
