"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDownToLine, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AddLeadDialog } from "@/components/add-lead-dialog";
import { AgentPanel } from "@/components/agent-panel";
import { LeadDetail, LeadRow, STATUS_LABEL } from "@/components/lead-card";
import { useLeads } from "@/components/leads-provider";
import { StatStrip } from "@/components/stat-strip";
import { cn } from "@/lib/utils";
import { ACTIVE_PLATFORMS, KINDS, leadTime, leadsCsv, localDate, PRIORITIES } from "@/lib/lead-utils";

type Tab = "new" | "replied" | "talking" | "all";
const TABS: Tab[] = ["new", "replied", "talking", "all"];
const RANK = { hot: 0, warm: 1, cold: 2 };

// Keep the detail pane beside the list from 1024px, with room for both panes and the agent rail.
const subscribe = (cb: () => void) => { const m = window.matchMedia("(min-width: 1024px)"); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const useDesktop = () => useSyncExternalStore(subscribe, () => window.matchMedia("(min-width: 1024px)").matches, () => false);

export function InboxView() {
  const { leads, groups, now, focus } = useLeads();
  const [tab, setTab] = useState<Tab>("new");
  const [kind, setKind] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [priority, setPriority] = useState("all");
  const [sort, setSort] = useState("urgent");
  const [q, setQ] = useState("");
  const [queue, setQueue] = useState("all");
  const [grouped, setGrouped] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [intro, setIntro] = useState(true);
  const desktop = useDesktop();
  const searchRef = useRef<HTMLInputElement>(null);
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  const today = localDate(now);
  const items = useMemo(() => grouped ? groups : leads.map(lead => ({ lead, reposts: [] })), [grouped, groups, leads]);
  const clearFilters = () => { setQ(""); setKind("all"); setPlatform("all"); setPriority("all"); setQueue("all"); };

  // The entrance plays once, when the first leads arrive.
  useEffect(() => { if (leads) { const t = setTimeout(() => setIntro(false), 900); return () => clearTimeout(t); } }, [leads !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // A lead opened from an alert switches to the tab it is in and selects it.
  useEffect(() => {
    const g = focus && items.find(g => g.lead.id === focus || g.reposts.some(r => r.id === focus));
    if (g) { setTab(g.lead.status === "new" || g.lead.status === "replied" || g.lead.status === "talking" ? g.lead.status : "all"); clearFilters(); setSelectedId(g.lead.id); }
  }, [focus, items]);

  const ready = items.filter(g => g.lead.status === "new");
  const hot = ready.filter(g => g.lead.priority === "hot").length;
  const comments = items.filter(g => g.lead.repliedAt).length;
  const counts: Record<string, number> = { all: items.length };
  for (const { lead } of items) counts[lead.status] = (counts[lead.status] ?? 0) + 1;
  const activeFilters = [platform !== "all", kind !== "all", priority !== "all", sort !== "urgent", !grouped].filter(Boolean).length;
  const filtered = !!q || kind !== "all" || platform !== "all" || priority !== "all" || queue !== "all";
  const shown = items.filter(({ lead: l, reposts }) =>
    (tab === "all" || l.status === tab) && (kind === "all" || l.kind === kind)
    && (platform === "all" || [l, ...reposts].some(r => r.platform === platform)) && (priority === "all" || l.priority === priority)
    && (queue !== "hot" || (l.priority === "hot" && l.status === "new"))
    && (queue !== "commented" || !!l.repliedAt)
    && (!q.trim() || [l, ...reposts].some(r => [r.author, r.why, r.excerpt, r.reply, r.notes].join(" ").toLowerCase().includes(q.trim().toLowerCase())))
  ).sort((a, b) => (sort === "urgent" ? RANK[a.lead.priority] - RANK[b.lead.priority] : 0) || (sort === "oldest" ? leadTime(a.lead) - leadTime(b.lead) : leadTime(b.lead) - leadTime(a.lead)));

  const selectedDemo = selectedId ? leads.find(lead => lead.id === selectedId && lead.query === "autonomous-demo") : undefined;
  const explicit = selectedDemo ? { lead: selectedDemo, reposts: [] } : selectedId ? shown.find(g => g.lead.id === selectedId || g.reposts.some(r => r.id === selectedId)) : undefined;
  const active = explicit ?? (desktop ? shown[0] : undefined);

  // j / k move through the list; / focuses search.
  keys.current = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('[role="dialog"]')) return;
    const t = e.target as HTMLElement;
    if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) return;
    if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); return; }
    if ((e.key === "j" || e.key === "k") && shown.length) {
      const i = Math.max(0, shown.findIndex(g => g === active));
      const next = shown[Math.min(shown.length - 1, Math.max(0, i + (e.key === "j" ? 1 : -1)))];
      setSelectedId(next.lead.id);
      document.getElementById(`row-${next.lead.id}`)?.scrollIntoView({ block: "nearest" });
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e);
    const onSearch = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); searchRef.current?.focus(); } };
    document.addEventListener("keydown", onKey); document.addEventListener("keydown", onSearch);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("keydown", onSearch); };
  }, []);

  function exportCsv() {
    const url = URL.createObjectURL(new Blob(["﻿", leadsCsv(shown.map(g => g.lead))], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url; link.download = `opportunities-${today}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const chooseQueue = (value: string) => { clearFilters(); setTab("all"); setQueue(value); };

  const subline = ready.length ? `${ready.length} leads in the new queue. Demo fixtures are processed automatically.` : "Start the autonomous demo to discover scripted opportunities.";

  return (
    <div className="portal-page">
      <header className="portal-header">
        <div className="portal-heading">
          <h1 className="portal-title">Inbox</h1>
          <p className="portal-description" aria-live="polite">{subline}</p>
          <p className="portal-notice">Demo mode · no live accounts or comments actually published</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!shown.length}><ArrowDownToLine strokeWidth={1.5} /> Export</Button>
          <AddLeadDialog />
        </div>
      </header>
      <StatStrip compact items={[
        { label: "Queued leads", value: ready.length, accent: ready.length ? "gold" : undefined, onClick: () => { clearFilters(); setTab("new"); }, active: tab === "new" && queue === "all" },
        { label: "Comment outcomes", value: comments, accent: comments ? "lilac" : undefined, onClick: () => chooseQueue("commented"), active: queue === "commented" },
        { label: "Hot leads", value: hot, accent: hot ? "rose" : undefined, onClick: () => chooseQueue("hot"), active: queue === "hot" },
      ]} />

      <div className="portal-grid">
        <section aria-label="Opportunity workspace" className="min-w-0 overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto overflow-y-hidden border-b p-3 [scrollbar-width:none]">
            <div className="flex min-w-max gap-1" role="tablist" aria-label="Pipeline">
              {TABS.map(t => <TabButton key={t} selected={tab === t && queue === "all"} onClick={() => { setTab(t); setQueue("all"); }} label={t === "all" ? "All" : t === "new" ? "New" : t === "replied" ? "Comment outcomes" : STATUS_LABEL[t]} count={counts[t] ?? 0} />)}
            </div>
          </div>

          <div className="flex h-[min(34rem,60dvh)] min-h-80 lg:grid lg:h-[min(42rem,70dvh)] lg:grid-cols-[minmax(240px,0.8fr)_minmax(360px,1.2fr)]">
            <section aria-label="Leads" className="flex min-h-0 min-w-0 w-full flex-col overflow-hidden">
              <div className="flex items-center gap-2 p-3">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Search leads</span>
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                  <Input ref={searchRef} type="search" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} className="pr-9 pl-9" />
                  <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border px-1.5 text-[11px] text-muted-foreground lg:block">/</kbd>
                </label>
                <FiltersMenu {...{ platform, setPlatform, kind, setKind, priority, setPriority, sort, setSort, grouped, setGrouped, activeFilters }} />
              </div>
              {filtered && (
                <div className="flex items-center justify-between gap-2 px-4 pb-1 text-xs text-muted-foreground">
                  <span>{queue === "hot" ? "Hot leads ready to comment" : queue === "commented" ? "Leads with comments" : `${shown.length} match${shown.length === 1 ? "" : "es"}`}</span>
                  <Button variant="ghost" size="sm" onClick={clearFilters}><X strokeWidth={1.5} /> Clear</Button>
                </div>
              )}
              <ul className="quiet-scroll grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto px-2 pt-1 pb-4" aria-label="Leads">
                {shown.length ? shown.map((g, i) => <LeadRow key={g.lead.id} lead={g.lead} reposts={g.reposts} index={i} intro={intro} selected={active?.lead.id === g.lead.id} onSelect={() => setSelectedId(g.lead.id)} />)
                  : <li className="grid justify-items-center gap-3 px-6 py-14 text-center">
                      <p className="font-heading text-xl font-bold tracking-[-0.03em]">{filtered ? "No leads match" : "No leads in this stage"}</p>
                      <p className="max-w-64 text-[13px] leading-5 text-muted-foreground">{filtered ? "Try another filter, or clear them to see everything." : "Add a post to start a new opportunity."}</p>
                      {filtered && <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>}
                    </li>}
              </ul>
              <p className="hidden items-center gap-4 border-t px-4 py-2.5 text-[11px] text-muted-foreground lg:flex">{[["j k", "move"], ["/", "search"]].map(([k, t]) => <span key={k}><b className="font-medium text-foreground">{k}</b> {t}</span>)}</p>
            </section>

            <div className={cn("min-h-0 min-w-0 overflow-hidden bg-card lg:border-l lg:[&_article]:px-5 lg:[&_article]:py-5 lg:[&_footer]:px-5", explicit ? "fixed inset-0 z-40 lg:static lg:z-auto" : "hidden lg:block")}>
              {active
                ? <LeadDetail key={active.lead.id} lead={active.lead} reposts={active.reposts} onBack={() => setSelectedId(null)} />
                : <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground">Select a lead to inspect a demo outcome or edit a regular lead&apos;s comment.</div>}
            </div>
          </div>
        </section>
        <AgentPanel onInspect={id => { clearFilters(); setTab("all"); setSelectedId(id); }} />
      </div>
    </div>
  );
}

function TabButton({ selected, onClick, label, count }: { selected: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button type="button" role="tab" aria-selected={selected} onClick={onClick}
      className={cn("flex h-9 items-center gap-2 rounded-full px-3.5 text-sm whitespace-nowrap text-text-2 transition-[background-color,color] duration-300 ease-[var(--ease-snap)] outline-ring hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2", selected && "bg-secondary font-medium text-foreground")}>
      {label}<span className="text-xs tabular">{count}</span>
    </button>
  );
}

function FiltersMenu(p: {
  platform: string; setPlatform: (v: string) => void; kind: string; setKind: (v: string) => void; priority: string; setPriority: (v: string) => void;
  sort: string; setSort: (v: string) => void; grouped: boolean; setGrouped: (v: boolean) => void; activeFilters: number;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label={p.activeFilters ? `Filters, ${p.activeFilters} active` : "Filters"}>
          <SlidersHorizontal strokeWidth={1.5} /><span className="hidden sm:inline">Filters</span>
          {p.activeFilters > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">{p.activeFilters}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-72 gap-4 p-4">
        <Field label="Platform" value={p.platform} onChange={p.setPlatform} options={[["all", "All platforms"], ...Object.entries(ACTIVE_PLATFORMS)]} />
        <Field label="Type" value={p.kind} onChange={p.setKind} options={[["all", "All types"], ...KINDS.map(k => [k, k[0].toUpperCase() + k.slice(1)] as [string, string])]} />
        <Field label="Priority" value={p.priority} onChange={p.setPriority} options={[["all", "Any priority"], ...PRIORITIES.map(x => [x, x[0].toUpperCase() + x.slice(1)] as [string, string])]} />
        <Field label="Sort" value={p.sort} onChange={p.setSort} options={[["urgent", "Highest intent"], ["newest", "Newest first"], ["oldest", "Oldest first"]]} />
        <label className="flex items-center justify-between gap-3 border-t pt-4 text-sm">Group similar posts<Switch checked={p.grouped} onCheckedChange={p.setGrouped} /></label>
      </PopoverContent>
    </Popover>
  );
}

function Field({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="grid gap-1.5">
      <span className="eyebrow">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full" aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
