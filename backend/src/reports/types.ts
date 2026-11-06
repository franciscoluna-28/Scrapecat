export const REPORT_CADENCES = ["daily", "weekly"] as const;
export type ReportCadence = (typeof REPORT_CADENCES)[number];

export const REPORT_STATUSES = [
  "idle",
  "running",
  "succeeded",
  "failed",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const DEFAULT_CADENCE: ReportCadence = "daily";
export const DEFAULT_DAY_OF_WEEK = 5;
export const DEFAULT_HOUR_UTC = 9;
export const DEFAULT_INITIAL_LOOKBACK_DAYS = 7;
