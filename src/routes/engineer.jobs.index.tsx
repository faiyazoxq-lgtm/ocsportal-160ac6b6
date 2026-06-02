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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { WorkOrderStatus } from "@/types/workOrders";

export const Route = createFileRoute("/engineer/jobs/")({
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
  const completed = useMemo(
    () =>
      (jobs ?? []).filter(
        (j) =>
          j.current_status === "field_submitted_complete" ||
          j.current_status === "dispatcher_review" ||
          j.current_status === "follow_up_required" ||
          j.current_status === "closed",
      ),
    [jobs],
  );
  const all = jobs ?? [];

  return (
    <ProtectedRoute requireRole="engineer">
      <EngineerShell>
        <section className="space-y-4">
          <header>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Jobs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
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
            <Tabs defaultValue="outstanding" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="outstanding">
                  Outstanding
                  <span className="ml-1.5 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {outstanding.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Completed
                  <span className="ml-1.5 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {completed.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="all">
                  All
                  <span className="ml-1.5 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {all.length}
                  </span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="outstanding" className="mt-3">
                <JobList jobs={outstanding} meId={me?.id ?? null} emptyLabel="No outstanding jobs." />
              </TabsContent>
              <TabsContent value="completed" className="mt-3">
                <JobList jobs={completed} meId={me?.id ?? null} emptyLabel="No completed jobs yet." />
              </TabsContent>
              <TabsContent value="all" className="mt-3">
                <JobList jobs={all} meId={me?.id ?? null} emptyLabel="No jobs." />
              </TabsContent>
            </Tabs>
          )}
        </section>
      </EngineerShell>
    </ProtectedRoute>
  );
}

type JobItem = NonNullable<ReturnType<typeof useEngineerAssignedJobs>["data"]>[number];

function JobList({
  jobs,
  meId,
  emptyLabel,
}: {
  jobs: JobItem[];
  meId: string | null;
  emptyLabel: string;
}) {
  if (!jobs.length) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {jobs.map((j) => (
        <EngineerJobCard key={j.id} job={j} currentEngineerId={meId} />
      ))}
    </div>
  );
}