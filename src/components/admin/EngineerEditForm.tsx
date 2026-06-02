import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, UserCog, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useUpsertEngineer } from "@/hooks/useEngineers";
import type { Engineer, EngineerInput } from "@/types/engineers";
import { EngineerAvatarUploader } from "./EngineerAvatarUploader";
import logoUrl from "@/assets/ocs-logo.png";

const EMPTY: EngineerInput = {
  display_name: "",
  engineer_code: "",
  trade_tags: [],
  certification_tags: [],
  covered_postcode_zones: [],
  can_lead: true,
  can_support: true,
  active_status: true,
  notes: "",
  personal_email: "",
  contact_number: "",
  hourly_pay_rate: null,
  van_registration: "",
  avatar_url: "",
};

const toCsv = (arr: string[]) => arr.join(", ");
const fromCsv = (s: string) =>
  s.split(",").map((x) => x.trim()).filter(Boolean);

export function EngineerEditForm({ engineer }: { engineer?: Engineer | null }) {
  const upsert = useUpsertEngineer();
  const navigate = useNavigate();
  const [form, setForm] = useState<EngineerInput>(EMPTY);
  const [tradeCsv, setTradeCsv] = useState("");
  const [certCsv, setCertCsv] = useState("");

  useEffect(() => {
    if (engineer) {
      setForm({
        display_name: engineer.display_name,
        engineer_code: engineer.engineer_code ?? "",
        trade_tags: engineer.trade_tags,
        certification_tags: engineer.certification_tags,
        covered_postcode_zones: engineer.covered_postcode_zones,
        can_lead: engineer.can_lead,
        can_support: engineer.can_support,
        active_status: engineer.active_status,
        notes: engineer.notes ?? "",
        personal_email: engineer.personal_email ?? "",
        contact_number: engineer.contact_number ?? "",
        hourly_pay_rate: engineer.hourly_pay_rate ?? null,
        van_registration: engineer.van_registration ?? "",
        avatar_url: engineer.avatar_url ?? "",
      });
      setTradeCsv(toCsv(engineer.trade_tags));
      setCertCsv(toCsv(engineer.certification_tags));
    } else {
      setForm(EMPTY);
      setTradeCsv("");
      setCertCsv("");
    }
  }, [engineer]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await upsert.mutateAsync({
      ...form,
      trade_tags: fromCsv(tradeCsv),
      certification_tags: fromCsv(certCsv),
      // Covered zones intentionally preserved as-is (no longer edited in UI).
      covered_postcode_zones: engineer?.covered_postcode_zones ?? [],
      id: engineer?.id,
    });
    navigate({ to: "/admin/engineers" });
  }

  const title = engineer ? "Edit engineer" : "New engineer";
  const subtitle = engineer
    ? "Update profile, capabilities and contact details."
    : "Create a new engineer profile for the directory.";

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* Back link */}
      <div className="mb-4">
        <Link
          to="/admin/engineers"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to engineers
        </Link>
      </div>

      {/* Prestige header card with translucent logo top-right */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-foreground via-foreground to-foreground/90 px-6 py-7 text-background shadow-xl sm:px-8 sm:py-9">
        <img
          src={logoUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 object-contain opacity-[0.08] sm:h-56 sm:w-56"
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-background/10 ring-1 ring-background/20">
            <UserCog className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-[10px] uppercase tracking-[0.22em] text-background/60">
              OCS · Engineer profile
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="mt-1 text-xs text-background/70 sm:text-sm">{subtitle}</p>
          </div>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="mt-6 space-y-6 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8"
      >
        <Section title="Identity" description="How this engineer appears across OCS.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Display name" required>
              <Input
                required
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              />
            </Field>
            <Field label="Engineer code">
              <Input
                value={form.engineer_code ?? ""}
                onChange={(e) =>
                  setForm({ ...form, engineer_code: e.target.value.toUpperCase() })
                }
              />
            </Field>
            <Field label="Profile photo" full>
              <EngineerAvatarUploader
                engineerId={engineer?.id}
                value={form.avatar_url ?? ""}
                onChange={(url: string) => setForm({ ...form, avatar_url: url })}
              />
            </Field>
          </div>
        </Section>

        <Section title="Capabilities" description="Trades and certifications used by dispatch matching.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Primary trade">
              <Input
                value={null ?? ""}
                onChange={(e) => setForm({ ...form, primary_trade: e.target.value })}
                placeholder="e.g. plumbing"
              />
            </Field>
            <Field label="Trade tags (comma separated)">
              <Input
                value={tradeCsv}
                onChange={(e) => setTradeCsv(e.target.value)}
                placeholder="plumbing, drainage"
              />
            </Field>
            <Field label="Certifications (comma separated)" full>
              <Input
                value={certCsv}
                onChange={(e) => setCertCsv(e.target.value)}
                placeholder="gas_safe, niceic"
              />
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Toggle
              label="Can lead jobs"
              checked={form.can_lead}
              onChange={(v) => setForm({ ...form, can_lead: v })}
            />
            <Toggle
              label="Can support jobs"
              checked={form.can_support}
              onChange={(v) => setForm({ ...form, can_support: v })}
            />
            <Toggle
              label="Active"
              checked={form.active_status}
              onChange={(v) => setForm({ ...form, active_status: v })}
            />
          </div>
        </Section>

        <Section title="Contact & pay" description="Personal contact details and rates.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Personal email">
              <Input
                type="email"
                value={form.personal_email ?? ""}
                onChange={(e) => setForm({ ...form, personal_email: e.target.value })}
              />
            </Field>
            <Field label="Contact number">
              <Input
                value={form.contact_number ?? ""}
                onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
              />
            </Field>
            <Field label="Hourly pay rate (£)">
              <Input
                type="number"
                step="0.01"
                value={form.hourly_pay_rate ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    hourly_pay_rate:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Van registration">
              <Input
                value={form.van_registration ?? ""}
                onChange={(e) =>
                  setForm({ ...form, van_registration: e.target.value.toUpperCase() })
                }
                placeholder="AB12 CDE"
              />
            </Field>
          </div>
        </Section>

        <Section title="Notes" description="Internal notes about this engineer.">
          <Field label="Notes" full>
            <Textarea
              rows={4}
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </Section>

        {upsert.error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
            {(upsert.error as Error).message}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/admin/engineers" })}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={upsert.isPending} className="gap-1.5">
            <Save className="h-4 w-4" />
            {upsert.isPending ? "Saving…" : engineer ? "Save changes" : "Create engineer"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  full,
  required,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  required?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-red-600">*</span>}
      </Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-sm hover:bg-accent/30">
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      <span>{label}</span>
    </label>
  );
}