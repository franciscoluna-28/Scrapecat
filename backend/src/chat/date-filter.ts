export type DateFilter = {
  startDate?: string;
  endDate?: string;
  label?: string;
};

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const MONTH_PATTERN =
  "january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function yearRange(year: number): { startDate: string; endDate: string } {
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

function monthRange(year: number, month: number): { startDate: string; endDate: string } {
  const lastDay = new Date(year, month, 0).getDate();
  return { startDate: `${year}-${pad(month)}-01`, endDate: `${year}-${pad(month)}-${pad(lastDay)}` };
}

function subtractLocal(now: Date, count: number, unit: string): Date {
  const d = new Date(now);
  if (unit === "day") d.setDate(d.getDate() - count);
  else if (unit === "week") d.setDate(d.getDate() - count * 7);
  else if (unit === "month") d.setMonth(d.getMonth() - count);
  else if (unit === "year") d.setFullYear(d.getFullYear() - count);
  return d;
}

function parseDateExpr(raw: string): { startDate: string; endDate: string; label: string } | null {
  const text = raw.trim();

  const iso = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    const [, y, m, d] = iso;
    const date = `${y}-${pad(Number(m))}-${pad(Number(d))}`;
    return { startDate: date, endDate: date, label: date };
  }

  const monthYear = text.match(
    new RegExp(`\\b(${MONTH_PATTERN})\\.?\\s*(?:of\\s+)?(\\d{4})\\b`, "i"),
  );
  if (monthYear) {
    const month = MONTHS[monthYear[1].toLowerCase()];
    const year = parseInt(monthYear[2], 10);
    const r = monthRange(year, month);
    const monthLabel = `${monthYear[1][0].toUpperCase()}${monthYear[1].slice(1).toLowerCase()}`;
    return { ...r, label: `${monthLabel} ${year}` };
  }

  const year = text.match(/\b(19|20)\d{2}\b/);
  if (year) {
    const y = parseInt(year[0], 10);
    const r = yearRange(y);
    return { ...r, label: String(y) };
  }

  return null;
}

export function extractDateFilter(question: string, now: Date = new Date()): DateFilter {
  const q = question.trim();
  if (!q) return {};

  const between = q.match(/\bbetween\s+(.+?)\s+and\s+(.+)/i);
  if (between) {
    const from = parseDateExpr(between[1]);
    const to = parseDateExpr(between[2]);
    if (from && to) {
      return {
        startDate: from.startDate,
        endDate: to.endDate,
        label: `between ${from.label} and ${to.label}`,
      };
    }
  }

  const since = q.match(/\bsince\s+(.+)/i);
  if (since) {
    const d = parseDateExpr(since[1]);
    if (d) return { startDate: d.startDate, label: `since ${d.label}` };
  }

  const before = q.match(/\bbefore\s+(.+)/i);
  if (before) {
    const d = parseDateExpr(before[1]);
    if (d) return { endDate: d.endDate, label: `before ${d.label}` };
  }

  const priorTo = q.match(/\bprior\s+to\s+(.+)/i);
  if (priorTo) {
    const d = parseDateExpr(priorTo[1]);
    if (d) return { endDate: d.endDate, label: `before ${d.label}` };
  }

  if (/\btoday\b/i.test(q)) {
    const iso = localIso(now);
    return { startDate: iso, endDate: iso, label: "today" };
  }

  if (/\byesterday\b/i.test(q)) {
    const iso = localIso(subtractLocal(now, 1, "day"));
    return { startDate: iso, endDate: iso, label: "yesterday" };
  }

  if (/\bthis\s+year\b/i.test(q)) {
    return { ...yearRange(now.getFullYear()), label: "this year" };
  }

  if (/\blast\s+year\b/i.test(q)) {
    return { ...yearRange(now.getFullYear() - 1), label: "last year" };
  }

  if (/\bthis\s+month\b/i.test(q)) {
    return { ...monthRange(now.getFullYear(), now.getMonth() + 1), label: "this month" };
  }

  if (/\blast\s+month\b/i.test(q)) {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { ...monthRange(prev.getFullYear(), prev.getMonth() + 1), label: "last month" };
  }

  if (/\brecently\b/i.test(q)) {
    return {
      startDate: localIso(subtractLocal(now, 30, "day")),
      endDate: localIso(now),
      label: "the last 30 days",
    };
  }

  const unit = q.match(
    /\b(?:from\s+the\s+|in\s+the\s+|over\s+the\s+|for\s+the\s+|the\s+)?(last|past|previous)\s+(\d+)\s+(days?|weeks?|months?|years?)\b/i,
  );
  if (unit) {
    const count = parseInt(unit[2], 10);
    const unitName = unit[3].toLowerCase().replace(/s$/, "");
    return {
      startDate: localIso(subtractLocal(now, count, unitName)),
      endDate: localIso(now),
      label: `the last ${count} ${unitName}${count === 1 ? "" : "s"}`,
    };
  }

  const bare = parseDateExpr(q);
  if (bare) {
    return { startDate: bare.startDate, endDate: bare.endDate, label: bare.label };
  }

  return {};
}
