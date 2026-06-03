import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  MapPin,
  Wrench,
  Clock,
  Building2,
  Phone,
  Crown,
  HandHelping,
  Lock,
  CheckCircle2,
  Send,
  AlertCircle,
  ChevronDown,
  Mail,
  ClipboardList,
  Receipt,
  Images,
  FileText,
  History,
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { EngineerShell } from "@/components/EngineerShell";
import {
  useEngineerJobDetail,
  useCurrentEngineer,
} from "@/hooks/useEngineerJobs";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SyncStatusBadge } from "@/components/engineer/SyncStatusBadge";
import { EngineerMilestoneActions } from "@/components/engineer/EngineerMilestoneActions";
import {
  EngineerOutcomeForm,
  type OutcomeSubmitState,
} from "@/components/engineer/EngineerOutcomeForm";
import { EngineerTimeline } from "@/components/engineer/EngineerTimeline";
import { EngineerExpensesSection } from "@/components/engineer/EngineerExpensesSection";
import { WorkOrderDocumentsPanel } from "@/components/documents/WorkOrderDocumentsPanel";
import { StopWorkButton } from "@/components/engineer/StopWorkButton";
import { AdditionalMediaUploadSection } from "@/components/engineer/AdditionalMediaUploadSection";
import { WorkOrderUpdatedBadge } from "@/components/engineer/WorkOrderUpdatedBadge";
import { buildMapsUrl, buildTelUrl } from "@/lib/mapsUrl";
import { useEngineerCanSee } from "@/hooks/useEngineerPermissions";
import { useEvidenceFiles } from "@/hooks/useEvidenceFiles";
import { useOfflineJobDraft } from "@/hooks/useOfflineJobDraft";
import { UNIVERSAL_CHECKLIST } from "@/types/engineerField";

export const Route = createFileRoute("/engineer/jobs/$id")({
  head: () => ({ meta: [{ title: "Job · OCS Engineer" }] }),
  component: EngineerJobDetailPage,
});

function EngineerJobDetailPage() {
  const { id } = Route.useParams();
  const { data: me } = useCurrentEngineer();
  const { data: job, isLoading, error } = useEngineerJobDetail(id);

  return (
    <ProtectedRoute requireRole="engineer">
      <EngineerShell>
        <div className="mx-auto w-full max-w-3xl space-y-3">
          <Link
            to="/engineer/jobs"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All jobs
          </Link>

          {isLoading ? (
            <Skeleton />
          ) : error ? (
            <ErrorCard message={(error as Error).message} />
          ) : !job ? (
            <ErrorCard message="Job not found or you do not have access." />
          ) : (
            <JobBody job={job} meId={me?.id ?? null} />
          )}
        </div>
      </EngineerShell>
    </ProtectedRoute>
  );
}

function JobBody({
  job,
  meId,
}: {
  job: NonNullable<ReturnType<typeof useEngineerJobDetail>["data"]>;
  meId: string | null;
}) {
  const mine = job.assignments.find((a) => a.engineer?.id === meId);
  const isLead = mine?.assignment_role === "lead";
  const lead = job.assignments.find((a) => a.assignment_role === "lead");
  const supports = job.assignments.filter((a) => a.assignment_role === "support");
  const [submitState, setSubmitState] = useState<OutcomeSubmitState | null>(null);

  // Lead can submit/resubmit until the job is fully closed
  const submittable = job.current_status !== "closed";
  const alreadySubmitted =
    job.current_status === "field_submitted_complete" ||
    job.current_status === "field_submitted_incomplete" ||
    job.current_status === "dispatcher_review";

  const mapsUrl = buildMapsUrl({
    lat: job.latitude,
    lng: job.longitude,
    address: job.address_line_1,
    postcode: job.postcode,
  });
  const telUrl = buildTelUrl(job.client?.contact_phone);

  return (
    <article className="space-y-3 pb-24">
      {/* === HERO: what + where + who + go === */}
      <header className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            <span>{job.order_no}</span>
            {mine ? (
              <span
                className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  isLead ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {isLead ? <Crown className="h-3 w-3" /> : <HandHelping className="h-3 w-3" />}
                {isLead ? "Lead" : "Support"}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <WorkOrderUpdatedBadge createdAt={job.created_at} updatedAt={job.updated_at} />
            <SyncStatusBadge workOrderId={job.id} />
            <StatusBadge status={job.current_status} />
          </div>
        </div>

        <div className="space-y-3 px-4 py-3">
          <h1 className="text-lg font-semibold leading-snug text-foreground">
            {job.job_summary ?? "Untitled job"}
          </h1>

          {/* Address with prominent map button */}
          {(job.address_line_1 || job.postcode) ? (
            <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2.5">
              <div className="flex min-w-0 items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 text-sm leading-snug text-foreground">
                  <div className="truncate">{job.address_line_1 ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {[job.address_line_2, job.city, job.postcode].filter(Boolean).join(" · ") || "—"}
                    {job.postcode_zone ? ` · ${job.postcode_zone}` : ""}
                  </div>
                </div>
              </div>
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <MapPin className="h-3.5 w-3.5" /> Directions
                </a>
              ) : null}
            </div>
          ) : null}

          {/* Contact + client compact */}
          <ClientContactBlock
            clientName={job.client?.client_name ?? null}
            clientType={job.client?.client_type ?? null}
            contactName={job.client?.contact_name ?? null}
            phone={job.client?.contact_phone ?? null}
            email={(job.client as { contact_email?: string | null } | null)?.contact_email ?? null}
            telUrl={telUrl}
          />

          {/* Compact meta strip */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {job.trade_tags.length ? (
              <span className="inline-flex items-center gap-1">
                <Wrench className="h-3 w-3" /> {job.trade_tags.join(", ")}
              </span>
            ) : null}
            {job.estimated_duration_minutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {job.estimated_duration_minutes} min
              </span>
            ) : null}
            {job.diary_date || job.diary_slot_label ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {job.diary_date ?? ""}
                {job.diary_slot_label ? ` · ${job.diary_slot_label}` : ""}
              </span>
            ) : null}
          </div>

          {job.tools_materials_hint ? (
            <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs">
              <div className="font-semibold text-foreground">Bring / use</div>
              <div className="text-muted-foreground">{job.tools_materials_hint}</div>
            </div>
          ) : null}

          {job.admin_notes ? (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="font-semibold">Dispatcher notes</div>
              <p className="mt-0.5">{job.admin_notes}</p>
            </div>
          ) : null}
        </div>
      </header>

      {/* === ON-SITE STATUS ACTIONS (lead) === */}
      {isLead && submittable ? (
        <section className="space-y-2 rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              On-site status
            </h2>
          </div>
          <EngineerMilestoneActions
            workOrderId={job.id}
            currentStatus={job.current_status}
          />
          {job.current_status === "field_in_progress" ? (
            <StopWorkButton workOrderId={job.id} />
          ) : null}
        </section>
      ) : null}

      {/* === SUBMIT READINESS (lead) === */}
      {isLead && submittable ? (
        <SubmitReadiness workOrderId={job.id} alreadySubmitted={alreadySubmitted} />
      ) : null}

      {/* === SUPPORT NOTICE === */}
      {!isLead && mine ? (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            You are <strong>support</strong> on this job. Only the lead can submit milestones, checklist, and outcome.
          </span>
        </div>
      ) : null}

      {/* === CHECKLIST & OUTCOME (lead) === */}
      {isLead && submittable ? (
        <Section
          id="checklist"
          icon={<ClipboardList className="h-4 w-4" />}
          title="Checklist & outcome"
          defaultOpen
        >
          {alreadySubmitted ? (
            <div className="mb-3 rounded-sm border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              Already submitted. You can still edit and re-submit until dispatch closes it.
            </div>
          ) : null}
          <EngineerOutcomeForm
            workOrderId={job.id}
            hideInlineSubmit
            onStateChange={setSubmitState}
          />
        </Section>
      ) : null}

      {/* === PHOTOS & FILES === */}
      <Section
        id="files"
        icon={<Images className="h-4 w-4" />}
        title="Photos & files"
        defaultOpen={isLead}
      >
        <AdditionalMediaUploadSection workOrderId={job.id} canUpload={!!isLead} />
      </Section>

      {/* === EXPENSES === */}
      <Section
        id="expenses"
        icon={<Receipt className="h-4 w-4" />}
        title="Expenses"
      >
        <EngineerExpensesSection workOrderId={job.id} canEdit={!!isLead} />
      </Section>

      {/* === DETAILS (description, team, dispatcher docs) === */}
      <Section
        id="details"
        icon={<FileText className="h-4 w-4" />}
        title="Job details & reference"
      >
        <div className="space-y-3">
          {job.job_description ? (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Description
              </h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {job.job_description}
              </p>
            </div>
          ) : null}

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Team
            </h3>
            <ul className="mt-1 space-y-0.5 text-sm">
              <li className="flex items-center gap-2">
                <Crown className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-foreground">
                  {lead?.engineer?.display_name ?? "No lead assigned"}
                </span>
                <span className="text-xs text-muted-foreground">lead</span>
              </li>
              {supports.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <HandHelping className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-foreground">{s.engineer?.display_name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">support</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Reference documents
            </h3>
            <div className="mt-1">
              <WorkOrderDocumentsPanel workOrderId={job.id} compact />
            </div>
          </div>

          {isLead ? (
            <div className="flex items-start gap-2 rounded-sm border border-dashed border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              <Lock className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                Original job details are owned by dispatch. Message dispatch if something is wrong — your checklist, evidence and expenses stay editable.
              </span>
            </div>
          ) : null}
        </div>
      </Section>

      {/* === TIMELINE === */}
      <Section
        id="timeline"
        icon={<History className="h-4 w-4" />}
        title={`Timeline (${job.events.length})`}
      >
        <EngineerTimeline events={job.events} />
      </Section>

      {/* Bottom submit bar (lead only) */}
      {isLead && submittable && submitState ? (
        <section
          id="submit"
          className="sticky bottom-0 z-10 -mx-2 mt-4 rounded-md border border-border bg-card/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80"
        >
          {submitState.errors.length ? (
            <div className="mb-2 flex items-start gap-1.5 rounded-sm border border-amber-300/60 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                {submitState.errors.length} step{submitState.errors.length === 1 ? "" : "s"} left
                {" · "}
                <span className="font-semibold">Next: {submitState.errors[0]}</span>
              </span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={submitState.submit}
            disabled={!submitState.canSubmit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {submitState.isPending
              ? "Submitting…"
              : submitState.canSubmit
                ? `Submit ${submitState.outcome}`
                : `Finish ${submitState.errors.length} step${submitState.errors.length === 1 ? "" : "s"} to submit`}
          </button>
        </section>
      ) : null}
    </article>
  );
}

function ClientContactBlock({
  clientName,
  clientType,
  contactName,
  phone,
  email,
  telUrl,
}: {
  clientName: string | null;
  clientType: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  telUrl: string | null;
}) {
  const canPhone = useEngineerCanSee("contact_info", "see_client_phone");
  const canEmail = useEngineerCanSee("contact_info", "see_client_email");
  const showPhone = phone && canPhone;
  const showEmail = email && canEmail;

  if (!clientName && !contactName) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2">
        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 text-sm leading-snug">
          <div className="truncate font-medium text-foreground">
            {clientName ?? "—"}
            {clientType ? (
              <span className="ml-1 text-xs font-normal text-muted-foreground">· {clientType}</span>
            ) : null}
          </div>
          {contactName ? (
            <div className="truncate text-xs text-muted-foreground">{contactName}</div>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {showPhone && telUrl ? (
          <a
            href={telUrl}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Phone className="h-3.5 w-3.5" /> Call
          </a>
        ) : null}
        {showEmail ? (
          <a
            href={`mailto:${email}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Mail className="h-3.5 w-3.5" /> Email
          </a>
        ) : null}
      </div>
    </div>
  );
}

function Section({
  id,
  icon,
  title,
  defaultOpen,
  children,
}: {
  id?: string;
  icon: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group overflow-hidden rounded-lg border border-border bg-card shadow-sm scroll-mt-4"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/30">
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-4 py-3">{children}</div>
    </details>
  );
}

const REQ_UNIVERSAL_KEYS = UNIVERSAL_CHECKLIST.filter(
  (i) => !["advisory_note", "additional_issue"].includes(i.key),
).map((i) => i.key);

function SubmitReadiness({
  workOrderId,
  alreadySubmitted,
}: {
  workOrderId: string;
  alreadySubmitted: boolean;
}) {
  const { data: files = [] } = useEvidenceFiles(workOrderId);
  const { draft } = useOfflineJobDraft(workOrderId);
  const hasArrival = files.some((f) => f.file_kind === "arrival_photo");
  const hasBefore = files.some((f) => f.file_kind === "before_leave_photo");
  const checklist = draft.checklist as Record<string, boolean>;
  const ticked = REQ_UNIVERSAL_KEYS.filter((k) => checklist[k]).length;
  const total = REQ_UNIVERSAL_KEYS.length;
  const notesOk = (draft.notes ?? "").trim().length >= 5;

  type Item = { ok: boolean; label: string; hint: string; href: string };
  const items: Item[] = [
    {
      ok: hasArrival,
      label: "Arrival photo",
      hint: "Take a photo as you arrive on site.",
      href: "#checklist",
    },
    {
      ok: hasBefore,
      label: "Before-leaving photo",
      hint: "Take a photo of completed work before you leave.",
      href: "#checklist",
    },
    {
      ok: ticked === total,
      label: `Checklist (${ticked}/${total})`,
      hint: `Tick the remaining ${total - ticked} universal item${total - ticked === 1 ? "" : "s"}.`,
      href: "#checklist",
    },
    {
      ok: notesOk,
      label: "Job details note",
      hint: "Write a short summary of the work carried out (min 5 chars).",
      href: "#checklist",
    },
  ];
  const done = items.filter((i) => i.ok).length;
  const allDone = done === items.length;
  const nextMissing = items.find((i) => !i.ok);
  const pct = Math.round((done / items.length) * 100);

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2 text-xs">
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">
          {alreadySubmitted ? "Already submitted" : allDone ? "Ready to submit" : "Required to submit"}
        </span>
        <span className={allDone ? "font-semibold text-emerald-700" : "font-medium text-muted-foreground"}>
          {done}/{items.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-muted">
        <div
          className={`h-full transition-all ${allDone ? "bg-emerald-500" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-2 p-3">
        {/* Next action banner */}
        {!allDone && nextMissing ? (
          <a
            href={nextMissing.href}
            className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs hover:bg-primary/10"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-foreground">
                Next: {nextMissing.label}
              </span>
              <span className="block text-muted-foreground">{nextMissing.hint}</span>
            </span>
            <span className="shrink-0 self-center text-[10px] font-semibold uppercase tracking-wider text-primary">
              Go →
            </span>
          </a>
        ) : allDone ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
            All required items complete — scroll down and tap Submit.
          </div>
        ) : null}

        {/* Item grid */}
        <ul className="grid grid-cols-2 gap-1.5">
          {items.map((i) => (
            <li key={i.label}>
              <a
                href={i.href}
                className={`flex items-center gap-1.5 rounded-sm border px-2 py-1.5 text-[11px] transition ${
                  i.ok
                    ? "border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
                    : "border-dashed border-amber-300/60 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-100"
                }`}
              >
                {i.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">{i.label}</span>
              </a>
            </li>
          ))}
        </ul>

        <p className="text-[10px] text-muted-foreground">
          Recommendations, expenses, and extra media are optional.
        </p>
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div className="rounded-md border border-border bg-card p-4 text-center text-xs text-muted-foreground">
      Loading job…
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-xs text-destructive">
      {message}
    </div>
  );
}