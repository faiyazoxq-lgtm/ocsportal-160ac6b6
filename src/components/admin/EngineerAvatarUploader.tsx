import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/account/UserAvatar";

const BUCKET = "user-avatars";
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * Profile photo upload for an engineer record. Uploads to the shared
 * user-avatars bucket under the engineers/<engineer-id-or-new>/ folder.
 * Dispatcher/Boss have storage permission for that folder.
 */
export function EngineerAvatarUploader({
  engineerId,
  value,
  onChange,
}: {
  engineerId?: string | null;
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErr(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setErr("Image must be 3 MB or smaller.");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const slug = engineerId ?? `new-${crypto.randomUUID()}`;
      const path = `engineers/${slug}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <UserAvatar url={value || null} name="Engineer" size={56} />
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Uploading…" : value ? "Replace photo" : "Upload photo"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange("")}
              disabled={busy}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          PNG, JPEG, WebP. Max 3 MB.
        </p>
        {err && <p className="text-[11px] text-destructive">{err}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onPick}
      />
    </div>
  );
}