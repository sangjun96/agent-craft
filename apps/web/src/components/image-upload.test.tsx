import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";
import { ImageUpload } from "./image-upload.tsx";

describe("ImageUpload", () => {
  test("shows a dropzone with an image file input when empty", () => {
    const html = renderToStaticMarkup(<ImageUpload id="image" value={null} onChange={() => {}} />);
    expect(html).toMatch(/^<label for="image" data-slot="image-upload"/);
    expect(html).toContain('<input id="image" type="file" accept="image/*"');
    expect(html).toContain("이미지를 끌어다 놓으세요");
  });

  test("shows the file name, size and a remove button once a file is chosen", () => {
    const file = new File([new Uint8Array(2048)], "cup.png", { type: "image/png" });
    const html = renderToStaticMarkup(<ImageUpload value={file} onChange={() => {}} />);
    expect(html).toContain("cup.png");
    expect(html).toContain("2.0 KB");
    expect(html).toContain('aria-label="이미지 제거"');
    expect(html).not.toContain('type="file"');
  });
});
