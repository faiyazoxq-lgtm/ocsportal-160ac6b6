import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Per-work-order, per-user local draft persistence for the engineer
 * checklist / outcome form. Survives reloads, navigation, and sign-out so
 * field progress is not lost when signal drops. Backed by localStorage —
 * payloads are small text-only (checklist booleans + short notes).
 */
const KEY_PREFIX = "ocs-job-draft-v1:";

function storageKey(workOrderId: string): string {
  return `${KEY_PREFIX}${workOrderId}`;
}

export interface JobDraft {
  checklist: Record<string, boolean>;
  outcome: "complete" | "incomplete";
  reason: string;
  notes: string;
  advisoryNotes: string;
  updated_at: number;
}

const EMPTY: JobDraft = {
  checklist: {},
  outcome: "complete",
  reason: "",
  notes: "",
  advisoryNotes: "",
  updated_at: 0,
};

function readDraft(workOrderId: string): JobDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(workOrderId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<JobDraft>;
    return { ...EMPTY, ...parsed };
  } catch {
    return null;
  }
}

function writeDraft(workOrderId: string, draft: JobDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(workOrderId), JSON.stringify(draft));
  } catch {
    /* quota / private mode — non-fatal */
  }
}

export function useOfflineJobDraft(workOrderId: string) {
  const [draft, setDraftState] = useState<JobDraft>(
    () => readDraft(workOrderId) ?? EMPTY,
  );
  const hydratedRef = useRef(false);

  // Re-hydrate when the work order id changes
  useEffect(() => {
    const next = readDraft(workOrderId) ?? EMPTY;
    setDraftState(next);
    hydratedRef.current = true;
  }, [workOrderId]);

  // Persist on change (skip the initial mount write)
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (draft.updated_at === 0) return;
    writeDraft(workOrderId, draft);
  }, [workOrderId, draft]);

  const update = useCallback((patch: Partial<JobDraft>) => {
    setDraftState((prev) => ({
      ...prev,
      ...patch,
      updated_at: Date.now(),
    }));
  }, []);

  const clear = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(storageKey(workOrderId));
      } catch {
        /* noop */
      }
    }
    setDraftState({ ...EMPTY });
  }, [workOrderId]);

  const hasDraft = draft.updated_at > 0;

  return { draft, update, clear, hasDraft };
}
