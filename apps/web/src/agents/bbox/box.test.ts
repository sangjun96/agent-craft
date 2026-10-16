import { expect, test } from "vite-plus/test";
import { boxToStyle } from "./box.ts";

test("boxToStyle converts edge fractions to percentage offsets and size", () => {
  expect(boxToStyle({ top: 0.1, bottom: 0.5, left: 0.25, right: 0.75 })).toEqual({
    top: "10%",
    left: "25%",
    width: "50%",
    height: "40%",
  });
});
