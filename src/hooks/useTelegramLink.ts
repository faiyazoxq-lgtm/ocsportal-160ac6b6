import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import {
  linkTelegramAccount,
  unlinkTelegramAccount,
} from "@/lib/messaging.functions";

export function useMyContactProfile() {
  const { profile } = useAuth();
  return useQuery({
    enabled: !!profile?.id,
    queryKey: ["dm", "my-contact-profile", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_contact_profiles")
        .select(
          "profile_id, avatar_url, job_title, capability_summary, bio, telegram_username, telegram_linked_at, last_seen_at, created_at, updated_at",
        )
        .eq("profile_id", profile!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useTelegramLink() {
  const qc = useQueryClient();
  const linkFn = useServerFn(linkTelegramAccount);
  const unlinkFn = useServerFn(unlinkTelegramAccount);

  const link = useMutation({
    mutationFn: (telegramUsername: string) =>
      linkFn({ data: { telegramUsername } }),
    onSuccess: (r) => {
      if ("ok" in r && r.ok) {
        toast.success("Telegram linked");
        qc.invalidateQueries({ queryKey: ["dm", "my-contact-profile"] });
        qc.invalidateQueries({ queryKey: ["contacts"] });
      } else if ("error" in r) {
        toast.error(r.error);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlink = useMutation({
    mutationFn: () => unlinkFn({}),
    onSuccess: () => {
      toast.success("Telegram disconnected");
      qc.invalidateQueries({ queryKey: ["dm", "my-contact-profile"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  return { link, unlink };
}