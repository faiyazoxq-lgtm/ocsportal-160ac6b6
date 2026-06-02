import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Phone, Send } from "lucide-react";
import { z } from "zod";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ContactsShell } from "@/components/contacts/ContactsShell";
import { ContactAvatar } from "@/components/contacts/ContactAvatar";
import { MessagingThreadPanel } from "@/components/contacts/MessagingThreadPanel";
import { useContactDetail } from "@/hooks/useContacts";
import { useOpenThread } from "@/hooks/useMessaging";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({ msg: z.coerce.number().optional() });

export const Route = createFileRoute("/contacts/$id")({
  head: () => ({ meta: [{ title: "Contact · OCS" }] }),
  validateSearch: searchSchema,
  component: ContactDetailPage,
});

function ContactDetailPage() {
  const { id } = Route.useParams();
  const { msg } = Route.useSearch();
  const { data: contact, isLoading } = useContactDetail(id);
  const openThread = useOpenThread();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState<boolean>(!!msg);

  useEffect(() => {
    if (showChat && !threadId && !openThread.isPending) {
      openThread.mutate(id, {
        onSuccess: (res) => setThreadId(res.threadId),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showChat, id]);

  return (
    <ProtectedRoute>
      <ContactsShell>
        <div className="mx-auto max-w-3xl">
          <Link
            to="/contacts"
            className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back to contacts
          </Link>
          {isLoading ? (
            <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : !contact ? (
            <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
              Contact not found.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <ContactAvatar contact={contact} size={56} />
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold text-foreground">
                      {contact.full_name || contact.email}
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {contact.role}
                      {contact.job_title ? ` · ${contact.job_title}` : ""}
                    </div>
                    {contact.engineer && contact.engineer.covered_postcode_zones.length ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {contact.engineer.covered_postcode_zones.join(", ")}
                      </div>
                    ) : null}
                    {contact.capability_summary ? (
                      <p className="mt-2 text-sm text-foreground">
                        {contact.capability_summary}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <Button
                    size="sm"
                    onClick={() => setShowChat(true)}
                    disabled={openThread.isPending}
                  >
                    <Send className="mr-1 h-3.5 w-3.5" />
                    Message
                  </Button>
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                    >
                      <Phone className="h-3.5 w-3.5" /> {contact.phone}
                    </a>
                  ) : null}
                  {contact.telegram_linked ? (
                    <span className="rounded-sm bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-900">
                      Telegram linked
                    </span>
                  ) : null}
                </div>
              </div>

              {showChat ? (
                threadId ? (
                  <MessagingThreadPanel threadId={threadId} other={contact} />
                ) : (
                  <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
                    Opening conversation…
                  </div>
                )
              ) : null}
            </div>
          )}
        </div>
      </ContactsShell>
    </ProtectedRoute>
  );
}