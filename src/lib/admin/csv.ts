/** Minimal RFC 4180 CSV reader/writer (quoted fields, embedded commas/newlines/quotes). */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"' && field === "") quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/** Guards against spreadsheet formula injection when staff open exports. */
function neutralise(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function toCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const encode = (value: string | number | boolean | null | undefined) => {
    const text = value === null || value === undefined ? "" : typeof value === "string" ? neutralise(value) : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [header, ...rows].map((row) => row.map(encode).join(",")).join("\r\n") + "\r\n";
}

export function rowsToObjects(rows: string[][]): { header: string[]; records: Record<string, string>[] } {
  const [rawHeader = [], ...body] = rows;
  const header = rawHeader.map((cell) => cell.trim().toLowerCase());
  return { header, records: body.map((cells) => Object.fromEntries(header.map((name, index) => [name, (cells[index] ?? "").trim()]))) };
}
