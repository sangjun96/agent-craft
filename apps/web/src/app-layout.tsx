import { useState } from "react";
import { KeyRoundIcon, MenuIcon, MoonIcon, SunIcon } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { useAccess } from "@/access/use-access";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Typography } from "@/components/typography";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "홈" },
  { to: "/resources", label: "리소스" },
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
  const { canEdit } = useAccess();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark", !dark);
    setDark(!dark);
  };

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-6">
          <MobileNav />
          <Typography variant="large" render={<span />}>
            agent-craft
          </Typography>
          <NavLinks className="hidden items-center gap-4 text-sm sm:flex" />
        </div>
        <div className="flex items-center gap-1">
          {!canEdit && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    render={<a href="/api/access/login" />}
                    nativeButton={false}
                    aria-label="관리자 로그인"
                  />
                }
              >
                <KeyRoundIcon />
              </TooltipTrigger>
              <TooltipContent>관리자 로그인</TooltipContent>
            </Tooltip>
          )}
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

function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="sm:hidden" aria-label="메뉴 열기" />}
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>agent-craft</SheetTitle>
        </SheetHeader>
        <NavLinks className="flex flex-col gap-4 px-4" onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

function NavLinks({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  return (
    <nav className={className}>
      {NAV_ITEMS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          onClick={onNavigate}
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
  );
}
