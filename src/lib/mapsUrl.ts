/**
 * Build a universal "open in maps" URL.
 * Works on iOS/Android (opens native maps app) and desktop (opens Google Maps).
 */
export function buildMapsUrl(opts: {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  postcode?: string | null;
}): string | null {
  if (opts.lat != null && opts.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${opts.lat},${opts.lng}`;
  }
  const parts = [opts.address, opts.postcode].filter(Boolean).join(", ");
  if (!parts) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
}

export function buildTelUrl(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  return `tel:${cleaned}`;
}