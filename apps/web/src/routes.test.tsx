import { matchRoutes } from "react-router";
import { expect, test } from "vite-plus/test";
import { AgentDetailPage } from "./pages/agent-detail-page.tsx";
import { DesignSystemPage } from "./pages/design-system-page.tsx";
import { HomePage } from "./pages/home-page.tsx";
import { NotFoundPage } from "./pages/not-found-page.tsx";
import { ResourcesPage } from "./pages/resources-page.tsx";
import { routes } from "./routes.tsx";

function pageAt(pathname: string) {
  return matchRoutes(routes, pathname)?.at(-1)?.route.element;
}

test.each([
  ["/", HomePage],
  ["/agent/bbox-agent", AgentDetailPage],
  ["/resources", ResourcesPage],
  ["/design-system", DesignSystemPage],
  ["/no-such-page", NotFoundPage],
])("%s renders its page inside the layout", (pathname, page) => {
  expect(pageAt(pathname)).toMatchObject({ type: page });
});
