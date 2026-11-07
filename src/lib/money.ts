import type {Money} from "@/api";

let formatters = new Map<string, Intl.NumberFormat>();

/**
 * Formats a total Helm adds up itself. Anything the server sends already has `display`; this is
 * only for sums across rows, written the same way the server writes UZS so the two never look
 * different side by side.
 */
export function uzs(major: number, currency = "UZS"): Money {
  let formatter = formatters.get(currency) ?? new Intl.NumberFormat("ru-RU", {maximumFractionDigits: currency === "UZS" ? 0 : 2});
  formatters.set(currency, formatter);
  let display = currency === "UZS" ? `${formatter.format(major)} so'm` : `${formatter.format(major)} ${currency}`;
  return {amount: Math.round(major * 100), majorAmount: major, currency, display};
}
