"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { BarChart3, Bell, CalendarClock, Inbox, Monitor, Moon, Radio, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useLeads } from "./leads-provider";
import { isFollowUpDue, localDate } from "@/lib/lead-utils";

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { groups, now } = useLeads();
  const waiting = groups.filter(g => g.lead.status === "new").length;
  const due = groups.filter(g => isFollowUpDue(g.lead, localDate(now))).length;
  const nav = [
    { href: "/", label: "Inbox", icon: Inbox, count: waiting },
    { href: "/follow-ups", label: "Follow-ups", icon: CalendarClock, count: due },
    { href: "/results", label: "Insights", icon: BarChart3, count: 0 },
    { href: "/sources", label: "Sources", icon: Radio, count: 0 },
  ];
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3">Skip to content</a>

      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar px-3 pt-5 pb-4 text-sidebar-foreground md:flex">
        <div className="px-2.5"><Wordmark /></div>
        <nav className="mt-8 grid gap-0.5" aria-label="Main">
          {nav.map(({ href, label, icon: Icon, count }) => (
            <Link key={href} href={href} aria-current={path === href ? "page" : undefined}
              className={cn("flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-text-2 transition-[background-color,color] duration-150 ease-[var(--ease-snap)] hover:bg-sidebar-accent/70 hover:text-foreground",
                path === href && "bg-sidebar-accent font-medium text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.07)]")}>
              <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} />
              {label}
              {count > 0 && <span className="ml-auto font-mono text-xs text-muted-foreground tabular">{count}</span>}
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-3 px-2.5">
          <ScanStatus />
          <div className="-mx-2 flex items-center justify-between border-t border-sidebar-border pt-3">
            <ThemeMenu />
            <AlertsButton />
          </div>
        </div>
      </aside>

      <div className="min-w-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <Wordmark />
          <div className="flex items-center"><AlertsButton /><ThemeMenu compact /></div>
        </header>
        <main id="main-content" className="min-w-0">{children}</main>
      </div>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {nav.map(({ href, label, icon: Icon, count }) => (
          <Link key={href} href={href} aria-current={path === href ? "page" : undefined}
            className={cn("relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground transition-colors duration-150", path === href && "text-foreground")}>
            <Icon className="size-[18px]" strokeWidth={path === href ? 1.8 : 1.5} />
            {label}
            {count > 0 && <span className="absolute top-1.5 left-1/2 ml-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-clay px-1 font-mono text-[10px] font-medium text-white tabular">{count}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}

// The mark is the product's signature: a ruler that ends at the 2-hour deadline.
function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 whitespace-nowrap" aria-label="Opportunity Inbox, home">
      <svg viewBox="0 0 20 20" className="size-5" fill="none" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
        <path d="M3 17V10M6.5 17v-4M10 17v-7M13.5 17v-4" stroke="currentColor" />
        <path d="M17 17V4" stroke="var(--clay)" />
      </svg>
      <span className="font-heading text-xl leading-none font-medium tracking-[-0.01em]">Opportunity Inbox</span>
    </Link>
  );
}

function ScanStatus() {
  const { live, checkedAt } = useLeads();
  return (
    <div className="grid gap-1 text-xs leading-5 text-muted-foreground">
      <span className="flex items-center gap-2">
        <span className={cn("size-1.5 rounded-full", live === "on" ? "bg-good" : live === "off" ? "bg-late" : "bg-muted-foreground")} />
        {live === "on" ? `Up to date, ${fmtTime(checkedAt)}` : live === "off" ? "Can't reach the server" : "Connecting"}
      </span>
      <span>Scans run daily at 06:00 IST. <Link href="/sources" className="underline decoration-line underline-offset-4 transition-colors hover:text-foreground">Scan health</Link></span>
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
        <Button variant="ghost" size={compact ? "icon" : "sm"} className="text-muted-foreground" aria-label="Theme">
          <Icon className="size-4" strokeWidth={1.5} />
          {!compact && (mounted ? { dark: "Dark", light: "Light" }[theme ?? ""] ?? "System" : "Theme")}
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
        <Button variant="ghost" size="icon" className="relative text-muted-foreground" aria-label={unseen ? `Alerts, ${unseen} new` : "Alerts"}>
          <Bell className="size-4" strokeWidth={1.5} />
          {unseen > 0 && <span className="absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-clay px-1 font-mono text-[10px] font-medium text-white tabular">{unseen}</span>}
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
