import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";
import { Prose, Typography } from "./typography.tsx";

describe("Typography", () => {
  test("renders a <p> by default", () => {
    const html = renderToStaticMarkup(<Typography>본문</Typography>);
    expect(html).toBe('<p data-slot="typography" data-variant="p" class="leading-7">본문</p>');
  });

  test("maps each variant to its semantic tag", () => {
    expect(renderToStaticMarkup(<Typography variant="h2">t</Typography>)).toMatch(/^<h2 /);
    expect(renderToStaticMarkup(<Typography variant="lead">t</Typography>)).toMatch(/^<p /);
    expect(renderToStaticMarkup(<Typography variant="code">t</Typography>)).toMatch(/^<code /);
  });

  test("render prop overrides the tag but keeps variant styles", () => {
    const html = renderToStaticMarkup(
      <Typography variant="h2" render={<h1 />}>
        t
      </Typography>,
    );
    expect(html).toMatch(/^<h1 [^>]*data-variant="h2"[^>]*class="[^"]*text-3xl/);
  });

  test("merges className with variant classes", () => {
    const html = renderToStaticMarkup(
      <Typography variant="muted" className="text-xs">
        t
      </Typography>,
    );
    expect(html).toContain('class="text-muted-foreground text-xs"');
  });
});

describe("Prose", () => {
  test("applies typography plugin classes bound to tokens", () => {
    const html = renderToStaticMarkup(
      <Prose size="sm">
        <p>t</p>
      </Prose>,
    );
    expect(html).toBe(
      '<div data-slot="prose" class="prose prose-token max-w-none prose-sm"><p>t</p></div>',
    );
  });
});
