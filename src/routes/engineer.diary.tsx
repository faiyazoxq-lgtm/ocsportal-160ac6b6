import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Wrench } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { EngineerShell } from "@/components/EngineerShell";
import {
  useEngineerAssignedJobs,
  useCurrentEngineer,
} from "@/hooks/useEngineerJobs";
import { EngineerJobCard } from "@/components/engineer/EngineerJobCard";

export const Route = createFileRoute("/engineer/diary")({
  head: () => ({ meta: [{ title: "Diary · OCS Engineer" }] }),
  component: EngineerDiaryPage,
});

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function EngineerDiaryPage() {
  const { data: me } = useCurrentEngineer();
  const { data: jobs, isLoading, error } = useEngineerAssignedJobs();

  const grouped = useMemo(() => {
    const today = isoToday();
    const byDate = new Map<string, typeof jobs>();
    (jobs ?? []).forEach((j) => {
      const key = j.diary_date ?? "unscheduled";
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(j);
    });
    return { today, byDate };
  }, [jobs]);

  return (
    <ProtectedRoute requireRole="engineer">
      <EngineerShell>
        <section className="space-y-4">
          <header>
            <h1 className="text-base font-semibold text-foreground">Diary</h1>
            <p className="text-xs text-muted-foreground">
              Jobs scheduled for you, grouped by diary date.
            </p>
          </header>

          {!me ? (
            <NoEngineerProfile />
          ) : isLoading ? (
            <SkeletonCard label="Loading diary…" />
          ) : error ? (
            <ErrorCard message={(error as Error).message} />
          ) : !jobs?.length ? (
            <EmptyCard
              icon={<CalendarDays className="h-5 w-5" />}
              title="No assigned jobs"
              body="When a dispatcher assigns you a job it will appear here."
            />
          ) : (
            Array.from(grouped.byDate.entries()).map(([date, list]) => (
              <div key={date} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {date === "unscheduled"
                      ? "Unscheduled"
                      : date === grouped.today
                        ? `Today · ${date}`
                        : date}
                  </h2>
                </div>
                <div className="space-y-2">
                  {list!.map((j) => (
                    <EngineerJobCard
                      key={j.id}
                      job={j}
                      currentEngineerId={me?.id ?? null}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </EngineerShell>
    </ProtectedRoute>
  );
}

function NoEngineerProfile() {
  return (
    <div className="rounded-md border border-amber-300/60 bg-amber-50 p-4 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="font-semibold">No engineer profile linked</div>
      <p className="mt-1">
        Your account is not yet linked to an engineer record. Ask a dispatcher to attach your profile to an engineer in the directory before jobs can be assigned to you.
      </p>
    </div>
  );
}

function SkeletonCard({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4 text-center text-xs text-muted-foreground">
      {label}
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

function EmptyCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card p-6 text-center">
      <div className="mx-auto mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      <Wrench className="hidden" />
    </div>
  );
}