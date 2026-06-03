import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  ClipboardList,
  Inbox,
  Users,
  Contact as ContactIcon,
  Receipt,
  PhoneCall,
  Map as MapIcon,
  CalendarDays,
  BarChart3,
  MessageSquare,
  AlertTriangle,
  CheckSquare,
  LayoutDashboard,
} from "lucide-react";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";

const QUICK_ROUTES = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "ALL WORK ORDERS", to: "/admin/dispatch", icon: ClipboardList },
  { label: "Intake Queue", to: "/admin/intake", icon: Inbox },
  { label: "Admin Attention", to: "/admin/attention", icon: AlertTriangle },
  { label: "Diary", to: "/admin/diary", icon: CalendarDays },
  { label: "Engineers", to: "/admin/engineers", icon: Users },
  { label: "Review Queue", to: "/admin/review", icon: CheckSquare },
  { label: "Billing Prep", to: "/admin/billing", icon: Receipt },
  { label: "Follow-ups", to: "/admin/communications", icon: PhoneCall },
  { label: "Map View", to: "/admin/map", icon: MapIcon },
  { label: "Reports", to: "/admin/reports", icon: BarChart3 },
  { label: "Contacts", to: "/contacts", icon: ContactIcon },
  { label: "Messages", to: "/messages", icon: MessageSquare },
] as const;

export function GlobalSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { data, isFetching } = useGlobalSearch(query);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function go(to: string, search?: Record<string, string>) {
    onOpenChange(false);
    navigate({ to, search: search as never });
  }

  const showResults = query.trim().length >= 2;
  const r = data;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search work orders, engineers, contacts, billing…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {showResults && isFetching && !r ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            Searching…
          </div>
        ) : null}

        {showResults && r ? (
          <>
            {r.workOrders.length > 0 && (
              <CommandGroup heading="Work orders">
                {r.workOrders.map((w) => (
                  <CommandItem
                    key={w.id}
                    value={`wo-${w.id}-${w.order_no}-${w.job_summary ?? ""}-${w.address_line_1 ?? ""}`}
                    onSelect={() =>
                      go("/admin/dispatch", { focus: w.id })
                    }
                  >
                    <ClipboardList className="text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {w.order_no}
                        </span>
                        <span className="truncate text-sm font-medium">
                          {w.job_summary ?? "Untitled job"}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {[w.address_line_1, w.city, w.postcode]
                          .filter(Boolean)
                          .join(" · ") || w.client_name || "—"}
                      </div>
                    </div>
                    <span className="ml-2 shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {w.current_status.replace(/_/g, " ")}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {r.intakeRecords.length > 0 && (
              <CommandGroup heading="Intake records">
                {r.intakeRecords.map((i) => (
                  <CommandItem
                    key={i.id}
                    value={`intake-${i.id}-${i.source_reference ?? ""}`}
                    onSelect={() => go("/admin/intake", { focus: i.id })}
                  >
                    <Inbox className="text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {i.source_reference ?? "Intake record"}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {i.source_type} ·{" "}
                        {new Date(i.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="ml-2 shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {i.parse_status.replace(/_/g, " ")}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {r.engineers.length > 0 && (
              <CommandGroup heading="Engineers">
                {r.engineers.map((e) => (
                  <CommandItem
                    key={e.id}
                    value={`eng-${e.id}-${e.display_name}-${e.engineer_code ?? ""}`}
                    onSelect={() => go("/admin/engineers")}
                  >
                    <Users className="text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {e.display_name}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {[e.engineer_code, null]
                          .filter(Boolean)
                          .join(" · ") || "Engineer"}
                      </div>
                    </div>
                    {!e.active_status && (
                      <span className="ml-2 shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        inactive
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {r.externalContacts.length > 0 && (
              <CommandGroup heading="External contacts">
                {r.externalContacts.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`ext-${c.id}-${c.name}-${c.organization ?? ""}`}
                    onSelect={() => go("/admin/communications")}
                  >
                    <ContactIcon className="text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {c.name}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {[c.organization, c.email ?? c.phone]
                          .filter(Boolean)
                          .join(" · ") || c.contact_type}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {r.billingCases.length > 0 && (
              <CommandGroup heading="Billing cases">
                {r.billingCases.map((b) => (
                  <CommandItem
                    key={b.id}
                    value={`bill-${b.id}-${b.invoice_reference ?? ""}-${b.client_reference ?? ""}-${b.order_no ?? ""}`}
                    onSelect={() =>
                      go("/admin/billing", { focus: b.work_order_id })
                    }
                  >
                    <Receipt className="text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {b.invoice_reference ?? b.client_reference ?? "Billing case"}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {b.order_no ? `WO ${b.order_no}` : ""}
                      </div>
                    </div>
                    <span className="ml-2 shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {b.billing_status.replace(/_/g, " ")}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {r.followUps.length > 0 && (
              <CommandGroup heading="Follow-ups">
                {r.followUps.map((f) => (
                  <CommandItem
                    key={f.id}
                    value={`fu-${f.id}-${f.subject ?? ""}-${f.summary ?? ""}`}
                    onSelect={() => go("/admin/communications")}
                  >
                    <PhoneCall className="text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {f.subject ?? f.communication_type}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {f.summary ?? "—"}
                      </div>
                    </div>
                    {f.follow_up_status && (
                      <span className="ml-2 shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {f.follow_up_status.replace(/_/g, " ")}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {r.workOrders.length === 0 &&
            r.intakeRecords.length === 0 &&
            r.engineers.length === 0 &&
            r.externalContacts.length === 0 &&
            r.billingCases.length === 0 &&
            r.followUps.length === 0 ? (
              <CommandEmpty>No records match "{query}".</CommandEmpty>
            ) : null}

            <CommandSeparator />
          </>
        ) : null}

        <CommandGroup heading="Jump to">
          {QUICK_ROUTES.map((q) => {
            const Icon = q.icon;
            return (
              <CommandItem
                key={q.to}
                value={`route-${q.label}`}
                onSelect={() => go(q.to)}
              >
                <Icon className="text-muted-foreground" />
                <span className="text-sm">{q.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {!showResults ? (
          <div className="px-3 py-3 text-center text-[11px] text-muted-foreground">
            Type at least 2 characters to search records.{" "}
            <CommandShortcut>↵ to open</CommandShortcut>
          </div>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}