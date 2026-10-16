import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, test, vi } from "vite-plus/test";
import type { ResourcesState } from "@/resources/use-resources";
import { ResourcePicker } from "./resource-picker.tsx";

const state: ResourcesState = { resources: [], loading: false, reload: () => {} };

vi.mock("@/resources/use-resources", () => ({ useResources: () => state }));

const image = {
  id: "abc",
  name: "빨간-머그컵.jpg",
  originalName: "IMG_0001.jpg",
  contentType: "image/jpeg",
  size: 10,
  shapeHash: null,
  createdAt: 0,
};
const csv = (id: string, shapeHash: string) => ({
  ...image,
  id,
  name: `${id}.csv`,
  contentType: "text/csv",
  shapeHash,
});

function render(props: Partial<ComponentProps<typeof ResourcePicker>> = {}) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ResourcePicker onSelect={() => {}} {...props} />
    </MemoryRouter>,
  );
}

describe("ResourcePicker", () => {
  test("shows a thumbnail button per stored resource", () => {
    state.resources = [image];
    const html = render();
    expect(html).toContain('aria-label="빨간-머그컵.jpg 선택"');
    expect(html).toContain('src="/api/resources/abc/file"');
  });

  test("shows the name, size and upload date next to each thumbnail", () => {
    state.resources = [{ ...image, size: 2048, createdAt: Date.UTC(2026, 9, 16, 3) }];
    const html = render();
    expect(html).toContain(">빨간-머그컵.jpg</span>");
    expect(html).toContain("2.0 KB");
    expect(html).toContain("26. 10. 16.");
  });

  test("links to the resources page when nothing is stored", () => {
    state.resources = [];
    expect(render()).toContain('href="/resources"');
  });

  test("offers only images by default", () => {
    state.resources = [image, csv("data", "h1")];
    const html = render();
    expect(html).toContain('aria-label="빨간-머그컵.jpg 선택"');
    expect(html).not.toContain("data.csv");
  });

  test("offers only CSVs of the expected shape when asked for a CSV kind", () => {
    state.resources = [image, csv("a", "h1"), csv("b", "h2")];
    const html = render({ kind: "csv", shapeHash: "h2" });
    expect(html).toContain('aria-label="b.csv 선택"');
    expect(html).not.toContain("a.csv");
    expect(html).not.toContain("빨간-머그컵");
    expect(render({ kind: "csv", shapeHash: "other" })).toContain("맞는 CSV 리소스가 없습니다");
  });
});
