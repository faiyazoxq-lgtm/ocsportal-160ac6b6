import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ContactsShell } from "@/components/contacts/ContactsShell";
import { TelegramLinkPanel } from "@/components/contacts/TelegramLinkPanel";
import { PeopleDirectoryTable } from "@/components/people/PeopleDirectoryTable";
import { ClientListTab } from "@/components/contacts/ClientListTab";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/contacts/")({
  head: () => ({ meta: [{ title: "People · OCS" }] }),
  component: ContactsPage,
});

function ContactsPage() {
  const { profile } = useAuth();
  const mode =
    profile?.role === "boss" ? "boss" :
    profile?.role === "dispatcher" ? "dispatcher" : "view";
  const [tab, setTab] = useState<"people" | "clients">("people");
  return (
    <ProtectedRoute>
      <ContactsShell>
        <div className="mx-auto max-w-5xl space-y-4">
          <header>
            <h1 className="text-lg font-semibold text-foreground">Contacts</h1>
            <p className="text-xs text-muted-foreground">
              External directory and tenant client list. Staff roles live under People &amp; Roles.
            </p>
          </header>
          <div className="flex gap-1 border-b border-border">
            {([
              { id: "people", label: "People" },
              { id: "clients", label: "Client List" },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  tab === t.id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === "people" ? (
            <>
              <TelegramLinkPanel />
              <PeopleDirectoryTable mode={mode} />
            </>
          ) : (
            <ClientListTab />
          )}
        </div>
      </ContactsShell>
    </ProtectedRoute>
  );
}