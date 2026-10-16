import type { RouteObject } from "react-router";
import { AppLayout } from "./app-layout.tsx";
import { AgentDetailPage } from "./pages/agent-detail-page.tsx";
import { DesignSystemPage } from "./pages/design-system-page.tsx";
import { HomePage } from "./pages/home-page.tsx";
import { NotFoundPage } from "./pages/not-found-page.tsx";

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      // Not "agents/": the Worker serves /agents/* for Agents SDK connections.
      { path: "agent/:slug", element: <AgentDetailPage /> },
      { path: "design-system", element: <DesignSystemPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
