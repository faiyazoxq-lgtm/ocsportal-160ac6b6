import { useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAccountAvatar } from "@/hooks/useAccountAvatar";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/account/UserAvatar";

export function AccountAvatarUploader() {
  const { profile } = useAuth();
  const { upload, remove, currentUrl } = useAccountAvatar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!profile) return null;

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErr(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await upload.mutateAsync(file);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Upload failed");
    }
  };

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Profile picture</h2>
      <div className="flex items-center gap-4">
        <UserAvatar
          url={currentUrl}
          name={profile.full_name || profile.email}
          size={64}
        />
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={upload.isPending}
            >
              {upload.isPending ? "Uploading…" : currentUrl ? "Replace" : "Upload"}
            </Button>
            {currentUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                {remove.isPending ? "Removing…" : "Remove"}
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            PNG, JPEG, WebP or GIF. Max 3 MB.
          </p>
          {err && <p className="text-[11px] text-destructive">{err}</p>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={onPick}
        />
      </div>
    </div>
  );
}