import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  MapPin,
  Wrench,
  Clock,
  Banknote,
  Building2,
  Phone,
  Crown,
  HandHelping,
  Info,
  Lock,
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { EngineerShell } from "@/components/EngineerShell";
import {
  useEngineerJobDetail,
  useCurrentEngineer,
} from "@/hooks/useEngineerJobs";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EngineerMilestoneActions } from "@/components/engineer/EngineerMilestoneActions";
import { EngineerOutcomeForm } from "@/components/engineer/EngineerOutcomeForm";
import { EngineerTimeline } from "@/components/engineer/EngineerTimeline";
import {
  EngineerEvidenceCapture,
  EvidenceSummaryBadge,
} from "@/components/engineer/EngineerEvidenceCapture";
import { EngineerExpenses } from "@/components/engineer/EngineerExpenses";
import { WorkOrderDocumentsPanel } from "@/components/documents/WorkOrderDocumentsPanel";

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
        <div className="space-y-4">
          <Link
            to="/engineer/jobs"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to jobs
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

  const submittable =
    job.current_status !== "field_submitted_complete" &&
    job.current_status !== "field_submitted_incomplete" &&
    job.current_status !== "closed" &&
    job.current_status !== "dispatcher_review";

  return (
    <article className="space-y-4">
      {/* Header */}
      <header className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-muted-foreground">{job.order_no}</span>
          <StatusBadge status={job.current_status} />
        </div>
        <h1 className="mt-2 text-base font-semibold text-foreground">
          {job.job_summary ?? "Untitled job"}
        </h1>
        {mine ? (
          <div className="mt-2">
            <span
              className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                isLead ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              {isLead ? <Crown className="h-3 w-3" /> : <HandHelping className="h-3 w-3" />}
              {isLead ? "You are lead" : "You are support"}
            </span>
          </div>
        ) : null}
      </header>

      {/* Lead-only milestone actions */}
      {isLead && submittable ? (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Quick status
          </h2>
          <EngineerMilestoneActions
            workOrderId={job.id}
            currentStatus={job.current_status}
          />
        </section>
      ) : null}

      {/* Support read-only notice */}
      {!isLead && mine ? (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            You are a <strong>support</strong> engineer on this job. Only the lead engineer can submit the official checklist, milestone updates, and outcome.
          </span>
        </div>
      ) : null}

      {/* Job summary block */}
      <section className="space-y-2 rounded-md border border-border bg-card p-4">
        <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Client">
          {job.client?.client_name ?? "—"}
          {job.client?.client_type ? (
            <span className="ml-1 text-muted-foreground">· {job.client.client_type}</span>
          ) : null}
        </Row>
        {job.client?.contact_name ? (
          <Row icon={<Phone className="h-3.5 w-3.5" />} label="Contact">
            {job.client.contact_name}
            {job.client.contact_phone ? ` · ${job.client.contact_phone}` : ""}
          </Row>
        ) : null}
        <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Address">
          {job.address_line_1 ?? "—"}
          {job.postcode ? ` · ${job.postcode}` : ""}
          {job.postcode_zone ? ` (${job.postcode_zone})` : ""}
        </Row>
        <Row icon={<Wrench className="h-3.5 w-3.5" />} label="Trade">
          {job.primary_trade ?? "—"}
          {job.trade_tags.length ? ` · ${job.trade_tags.join(", ")}` : ""}
        </Row>
        <Row icon={<Info className="h-3.5 w-3.5" />} label="Complexity">
          {job.complexity_level ?? "—"}
        </Row>
        <Row icon={<Clock className="h-3.5 w-3.5" />} label="Estimated">
          {job.estimated_duration_minutes
            ? `${job.estimated_duration_minutes} min`
            : "—"}
        </Row>
        {job.estimated_value_amount ? (
          <Row icon={<Banknote className="h-3.5 w-3.5" />} label="Value">
            £{Number(job.estimated_value_amount).toFixed(0)}
          </Row>
        ) : null}
        {job.tools_materials_hint ? (
          <div className="mt-2 rounded-sm border border-dashed border-border bg-muted/30 px-3 py-2 text-xs">
            <div className="font-semibold text-foreground">Tools / materials</div>
            <div className="text-muted-foreground">{job.tools_materials_hint}</div>
          </div>
        ) : null}
      </section>

      {/* Description */}
      {job.job_description ? (
        <section className="rounded-md border border-border bg-card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Job description
          </h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {job.job_description}
          </p>
        </section>
      ) : null}

      {/* Diary */}
      {job.diary_date || job.diary_slot_label ? (
        <section className="rounded-md border border-border bg-card p-4 text-xs">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Diary
          </h2>
          <div className="mt-1 text-foreground">
            {job.diary_date ?? "—"}{job.diary_slot_label ? ` · ${job.diary_slot_label}` : ""}
          </div>
        </section>
      ) : null}

      {/* Team */}
      <section className="rounded-md border border-border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Team
        </h2>
        <ul className="mt-2 space-y-1 text-sm">
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
      </section>

      {/* Admin notes */}
      {job.admin_notes ? (
        <section className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="font-semibold">Dispatcher notes</div>
          <p className="mt-1">{job.admin_notes}</p>
        </section>
      ) : null}

      {/* Outcome form (lead only) */}
      {isLead && submittable ? (
        <section className="rounded-md border border-border bg-card p-4">
          <EngineerOutcomeForm
            workOrderId={job.id}
            primaryTrade={job.primary_trade}
          />
        </section>
      ) : null}

      {/* Evidence */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Evidence
          </h2>
          <EvidenceSummaryBadge workOrderId={job.id} />
        </div>
        {isLead ? (
          <div className="space-y-2">
            <EngineerEvidenceCapture
              workOrderId={job.id}
              fileKind="arrival_photo"
              helperText="On-arrival site / hazard photo."
            />
            <EngineerEvidenceCapture
              workOrderId={job.id}
              fileKind="before_leave_photo"
              helperText="Finished work photo before leaving site."
            />
            <EngineerEvidenceCapture
              workOrderId={job.id}
              fileKind="completion_signature"
              helperText="Customer signature / sign-off."
            />
            <EngineerEvidenceCapture
              workOrderId={job.id}
              fileKind="general_evidence"
              helperText="Optional extra photos."
            />
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Only the lead engineer can capture official evidence. You can view what has been submitted via the summary above.
          </div>
        )}
      </section>

      {/* Expenses */}
      <EngineerExpenses workOrderId={job.id} canEdit={isLead} />

      {/* Documents & media (read-focused) */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Documents & media
        </h2>
        <WorkOrderDocumentsPanel workOrderId={job.id} compact />
      </section>

      {/* Timeline */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Timeline
        </h2>
        <EngineerTimeline events={job.events} />
      </section>
    </article>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-foreground">{children}</div>
      </div>
    </div>
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