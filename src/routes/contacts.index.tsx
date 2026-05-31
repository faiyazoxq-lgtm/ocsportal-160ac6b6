import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ContactsShell } from "@/components/contacts/ContactsShell";
import { TelegramLinkPanel } from "@/components/contacts/TelegramLinkPanel";
import { PeopleDirectoryTable } from "@/components/people/PeopleDirectoryTable";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/contacts/")({
  head: () => ({ meta: [{ title: "People · OCS" }] }),
  component: ContactsPage,
});

function ContactsPage() {
  const { profile } = useAuth();
  const isBoss = profile?.role === "boss";
  return (
    <ProtectedRoute>
      <ContactsShell>
        <div className="mx-auto max-w-5xl space-y-4">
          <header>
            <h1 className="text-lg font-semibold text-foreground">People</h1>
            <p className="text-xs text-muted-foreground">
              Staff accounts and external contacts in one directory. Use Message/Call to reach app users; external contacts are directory-only.
            </p>
          </header>
          <TelegramLinkPanel />
          <PeopleDirectoryTable mode={isBoss ? "boss" : "view"} />
        </div>
      </ContactsShell>
    </ProtectedRoute>
  );
}