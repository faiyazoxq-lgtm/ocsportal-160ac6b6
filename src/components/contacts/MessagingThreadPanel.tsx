import { useEffect, useRef, useState } from "react";
import { Paperclip, Send, Image as ImageIcon, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import {
  useMarkThreadRead,
  useSendMessage,
  useEditMessage,
  useDeleteMessage,
} from "@/hooks/useMessaging";
import { useAuth } from "@/hooks/useAuth";
import { useBossPermissions } from "@/hooks/useBossPermissions";
import { supabase } from "@/integrations/supabase/client";
import { ContactAvatar } from "./ContactAvatar";
import type { ContactDirectoryEntry } from "@/types/contacts";

export function MessagingThreadPanel({
  threadId,
  other,
}: {
  threadId: string;
  other: ContactDirectoryEntry | null;
}) {
  const { profile } = useAuth();
  const { isBoss } = useBossPermissions();
  const { data: messages, isLoading } = useDirectMessages(threadId);
  const send = useSendMessage();
  const markRead = useMarkThreadRead();
  const editMsg = useEditMessage(threadId);
  const delMsg = useDeleteMessage(threadId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  useEffect(() => {
    if (threadId) markRead.mutate(threadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && files.length === 0) return;
    send.mutate(
      { threadId, bodyText: text.trim() || undefined, files: files.length ? files : undefined },
      {
        onSuccess: () => {
          setText("");
          setFiles([]);
        },
      },
    );
  };

  return (
    <div className="flex h-full min-h-[60vh] flex-col rounded-md border border-border bg-card">
      <header className="flex items-center gap-3 border-b border-border px-3 py-2">
        {other ? <ContactAvatar contact={other} size={32} /> : null}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">
            {other?.full_name || other?.email || "Conversation"}
          </div>
          <div className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
            {other?.role}
            {other?.telegram_linked ? " · Telegram linked" : ""}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading messages…</p>
        ) : !messages?.length ? (
          <p className="text-center text-xs text-muted-foreground">
            No messages yet. Say hello.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_profile_id === profile?.id;
            const canEdit = mine;
            const canDelete = mine || isBoss;
            const isEditing = editingId === m.id;
            return (
              <div
                key={m.id}
                className={`group flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-md px-3 py-2 text-sm shadow-sm ${
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-1">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-sm border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel edit"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!editingText.trim() || editMsg.isPending}
                          onClick={() =>
                            editMsg.mutate(
                              { messageId: m.id, bodyText: editingText.trim() },
                              { onSuccess: () => setEditingId(null) },
                            )
                          }
                          aria-label="Save edit"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : m.body_text ? (
                    <p className="whitespace-pre-wrap break-words">{m.body_text}</p>
                  ) : null}
                  {m.files.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {m.files.map((f) => (
                        <AttachmentRow key={f.id} bucket={f.storage_bucket} path={f.storage_path} mime={f.mime_type} />
                      ))}
                    </div>
                  )}
                  <div
                    className={`mt-1 flex items-center justify-between gap-2 text-[10px] ${
                      mine ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    <span>
                      {new Date(m.sent_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {m.edited_at ? " · edited" : ""}
                    </span>
                    {!isEditing && (canEdit || canDelete) && (
                      <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {canEdit && m.body_text ? (
                          <button
                            type="button"
                            className="hover:opacity-80"
                            aria-label="Edit message"
                            onClick={() => {
                              setEditingId(m.id);
                              setEditingText(m.body_text ?? "");
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            className="hover:opacity-80"
                            aria-label="Delete message"
                            onClick={() => {
                              if (confirm("Delete this message?")) {
                                delMsg.mutate(m.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        ) : null}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={submit}
        className="border-t border-border p-2"
      >
        {files.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1">
            {files.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-sm bg-secondary px-1.5 py-0.5 text-[11px]"
              >
                {f.name}
                <button
                  type="button"
                  onClick={() => setFiles((arr) => arr.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1">
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) =>
              setFiles((cur) => [...cur, ...Array.from(e.target.files ?? [])])
            }
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => fileInput.current?.click()}
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
            rows={1}
            placeholder="Write a message…"
            className="min-h-[36px] flex-1 resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            type="submit"
            size="sm"
            disabled={send.isPending || (!text.trim() && files.length === 0)}
          >
            <Send className="mr-1 h-3.5 w-3.5" />
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}

function AttachmentRow({
  bucket,
  path,
  mime,
}: {
  bucket: string;
  path: string;
  mime: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 30)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [bucket, path]);

  const isImage = mime?.startsWith("image/");
  const isAudio = mime?.startsWith("audio/");
  const name = path.split("/").pop() ?? path;

  if (!url) return <span className="text-[11px] opacity-70">Loading attachment…</span>;
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={name} className="max-h-48 rounded-sm border border-border/40" />
      </a>
    );
  }
  if (isAudio) {
    return <audio controls src={url} className="max-w-full" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-sm bg-background/60 px-2 py-1 text-[11px] font-medium text-foreground underline"
    >
      <ImageIcon className="h-3 w-3" />
      {name}
    </a>
  );
}