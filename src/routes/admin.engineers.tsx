import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEngineers } from "@/hooks/useEngineers";
import { useAllAvailability } from "@/hooks/useEngineerAvailability";
import { EngineerAvailabilityDialog } from "@/components/admin/EngineerAvailabilityDialog";
import type { Engineer } from "@/types/engineers";

export const Route = createFileRoute("/admin/engineers")({
  head: () => ({ meta: [{ title: "Engineers · OCS" }] }),
  component: EngineersPage,
});

function EngineersPage() {
  const { data, isLoading, error } = useEngineers();
  const availability = useAllAvailability();
  const navigate = useNavigate();

  const [trade, setTrade] = useState("");
  const [zone, setZone] = useState("");
  const [canLead, setCanLead] = useState("");
  const [active, setActive] = useState("active");

  const [availOpen, setAvailOpen] = useState(false);
  const [availTarget, setAvailTarget] = useState<Engineer | null>(null);

  const availByEng = useMemo(() => {
    const m = new Map<string, number>();
    (availability.data ?? []).forEach((a) =>
      m.set(a.engineer_id, (m.get(a.engineer_id) ?? 0) + 1),
    );
    return m;
  }, [availability.data]);

  const filtered = useMemo(() => {
    return (data ?? []).filter((e) => {
      if (trade && !(null ?? "").toLowerCase().includes(trade.toLowerCase()) && !e.trade_tags.some((t) => t.toLowerCase().includes(trade.toLowerCase())))
        return false;
      if (zone && !e.covered_postcode_zones.some((z) => z.toLowerCase() === zone.toLowerCase()))
        return false;
      if (canLead === "yes" && !e.can_lead) return false;
      if (canLead === "no" && e.can_lead) return false;
      if (active === "active" && !e.active_status) return false;
      if (active === "inactive" && e.active_status) return false;
      return true;
    });
  }, [data, trade, zone, canLead, active]);

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-7xl">
          <AdminPageHeader
            title="Engineers"
            description="Directory of OCS engineers, capabilities, coverage and availability."
            actions={
              <Button size="sm" asChild>
                <Link to="/admin/engineers/new">New engineer</Link>
              </Button>
            }
          />

          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Input placeholder="Trade" value={trade} onChange={(e) => setTrade(e.target.value)} />
            <Input placeholder="Postcode zone" value={zone} onChange={(e) => setZone(e.target.value)} />
            <select
              value={canLead}
              onChange={(e) => setCanLead(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Any lead status</option>
              <option value="yes">Can lead</option>
              <option value="no">Support only</option>
            </select>
            <select
              value={active}
              onChange={(e) => setActive(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>

          {isLoading ? (
            <div className="rounded-md border border-border bg-card">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse border-b border-border bg-muted/40 last:border-b-0" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              Couldn't load engineers. {(error as Error).message}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-4 py-12 text-center">
              <Users className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No engineers match these filters.</p>
            </div>
          ) : (
            <>
            {/* Desktop / tablet table */}
            <div className="hidden overflow-hidden rounded-md border border-border bg-card md:block">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <Th>Engineer</Th>
                    <Th>Primary trade</Th>
                    <Th>Trade tags</Th>
                    <Th>Zones</Th>
                    <Th>Certs</Th>
                    <Th>Lead</Th>
                    <Th>Status</Th>
                    <Th>Availability</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id} className="border-t border-border hover:bg-accent/30">
                      <Td>
                        <div className="font-medium text-foreground">{e.display_name}</div>
                        <div className="text-xs text-muted-foreground">{e.engineer_code || "—"}</div>
                      </Td>
                      <Td>{null || "—"}</Td>
                      <Td className="text-xs text-muted-foreground">{e.trade_tags.join(", ") || "—"}</Td>
                      <Td className="text-xs text-muted-foreground">{e.covered_postcode_zones.join(", ") || "—"}</Td>
                      <Td className="text-xs text-muted-foreground">{e.certification_tags.join(", ") || "—"}</Td>
                      <Td className="text-xs">
                        {e.can_lead ? (
                          <span className="rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-emerald-900">
                            yes
                          </span>
                        ) : (
                          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                            no
                          </span>
                        )}
                      </Td>
                      <Td className="text-xs">
                        {e.active_status ? (
                          <span className="rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-emerald-900">
                            active
                          </span>
                        ) : (
                          <span className="rounded-sm bg-red-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-red-900">
                            inactive
                          </span>
                        )}
                      </Td>
                      <Td className="text-xs text-muted-foreground">
                        {availByEng.get(e.id) ?? 0} rule(s)
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate({
                                to: "/admin/engineers/$id/edit",
                                params: { id: e.id },
                              })
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAvailTarget(e);
                              setAvailOpen(true);
                            }}
                          >
                            Availability
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile card list */}
            <ul className="space-y-2.5 md:hidden">
              {filtered.map((e) => (
                <li
                  key={e.id}
                  className="rounded-md border border-border bg-card p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {e.display_name}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {e.engineer_code || "—"} · {null || "No trade"}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {e.active_status ? (
                        <span className="rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-900">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-sm bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-900">
                          Inactive
                        </span>
                      )}
                      {e.can_lead && (
                        <span className="rounded-sm bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-900">
                          Lead
                        </span>
                      )}
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[12px]">
                    {e.trade_tags.length > 0 && (
                      <>
                        <dt className="font-medium text-muted-foreground">Tags</dt>
                        <dd className="truncate text-foreground">{e.trade_tags.join(", ")}</dd>
                      </>
                    )}
                    {e.covered_postcode_zones.length > 0 && (
                      <>
                        <dt className="font-medium text-muted-foreground">Zones</dt>
                        <dd className="truncate text-foreground">{e.covered_postcode_zones.join(", ")}</dd>
                      </>
                    )}
                    {e.certification_tags.length > 0 && (
                      <>
                        <dt className="font-medium text-muted-foreground">Certs</dt>
                        <dd className="truncate text-foreground">{e.certification_tags.join(", ")}</dd>
                      </>
                    )}
                    <dt className="font-medium text-muted-foreground">Avail</dt>
                    <dd className="text-foreground">{availByEng.get(e.id) ?? 0} rule(s)</dd>
                  </dl>

                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() =>
                        navigate({
                          to: "/admin/engineers/$id/edit",
                          params: { id: e.id },
                        })
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setAvailTarget(e);
                        setAvailOpen(true);
                      }}
                    >
                      Availability
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            </>
          )}
        </div>

        <EngineerAvailabilityDialog open={availOpen} onOpenChange={setAvailOpen} engineer={availTarget} />
      </DispatcherShell>
    </ProtectedRoute>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-top ${className}`}>{children}</td>;
}