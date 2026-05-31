import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useSecureFileUrl } from "@/hooks/useDocuments";
import {
  isPreviewableImage,
  isPreviewablePdf,
  type UnifiedDocument,
  DOCUMENT_CATEGORY_LABELS,
} from "@/services/documents";
import { Download, ExternalLink } from "lucide-react";

export function DocumentPreviewDrawer({
  doc,
  open,
  onOpenChange,
}: {
  doc: UnifiedDocument | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: url, isLoading } = useSecureFileUrl(doc);

  const canPreviewImage = doc ? isPreviewableImage(doc.mime_type) : false;
  const canPreviewPdf = doc
    ? isPreviewablePdf(doc.mime_type, doc.display_name)
    : false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="text-sm">
            {doc?.display_name ?? "Document"}
          </SheetTitle>
        </SheetHeader>
        {doc && (
          <div className="mt-4 space-y-3 text-xs">
            <div className="grid grid-cols-[110px_1fr] gap-2 text-muted-foreground">
              <div>Category</div>
              <div className="text-foreground">
                {DOCUMENT_CATEGORY_LABELS[doc.source_context]}
              </div>
              <div>Kind</div>
              <div className="text-foreground">{doc.file_kind}</div>
              <div>Type</div>
              <div className="text-foreground">{doc.mime_type ?? "—"}</div>
              <div>Size</div>
              <div className="text-foreground">
                {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : "—"}
              </div>
              <div>Uploaded</div>
              <div className="text-foreground">
                {new Date(doc.created_at).toLocaleString()}
              </div>
              {doc.sync_status ? (
                <>
                  <div>Sync</div>
                  <div className="text-foreground">{doc.sync_status}</div>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {url ? (
                <>
                  <Button asChild size="sm" variant="outline">
                    <a href={url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                      Open in new tab
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={url} download={doc.display_name}>
                      <Download className="mr-1 h-3.5 w-3.5" />
                      Download
                    </a>
                  </Button>
                </>
              ) : (
                <span className="text-muted-foreground">
                  {isLoading ? "Preparing secure link…" : "No preview available."}
                </span>
              )}
            </div>

            <div className="mt-3 rounded-md border border-border bg-muted/30 p-2">
              {url && canPreviewImage ? (
                <img
                  src={url}
                  alt={doc.display_name}
                  className="mx-auto max-h-[70vh] w-auto"
                />
              ) : url && canPreviewPdf ? (
                <iframe
                  src={url}
                  title={doc.display_name}
                  className="h-[70vh] w-full rounded-sm border border-border bg-white"
                />
              ) : (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No inline preview for this file type. Use download or open in
                  new tab.
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}