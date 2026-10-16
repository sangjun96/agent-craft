import { matchRoutes } from "react-router";
import { expect, test } from "vite-plus/test";
import { DesignSystemPage } from "./pages/design-system-page.tsx";
import { HomePage } from "./pages/home-page.tsx";
import { NotFoundPage } from "./pages/not-found-page.tsx";
import { routes } from "./routes.tsx";

function pageAt(pathname: string) {
  return matchRoutes(routes, pathname)?.at(-1)?.route.element;
}

test.each([
  ["/", HomePage],
  ["/design-system", DesignSystemPage],
  ["/no-such-page", NotFoundPage],
])("%s renders its page inside the layout", (pathname, page) => {
  expect(pageAt(pathname)).toMatchObject({ type: page });
});
