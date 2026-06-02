import { useEffect, useRef } from "react";
import { logSessionActivity } from "@/lib/sessionTracking.functions";

type PendingEvent = {
  kind: "page_view" | "click" | "submit" | "custom";
  path?: string;
  label?: string;
  target?: string;
  payload?: Record<string, unknown>;
  occurredAt: string;
};

function describeElement(el: HTMLElement): { label: string; target: string } {
  const aria = el.getAttribute("aria-label");
  const title = el.getAttribute("title");
  const text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
  const label = (aria || title || text || "").slice(0, 200) || el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls = el.classList.length ? `.${Array.from(el.classList).slice(0, 2).join(".")}` : "";
  const role = el.getAttribute("role");
  const target = `${el.tagName.toLowerCase()}${id}${cls}${role ? `[role=${role}]` : ""}`.slice(0, 200);
  return { label, target };
}

export function useSessionActivityTracker(args: {
  userId: string | undefined;
  clientSessionKey: string | null;
}) {
  const queueRef = useRef<PendingEvent[]>([]);
  const flushingRef = useRef(false);
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!args.userId || !args.clientSessionKey) return;
    const userId = args.userId;
    const clientSessionKey = args.clientSessionKey;

    const flush = async () => {
      if (flushingRef.current) return;
      if (queueRef.current.length === 0) return;
      flushingRef.current = true;
      const batch = queueRef.current.splice(0, 50);
      try {
        await logSessionActivity({
          data: { userId, clientSessionKey, events: batch },
        });
      } catch (err) {
        // Re-queue if it failed (best effort)
        console.warn("[activity flush] failed", err);
        queueRef.current.unshift(...batch);
      } finally {
        flushingRef.current = false;
      }
    };

    const enqueue = (ev: PendingEvent) => {
      queueRef.current.push(ev);
      if (queueRef.current.length >= 10) void flush();
    };

    const recordPath = (path: string) => {
      if (lastPathRef.current === path) return;
      lastPathRef.current = path;
      enqueue({
        kind: "page_view",
        path,
        label: document.title || undefined,
        occurredAt: new Date().toISOString(),
      });
    };

    // Initial page view
    recordPath(window.location.pathname + window.location.search);

    // History API patches for SPA nav
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    const onNav = () =>
      recordPath(window.location.pathname + window.location.search);
    history.pushState = function (...a) {
      const r = origPush.apply(this, a as Parameters<typeof origPush>);
      onNav();
      return r;
    };
    history.replaceState = function (...a) {
      const r = origReplace.apply(this, a as Parameters<typeof origReplace>);
      onNav();
      return r;
    };
    window.addEventListener("popstate", onNav);

    // Clicks
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const interactive = target.closest(
        "button, a, [role='button'], [role='link'], [role='menuitem'], [role='tab'], input[type='button'], input[type='submit']",
      ) as HTMLElement | null;
      if (!interactive) return;
      const { label, target: tgt } = describeElement(interactive);
      const href =
        interactive instanceof HTMLAnchorElement ? interactive.href : undefined;
      enqueue({
        kind: "click",
        path: window.location.pathname + window.location.search,
        label,
        target: tgt,
        payload: href ? { href } : undefined,
        occurredAt: new Date().toISOString(),
      });
    };
    document.addEventListener("click", onClick, true);

    // Form submits
    const onSubmit = (e: Event) => {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;
      const name = form.getAttribute("name") || form.getAttribute("id") || "form";
      enqueue({
        kind: "submit",
        path: window.location.pathname + window.location.search,
        label: name,
        target: `form${form.id ? `#${form.id}` : ""}`,
        occurredAt: new Date().toISOString(),
      });
    };
    document.addEventListener("submit", onSubmit, true);

    // Periodic flush
    const interval = window.setInterval(() => void flush(), 5000);
    // Flush before unload
    const onHide = () => void flush();
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);

    return () => {
      history.pushState = origPush;
      history.replaceState = origReplace;
      window.removeEventListener("popstate", onNav);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      window.clearInterval(interval);
      void flush();
    };
  }, [args.userId, args.clientSessionKey]);
}