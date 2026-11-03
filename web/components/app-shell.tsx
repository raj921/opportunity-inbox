"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { BarChart3, Bell, Inbox, Monitor, Moon, Sun, CalendarClock, Radio, ArrowUpRight, Layers3 } from "lucide-react";
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
    { href: "/", label: "Opportunities", icon: Inbox, count: waiting },
    { href: "/follow-ups", label: "Follow-ups", icon: CalendarClock, count: due },
    { href: "/results", label: "Insights", icon: BarChart3, count: 0 },
    { href: "/sources", label: "Sources", icon: Radio, count: 0 },
  ];
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[224px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-card focus:p-3">Skip to content</a>
      <aside className="workspace-sidebar sticky top-0 hidden h-dvh flex-col px-4 py-7 md:flex">
        <Wordmark />
        <div className="mt-9 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
          <p className="flex items-center gap-2 text-sm font-medium"><span className="grid size-7 place-items-center rounded-lg bg-[#e9c66b] text-xs font-semibold text-[#182623]">G</span> Growth workspace</p>
          <p className="mt-2 pl-9 text-[10px] uppercase tracking-[0.15em] text-white/45">Opportunity intelligence</p>
        </div>
        <p className="mt-8 mb-3 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">Workspace</p>
        <nav className="grid gap-1.5" aria-label="Main">{nav.map(({href,label,icon:Icon,count}) => <Link key={href} href={href} aria-current={path===href ? "page" : undefined} className={cn("sidebar-link", path===href && "sidebar-link-active")}><Icon className="size-[18px]" strokeWidth={1.5} />{label}{count>0 && <span className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px] tabular">{count}</span>}</Link>)}</nav>
        <div className="mt-auto grid gap-5 pt-8">
          <div className="rounded-xl border border-white/10 p-4"><ArrowUpRight className="mb-3 size-5 text-[#e9c66b]" /><p className="text-sm font-medium">Find the signal.</p><p className="mt-1.5 text-xs leading-5 text-white/50">Be useful, be personal, and turn buying intent into your next conversation.</p></div>
          <div className="border-t border-white/10 pt-4"><ScanStatus /></div>
          <div className="flex items-center justify-between"><ThemeMenu compact /><AlertsButton /></div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="workspace-topbar"><div className="md:hidden"><Wordmark /></div><span className="hidden text-xs text-muted-foreground md:block">Opportunity Inbox <span className="mx-3 text-border">/</span> {nav.find(n=>n.href===path)?.label ?? "Workspace"}</span><div className="ml-auto flex items-center gap-3"><span suppressHydrationWarning className="hidden text-xs text-muted-foreground sm:block">{new Date(now).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}</span><span className="grid size-7 place-items-center rounded-full border bg-secondary text-[10px] font-semibold">OI</span></div></header>
        <nav className="flex gap-1 overflow-x-auto border-b bg-background px-3 py-2 md:hidden" aria-label="Mobile navigation">{nav.map(({href,label,icon:Icon})=><Link key={href} href={href} aria-current={path===href ? "page" : undefined} className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-muted-foreground",path===href && "bg-secondary text-foreground")}><Icon className="size-3.5" />{label}</Link>)}<ThemeMenu compact /><AlertsButton /></nav>
        <main id="main-content" className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

function Wordmark() {
  return <Link href="/" className="flex items-center gap-2.5 font-heading text-[16px] font-semibold tracking-tight whitespace-nowrap"><span className="grid size-8 place-items-center rounded-xl bg-[#e9c66b] text-[#182623]"><Layers3 className="size-[18px]" strokeWidth={1.7} /></span><span>opportunity<span className="font-normal opacity-60"> / inbox</span></span></Link>;
}

function ScanStatus() {
  const { live, checkedAt } = useLeads();
  return (
    <div className="grid gap-1 text-xs text-white/50">
      <span className="flex items-center gap-2">
        <span className={cn("size-1.5 rounded-full", live === "on" ? "bg-good" : live === "off" ? "bg-late" : "bg-muted-foreground")} />
        {live === "on" ? `Inbox synced · ${fmtTime(checkedAt)}` : live === "off" ? "Can't reach the server" : "Connecting"}
      </span>
      <span><Link href="/sources" className="mt-1 underline underline-offset-4 hover:text-white">View scan health</Link></span>
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
