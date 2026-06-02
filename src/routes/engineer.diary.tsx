import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { EngineerShell } from "@/components/EngineerShell";
import {
  useEngineerAssignedJobs,
  useCurrentEngineer,
} from "@/hooks/useEngineerJobs";
import { EngineerJobCard } from "@/components/engineer/EngineerJobCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/engineer/diary")({
  head: () => ({ meta: [{ title: "Diary · OCS Engineer" }] }),
  component: EngineerDiaryPage,
});

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoFor(year: number, month: number, day: number) {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function EngineerDiaryPage() {
  const { data: me } = useCurrentEngineer();
  const { data: jobs, isLoading, error } = useEngineerAssignedJobs();

  const today = isoToday();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Only today + future jobs (drop past)
  const upcoming = useMemo(
    () =>
      (jobs ?? []).filter((j) => {
        if (!j.diary_date) return true; // keep unscheduled
        return j.diary_date >= today;
      }),
    [jobs, today],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, typeof upcoming>();
    upcoming.forEach((j) => {
      const key = j.diary_date ?? "unscheduled";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(j);
    });
    return map;
  }, [upcoming]);

  // Build calendar grid for current month view
  const calendar = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    // Monday-based: getDay returns 0=Sun..6=Sat → convert so Mon=0
    const offset = (firstOfMonth.getDay() + 6) % 7;
    const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];
    // leading blanks from prev month
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = offset - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const prev = new Date(viewYear, viewMonth - 1, 1);
      cells.push({
        iso: isoFor(prev.getFullYear(), prev.getMonth(), day),
        day,
        inMonth: false,
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ iso: isoFor(viewYear, viewMonth, d), day: d, inMonth: true });
    }
    // trailing to fill 6 rows × 7
    const trailing = 42 - cells.length;
    for (let d = 1; d <= trailing; d++) {
      const next = new Date(viewYear, viewMonth + 1, 1);
      cells.push({
        iso: isoFor(next.getFullYear(), next.getMonth(), d),
        day: d,
        inMonth: false,
      });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const scheduledList = useMemo(() => {
    const items = upcoming
      .filter((j) => j.diary_date)
      .filter((j) => (selectedDate ? j.diary_date === selectedDate : true))
      .sort((a, b) => (a.diary_date! < b.diary_date! ? -1 : 1));
    return items;
  }, [upcoming, selectedDate]);

  const unscheduled = useMemo(
    () => upcoming.filter((j) => !j.diary_date),
    [upcoming],
  );

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  return (
    <ProtectedRoute requireRole="engineer">
      <EngineerShell>
        <section className="space-y-4">
          <header>
            <h1 className="text-base font-semibold text-foreground">Diary</h1>
            <p className="text-xs text-muted-foreground">
              Today and upcoming jobs scheduled for you.
            </p>
          </header>

          {!me ? (
            <NoEngineerProfile />
          ) : isLoading ? (
            <SkeletonCard label="Loading diary…" />
          ) : error ? (
            <ErrorCard message={(error as Error).message} />
          ) : !upcoming.length ? (
            <EmptyCard
              icon={<CalendarDays className="h-5 w-5" />}
              title="No upcoming jobs"
              body="When a dispatcher schedules a job for today or later it will appear here."
            />
          ) : (
            <>
              {/* Calendar */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="mb-3 flex items-center justify-between">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => shiftMonth(-1)}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-sm font-semibold text-foreground">
                    {MONTHS[viewMonth]} {viewYear}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => shiftMonth(1)}
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
                  {WEEKDAYS.map((w) => (
                    <div key={w} className="px-1 py-1 text-center">
                      {w}
                    </div>
                  ))}
                </div>

                <div className="mt-1 grid grid-cols-7 gap-1">
                  {calendar.map((cell) => {
                    const count = byDate.get(cell.iso)?.length ?? 0;
                    const isToday = cell.iso === today;
                    const isPast = cell.iso < today;
                    const isSelected = cell.iso === selectedDate;
                    return (
                      <button
                        key={cell.iso + (cell.inMonth ? "" : "-out")}
                        type="button"
                        onClick={() =>
                          setSelectedDate(isSelected ? null : cell.iso)
                        }
                        disabled={isPast && !count}
                        className={cn(
                          "relative aspect-square rounded-sm border text-xs transition-colors",
                          "flex flex-col items-center justify-start p-1",
                          cell.inMonth
                            ? "border-border bg-background"
                            : "border-transparent bg-muted/30 text-muted-foreground/60",
                          isPast && "opacity-50",
                          isToday && "border-primary ring-1 ring-primary/40",
                          isSelected && "bg-primary text-primary-foreground",
                          count > 0 &&
                            !isSelected &&
                            "bg-primary/10 font-semibold text-foreground",
                        )}
                      >
                        <span className="text-[11px] leading-none">
                          {cell.day}
                        </span>
                        {count > 0 && (
                          <span
                            className={cn(
                              "mt-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none",
                              isSelected
                                ? "bg-primary-foreground text-primary"
                                : "bg-primary text-primary-foreground",
                            )}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedDate && (
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Filtering by {selectedDate}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(null)}
                      className="font-semibold text-primary hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Scheduled jobs list */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {selectedDate ? `Jobs on ${selectedDate}` : "Scheduled jobs"}
                  </h2>
                </div>
                {scheduledList.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">
                    No scheduled jobs{selectedDate ? " on this date" : ""}.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {scheduledList.map((j) => (
                      <EngineerJobCard
                        key={j.id}
                        job={j}
                        currentEngineerId={me?.id ?? null}
                      />
                    ))}
                  </div>
                )}
              </div>

              {!selectedDate && unscheduled.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Unscheduled
                    </h2>
                  </div>
                  <div className="space-y-2">
                    {unscheduled.map((j) => (
                      <EngineerJobCard
                        key={j.id}
                        job={j}
                        currentEngineerId={me?.id ?? null}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
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