import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useExternalContacts,
  useLinkWorkOrderContact,
  useUnlinkWorkOrderContact,
  useUpsertExternalContact,
  useWorkOrderContacts,
} from "@/hooks/useCommunications";
import { EXTERNAL_CONTACT_TYPES, type ExternalContactType } from "@/types/communications";
import { Plus, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

export function ExternalContactsCard({ workOrderId }: { workOrderId: string }) {
  const { data: linked = [], isLoading } = useWorkOrderContacts(workOrderId);
  const [search, setSearch] = useState("");
  const { data: contacts = [] } = useExternalContacts(search);
  const link = useLinkWorkOrderContact();
  const unlink = useUnlinkWorkOrderContact();
  const upsert = useUpsertExternalContact();

  const [showNew, setShowNew] = useState(false);
  const [n, setN] = useState({ name: "", organization: "", phone: "", email: "", contact_type: "tenant" as ExternalContactType });

  const addExisting = async (id: string) => {
    try {
      await link.mutateAsync({ work_order_id: workOrderId, external_contact_id: id });
      toast.success("Contact linked");
    } catch (e) { toast.error((e as Error).message); }
  };

  const createAndLink = async () => {
    if (!n.name.trim()) return toast.error("Name required");
    try {
      const c = await upsert.mutateAsync(n);
      await link.mutateAsync({ work_order_id: workOrderId, external_contact_id: c.id });
      setShowNew(false);
      setN({ name: "", organization: "", phone: "", email: "", contact_type: "tenant" });
      toast.success("Contact created and linked");
    } catch (e) { toast.error((e as Error).message); }
  };

  const linkedIds = new Set(linked.map((l) => l.external_contact_id));

  return (
    <div className="space-y-3 text-sm">
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading contacts…</div>
      ) : linked.length === 0 ? (
        <div className="text-xs text-muted-foreground">No external contacts linked.</div>
      ) : (
        <ul className="space-y-1">
          {linked.map((l) => (
            <li key={l.id} className="flex items-center justify-between rounded-sm border border-border bg-secondary px-2 py-1.5 text-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {l.is_primary && <Star className="h-3 w-3 fill-amber-500 text-amber-500" />}
                  <span className="font-medium">{l.contact?.name}</span>
                  <span className="rounded-sm bg-background px-1 text-[10px] uppercase">{l.contact?.contact_type}</span>
                </div>
                <div className="text-muted-foreground">
                  {l.contact?.organization}
                  {l.contact?.phone ? ` · ${l.contact.phone}` : ""}
                  {l.contact?.email ? ` · ${l.contact.email}` : ""}
                </div>
              </div>
              <button onClick={() => unlink.mutate(l.id)} className="text-muted-foreground hover:text-red-700">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-sm border border-dashed border-border p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase text-muted-foreground">Link contact</span>
          <Button size="sm" variant="ghost" onClick={() => setShowNew((s) => !s)}>
            <Plus className="mr-1 h-3.5 w-3.5" />New
          </Button>
        </div>
        {showNew ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Name" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
              <Input placeholder="Organization" value={n.organization} onChange={(e) => setN({ ...n, organization: e.target.value })} />
              <Input placeholder="Phone" value={n.phone} onChange={(e) => setN({ ...n, phone: e.target.value })} />
              <Input placeholder="Email" value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} />
            </div>
            <Select value={n.contact_type} onValueChange={(v) => setN({ ...n, contact_type: v as ExternalContactType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXTERNAL_CONTACT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button size="sm" onClick={createAndLink}>Create & link</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Input placeholder="Search by name, org, email…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search.trim() && (
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {contacts.filter((c) => !linkedIds.has(c.id)).slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <button onClick={() => addExisting(c.id)} className="flex w-full items-center justify-between rounded-sm px-2 py-1 text-left text-xs hover:bg-muted">
                      <span>{c.name}{c.organization ? ` · ${c.organization}` : ""}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">{c.contact_type}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}