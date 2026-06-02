import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ContactsShell } from "@/components/contacts/ContactsShell";
import { TelegramLinkPanel } from "@/components/contacts/TelegramLinkPanel";
import { ClientListTab } from "@/components/contacts/ClientListTab";
import { AllContactsTab } from "@/components/contacts/AllContactsTab";
import { EngineersContactsTab } from "@/components/contacts/EngineersContactsTab";
import { ExternalContactsTab } from "@/components/contacts/ExternalContactsTab";
import { ContactsTabBar } from "@/components/contacts/ContactsTabBar";
import { useCombinedContactsView } from "@/hooks/useCombinedContactsView";
import { useEngineerCanSee } from "@/hooks/useEngineerPermissions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/contacts/")({
  head: () => ({ meta: [{ title: "Contacts · OCS" }] }),
  component: ContactsPage,
});

type TabId = "all" | "engineers" | "clients" | "external";

function ContactsPage() {
  const [tab, setTab] = useState<TabId>("all");
  const { counts } = useCombinedContactsView();
  const { profile } = useAuth();
  const isEngineer = profile?.role === "engineer";
  const canSeeClients = useEngineerCanSee("directory", "see_client_list");
  const canSeeExternal = useEngineerCanSee("directory", "see_external_contacts");

  const allTabs = [
    { id: "all", label: "All Contacts", count: counts.all },
    { id: "engineers", label: "Engineers", count: counts.engineers },
    { id: "clients", label: "Clients", count: counts.clients },
    { id: "external", label: "External", count: counts.external },
  ] as const;
  const tabs = allTabs.filter((t) => {
    if (!isEngineer) return true;
    if (t.id === "clients") return canSeeClients;
    if (t.id === "external") return canSeeExternal;
    return true;
  });

  const activeTab: TabId = tabs.some((t) => t.id === tab) ? tab : "all";

  return (
    <ProtectedRoute>
      <ContactsShell>
        <div className="mx-auto max-w-5xl space-y-4">
          <header>
            <h1 className="text-lg font-semibold text-foreground">Contacts</h1>
            <p className="text-xs text-muted-foreground">
              Everyone you work with — engineers, tenants &amp; clients, and external parties.
              Staff roles live under People &amp; Roles.
            </p>
          </header>
          <ContactsTabBar tabs={tabs} active={activeTab} onChange={(id) => setTab(id as TabId)} />
          {activeTab === "all" ? (
            <>
              <TelegramLinkPanel />
              <AllContactsTab />
            </>
          ) : activeTab === "engineers" ? (
            <EngineersContactsTab />
          ) : activeTab === "clients" ? (
            <ClientListTab />
          ) : (
            <ExternalContactsTab />
          )}
        </div>
      </ContactsShell>
    </ProtectedRoute>
  );
}