/**
 * A CSV's shape is its header row: column names in order. Hashing it lets an agent declare the
 * shape it expects and reject any other CSV, whatever the data rows hold.
 */

export const CSV_TYPE = "text/csv";

/** Browsers disagree on a CSV's MIME type (Windows reports Excel's, some report none), so the extension counts too. */
export function isCsv(file: { name: string; type: string }): boolean {
  return file.type === CSV_TYPE || /\.csv$/i.test(file.name);
}

/** Returns the trimmed column names of the first record; throws when the bytes aren't a CSV with a header. */
export function parseCsvHeader(bytes: Uint8Array): string[] {
  let text: string;
  try {
    // Not ignoring the BOM strips the one Excel prepends, so it never ends up in the first column's name.
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    throw new Error("UTF-8로 인코딩된 CSV만 사용할 수 있습니다");
  }
  // A header row can span lines when a quoted name contains a newline, so scan instead of splitting.
  const columns: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') field += text[i++];
      else quoted = false;
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      columns.push(field.trim());
      field = "";
    } else if (char === "\n" || char === "\r") {
      break;
    } else {
      field += char;
    }
  }
  columns.push(field.trim());
  // The BOM Excel prepends belongs to the file, not to the first column's name.
  if (columns[0]!.startsWith("﻿")) columns[0] = columns[0]!.slice(1).trim();
  if (columns.every((column) => column === "")) throw new Error("CSV 헤더 행이 비어 있습니다");
  return columns;
}

/** Parses every record (header included) into trimmed fields; blank lines are skipped. */
export function parseCsvRecords(bytes: Uint8Array): string[][] {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    throw new Error("UTF-8로 인코딩된 CSV만 사용할 수 있습니다");
  }
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  const endRecord = () => {
    record.push(field.trim());
    field = "";
    if (record.some((value) => value !== "")) records.push(record);
    record = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') field += text[i++];
      else quoted = false;
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      record.push(field.trim());
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      endRecord();
    } else {
      field += char;
    }
  }
  endRecord();
  return records;
}

/** SHA-256 (hex) of the header's column names, in order. */
export async function csvShapeHash(bytes: Uint8Array): Promise<string> {
  return hashColumns(parseCsvHeader(bytes));
}

/** Throws unless the CSV's header hashes to `expectedHash`; the check agents run on their CSV inputs. */
export async function assertCsvShape(bytes: Uint8Array, expectedHash: string): Promise<void> {
  const columns = parseCsvHeader(bytes);
  if ((await hashColumns(columns)) !== expectedHash) {
    throw new Error(`CSV 형상이 기대와 다릅니다 (컬럼: ${columns.join(", ")})`);
  }
}

export async function hashColumns(columns: string[]): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(columns)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
