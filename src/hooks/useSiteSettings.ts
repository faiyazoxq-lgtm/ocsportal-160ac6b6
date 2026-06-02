import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WorkOrderStatus } from "@/types/workOrders";

export interface SiteSettings {
  work_email: string | null;
  intake_sniffing_email: string | null;
  status_colors: Partial<Record<WorkOrderStatus, string>>;
}

export function useSiteSettings() {
  return useQuery<SiteSettings>({
    queryKey: ["site_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("work_email, intake_sniffing_email, status_colors")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      const rec = (data ?? null) as {
        work_email: string | null;
        intake_sniffing_email: string | null;
        status_colors: Record<string, string> | null;
      } | null;
      return {
        work_email: rec?.work_email ?? null,
        intake_sniffing_email: rec?.intake_sniffing_email ?? null,
        status_colors: (rec?.status_colors ?? {}) as Partial<Record<WorkOrderStatus, string>>,
      };
    },
    staleTime: 60_000,
  });
}

// Compute readable foreground (black/white) for a given hex bg.
export function readableInk(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#0f172a";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  // perceived luminance
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? "#0f172a" : "#ffffff";
}