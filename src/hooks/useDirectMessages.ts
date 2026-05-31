import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DirectMessage, DirectMessageFile } from "@/types/contacts";

export interface MessageWithFiles extends DirectMessage {
  files: DirectMessageFile[];
}

export function useDirectMessages(threadId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!threadId) return;
    const ch = supabase
      .channel(`dm:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["dm", "messages", threadId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [threadId, qc]);

  return useQuery({
    enabled: !!threadId,
    queryKey: ["dm", "messages", threadId],
    queryFn: async (): Promise<MessageWithFiles[]> => {
      const { data: msgs, error } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("thread_id", threadId!)
        .is("deleted_at", null)
        .order("sent_at", { ascending: true });
      if (error) throw error;
      const ids = (msgs ?? []).map((m) => m.id);
      let files: DirectMessageFile[] = [];
      if (ids.length) {
        const { data: fs, error: fErr } = await supabase
          .from("direct_message_files")
          .select("*")
          .in("message_id", ids);
        if (fErr) throw fErr;
        files = (fs ?? []) as DirectMessageFile[];
      }
      return (msgs ?? []).map((m) => ({
        ...(m as DirectMessage),
        files: files.filter((f) => f.message_id === m.id),
      }));
    },
  });
}