import { expect, test } from "vite-plus/test";
import { CURRICULUM_SHAPE_HASH, LEVELS } from "../worker/agents/curriculum/constants.ts";
import { buildTree } from "../worker/agents/curriculum/tree.ts";
import { hashColumns, parseCsvRecords } from "../worker/resources/csv.ts";

const encode = (text: string) => new TextEncoder().encode(text);

test("CURRICULUM_SHAPE_HASH is the hash of the LEVELS header", async () => {
  expect(await hashColumns([...LEVELS])).toBe(CURRICULUM_SHAPE_HASH);
});

test("parseCsvRecords reads quoted fields and skips blank lines", () => {
  const records = parseCsvRecords(encode('﻿a,"b,c"\r\n\r\n1, "say ""hi""" \n2,3'));
  expect(records).toEqual([
    ["a", "b,c"],
    ["1", 'say "hi"'],
    ["2", "3"],
  ]);
});

test("buildTree nests rows by level and shares identical prefixes", () => {
  const tree = buildTree([
    ["수와 연산", "소인수분해", "약수와 배수", "기본", "약수 구하기"],
    ["수와 연산", "소인수분해", "약수와 배수", "기본", "배수 구하기"],
    ["수와 연산", "소인수분해", "거듭제곱", "기본", "지수 계산"],
    ["문자와 식", "일차방정식", "풀이", "응용", "문장제"],
  ]);

  expect(tree.children.map((c) => c.name)).toEqual(["수와 연산", "문자와 식"]);
  const factoring = tree.children[0]!.children[0]!;
  expect(factoring.children.map((c) => c.name)).toEqual(["약수와 배수", "거듭제곱"]);
  expect(factoring.children[0]!.children[0]!.children.map((c) => c.name)).toEqual([
    "약수 구하기",
    "배수 구하기",
  ]);
});

test("buildTree rejects empty input and rows with missing levels", () => {
  expect(() => buildTree([])).toThrow("데이터 행이 없습니다");
  expect(() =>
    buildTree([
      ["a", "b", "c", "d", "e"],
      ["a", "b", "", "d", "e"],
    ]),
  ).toThrow("3행");
  expect(() => buildTree([["a", "b"]])).toThrow("2행");
});
