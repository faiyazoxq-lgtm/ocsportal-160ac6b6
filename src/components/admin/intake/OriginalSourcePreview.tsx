import { useOriginalSourceUrl } from "@/hooks/useIntakeSources";
import type { IntakeRecord } from "@/types/intake";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText } from "lucide-react";

export function OriginalSourcePreview({ record }: { record: IntakeRecord }) {
  const { data: url, isLoading, error } = useOriginalSourceUrl(record);

  if (!record.source_file_path) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
        No original source file attached.
      </div>
    );
  }

  if (isLoading) return <div className="h-32 animate-pulse rounded-md bg-muted/40" />;
  if (error)
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
        Couldn't load original source: {(error as Error).message}
      </div>
    );

  const mime = record.original_mime_type ?? "";
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";

  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          <span className="truncate">{record.original_filename ?? "Original source"}</span>
        </div>
        {url && (
          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
            <a href={url} target="_blank" rel="noreferrer">
              Open <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        )}
      </div>
      {url && isImage && (
        <img src={url} alt={record.original_filename ?? "source"} className="max-h-[480px] w-full rounded-sm object-contain" />
      )}
      {url && isPdf && (
        <iframe src={url} title="Original source PDF" className="h-[480px] w-full rounded-sm border border-border" />
      )}
      {url && !isImage && !isPdf && (
        <div className="px-1 py-2 text-xs text-muted-foreground">
          Preview not available for this file type — use Open to download.
        </div>
      )}
    </div>
  );
}