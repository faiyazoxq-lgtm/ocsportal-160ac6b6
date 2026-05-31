/**
 * Durable IndexedDB-backed offline mutation queue for the engineer field
 * workflow. Stores mutations + binary blobs (photos / signatures) so an
 * engineer can keep working with no signal and sync later.
 *
 * Keep this module browser-only — never import in server code.
 */

export type QueuedMutationType =
  | "mark_on_route"
  | "mark_arrived"
  | "start_work"
  | "checklist_save"
  | "evidence_add"
  | "expense_add"
  | "submit_complete"
  | "submit_incomplete";

export type QueueItemStatus = "pending" | "syncing" | "synced" | "failed";

export interface QueuedMutation<TPayload = unknown> {
  id: string; // local mutation id (uuid)
  work_order_id: string;
  engineer_id: string | null;
  type: QueuedMutationType;
  payload: TPayload;
  // Reference to a blob stored in the "blobs" object store for file uploads
  blob_ref?: string | null;
  created_at: number;
  retry_count: number;
  status: QueueItemStatus;
  error_message?: string | null;
  last_attempt_at?: number | null;
}

const DB_NAME = "ocs-offline-v1";
const DB_VERSION = 1;
const STORE_MUTATIONS = "mutations";
const STORE_BLOBS = "blobs";

let dbPromise: Promise<IDBDatabase> | null = null;

function isBrowser() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  if (!isBrowser()) return Promise.reject(new Error("IndexedDB unavailable"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
        const s = db.createObjectStore(STORE_MUTATIONS, { keyPath: "id" });
        s.createIndex("by_status", "status");
        s.createIndex("by_work_order", "work_order_id");
        s.createIndex("by_created", "created_at");
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `loc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const r = fn(s);
        if (r && typeof (r as IDBRequest<T>).onsuccess !== "undefined") {
          const req = r as IDBRequest<T>;
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        } else {
          (r as Promise<T>).then(resolve, reject);
        }
      }),
  );
}

// ---------------- Blobs ----------------

export async function putBlob(blob: Blob): Promise<string> {
  const id = uuid();
  await tx<IDBValidKey>(STORE_BLOBS, "readwrite", (s) =>
    s.put({ id, blob, created_at: Date.now() }),
  );
  return id;
}

export async function getBlob(id: string): Promise<Blob | null> {
  const row = await tx<{ id: string; blob: Blob } | undefined>(
    STORE_BLOBS,
    "readonly",
    (s) => s.get(id),
  );
  return row?.blob ?? null;
}

export async function deleteBlob(id: string): Promise<void> {
  await tx<undefined>(STORE_BLOBS, "readwrite", (s) => s.delete(id));
}

// ---------------- Mutations ----------------

export interface EnqueueInput<TPayload> {
  work_order_id: string;
  engineer_id: string | null;
  type: QueuedMutationType;
  payload: TPayload;
  blob?: Blob | null;
}

export async function enqueueMutation<TPayload>(
  input: EnqueueInput<TPayload>,
): Promise<QueuedMutation<TPayload>> {
  const blob_ref = input.blob ? await putBlob(input.blob) : null;
  const item: QueuedMutation<TPayload> = {
    id: uuid(),
    work_order_id: input.work_order_id,
    engineer_id: input.engineer_id,
    type: input.type,
    payload: input.payload,
    blob_ref,
    created_at: Date.now(),
    retry_count: 0,
    status: "pending",
    error_message: null,
    last_attempt_at: null,
  };
  await tx<IDBValidKey>(STORE_MUTATIONS, "readwrite", (s) => s.put(item));
  notify();
  return item;
}

export async function listMutations(): Promise<QueuedMutation[]> {
  const all = await tx<QueuedMutation[]>(STORE_MUTATIONS, "readonly", (s) =>
    s.getAll(),
  );
  return (all ?? []).sort((a, b) => a.created_at - b.created_at);
}

export async function listPending(): Promise<QueuedMutation[]> {
  const items = await listMutations();
  return items.filter((i) => i.status === "pending" || i.status === "failed");
}

export async function getMutation(id: string): Promise<QueuedMutation | null> {
  const r = await tx<QueuedMutation | undefined>(
    STORE_MUTATIONS,
    "readonly",
    (s) => s.get(id),
  );
  return r ?? null;
}

export async function updateMutation(
  id: string,
  patch: Partial<QueuedMutation>,
): Promise<void> {
  const existing = await getMutation(id);
  if (!existing) return;
  const next: QueuedMutation = { ...existing, ...patch };
  await tx<IDBValidKey>(STORE_MUTATIONS, "readwrite", (s) => s.put(next));
  notify();
}

export async function removeMutation(id: string): Promise<void> {
  const m = await getMutation(id);
  if (m?.blob_ref) {
    try {
      await deleteBlob(m.blob_ref);
    } catch {
      /* noop */
    }
  }
  await tx<undefined>(STORE_MUTATIONS, "readwrite", (s) => s.delete(id));
  notify();
}

export async function pendingCountForWorkOrder(
  workOrderId: string,
): Promise<number> {
  const items = await listMutations();
  return items.filter(
    (i) => i.work_order_id === workOrderId && i.status !== "synced",
  ).length;
}

// ---------------- Change notifier ----------------

type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribeQueue(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* noop */
    }
  });
}