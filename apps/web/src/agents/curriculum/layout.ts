export type LayoutNode = { id: string; children: LayoutNode[] };

/** Left-to-right tidy tree: depth sets x, leaves take consecutive rows and parents center on their children. */
export function layoutTree(
  root: LayoutNode,
  size: { columnWidth: number; rowHeight: number },
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  let nextRow = 0;

  const place = (node: LayoutNode, depth: number): number => {
    const childYs = node.children.map((child) => place(child, depth + 1));
    const y =
      childYs.length > 0
        ? (childYs[0]! + childYs[childYs.length - 1]!) / 2
        : nextRow++ * size.rowHeight;
    positions.set(node.id, { x: depth * size.columnWidth, y });
    return y;
  };

  place(root, 0);
  return positions;
}
