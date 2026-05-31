import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { EngineerShell } from "@/components/EngineerShell";
import {
  useEngineerAssignedJobs,
  useCurrentEngineer,
} from "@/hooks/useEngineerJobs";
import { EngineerJobCard } from "@/components/engineer/EngineerJobCard";
import type { WorkOrderStatus } from "@/types/workOrders";

export const Route = createFileRoute("/engineer/jobs")({
  head: () => ({ meta: [{ title: "Jobs · OCS Engineer" }] }),
  component: EngineerJobsPage,
});

const OPEN_STATUSES: WorkOrderStatus[] = [
  "assigned",
  "accepted",
  "en_route",
  "on_site",
  "field_in_progress",
  "field_submitted_incomplete",
];

function EngineerJobsPage() {
  const { data: me } = useCurrentEngineer();
  const { data: jobs, isLoading, error } = useEngineerAssignedJobs();

  const outstanding = useMemo(
    () => (jobs ?? []).filter((j) => OPEN_STATUSES.includes(j.current_status)),
    [jobs],
  );
  const submitted = useMemo(
    () =>
      (jobs ?? []).filter(
        (j) =>
          j.current_status === "field_submitted_complete" ||
          j.current_status === "dispatcher_review" ||
          j.current_status === "closed",
      ),
    [jobs],
  );

  return (
    <ProtectedRoute requireRole="engineer">
      <EngineerShell>
        <section className="space-y-4">
          <header>
            <h1 className="text-base font-semibold text-foreground">Jobs</h1>
            <p className="text-xs text-muted-foreground">
              All work orders assigned to you.
            </p>
          </header>

          {isLoading ? (
            <div className="rounded-md border border-border bg-card p-4 text-center text-xs text-muted-foreground">
              Loading jobs…
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-xs text-destructive">
              {(error as Error).message}
            </div>
          ) : !jobs?.length ? (
            <div className="rounded-md border border-dashed border-border bg-card p-6 text-center">
              <Wrench className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">No assigned jobs</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                When a dispatcher assigns you a job, it will appear here.
              </p>
            </div>
          ) : (
            <>
              <Group title="Outstanding" jobs={outstanding} meId={me?.id ?? null} />
              <Group title="Submitted / closed" jobs={submitted} meId={me?.id ?? null} />
            </>
          )}
        </section>
      </EngineerShell>
    </ProtectedRoute>
  );
}

function Group({
  title,
  jobs,
  meId,
}: {
  title: string;
  jobs: ReturnType<typeof useEngineerAssignedJobs>["data"] extends infer T
    ? T extends Array<infer U>
      ? U[]
      : never
    : never;
  meId: string | null;
}) {
  if (!jobs.length) return null;
  return (
    <div className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title} · {jobs.length}
      </h2>
      <div className="space-y-2">
        {jobs.map((j) => (
          <EngineerJobCard key={j.id} job={j} currentEngineerId={meId} />
        ))}
      </div>
    </div>
  );
}