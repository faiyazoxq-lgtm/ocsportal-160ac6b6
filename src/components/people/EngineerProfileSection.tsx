import { useEffect, useMemo, useState } from "react";
import { useEngineerProfile, useUpsertEngineerProfile } from "@/hooks/useEngineerProfile";
import {
  useEngineerAvailability,
  useAddAvailability,
  useDeleteAvailability,
} from "@/hooks/useEngineerAvailability";
import { EngineerCoverageSummary } from "./EngineerSkillChips";
import type {} from "@/types/workOrders";
import type { AvailabilityType } from "@/types/engineers";

/**
 * Boss-side editor for the structured engineer profile attached to an app
 * user with role=engineer. Rendered inside BossUserEditorDrawer.
 */
export function EngineerProfileSection({
  profileId, displayName,
}: { profileId: string; displayName: string }) {
  const { data: engineer, isLoading } = useEngineerProfile(profileId);
  const upsert = useUpsertEngineerProfile();

  const [primaryTrade, setPrimaryTrade] = useState("");
  const [tradeTags, setTradeTags] = useState("");
  const [certTags, setCertTags] = useState("");
  const [zones, setZones] = useState("");
  const [complexityCap, setComplexityCap] = useState<ComplexityLevel>("intermediate");
  const [canLead, setCanLead] = useState(true);
  const [canSupport, setCanSupport] = useState(true);
  const [activeStatus, setActiveStatus] = useState(true);
  const [engineerCode, setEngineerCode] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!engineer) return;
    setPrimaryTrade(null ?? "");
    setTradeTags((engineer.trade_tags ?? []).join(", "));
    setCertTags((engineer.certification_tags ?? []).join(", "));
    setZones((engineer.covered_postcode_zones ?? []).join(", "));
    setComplexityCap(null);
    setCanLead(engineer.can_lead);
    setCanSupport(engineer.can_support);
    setActiveStatus(engineer.active_status);
    setEngineerCode(engineer.engineer_code ?? "");
    setNotes(engineer.notes ?? "");
  }, [engineer]);

  const parsedTrades = useMemo(() => splitCsv(tradeTags), [tradeTags]);
  const parsedCerts = useMemo(() => splitCsv(certTags), [certTags]);
  const parsedZones = useMemo(() => splitCsv(zones).map((z) => z.toUpperCase()), [zones]);

  const save = async () => {
    setErr(null);
    try {
      await upsert.mutateAsync({
        profileId,
        displayName: displayName || "Engineer",
        existingId: engineer?.id ?? null,
        input: {
          display_name: displayName || "Engineer",
          engineer_code: engineerCode || null,
          trade_tags: parsedTrades,
          certification_tags: parsedCerts,
          covered_postcode_zones: parsedZones,
          can_lead: canLead,
          can_support: canSupport,
          active_status: activeStatus,
          notes: notes || null,
        },
      });
      setSavedAt(Date.now());
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save engineer profile");
    }
  };

  return (
    <section className="space-y-3 rounded-sm border border-border bg-background p-3">
      <header className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-foreground">Engineer profile</h4>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {engineer ? "Editing" : "Not yet created"}
        </span>
      </header>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <>
          <EngineerCoverageSummary
            primaryTrade={primaryTrade || null}
            tradeTags={parsedTrades}
            certTags={parsedCerts}
            zones={parsedZones}
          />

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Field label="Primary trade">
              <input value={primaryTrade} onChange={(e) => setPrimaryTrade(e.target.value)} placeholder="plumbing" className="input" />
            </Field>
            <Field label="Engineer code">
              <input value={engineerCode} onChange={(e) => setEngineerCode(e.target.value)} placeholder="ENG-04" className="input" />
            </Field>
          </div>

          <Field label="Skills / trades (comma separated)">
            <input value={tradeTags} onChange={(e) => setTradeTags(e.target.value)} placeholder="plumbing, heating, handyman" className="input" />
          </Field>
          <Field label="Certifications (comma separated)">
            <input value={certTags} onChange={(e) => setCertTags(e.target.value)} placeholder="gas_safe, 18th_edition, niceic" className="input" />
          </Field>
          <Field label="Covered postcode zones (comma separated)">
            <input value={zones} onChange={(e) => setZones(e.target.value)} placeholder="NW, N1, SE15" className="input" />
          </Field>

          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
            <Toggle label="Can lead" checked={canLead} onChange={setCanLead} />
            <Toggle label="Can support" checked={canSupport} onChange={setCanSupport} />
            <Toggle label="Engineer active" checked={activeStatus} onChange={setActiveStatus} />
          </div>

          <Field label="Dispatch notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" />
          </Field>

          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={upsert.isPending}
              className="rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {upsert.isPending ? "Saving…" : engineer ? "Save engineer profile" : "Create engineer profile"}
            </button>
            {savedAt && <span className="text-[10px] text-muted-foreground">Saved</span>}
          </div>

          {engineer && <AvailabilityEditor engineerId={engineer.id} />}
        </>
      )}
      <style>{`.input { width: 100%; border: 1px solid hsl(var(--input)); background: hsl(var(--background)); border-radius: 4px; padding: 6px 8px; font-size: 12px; color: hsl(var(--foreground)); }`}</style>
    </section>
  );
}

function AvailabilityEditor({ engineerId }: { engineerId: string }) {
  const { data, isLoading } = useEngineerAvailability(engineerId);
  const add = useAddAvailability();
  const del = useDeleteAvailability();

  const [type, setType] = useState<AvailabilityType>("time_off");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [weekday, setWeekday] = useState("");
  const [note, setNote] = useState("");

  const submit = async () => {
    await add.mutateAsync({
      engineer_id: engineerId,
      availability_type: type,
      start_at: start ? new Date(start).toISOString() : null,
      end_at: end ? new Date(end).toISOString() : null,
      weekday_rule: weekday || null,
      note: note || null,
    });
    setStart(""); setEnd(""); setWeekday(""); setNote("");
  };

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Availability</h5>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">No availability records yet.</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {(data ?? []).map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-2 rounded-sm border border-border bg-muted/30 px-2 py-1">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground">
                  {a.availability_type.replace("_", " ")}
                  {a.weekday_rule ? ` · ${a.weekday_rule}` : ""}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {a.start_at ? new Date(a.start_at).toLocaleString() : "—"}
                  {a.end_at ? ` → ${new Date(a.end_at).toLocaleString()}` : ""}
                  {a.note ? ` · ${a.note}` : ""}
                </div>
              </div>
              <button onClick={() => del.mutate(a.id)} className="text-[10px] text-destructive hover:underline">Remove</button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 rounded-sm border border-dashed border-border p-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value as AvailabilityType)} className="input">
              <option value="working_hours">Working hours</option>
              <option value="time_off">Time off</option>
              <option value="unavailable_block">Unavailable block</option>
            </select>
          </Field>
          <Field label="Weekday rule (optional)">
            <input value={weekday} onChange={(e) => setWeekday(e.target.value)} placeholder="mon-fri 08:00-17:00" className="input" />
          </Field>
          <Field label="Start">
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="input" />
          </Field>
          <Field label="End">
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Note">
          <input value={note} onChange={(e) => setNote(e.target.value)} className="input" />
        </Field>
        <button
          onClick={submit}
          disabled={add.isPending}
          className="rounded-sm border border-border bg-background px-3 py-1 text-xs hover:bg-accent disabled:opacity-60"
        >
          {add.isPending ? "Adding…" : "Add availability entry"}
        </button>
      </div>
    </div>
  );
}

function splitCsv(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-medium text-foreground">{label}</div>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-[11px] font-medium text-foreground">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`h-7 rounded-sm border px-2 text-[11px] ${checked ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"}`}
      >
        {checked ? "Yes" : "No"}
      </button>
    </label>
  );
}