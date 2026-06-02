import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { pollGmailInbox } from "@/lib/gmail.functions";
import { useAuth } from "@/hooks/useAuth";

const POLL_INTERVAL_MS = 60_000;

/**
 * Polls Gmail every 60s while the app is open and a boss/dispatcher is
 * signed in. Invalidates inbox + intake queries so the UI reflects newly
 * captured messages and intake records automatically.
 * Safe to mount in multiple shells — single-flights via a ref and skips
 * while the previous run is still in flight or the tab is hidden.
 */
export function useAutoInboxSync(): void {
  const { profile, status } = useAuth();
  const qc = useQueryClient();
  const poll = useServerFn(pollGmailInbox);
  const inFlight = useRef(false);

  const role = profile?.role;
  const enabled =
    status === "authenticated" && (role === "boss" || role === "dispatcher");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const run = async () => {
      if (cancelled || inFlight.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      inFlight.current = true;
      try {
        await poll({});
        if (cancelled) return;
        qc.invalidateQueries({ queryKey: ["gmail"] });
        qc.invalidateQueries({ queryKey: ["intake_records"] });
      } catch {
        /* silent — next tick retries */
      } finally {
        inFlight.current = false;
      }
    };

    // Kick off shortly after mount, then on an interval.
    const initial = window.setTimeout(run, 2_000);
    const id = window.setInterval(run, POLL_INTERVAL_MS);
    const onVis = () => {
      if (!document.hidden) void run();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, poll, qc]);
}