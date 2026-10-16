import type { CSSProperties } from "react";
import type { BboxResult } from "../../../worker/agents/types.ts";

/** Positions an overlay over the image; box edges are fractions of the image size. */
export function boxToStyle(box: NonNullable<BboxResult["box"]>): CSSProperties {
  return {
    top: `${box.top * 100}%`,
    left: `${box.left * 100}%`,
    width: `${(box.right - box.left) * 100}%`,
    height: `${(box.bottom - box.top) * 100}%`,
  };
}
