import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useUploadWorkOrderDocument,
  useWorkOrderDocuments,
} from "@/hooks/useDocuments";
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORY_ORDER,
  type DocumentSourceContext,
  type UnifiedDocument,
} from "@/services/documents";
import { DocumentPreviewDrawer } from "./DocumentPreviewDrawer";
import { FileText, Image as ImageIcon, Upload, File } from "lucide-react";

export function WorkOrderDocumentsPanel({
  workOrderId,
  canUpload = false,
  compact = false,
}: {
  workOrderId: string;
  canUpload?: boolean;
  compact?: boolean;
}) {
  const { data, isLoading, error } = useWorkOrderDocuments(workOrderId);
  const [filter, setFilter] = useState<DocumentSourceContext | "all">("all");
  const [active, setActive] = useState<UnifiedDocument | null>(null);

  const docs = data ?? [];
  const filtered = useMemo(
    () => (filter === "all" ? docs : docs.filter((d) => d.source_context === filter)),
    [docs, filter],
  );
  const counts = useMemo(() => {
    const c: Partial<Record<DocumentSourceContext, number>> = {};
    for (const d of docs) c[d.source_context] = (c[d.source_context] ?? 0) + 1;
    return c;
  }, [docs]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1">
        <FilterChip
          label={`All (${docs.length})`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        {DOCUMENT_CATEGORY_ORDER.map((cat) => {
          const n = counts[cat] ?? 0;
          if (n === 0 && cat !== filter) return null;
          return (
            <FilterChip
              key={cat}
              label={`${DOCUMENT_CATEGORY_LABELS[cat]} (${n})`}
              active={filter === cat}
              onClick={() => setFilter(cat)}
            />
          );
        })}
        {canUpload ? (
          <div className="ml-auto">
            <AdminUploadButton workOrderId={workOrderId} />
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
          Loading documents…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          Couldn't load documents.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
          {filter === "all"
            ? "No documents linked to this work order yet."
            : `No ${DOCUMENT_CATEGORY_LABELS[filter as DocumentSourceContext].toLowerCase()} yet.`}
        </div>
      ) : (
        <ul className={compact ? "space-y-1" : "space-y-1.5"}>
          {filtered.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setActive(d)}
                className="flex w-full items-center gap-2 rounded-md border border-border bg-card p-2 text-left hover:border-primary/50"
              >
                <DocIcon mime={d.mime_type} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-foreground">
                    {d.display_name}
                  </div>
                  <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                    {DOCUMENT_CATEGORY_LABELS[d.source_context]} ·{" "}
                    {new Date(d.created_at).toLocaleString()}
                  </div>
                </div>
                {d.sync_status && d.sync_status !== "synced" ? (
                  <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                    {d.sync_status}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      <DocumentPreviewDrawer
        doc={active}
        open={!!active}
        onOpenChange={(v) => !v && setActive(null)}
      />
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm border px-2 py-0.5 text-[11px] font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function DocIcon({ mime }: { mime: string | null }) {
  if (mime?.startsWith("image/"))
    return <ImageIcon className="h-4 w-4 text-muted-foreground" />;
  if (mime === "application/pdf")
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function AdminUploadButton({ workOrderId }: { workOrderId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const upload = useUploadWorkOrderDocument(workOrderId);
  return (
    <>
      <input
        ref={ref}
        type="file"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            await upload.mutateAsync({ file });
          } finally {
            if (ref.current) ref.current.value = "";
          }
        }}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={upload.isPending}
        onClick={() => ref.current?.click()}
      >
        <Upload className="mr-1 h-3.5 w-3.5" />
        {upload.isPending ? "Uploading…" : "Upload"}
      </Button>
    </>
  );
}

export function FileAuditList({ workOrderId }: { workOrderId: string }) {
  const { data } = useWorkOrderDocuments(workOrderId);
  const rows = data ?? [];
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No file activity yet.</p>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-card text-xs">
      {rows.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="truncate">
            <span className="text-foreground">{d.display_name}</span>{" "}
            <span className="text-muted-foreground">
              · {DOCUMENT_CATEGORY_LABELS[d.source_context]}
            </span>
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {new Date(d.created_at).toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}