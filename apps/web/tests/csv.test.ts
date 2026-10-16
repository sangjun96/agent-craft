import { expect, test } from "vite-plus/test";
import { assertCsvShape, csvShapeHash, isCsv, parseCsvHeader } from "../worker/resources/csv.ts";

const encode = (text: string) => new TextEncoder().encode(text);

test("parseCsvHeader reads trimmed column names from the first row only", () => {
  expect(parseCsvHeader(encode("id, name ,score\r\n1,a,2\n"))).toEqual(["id", "name", "score"]);
});

test("parseCsvHeader drops the BOM and unquotes names with commas, quotes and newlines", () => {
  const header = parseCsvHeader(encode('﻿id,"a,b","say ""hi""","two\nlines"\n1,2,3,4'));
  expect(header).toEqual(["id", "a,b", 'say "hi"', "two\nlines"]);
});

test("parseCsvHeader rejects empty files and non-UTF-8 bytes", () => {
  expect(() => parseCsvHeader(encode(""))).toThrow("비어 있습니다");
  expect(() => parseCsvHeader(encode("\n1,2"))).toThrow("비어 있습니다");
  expect(() => parseCsvHeader(new Uint8Array([0xff, 0xfe, 0x00]))).toThrow("UTF-8");
});

test("csvShapeHash ignores data rows but not column names or order", async () => {
  const base = await csvShapeHash(encode("id,name\n1,a\n"));
  expect(base).toMatch(/^[0-9a-f]{64}$/);
  expect(await csvShapeHash(encode("id,name\n2,b\n3,c\n"))).toBe(base);
  expect(await csvShapeHash(encode("﻿id, name\r\n"))).toBe(base);
  expect(await csvShapeHash(encode("name,id\n"))).not.toBe(base);
  expect(await csvShapeHash(encode("id,Name\n"))).not.toBe(base);
  // Joining names naively would make these two collide.
  expect(await csvShapeHash(encode('"a,b",c\n'))).not.toBe(await csvShapeHash(encode("a,b,c\n")));
});

test("assertCsvShape passes for the expected header and names the columns otherwise", async () => {
  const expected = await csvShapeHash(encode("id,name\n"));
  await expect(assertCsvShape(encode("id,name\n1,a"), expected)).resolves.toBeUndefined();
  await expect(assertCsvShape(encode("name,id\n1,a"), expected)).rejects.toThrow(
    "CSV 형상이 기대와 다릅니다 (컬럼: name, id)",
  );
});

test("isCsv accepts CSVs however the browser labels them", () => {
  expect(isCsv({ name: "a.csv", type: "text/csv" })).toBe(true);
  expect(isCsv({ name: "a.CSV", type: "application/vnd.ms-excel" })).toBe(true);
  expect(isCsv({ name: "a", type: "text/csv" })).toBe(true);
  expect(isCsv({ name: "a.png", type: "image/png" })).toBe(false);
});
