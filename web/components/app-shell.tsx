"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { BarChart3, Bell, Inbox, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useLeads } from "./leads-provider";

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { groups } = useLeads();
  const waiting = groups.filter((g) => g.lead.status === "new").length;
  const nav = [
    { href: "/", label: "Inbox", icon: Inbox, count: waiting },
    { href: "/results", label: "Results", icon: BarChart3, count: null },
  ];

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 md:flex">
        <div className="flex h-9 items-center justify-between pl-2">
          <Wordmark />
          <AlertsButton />
        </div>
        <nav className="mt-6 grid gap-1" aria-label="Main">
          {nav.map(({ href, label, icon: Icon, count }) => (
            <Link key={href} href={href} aria-current={path === href ? "page" : undefined}
              className={cn("flex h-9 items-center gap-2.5 rounded-lg px-2 text-sm font-medium text-text-2 transition-colors hover:bg-sidebar-accent hover:text-foreground",
                path === href && "bg-sidebar-accent text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]")}>
              <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} />
              {label}
              {count ? <span className="ml-auto font-mono text-xs text-muted-foreground tabular">{count}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-3 px-2">
          <ScanStatus />
          <ThemeMenu />
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-1 border-b bg-background/95 px-3 backdrop-blur md:hidden">
        <Wordmark />
        <nav className="ml-auto flex items-center" aria-label="Main">
          {nav.map(({ href, label }) => (
            <Link key={href} href={href} aria-current={path === href ? "page" : undefined}
              className={cn("rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground", path === href && "bg-secondary text-foreground")}>
              {label}
            </Link>
          ))}
        </nav>
        <AlertsButton />
        <ThemeMenu compact />
      </header>

      <main className="min-w-0">{children}</main>
    </div>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2 font-heading text-[15px] font-semibold tracking-tight whitespace-nowrap md:text-[17px]">
      <span className="grid size-6 place-items-center rounded-md bg-brand text-[13px] text-[#111]" aria-hidden>O</span>
      Opportunity Inbox
    </Link>
  );
}

function ScanStatus() {
  const { live, checkedAt } = useLeads();
  return (
    <div className="grid gap-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-2">
        <span className={cn("size-1.5 rounded-full", live === "on" ? "bg-good" : live === "off" ? "bg-late" : "bg-muted-foreground")} />
        {live === "on" ? `Up to date · ${fmtTime(checkedAt)}` : live === "off" ? "Can't reach the server" : "Connecting"}
      </span>
      <span>LinkedIn and X are scanned once a day</span>
    </div>
  );
}

function ThemeMenu({ compact }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const Icon = !mounted ? Monitor : theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={compact ? "icon" : "sm"} className={cn(!compact && "w-full justify-start px-2 text-muted-foreground")} aria-label="Theme">
          <Icon className="size-4" strokeWidth={1.5} />
          {!compact && (mounted ? { dark: "Dark", light: "Light" }[theme ?? ""] ?? "System theme" : "Theme")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => setTheme("light")}><Sun strokeWidth={1.5} /> Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}><Moon strokeWidth={1.5} /> Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}><Monitor strokeWidth={1.5} /> System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AlertsButton() {
  const { alerts, unseen, markSeen, sound, setSound, jumpTo } = useLeads();
  const router = useRouter();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission), []);
  return (
    <Popover onOpenChange={(open) => open && markSeen()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unseen ? `Alerts, ${unseen} new` : "Alerts"}>
          <Bell className="size-4" strokeWidth={1.5} />
          {unseen > 0 && <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-hot px-1 font-mono text-[10px] font-medium text-[#111] tabular">{unseen}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <p className="px-2 pt-1 pb-2 text-sm font-medium">Alerts</p>
        {alerts.length ? (
          <ul className="grid">
            {alerts.map((a) => (
              <li key={a.id + a.at}>
                <button type="button" onClick={() => { router.push("/"); jumpTo(a.id); }}
                  className="grid w-full gap-0.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent">
                  <span className="text-sm font-medium">{a.author}</span>
                  <span className="font-mono text-xs text-muted-foreground">{a.kind} · {fmtTime(a.at)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="px-2 pb-3 text-sm text-muted-foreground">New leads show up here while the inbox is open.</p>}
        <div className="mt-2 grid gap-3 border-t px-2 pt-3 pb-1 text-sm">
          <label className="flex items-center justify-between gap-3">
            Sound for new leads
            <Switch checked={sound} onCheckedChange={setSound} />
          </label>
          {perm === "default" ? (
            <Button variant="secondary" size="sm" onClick={async () => setPerm(await Notification.requestPermission())}>Turn on desktop notifications</Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {perm === "granted" ? "Desktop notifications are on" : perm === "denied" ? "Desktop notifications are blocked in your browser settings" : "This browser can't show desktop notifications"}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
