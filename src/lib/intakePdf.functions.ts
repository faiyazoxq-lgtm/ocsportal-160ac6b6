import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildIntakePdf } from "./intakePdf.server";

/**
 * Generate a printable PDF for an intake record (pre-conversion work order
 * preview). Returns the PDF bytes base64-encoded so the browser can trigger a
 * download from the click handler that called this RPC.
 */
export const getIntakePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ intakeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const out = await buildIntakePdf(data.intakeId);
    if (!out) throw new Error("Intake record not found");
    // Encode bytes as base64 for transport over JSON.
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < out.bytes.length; i += chunk) {
      binary += String.fromCharCode(
        ...out.bytes.subarray(i, i + chunk),
      );
    }
    const base64 = btoa(binary);
    return { base64, filename: out.filename };
  });
