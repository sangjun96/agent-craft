import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DemoPage } from "./demo-page.tsx";

document.documentElement.classList.toggle(
  "dark",
  window.matchMedia("(prefers-color-scheme: dark)").matches,
);

createRoot(document.querySelector("#app")!).render(
  <StrictMode>
    <TooltipProvider>
      <DemoPage />
    </TooltipProvider>
  </StrictMode>,
);
