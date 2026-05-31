import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  workOrderIds: z.array(z.string().uuid()).min(1).max(50).optional(),
  limit: z.number().int().min(1).max(50).default(25),
});

interface PostcodeResult {
  postcode: string;
  latitude: number;
  longitude: number;
}

async function lookupPostcodes(postcodes: string[]): Promise<Map<string, PostcodeResult>> {
  const result = new Map<string, PostcodeResult>();
  if (postcodes.length === 0) return result;
  // postcodes.io bulk endpoint — free, UK only, no key required
  const res = await fetch("https://api.postcodes.io/postcodes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ postcodes }),
  });
  if (!res.ok) return result;
  const json = (await res.json()) as {
    result?: Array<{
      query: string;
      result: { postcode: string; latitude: number; longitude: number } | null;
    }>;
  };
  for (const row of json.result ?? []) {
    if (row.result) {
      result.set(row.query.toUpperCase(), {
        postcode: row.result.postcode,
        latitude: row.result.latitude,
        longitude: row.result.longitude,
      });
    }
  }
  return result;
}

export const geocodeWorkOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let query = supabase
      .from("work_orders")
      .select("id, postcode, latitude, longitude")
      .not("postcode", "is", null)
      .or("latitude.is.null,longitude.is.null")
      .limit(data.limit);

    if (data.workOrderIds && data.workOrderIds.length > 0) {
      query = supabase
        .from("work_orders")
        .select("id, postcode, latitude, longitude")
        .in("id", data.workOrderIds);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const targets = (rows ?? []).filter(
      (r) => r.postcode && (r.latitude == null || r.longitude == null),
    );
    if (targets.length === 0) {
      return { processed: 0, geocoded: 0, failed: 0 };
    }

    const uniquePostcodes = Array.from(
      new Set(targets.map((t) => (t.postcode as string).trim().toUpperCase())),
    );
    const lookup = await lookupPostcodes(uniquePostcodes);

    let geocoded = 0;
    let failed = 0;
    const now = new Date().toISOString();

    for (const row of targets) {
      const key = (row.postcode as string).trim().toUpperCase();
      const hit = lookup.get(key);
      if (!hit) {
        failed += 1;
        // mark attempt so we don't retry forever
        await supabase
          .from("work_orders")
          .update({ geocoded_at: now, geocode_confidence: 0 })
          .eq("id", row.id);
        continue;
      }
      const { error: upErr } = await supabase
        .from("work_orders")
        .update({
          latitude: hit.latitude,
          longitude: hit.longitude,
          geocoded_at: now,
          geocode_confidence: 0.85,
        })
        .eq("id", row.id);
      if (upErr) failed += 1;
      else geocoded += 1;
    }

    return { processed: targets.length, geocoded, failed };
  });