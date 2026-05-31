import { useEffect, useState } from "react";
import { useOfflineStatus } from "./useOfflineStatus";

type NetInfoLike = {
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
  addEventListener?: (t: string, cb: () => void) => void;
  removeEventListener?: (t: string, cb: () => void) => void;
};

/**
 * Online/offline + Network Information API (Chromium) signal. Used to surface
 * "weak signal" hints so engineers know why a write may be slow to confirm.
 */
export function useConnectivityStatus() {
  const { online, offline } = useOfflineStatus();
  const [effectiveType, setEffectiveType] = useState<string | null>(null);
  const [saveData, setSaveData] = useState<boolean>(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const conn = (navigator as Navigator & { connection?: NetInfoLike })
      .connection;
    if (!conn) return;
    const sync = () => {
      setEffectiveType(conn.effectiveType ?? null);
      setSaveData(!!conn.saveData);
    };
    sync();
    conn.addEventListener?.("change", sync);
    return () => conn.removeEventListener?.("change", sync);
  }, []);

  const weak = online && (effectiveType === "2g" || effectiveType === "slow-2g");

  return { online, offline, effectiveType, saveData, weak };
}