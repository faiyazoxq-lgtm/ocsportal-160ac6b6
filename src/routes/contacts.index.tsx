import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ContactsShell } from "@/components/contacts/ContactsShell";
import { ContactDirectoryPage } from "@/components/contacts/ContactDirectoryPage";
import { TelegramLinkPanel } from "@/components/contacts/TelegramLinkPanel";

export const Route = createFileRoute("/contacts/")({
  head: () => ({ meta: [{ title: "Contacts · OCS" }] }),
  component: ContactsPage,
});

function ContactsPage() {
  return (
    <ProtectedRoute>
      <ContactsShell>
        <div className="mx-auto max-w-5xl space-y-4">
          <TelegramLinkPanel />
          <ContactDirectoryPage />
        </div>
      </ContactsShell>
    </ProtectedRoute>
  );
}