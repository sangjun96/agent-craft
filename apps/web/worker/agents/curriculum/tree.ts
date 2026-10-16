import { LEVELS } from "./constants.ts";

export type CurriculumNode = { name: string; children: CurriculumNode[] };

/** Nests CSV data rows (header excluded) into a LEVELS-deep tree; identical prefixes share a node. */
export function buildTree(rows: string[][]): CurriculumNode {
  if (rows.length === 0) throw new Error("커리큘럼 CSV에 데이터 행이 없습니다");
  const root: CurriculumNode = { name: "", children: [] };

  rows.forEach((row, index) => {
    const cells = row.slice(0, LEVELS.length);
    if (cells.length < LEVELS.length || cells.some((cell) => cell === "")) {
      // +2: one for the header row, one because people count rows from 1.
      throw new Error(`커리큘럼 CSV ${index + 2}행에 비어 있는 ${LEVELS.length}단계 값이 있습니다`);
    }
    let node = root;
    for (const name of cells) {
      let child = node.children.find((candidate) => candidate.name === name);
      if (!child) {
        child = { name, children: [] };
        node.children.push(child);
      }
      node = child;
    }
  });
  return root;
}
