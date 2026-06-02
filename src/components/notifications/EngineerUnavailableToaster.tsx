import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { NotificationRow } from "@/types/notifications";

/**
 * Listens for new `engineer_unavailable` notifications for the current
 * dispatcher/boss user and surfaces a concise sonner toast with a quick
 * link to the affected date in the diary.
 */
export function EngineerUnavailableToaster() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const userId = session?.user?.id ?? null;
  const role = profile?.role;
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    if (role !== "dispatcher" && role !== "boss") return;

    const channel = supabase
      .channel(`engunavail-toast:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_profile_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as NotificationRow;
          if (n.notification_type !== "engineer_unavailable") return;
          if (seen.current.has(n.id)) return;
          seen.current.add(n.id);

          // Try to derive an ISO date from the payload to deep-link the diary.
          const meta = (n.payload_json ?? {}) as Record<string, unknown>;
          const startRaw = typeof meta.start_at === "string" ? meta.start_at : null;
          const isoDate = startRaw ? startRaw.slice(0, 10) : null;
          const target = isoDate
            ? `/admin/diary#${isoDate}`
            : n.link_path ?? "/admin/engineers";

          toast.warning(n.title ?? "Engineer marked unavailable", {
            description: n.body ?? undefined,
            duration: 10_000,
            action: {
              label: isoDate ? `Open ${isoDate}` : "View diary",
              onClick: () => router.navigate({ to: target }),
            },
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, role, router]);

  return null;
}