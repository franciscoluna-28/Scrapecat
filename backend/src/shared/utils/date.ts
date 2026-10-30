/**
 * Generic date helpers shared across domains.
 *
 * These operate on ISO calendar days (UTC) rather than local time so that
 * date ranges from the API compare consistently with stored timestamps.
 */

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses a `YYYY-MM-DD` string as the first instant of that UTC day. */
export function startOfDayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Parses a `YYYY-MM-DD` string as the last instant of that UTC day. */
export function endOfDayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999Z`);
}
