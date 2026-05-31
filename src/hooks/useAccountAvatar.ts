import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function useAccountAvatar() {
  const { profile, refresh } = useAuth();
  const qc = useQueryClient();

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!profile?.id) throw new Error("Not signed in");
      if (!ALLOWED.includes(file.type)) throw new Error("Use PNG, JPEG, WebP, or GIF.");
      if (file.size > MAX_BYTES) throw new Error("Image must be under 3 MB.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("user-avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("user-avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", profile.id);
      if (profErr) throw profErr;
      return url;
    },
    onSuccess: async () => {
      await refresh?.();
      qc.invalidateQueries({ queryKey: ["boss", "staff"] });
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refresh?.();
    },
  });

  return { upload, remove, currentUrl: profile?.avatar_url ?? null };
}