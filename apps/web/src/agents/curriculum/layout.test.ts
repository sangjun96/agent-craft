import { expect, test } from "vite-plus/test";
import { layoutTree } from "./layout.ts";

test("layoutTree puts depth in columns, leaves in rows and parents between their children", () => {
  const root = {
    id: "root",
    children: [
      {
        id: "a",
        children: [
          { id: "a1", children: [] },
          { id: "a2", children: [] },
        ],
      },
      { id: "b", children: [] },
    ],
  };

  const positions = layoutTree(root, { columnWidth: 100, rowHeight: 10 });

  expect(positions.get("a1")).toEqual({ x: 200, y: 0 });
  expect(positions.get("a2")).toEqual({ x: 200, y: 10 });
  expect(positions.get("a")).toEqual({ x: 100, y: 5 });
  expect(positions.get("b")).toEqual({ x: 100, y: 20 });
  expect(positions.get("root")).toEqual({ x: 0, y: 12.5 });
});
