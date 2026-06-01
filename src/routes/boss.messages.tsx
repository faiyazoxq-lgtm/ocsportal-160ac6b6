import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { BossShell } from "@/components/boss/BossShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useContacts } from "@/hooks/useContacts";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { useDeleteMessage, useDeleteThread } from "@/hooks/useMessaging";
import { useBossPermissions } from "@/hooks/useBossPermissions";
import { ContactAvatar } from "@/components/contacts/ContactAvatar";
import type { ContactDirectoryEntry } from "@/types/contacts";

export const Route = createFileRoute("/boss/messages")({
  head: () => ({ meta: [{ title: "All Messages · Boss · OCS" }] }),
  component: BossAllMessagesPage,
});

function BossAllMessagesPage() {
  return (
    <ProtectedRoute>
      <BossShell>
        <BossOnlyGuard>
          <BossMessagesView />
        </BossOnlyGuard>
      </BossShell>
    </ProtectedRoute>
  );
}

function BossOnlyGuard({ children }: { children: React.ReactNode }) {
  const { isBoss } = useBossPermissions();
  if (!isBoss) {
    return (
      <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
        Boss access required.
      </div>
    );
  }
  return <>{children}</>;
}

interface BossThreadRow {
  thread_id: string;
  created_at: string;
  updated_at: string;
  participant_ids: string[];
  last_message_at: string | null;
  last_message_preview: string | null;
  message_count: number;
}

function useBossAllThreads() {
  return useQuery({
    queryKey: ["dm", "boss-threads"],
    queryFn: async (): Promise<BossThreadRow[]> => {
      const [{ data: threads, error: tErr }, { data: parts, error: pErr }, { data: msgs, error: mErr }] =
        await Promise.all([
          supabase
            .from("direct_message_threads")
            .select("id, created_at, updated_at")
            .is("deleted_at", null)
            .order("updated_at", { ascending: false }),
          supabase
            .from("direct_message_participants")
            .select("thread_id, profile_id"),
          supabase
            .from("direct_messages")
            .select("id, thread_id, body_text, sent_at, deleted_at")
            .order("sent_at", { ascending: false }),
        ]);
      if (tErr) throw tErr;
      if (pErr) throw pErr;
      if (mErr) throw mErr;

      const partsByThread = new Map<string, string[]>();
      for (const p of parts ?? []) {
        const arr = partsByThread.get(p.thread_id) ?? [];
        arr.push(p.profile_id);
        partsByThread.set(p.thread_id, arr);
      }
      const lastByThread = new Map<
        string,
        { body_text: string | null; sent_at: string }
      >();
      const countsByThread = new Map<string, number>();
      for (const m of msgs ?? []) {
        if (m.deleted_at) continue;
        countsByThread.set(m.thread_id, (countsByThread.get(m.thread_id) ?? 0) + 1);
        if (!lastByThread.has(m.thread_id)) {
          lastByThread.set(m.thread_id, {
            body_text: m.body_text,
            sent_at: m.sent_at,
          });
        }
      }
      return (threads ?? []).map((t) => {
        const last = lastByThread.get(t.id);
        return {
          thread_id: t.id,
          created_at: t.created_at,
          updated_at: t.updated_at,
          participant_ids: partsByThread.get(t.id) ?? [],
          last_message_at: last?.sent_at ?? null,
          last_message_preview: last?.body_text ?? null,
          message_count: countsByThread.get(t.id) ?? 0,
        };
      });
    },
  });
}

function BossMessagesView() {
  const contacts = useContacts();
  const threads = useBossAllThreads();
  const [selected, setSelected] = useState<string | null>(null);
  const delThread = useDeleteThread();

  const contactsById = useMemo(
    () => new Map((contacts.data ?? []).map((c) => [c.profile_id, c])),
    [contacts.data],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-foreground">All Messages</h1>
        <p className="text-xs text-muted-foreground">
          Boss-only view of every direct conversation across the team. You can
          delete individual messages or entire conversations.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <aside className="rounded-md border border-border bg-card">
          {threads.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : threads.error ? (
            <div className="p-4 text-sm text-red-700">
              {(threads.error as Error).message}
            </div>
          ) : !threads.data?.length ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-40" />
              No conversations.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {threads.data.map((t) => {
                const names = t.participant_ids
                  .map(
                    (id) =>
                      contactsById.get(id)?.full_name ||
                      contactsById.get(id)?.email ||
                      id.slice(0, 6),
                  )
                  .join(" ↔ ");
                const active = selected === t.thread_id;
                return (
                  <li key={t.thread_id}>
                    <button
                      type="button"
                      onClick={() => setSelected(t.thread_id)}
                      className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors ${
                        active ? "bg-accent/60" : "hover:bg-accent/30"
                      }`}
                    >
                      <div className="flex -space-x-2">
                        {t.participant_ids.slice(0, 3).map((pid) => {
                          const c = contactsById.get(pid);
                          return c ? (
                            <ContactAvatar key={pid} contact={c} size={28} />
                          ) : null;
                        })}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {names || "Conversation"}
                          </span>
                          <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {formatDistanceToNow(new Date(t.updated_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.last_message_preview ??
                            (t.message_count
                              ? "Attachment"
                              : "No messages yet")}
                        </p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                          {t.message_count} message
                          {t.message_count === 1 ? "" : "s"}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="rounded-md border border-border bg-card">
          {!selected ? (
            <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
              Select a conversation to inspect.
            </div>
          ) : (
            <BossThreadView
              threadId={selected}
              onDeleted={() => setSelected(null)}
              contactsById={contactsById}
              participantIds={
                threads.data?.find((t) => t.thread_id === selected)
                  ?.participant_ids ?? []
              }
              onDeleteThread={() =>
                delThread.mutate(selected, {
                  onSuccess: () => setSelected(null),
                })
              }
              deleting={delThread.isPending}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function BossThreadView({
  threadId,
  participantIds,
  contactsById,
  onDeleteThread,
  deleting,
  onDeleted: _onDeleted,
}: {
  threadId: string;
  participantIds: string[];
  contactsById: Map<string, ContactDirectoryEntry>;
  onDeleteThread: () => void;
  deleting: boolean;
  onDeleted: () => void;
}) {
  const { data: messages, isLoading } = useDirectMessages(threadId);
  const delMsg = useDeleteMessage(threadId);
  const nameOf = (id: string) =>
    contactsById.get(id)?.full_name ||
    contactsById.get(id)?.email ||
    id.slice(0, 6);

  return (
    <div className="flex h-[70vh] flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {participantIds.map(nameOf).join(" ↔ ")}
          </div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Boss audit view
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={deleting}
          onClick={() => {
            if (
              confirm(
                "Delete this entire conversation? All messages will be removed.",
              )
            ) {
              onDeleteThread();
            }
          }}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Delete conversation
        </Button>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading messages…</p>
        ) : !messages?.length ? (
          <p className="text-center text-xs text-muted-foreground">
            No messages in this conversation.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className="flex items-start gap-2 rounded-md border border-border/60 bg-background px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span className="font-semibold text-foreground/80">
                    {nameOf(m.sender_profile_id)}
                  </span>
                  <span>
                    {new Date(m.sent_at).toLocaleString([], {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  {m.edited_at ? <span>· edited</span> : null}
                </div>
                {m.body_text ? (
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                    {m.body_text}
                  </p>
                ) : null}
                {m.files.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.files.length} attachment
                    {m.files.length === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Delete message"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => {
                  if (confirm("Delete this message?")) {
                    delMsg.mutate(m.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}