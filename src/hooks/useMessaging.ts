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