import { useCallback, useEffect, useState } from "react";

// BeforeInstallPromptEvent isn't in lib.dom yet — narrow it ourselves.
interface BIPEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "ocs.pwa.install.dismissed_at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS
    // @ts-expect-error legacy iOS field
    window.navigator.standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(/CriOS|FxiOS/.test(ua));
}

/**
 * Install-prompt orchestration. Captures beforeinstallprompt, tracks standalone
 * mode, and exposes a soft-dismiss with TTL so we don't nag users.
 */
export function usePWAInstall() {
  const [event, setEvent] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setInstalled(isStandalone());
    try {
      const at = Number(window.localStorage.getItem(DISMISS_KEY) ?? "0");
      if (at && Date.now() - at < DISMISS_TTL_MS) setDismissed(true);
    } catch {
      /* ignore */
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!event) return { ok: false as const, reason: "no-event" as const };
    await event.prompt();
    const choice = await event.userChoice;
    setEvent(null);
    return { ok: true as const, outcome: choice.outcome };
  }, [event]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }, []);

  const ios = isIos();
  const canPrompt = !!event && !installed && !dismissed;
  const showIosHint = ios && !installed && !dismissed;

  return {
    installed,
    dismissed,
    canPrompt,
    showIosHint,
    promptInstall,
    dismiss,
  };
}