export const fmtInt = (n: number | null | undefined): string =>
  n == null ? "—" : new Intl.NumberFormat("en-GB").format(n);

export const fmtPct = (n: number | null | undefined, digits = 0): string =>
  n == null || !isFinite(n) ? "—" : `${(n * 100).toFixed(digits)}%`;

export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null || !isFinite(ms) || ms <= 0) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = mins / 60;
  if (hrs < 24) return `${hrs.toFixed(1)}h`;
  return `${(hrs / 24).toFixed(1)}d`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" });
}

export function dayKey(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

export function rangeDays(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function buildDaySeries(
  fromISO: string,
  toISO: string,
  rows: Array<{ created_at: string }>,
  group?: (r: { created_at: string }) => string,
): Array<{ day: string; total: number } & Record<string, number | string>> {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  const days: string[] = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  while (cur <= to) {
    days.push(dayKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  const buckets = new Map<string, Record<string, number>>();
  days.forEach((d) => buckets.set(d, { total: 0 }));
  for (const r of rows) {
    const k = dayKey(r.created_at);
    const b = buckets.get(k);
    if (!b) continue;
    b.total += 1;
    if (group) {
      const g = group(r) || "other";
      b[g] = (b[g] ?? 0) + 1;
    }
  }
  return days.map((d) => ({ day: d.slice(5), total: buckets.get(d)?.total ?? 0, ...buckets.get(d) }));
}

export function countBy<T>(rows: T[], key: (r: T) => string | null | undefined): Array<{ name: string; value: number }> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = (key(r) ?? "unknown") || "unknown";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}