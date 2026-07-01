import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  Boxes,
  ChevronsUpDown,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Plus,
  Radio,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CurrentOrgProvider, useCurrentOrg } from "@/lib/current-org";
import { useLogout, useMe } from "@/lib/auth";

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
}

const socketNav: NavEntry[] = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/connections", label: "Connections", icon: Radio },
  { to: "/metrics", label: "Metrics", icon: Activity },
  { to: "/events", label: "Events", icon: ScrollText },
];

const bottomNav: NavEntry[] = [
  { to: "/environments", label: "Environments", icon: Boxes },
  { to: "/keys", label: "API Keys", icon: KeyRound },
  { to: "/usage", label: "Usage", icon: Gauge },
  { to: "/settings", label: "Settings", icon: Settings },
];

function NavItem({ to, label, icon: Icon }: NavEntry) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          isActive && "bg-accent text-foreground"
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground/40">
      <span className="h-4 w-4 rounded bg-muted" />
      {label}
      <Badge variant="outline" className="ml-auto text-[10px]">
        soon
      </Badge>
    </div>
  );
}

function OrgSwitcher() {
  const { orgs, current, select } = useCurrentOrg();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
        <span className="h-4 w-4 rounded bg-primary/80" />
        <span className="max-w-[12rem] truncate font-medium">
          {current?.displayName ?? "No organization"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        {orgs.map((o) => (
          <DropdownMenuItem key={o.id} onSelect={() => select(o.id)}>
            <span className="truncate">{o.displayName}</span>
            {o.role === "owner" ? (
              <Badge variant="outline" className="ml-auto text-[10px]">
                owner
              </Badge>
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-muted-foreground">
          <Plus className="h-4 w-4" /> New organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { data: user } = useMe();
  const logout = useLogout();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
        {user?.email?.slice(0, 1) ?? "?"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="normal-case tracking-normal">
          {user?.email ?? "Account"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate()}>
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Shell() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border p-3">
        <div className="mb-6 flex items-center gap-2 px-1.5 pt-1">
          <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_16px_var(--color-primary)]" />
          <span className="font-mono text-lg font-semibold tracking-tight">
            ket<span className="text-primary">soc</span>
          </span>
        </div>

        <div className="px-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Socket
        </div>
        <nav className="mt-1.5 flex flex-col gap-0.5">
          {socketNav.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </nav>

        <div className="mt-4 flex flex-col gap-0.5">
          <ComingSoon label="Live Objects" />
          <ComingSoon label="Streaming" />
        </div>

        <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
          {bottomNav.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border px-6">
          <OrgSwitcher />
          <div className="ml-auto flex items-center gap-3">
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <CurrentOrgProvider>
      <Shell />
    </CurrentOrgProvider>
  );
}
