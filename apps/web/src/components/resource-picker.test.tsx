import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, test, vi } from "vite-plus/test";
import type { ResourcesState } from "@/resources/use-resources";
import { ResourcePicker } from "./resource-picker.tsx";

const state: ResourcesState = { resources: [], loading: false, reload: () => {} };

vi.mock("@/resources/use-resources", () => ({ useResources: () => state }));

function render() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ResourcePicker onSelect={() => {}} />
    </MemoryRouter>,
  );
}

describe("ResourcePicker", () => {
  test("shows a thumbnail button per stored resource", () => {
    state.resources = [
      {
        id: "abc",
        name: "빨간-머그컵.jpg",
        originalName: "IMG_0001.jpg",
        contentType: "image/jpeg",
        size: 10,
        createdAt: 0,
      },
    ];
    const html = render();
    expect(html).toContain('aria-label="빨간-머그컵.jpg 선택"');
    expect(html).toContain('src="/api/resources/abc/file"');
  });

  test("links to the resources page when nothing is stored", () => {
    state.resources = [];
    expect(render()).toContain('href="/resources"');
  });
});
