import { useEffect } from "react";
import { bootSyncEngine } from "@/services/syncEngine";

export function SyncBoot() {
  useEffect(() => {
    bootSyncEngine();
  }, []);
  return null;
}