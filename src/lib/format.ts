import {differenceInCalendarDays, formatDistanceToNowStrict} from "date-fns";

// One place for how Helm writes dates and numbers, so the overview and a client's page never
// disagree about whether something is "in 3 days" or "Nov 11".

export function formatDate(value: string | undefined, locale = "en") {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(locale, {day: "numeric", month: "short", year: "numeric"});
}

export function formatDateTime(value: string | undefined, locale = "en") {
  if (!value) return "—";
  return new Date(value).toLocaleString(locale, {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"});
}

export function formatRelative(value: string | undefined) {
  if (!value) return "—";
  return formatDistanceToNowStrict(new Date(value), {addSuffix: true});
}

/** Calendar days from today: 0 is today, negative is past. */
export function daysUntil(value: string) {
  return differenceInCalendarDays(new Date(value), new Date());
}

export function formatDue(value: string) {
  let days = daysUntil(value);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

export function formatPercent(fraction: number, digits = 1) {
  return `${(fraction * 100).toFixed(digits)}%`;
}

let compact = new Intl.NumberFormat("en", {notation: "compact", maximumFractionDigits: 1});
export function formatCompact(value: number) {
  return compact.format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/** "2026-11" → a local date on the 1st, so the label is the same month in every timezone. */
export function monthDate(month: string) {
  let [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1);
}
