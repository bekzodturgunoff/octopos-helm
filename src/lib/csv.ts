// CSV for the accountant: comma-separated, quoted where needed, UTF-8 with a byte-order mark so
// Excel opens Cyrillic and Uzbek names correctly instead of as mojibake.

export type Column<T> = {header: string; value: (row: T) => string | number | boolean | undefined | null};

function cell(value: unknown) {
  if (value === undefined || value === null) return "";
  let text = String(value);
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: T[], columns: Column<T>[]) {
  let lines = [columns.map((c) => cell(c.header)).join(","), ...rows.map((row) => columns.map((c) => cell(c.value(row))).join(","))];
  return "﻿" + lines.join("\r\n");
}

export function downloadCsv<T>(name: string, rows: T[], columns: Column<T>[]) {
  let blob = new Blob([toCsv(rows, columns)], {type: "text/csv;charset=utf-8"});
  let url = URL.createObjectURL(blob);
  let link = document.createElement("a");
  link.href = url;
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
