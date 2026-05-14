// Tiny CSV exporter. No dependency — handles quoting, commas, newlines,
// quotes-inside-values, and BOM so Excel opens UTF-8 correctly.

type Row = Record<string, string | number | boolean | null | undefined>;

function escape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Excel-style: wrap in quotes if value contains comma, quote, or newline.
  if (/[",\r\n]/.test(s)) {
    s = s.replace(/"/g, '""');
    return `"${s}"`;
  }
  return s;
}

export function toCsv<T extends Row>(rows: T[], headers?: (keyof T)[]): string {
  if (rows.length === 0 && !headers) return "";
  const cols = (headers ?? (Object.keys(rows[0]) as (keyof T)[])) as string[];

  const out: string[] = [];
  out.push(cols.map(escape).join(","));
  for (const row of rows) {
    out.push(cols.map((c) => escape((row as Row)[c])).join(","));
  }
  return out.join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  // Prepend BOM so Excel reads as UTF-8 (avoids mojibake with Arabic).
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
