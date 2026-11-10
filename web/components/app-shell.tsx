"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { BarChart3, Bell, CalendarClock, FlaskConical, Inbox, Monitor, Moon, Radio, Sun } from "lucide-react";
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
    { href: "/evals", label: "Evals", icon: FlaskConical, count: 0 },
  ];
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[236px_minmax(0,1fr)]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3">Skip to content</a>

      <aside className="sticky top-0 hidden h-dvh flex-col bg-sidebar px-4 pt-6 pb-4 text-sidebar-foreground md:flex">
        <div className="grid gap-2.5 px-2"><Wordmark /><p className="eyebrow">Opportunity Inbox</p></div>
        <nav className="mt-8 grid gap-0.5" aria-label="Main">
          {nav.map(({ href, label, icon: Icon, count }) => (
            <Link key={href} href={href} aria-current={path === href ? "page" : undefined}
              className={cn("flex h-10 items-center gap-2.5 rounded-full px-3.5 text-sm text-text-2 transition-[background-color,color] duration-300 ease-[var(--ease-snap)] hover:bg-sidebar-accent/60 hover:text-foreground",
                path === href && "bg-sidebar-accent font-medium text-foreground")}>
              <Icon className="size-4" strokeWidth={1.5} />
              {label}
              {count > 0 && <span className="ml-auto text-xs font-medium tabular">{count}</span>}
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-3 px-2">
          <ScanStatus />
          <div className="-mx-1 flex items-center justify-between border-t border-sidebar-border pt-3">
            <ThemeMenu />
            <AlertsButton />
          </div>
        </div>
      </aside>

      <div className="min-w-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/90 px-4 backdrop-blur md:hidden">
          <Wordmark />
          <div className="flex items-center"><AlertsButton /><ThemeMenu compact /></div>
        </header>
        <main id="main-content" className="min-w-0">{children}</main>
      </div>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/92 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {nav.map(({ href, label, icon: Icon, count }) => (
          <Link key={href} href={href} aria-current={path === href ? "page" : undefined}
            className={cn("relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground transition-colors duration-150", path === href && "font-medium text-foreground")}>
            <Icon className="size-[18px]" strokeWidth={path === href ? 1.8 : 1.5} />
            {label}
            {count > 0 && <span className="absolute top-1.5 left-1/2 ml-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 font-mono text-[10px] font-medium text-ink tabular">{count}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}

// The official logo. It has no dark version, so dark mode puts it in a white holder.
function Wordmark() {
  return (
    <Link href="/" className="w-fit rounded-xl dark:bg-white dark:px-1.5 dark:py-0.5" aria-label="Futurelab Studios, Opportunity Inbox home">
      <Image src="/brand/logos/futurelab-logo-primary-1200.png" alt="Futurelab Studios" width={1200} height={300} priority className="-my-1 -ml-2 h-[52px] w-auto dark:my-0 dark:ml-0 dark:h-9" />
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
          {unseen > 0 && <span className="absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 font-mono text-[10px] font-medium text-ink tabular">{unseen}</span>}
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
