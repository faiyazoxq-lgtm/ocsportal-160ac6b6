import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useContacts } from "./useContacts";
import type { ThreadSummary, DirectMessage } from "@/types/contacts";

export function useDirectThreads() {
  const { profile } = useAuth();
  const contacts = useContacts();
  return useQuery({
    enabled: !!profile?.id && !!contacts.data,
    queryKey: ["dm", "threads", profile?.id],
    queryFn: async (): Promise<ThreadSummary[]> => {
      const { data: parts, error } = await supabase
        .from("direct_message_participants")
        .select("thread_id, last_read_at, profile_id");
      if (error) throw error;

      const myParts = (parts ?? []).filter((p) => p.profile_id === profile!.id);
      const threadIds = myParts.map((p) => p.thread_id);
      if (!threadIds.length) return [];

      const [{ data: threads }, { data: msgs }] = await Promise.all([
        supabase.from("direct_message_threads").select("*").in("id", threadIds),
        supabase
          .from("direct_messages")
          .select("*")
          .in("thread_id", threadIds)
          .order("sent_at", { ascending: false }),
      ]);

      const lastByThread = new Map<string, DirectMessage>();
      for (const m of ((msgs ?? []) as DirectMessage[])) {
        if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m);
      }

      const contactsById = new Map(
        (contacts.data ?? []).map((c) => [c.profile_id, c]),
      );

      return (threads ?? [])
        .map((t) => {
          const myPart = myParts.find((p) => p.thread_id === t.id);
          const others = (parts ?? []).filter(
            (p) => p.thread_id === t.id && p.profile_id !== profile!.id,
          );
          const otherId = others[0]?.profile_id;
          const last = lastByThread.get(t.id) ?? null;
          const unread = (msgs ?? []).filter(
            (m) =>
              m.thread_id === t.id &&
              m.sender_profile_id !== profile!.id &&
              (!myPart?.last_read_at ||
                new Date(m.sent_at) > new Date(myPart.last_read_at)),
          ).length;
          return {
            thread: t,
            other: otherId ? contactsById.get(otherId) ?? null : null,
            last_message: last,
            unread_count: unread,
          } satisfies ThreadSummary;
        })
        .sort(
          (a, b) =>
            new Date(b.thread.updated_at).getTime() -
            new Date(a.thread.updated_at).getTime(),
        );
    },
  });
}