import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, PenSquare, Search, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ContactsShell } from "@/components/contacts/ContactsShell";
import { ContactAvatar } from "@/components/contacts/ContactAvatar";
import { MessagingThreadPanel } from "@/components/contacts/MessagingThreadPanel";
import { useDirectThreads } from "@/hooks/useDirectThreads";
import { useContacts } from "@/hooks/useContacts";
import { useOpenThread } from "@/hooks/useMessaging";
import { useAuth } from "@/hooks/useAuth";
import type { ContactDirectoryEntry, ThreadSummary } from "@/types/contacts";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages · OCS" }] }),
  component: MessagesPage,
});

type View = { mode: "thread"; threadId: string; other: ContactDirectoryEntry | null } | { mode: "new" } | { mode: "empty" };

function MessagesPage() {
  const { data: threads, isLoading, error } = useDirectThreads();
  const [view, setView] = useState<View>({ mode: "empty" });
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!threads) return [];
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      const name = (t.other?.full_name || t.other?.email || "").toLowerCase();
      const last = (t.last_message?.body_text || "").toLowerCase();
      return name.includes(q) || last.includes(q);
    });
  }, [threads, search]);

  return (
    <ProtectedRoute>
      <ContactsShell>
        <div className="mx-auto h-[calc(100vh-9rem)] max-w-6xl">
          <div className="grid h-full grid-cols-1 overflow-hidden rounded-lg border border-border bg-card shadow-sm md:grid-cols-[320px_1fr]">
            {/* Sidebar */}
            <aside
              className={`flex flex-col border-r border-border ${
                view.mode === "empty" ? "flex" : "hidden md:flex"
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
                <h1 className="text-base font-semibold text-foreground">Chats</h1>
                <button
                  type="button"
                  onClick={() => setView({ mode: "new" })}
                  className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                  aria-label="New message"
                >
                  <PenSquare className="h-3.5 w-3.5" />
                  New
                </button>
              </div>
              <div className="border-b border-border px-3 py-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search chats"
                    className="w-full rounded-full border border-input bg-background py-1.5 pl-7 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <p className="p-4 text-xs text-muted-foreground">Loading…</p>
                ) : error ? (
                  <p className="p-4 text-xs text-destructive">{(error as Error).message}</p>
                ) : !filtered.length ? (
                  <div className="flex flex-col items-center gap-2 p-8 text-center text-xs text-muted-foreground">
                    <MessageSquare className="h-7 w-7 opacity-40" />
                    <p>No conversations yet.</p>
                    <button
                      type="button"
                      onClick={() => setView({ mode: "new" })}
                      className="font-medium text-primary hover:underline"
                    >
                      Start a new chat →
                    </button>
                  </div>
                ) : (
                  <ul>
                    {filtered.map((t) => (
                      <ThreadRow
                        key={t.thread.id}
                        thread={t}
                        active={view.mode === "thread" && view.threadId === t.thread.id}
                        onClick={() =>
                          setView({ mode: "thread", threadId: t.thread.id, other: t.other })
                        }
                      />
                    ))}
                  </ul>
                )}
              </div>
            </aside>

            {/* Right pane */}
            <section
              className={`min-w-0 flex-col bg-background ${
                view.mode === "empty" ? "hidden md:flex" : "flex"
              }`}
            >
              {view.mode === "thread" ? (
                <div className="flex h-full flex-col">
                  <button
                    type="button"
                    onClick={() => setView({ mode: "empty" })}
                    className="flex items-center gap-1 border-b border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground md:hidden"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <div className="flex-1 overflow-hidden p-2">
                    <MessagingThreadPanel threadId={view.threadId} other={view.other} />
                  </div>
                </div>
              ) : view.mode === "new" ? (
                <NewMessageView
                  onCancel={() => setView({ mode: "empty" })}
                  onOpened={(threadId, other) =>
                    setView({ mode: "thread", threadId, other })
                  }
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
                  <MessageSquare className="h-10 w-10 opacity-30" />
                  <p>Select a chat or start a new one.</p>
                  <button
                    type="button"
                    onClick={() => setView({ mode: "new" })}
                    className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                  >
                    <PenSquare className="h-3.5 w-3.5" />
                    New message
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </ContactsShell>
    </ProtectedRoute>
  );
}

function ThreadRow({
  thread: t,
  active,
  onClick,
}: {
  thread: ThreadSummary;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
          active ? "bg-accent" : "hover:bg-accent/40"
        }`}
      >
        {t.other ? (
          <ContactAvatar contact={t.other} size={44} />
        ) : (
          <div className="h-11 w-11 shrink-0 rounded-full bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {t.other?.full_name || t.other?.email || "Conversation"}
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(t.thread.updated_at), { addSuffix: true })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <p
              className={`min-w-0 flex-1 truncate text-xs ${
                t.unread_count > 0 ? "font-semibold text-foreground" : "text-muted-foreground"
              }`}
            >
              {t.last_message?.body_text ??
                (t.last_message ? "Attachment" : "No messages yet")}
            </p>
            {t.unread_count > 0 ? (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                {t.unread_count}
              </span>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  );
}

function NewMessageView({
  onCancel,
  onOpened,
}: {
  onCancel: () => void;
  onOpened: (threadId: string, other: ContactDirectoryEntry | null) => void;
}) {
  const { profile } = useAuth();
  const { data: contacts, isLoading } = useContacts();
  const openThread = useOpenThread();
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const base = (contacts ?? []).filter((c) => c.profile_id !== profile?.id);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (c) =>
        (c.full_name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.role || "").toLowerCase().includes(q),
    );
  }, [contacts, query, profile?.id]);

  const pick = (c: ContactDirectoryEntry) => {
    openThread.mutate(c.profile_id, {
      onSuccess: (res: { threadId: string } | string) => {
        const threadId = typeof res === "string" ? res : res.threadId;
        onOpened(threadId, c);
      },
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Cancel"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">New message</span>
      </div>
      <div className="border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="To: search people…"
            className="w-full rounded-full border border-input bg-background py-1.5 pl-7 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="p-4 text-xs text-muted-foreground">Loading contacts…</p>
        ) : !list.length ? (
          <p className="p-4 text-xs text-muted-foreground">No people match.</p>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((c) => (
              <li key={c.profile_id}>
                <button
                  type="button"
                  onClick={() => pick(c)}
                  disabled={openThread.isPending}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/40 disabled:opacity-50"
                >
                  <ContactAvatar contact={c} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {c.full_name || c.email}
                    </div>
                    <div className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                      {c.role}
                      {c.job_title ? ` · ${c.job_title}` : ""}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}