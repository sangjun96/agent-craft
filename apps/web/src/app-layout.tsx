import { useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Typography } from "@/components/typography";
import { cn } from "@/lib/utils";
import { useApiStatus } from "./api-status.ts";

const NAV_ITEMS = [
  { to: "/", label: "홈" },
  { to: "/design-system", label: "디자인 시스템" },
];

export function AppLayout() {
  return (
    <div className="min-h-svh">
      <Header />
      <Outlet />
    </div>
  );
}

function Header() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark", !dark);
    setDark(!dark);
  };

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Typography variant="large" render={<span />}>
            agent-craft
          </Typography>
          <nav className="flex items-center gap-4 text-sm">
            {NAV_ITEMS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  cn(
                    "transition-colors hover:text-foreground",
                    isActive ? "font-medium text-foreground" : "text-muted-foreground",
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ApiStatusBadge />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="테마 전환" />
              }
            >
              {dark ? <SunIcon /> : <MoonIcon />}
            </TooltipTrigger>
            <TooltipContent>{dark ? "라이트 모드" : "다크 모드"}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}

function ApiStatusBadge() {
  const status = useApiStatus();
  if (status.state === "connecting") return <Badge variant="outline">API 연결 중…</Badge>;
  if (status.state === "failed") return <Badge variant="destructive">API 실패</Badge>;
  return <Badge variant="secondary">API: {status.message}</Badge>;
}
