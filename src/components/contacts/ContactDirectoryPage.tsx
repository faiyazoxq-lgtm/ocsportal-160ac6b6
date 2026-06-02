import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Phone, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useContacts } from "@/hooks/useContacts";
import { ContactAvatar } from "./ContactAvatar";

export function ContactDirectoryPage() {
  const { data, isLoading, error } = useContacts();
  const [q, setQ] = useState("");
  const [trade, setTrade] = useState<string>("");
  const [zone, setZone] = useState<string>("");

  const filtered = useMemo(() => {
    return (data ?? []).filter((c) => {
      if (q && !(c.full_name ?? c.email ?? "").toLowerCase().includes(q.toLowerCase()))
        return false;
      if (trade) {
        const t = trade.toLowerCase();
        const tags = [
          c.engineer?.primary_trade ?? "",
          ...(c.engineer?.trade_tags ?? []),
        ]
          .map((x) => x.toLowerCase())
          .join(" ");
        if (!tags.includes(t)) return false;
      }
      if (zone) {
        const z = zone.toLowerCase();
        if (
          !(c.engineer?.covered_postcode_zones ?? [])
            .map((x) => x.toLowerCase())
            .some((x) => x.includes(z))
        )
          return false;
      }
      return true;
    });
  }, [data, q, trade, zone]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-foreground">Contacts</h1>
        <p className="text-xs text-muted-foreground">
          Staff directory · message, call, or open in Telegram.
        </p>
      </header>

      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="relative col-span-2 md:col-span-1">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name…"
            className="pl-7"
          />
        </div>
        <Input
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          placeholder="Trade / capability"
        />
        <Input
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          placeholder="Postcode zone"
        />
      </div>

      {isLoading ? (
        <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {(error as Error).message}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No contacts match.
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <li
              key={c.profile_id}
              className="rounded-md border border-border bg-card p-3"
            >
              {c.engineer_only ? (
                <div className="flex items-start gap-3">
                  <ContactAvatar contact={c} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {c.full_name || "Engineer"}
                    </div>
                    {c.engineer?.primary_trade ? (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {c.engineer.primary_trade}
                        {c.engineer.covered_postcode_zones.length
                          ? ` · ${c.engineer.covered_postcode_zones.slice(0, 3).join(", ")}`
                          : ""}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <Link
                  to="/contacts/$id"
                  params={{ id: c.profile_id }}
                  className="flex items-start gap-3"
                >
                  <ContactAvatar contact={c} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {c.full_name || c.email}
                    </div>
                    {c.job_title ? (
                      <div className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                        {c.job_title}
                      </div>
                    ) : null}
                  {c.engineer?.primary_trade ? (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {c.engineer.primary_trade}
                      {c.engineer.covered_postcode_zones.length
                        ? ` · ${c.engineer.covered_postcode_zones.slice(0, 3).join(", ")}`
                        : ""}
                    </div>
                  ) : null}
                  {c.capability_summary ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {c.capability_summary}
                    </p>
                  ) : null}
                </div>
                </Link>
              )}
              <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
                {c.engineer_only ? (
                  <span className="text-[11px] text-muted-foreground">
                    No login — view in Engineers tab
                  </span>
                ) : (
                  <>
                <Link
                  to="/contacts/$id"
                  params={{ id: c.profile_id }}
                  search={{ msg: 1 }}
                  className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
                >
                  <Send className="h-3 w-3" /> Message
                </Link>
                {c.phone ? (
                  <a
                    href={`tel:${c.phone}`}
                    className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
                  >
                    <Phone className="h-3 w-3" /> Call
                  </a>
                ) : null}
                {c.telegram_linked && (
                  <span className="ml-auto rounded-sm bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-900">
                    Telegram
                  </span>
                )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}