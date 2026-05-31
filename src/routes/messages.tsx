import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ContactsShell } from "@/components/contacts/ContactsShell";
import { ContactAvatar } from "@/components/contacts/ContactAvatar";
import { useDirectThreads } from "@/hooks/useDirectThreads";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages · OCS" }] }),
  component: MessagesPage,
});

function MessagesPage() {
  const { data, isLoading, error } = useDirectThreads();

  return (
    <ProtectedRoute>
      <ContactsShell>
        <div className="mx-auto max-w-3xl">
          <header className="mb-4">
            <h1 className="text-lg font-semibold text-foreground">Messages</h1>
            <p className="text-xs text-muted-foreground">
              Direct conversations with the OCS team.
            </p>
          </header>

          {isLoading ? (
            <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              {(error as Error).message}
            </div>
          ) : !data?.length ? (
            <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-40" />
              <p>No conversations yet.</p>
              <Link
                to="/contacts"
                className="text-xs font-medium text-primary hover:underline"
              >
                Browse contacts to start one →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
              {data.map((t) => (
                <li key={t.thread.id}>
                  <Link
                    to="/contacts/$id"
                    params={{ id: t.other?.profile_id ?? "" }}
                    search={{ msg: 1 }}
                    className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/40"
                  >
                    {t.other ? <ContactAvatar contact={t.other} size={40} /> : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {t.other?.full_name || t.other?.email || "Conversation"}
                        </span>
                        <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {formatDistanceToNow(new Date(t.thread.updated_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          {t.last_message?.body_text ??
                            (t.last_message ? "Attachment" : "No messages yet")}
                        </p>
                        {t.unread_count > 0 ? (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                            {t.unread_count}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ContactsShell>
    </ProtectedRoute>
  );
}