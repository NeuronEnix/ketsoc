import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import {
  Activity,
  Boxes,
  Gauge,
  KeyRound,
  LayoutDashboard,
  Radio,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface PaletteItem {
  to: string;
  label: string;
  icon: LucideIcon;
  keywords?: string;
}

const ITEMS: PaletteItem[] = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard, keywords: "home dashboard" },
  { to: "/connections", label: "Connections", icon: Radio, keywords: "clients sockets" },
  { to: "/metrics", label: "Metrics", icon: Activity, keywords: "charts latency throughput" },
  { to: "/events", label: "Events", icon: ScrollText, keywords: "tail stream log" },
  { to: "/environments", label: "Environments", icon: Boxes, keywords: "prod test env" },
  { to: "/keys", label: "API Keys", icon: KeyRound, keywords: "kpk ksk secret token" },
  { to: "/usage", label: "Usage", icon: Gauge, keywords: "billing quota plan" },
  { to: "/settings", label: "Settings", icon: Settings, keywords: "org account sign out" },
];

/** Global ⌘K / Ctrl-K command palette for jumping between screens. */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function go(to: string) {
    onOpenChange(false);
    navigate(to);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command menu"
      className="overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl shadow-black/40"
    >
      <Command.Input
        placeholder="Jump to…"
        className="w-full border-b border-border bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground"
      />
      <Command.List className="max-h-80 overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
          No results.
        </Command.Empty>
        <Command.Group
          heading="Navigate"
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          {ITEMS.map((it) => (
            <Command.Item
              key={it.to}
              value={`${it.label} ${it.keywords ?? ""}`}
              onSelect={() => go(it.to)}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground data-[selected=true]:bg-accent data-[selected=true]:text-foreground"
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
