import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getOrCreateDirectThread,
  markThreadRead,
  sendDirectMessage,
} from "@/lib/messaging.functions";

export function useOpenThread() {
  const fn = useServerFn(getOrCreateDirectThread);
  return useMutation({
    mutationFn: (otherProfileId: string) => fn({ data: { otherProfileId } }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface SendArgs {
  threadId: string;
  bodyText?: string;
  files?: File[];
  messageType?: "text" | "image" | "file" | "voice_note";
}

export function useSendMessage() {
  const qc = useQueryClient();
  const fn = useServerFn(sendDirectMessage);
  return useMutation({
    mutationFn: async (args: SendArgs) => {
      const uploaded: Array<{
        storagePath: string;
        fileKind: string;
        mimeType?: string;
        byteSize?: number;
      }> = [];
      if (args.files?.length) {
        for (const f of args.files) {
          const path = `${args.threadId}/${crypto.randomUUID()}/${f.name}`;
          const { error } = await supabase.storage
            .from("direct-message-attachments")
            .upload(path, f, { contentType: f.type, upsert: false });
          if (error) throw new Error(error.message);
          uploaded.push({
            storagePath: path,
            fileKind: f.type.startsWith("image/")
              ? "image"
              : f.type.startsWith("audio/")
                ? "voice_note"
                : "file",
            mimeType: f.type,
            byteSize: f.size,
          });
        }
      }
      const messageType =
        args.messageType ??
        (uploaded[0]?.fileKind === "image"
          ? "image"
          : uploaded[0]?.fileKind === "voice_note"
            ? "voice_note"
            : uploaded.length
              ? "file"
              : "text");
      return fn({
        data: {
          threadId: args.threadId,
          bodyText: args.bodyText,
          messageType,
          files: uploaded.length ? uploaded : undefined,
        },
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["dm", "messages", vars.threadId] });
      qc.invalidateQueries({ queryKey: ["dm", "threads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarkThreadRead() {
  const qc = useQueryClient();
  const fn = useServerFn(markThreadRead);
  return useMutation({
    mutationFn: (threadId: string) => fn({ data: { threadId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dm", "threads"] }),
  });
}

// -------- edit / delete (RLS enforces who may do what) --------

export function useEditMessage(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { messageId: string; bodyText: string }) => {
      const { error } = await supabase
        .from("direct_messages")
        .update({
          body_text: args.bodyText,
          edited_at: new Date().toISOString(),
        })
        .eq("id", args.messageId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dm", "messages", threadId] });
      qc.invalidateQueries({ queryKey: ["dm", "threads"] });
      qc.invalidateQueries({ queryKey: ["dm", "boss-threads"] });
      qc.invalidateQueries({ queryKey: ["dm", "boss-messages", threadId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteMessage(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from("direct_messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", messageId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dm", "messages", threadId] });
      qc.invalidateQueries({ queryKey: ["dm", "threads"] });
      qc.invalidateQueries({ queryKey: ["dm", "boss-threads"] });
      qc.invalidateQueries({ queryKey: ["dm", "boss-messages", threadId] });
      toast.success("Message deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const nowIso = new Date().toISOString();
      const { error: mErr } = await supabase
        .from("direct_messages")
        .update({ deleted_at: nowIso })
        .eq("thread_id", threadId)
        .is("deleted_at", null);
      if (mErr) throw new Error(mErr.message);
      const { error: tErr } = await supabase
        .from("direct_message_threads")
        .update({ deleted_at: nowIso })
        .eq("id", threadId);
      if (tErr) throw new Error(tErr.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dm"] });
      toast.success("Conversation deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}