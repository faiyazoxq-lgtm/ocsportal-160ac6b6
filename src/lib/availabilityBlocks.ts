import type { EngineerAvailability } from "@/types/engineers";

/**
 * A date string in YYYY-MM-DD (local) intersects an availability block when
 * its day range overlaps the block's [start_at, end_at] window. Blocking
 * types are `time_off` and `unavailable_block`. Working-hours rows do not
 * block assignment.
 */
export function isBlockedOnDate(
  slots: EngineerAvailability[] | null | undefined,
  engineerId: string,
  isoDate: string | null | undefined,
): { blocked: boolean; note?: string } {
  if (!slots || !isoDate) return { blocked: false };
  // [00:00, next day 00:00) for the target day, local-time
  const dayStart = new Date(`${isoDate}T00:00:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  for (const s of slots) {
    if (s.engineer_id !== engineerId) continue;
    if (s.availability_type !== "time_off" && s.availability_type !== "unavailable_block") continue;
    const start = s.start_at ? new Date(s.start_at) : null;
    const end = s.end_at ? new Date(s.end_at) : null;
    // Overlap: start < dayEnd AND end > dayStart (treating nulls as open-ended).
    const startsBeforeDayEnd = !start || start < dayEnd;
    const endsAfterDayStart = !end || end > dayStart;
    if (startsBeforeDayEnd && endsAfterDayStart) {
      return { blocked: true, note: s.note ?? "Marked unavailable" };
    }
  }
  return { blocked: false };
}

/** Convenience: list of engineer IDs blocked on a given date. */
export function blockedEngineerIdsOnDate(
  slots: EngineerAvailability[] | null | undefined,
  isoDate: string | null | undefined,
): Set<string> {
  const set = new Set<string>();
  if (!slots || !isoDate) return set;
  for (const s of slots) {
    if (s.availability_type !== "time_off" && s.availability_type !== "unavailable_block") continue;
    if (isBlockedOnDate([s], s.engineer_id, isoDate).blocked) set.add(s.engineer_id);
  }
  return set;
}