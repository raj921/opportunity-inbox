"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDownToLine, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AddLeadDialog } from "@/components/add-lead-dialog";
import { LeadDetail, LeadRow, STATUS_LABEL, type DetailActions } from "@/components/lead-card";
import { SLA_MS, useLeads } from "@/components/leads-provider";
import { StatStrip } from "@/components/stat-strip";
import { cn } from "@/lib/utils";
import { isFollowUpDue, KINDS, leadTime, leadsCsv, localDate, PLATFORMS, PRIORITIES, type Status } from "@/lib/lead-utils";

type Tab = Status | "all";
const TABS: Tab[] = ["new", "replied", "talking", "won", "lost", "skipped", "all"];
const RANK = { hot: 0, warm: 1, cold: 2 };

// The detail pane sits beside the list from 1024px; below that it opens full screen.
const subscribe = (cb: () => void) => { const m = window.matchMedia("(min-width: 1024px)"); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const useDesktop = () => useSyncExternalStore(subscribe, () => window.matchMedia("(min-width: 1024px)").matches, () => false);

export function InboxView({ followUps = false }: { followUps?: boolean }) {
  const { leads, groups, now, live, focus, reload } = useLeads();
  const [tab, setTab] = useState<Tab>(followUps ? "all" : "new");
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
  const actions = useRef<DetailActions | null>(null);
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  const today = localDate(now);
  const items = useMemo(() => grouped ? groups : (leads ?? []).map(lead => ({ lead, reposts: [] })), [grouped, groups, leads]);
  const clearFilters = () => { setQ(""); setKind("all"); setPlatform("all"); setPriority("all"); setQueue("all"); };

  // The entrance plays once, when the first leads arrive.
  useEffect(() => { if (leads) { const t = setTimeout(() => setIntro(false), 900); return () => clearTimeout(t); } }, [leads !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // A lead opened from an alert switches to the tab it is in and selects it.
  useEffect(() => {
    const g = focus && items.find(g => g.lead.id === focus || g.reposts.some(r => r.id === focus));
    if (g) { setTab(followUps ? "all" : g.lead.status); clearFilters(); setSelectedId(g.lead.id); }
  }, [focus, items, followUps]);

  const waiting = items.filter(g => g.lead.status === "new");
  const hot = waiting.filter(g => g.lead.priority === "hot").length;
  const due = items.filter(g => isFollowUpDue(g.lead, today)).length;
  const overdue = waiting.filter(g => g.lead.foundAt && leadTime(g.lead) + SLA_MS < now).length;
  const base = followUps ? items.filter(g => ["replied", "talking"].includes(g.lead.status) && g.lead.followUp) : items;
  const counts: Record<string, number> = { all: base.length };
  for (const { lead } of base) counts[lead.status] = (counts[lead.status] ?? 0) + 1;
  const activeFilters = [platform !== "all", kind !== "all", priority !== "all", sort !== "urgent", !grouped].filter(Boolean).length;
  const filtered = !!q || kind !== "all" || platform !== "all" || priority !== "all" || queue !== "all";
  const shown = base.filter(({ lead: l, reposts }) =>
    (tab === "all" || l.status === tab) && (kind === "all" || l.kind === kind)
    && (platform === "all" || [l, ...reposts].some(r => r.platform === platform)) && (priority === "all" || l.priority === priority)
    && (queue !== "hot" || (l.priority === "hot" && l.status === "new"))
    && (queue !== "overdue" || (l.status === "new" && !!l.foundAt && leadTime(l) + SLA_MS < now))
    && (queue !== "due" || isFollowUpDue(l, today))
    && (!q.trim() || [l, ...reposts].some(r => [r.author, r.why, r.excerpt, r.reply, r.notes].join(" ").toLowerCase().includes(q.trim().toLowerCase())))
  ).sort((a, b) => followUps ? (a.lead.followUp ?? "").localeCompare(b.lead.followUp ?? "")
    : (sort === "urgent" ? RANK[a.lead.priority] - RANK[b.lead.priority] : 0) || (sort === "oldest" ? leadTime(a.lead) - leadTime(b.lead) : leadTime(b.lead) - leadTime(a.lead)));

  const explicit = selectedId ? shown.find(g => g.lead.id === selectedId || g.reposts.some(r => r.id === selectedId)) : undefined;
  const active = explicit ?? (desktop ? shown[0] : undefined);

  // j / k move through the list, c copies the reply, e marks it replied, / searches. Nothing here animates.
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
    if (e.key === "c") actions.current?.copy();
    if (e.key === "e") actions.current?.markReplied();
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

  const subline = leads === null ? "Loading leads"
    : followUps ? `${base.length} scheduled${due ? `, ${due} due` : ""}`
    : waiting.length ? `${waiting.length} waiting for a reply${overdue ? `, ${overdue} past the 2-hour mark` : ""}` : "Nothing is waiting for a reply";

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col md:min-h-dvh lg:h-dvh">
      <div className="grid gap-5 px-5 pt-6 pb-4 lg:px-10 lg:pt-8">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="grid gap-1.5">
            <h1 className="font-heading text-[40px] leading-none font-normal tracking-[-0.02em]">{followUps ? "Follow-ups" : "Inbox"}</h1>
            <p className="text-sm text-muted-foreground" aria-live="polite">{subline}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={!shown.length}><ArrowDownToLine strokeWidth={1.5} /> Export</Button>
            <AddLeadDialog />
          </div>
        </header>
        {!followUps && (
          <StatStrip compact items={[
            { label: "Waiting for a reply", value: leads === null ? "–" : waiting.length, onClick: () => { clearFilters(); setTab("new"); }, active: tab === "new" && queue === "all" },
            { label: "Hot leads", value: leads === null ? "–" : hot, onClick: () => chooseQueue("hot"), active: queue === "hot" },
            { label: "Past the 2-hour mark", value: leads === null ? "–" : overdue, tone: overdue ? "late" : undefined, onClick: () => chooseQueue("overdue"), active: queue === "overdue" },
            { label: "Follow-ups due", value: leads === null ? "–" : due, onClick: () => chooseQueue("due"), active: queue === "due" },
          ]} />
        )}
      </div>

      <div className="overflow-x-auto overflow-y-hidden px-5 lg:px-10">
        <div className="flex min-w-max gap-1" role="tablist" aria-label={followUps ? "Follow-up filters" : "Pipeline"}>
          {followUps ? (
            [["all", "All scheduled", base.length], ["due", "Due now", due]].map(([id, label, n]) => (
              <TabButton key={id} selected={queue === id} onClick={() => chooseQueue(id as string)} label={label as string} count={n as number} />
            ))
          ) : TABS.map(t => <TabButton key={t} selected={tab === t && queue === "all"} onClick={() => { setTab(t); setQueue("all"); }} label={t === "all" ? "All" : STATUS_LABEL[t]} count={counts[t] ?? 0} />)}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 border-t lg:grid lg:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]">
        <section aria-label="Leads" className="flex min-h-0 w-full flex-col lg:border-r">
          <div className="flex items-center gap-2 px-3 pt-3 pb-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search leads</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
              <Input ref={searchRef} type="search" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} className="pr-9 pl-9" />
              <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border px-1.5 font-mono text-[11px] text-muted-foreground lg:block">/</kbd>
            </label>
            <FiltersMenu {...{ platform, setPlatform, kind, setKind, priority, setPriority, sort, setSort, grouped, setGrouped, followUps, activeFilters }} />
          </div>
          {filtered && (
            <div className="flex items-center justify-between px-4 pb-1 text-xs text-muted-foreground">
              <span>{queue === "due" ? "Follow-ups due" : queue === "hot" ? "Hot leads waiting" : queue === "overdue" ? "Past the 2-hour mark" : `${shown.length} match${shown.length === 1 ? "" : "es"}`}</span>
              <Button variant="ghost" size="sm" onClick={clearFilters}><X strokeWidth={1.5} /> Clear</Button>
            </div>
          )}
          {live === "off" && (
            <div role="alert" className="mx-3 mb-2 grid gap-2 rounded-xl border bg-late/5 p-3 text-[13px] leading-5">
              <span>Can&apos;t refresh the inbox. {leads ? "Showing the last loaded data." : "Check the connection and try again."}</span>
              <Button variant="outline" size="sm" className="w-fit" onClick={reload}>Retry</Button>
            </div>
          )}
          <ul className="quiet-scroll grid min-h-0 flex-1 content-start gap-0.5 px-2 pt-1 pb-4 lg:overflow-y-auto" aria-label="Leads">
            {leads === null && live !== "off" ? [0, 1, 2, 3].map(i => <li key={i} className="mx-1 h-[92px] animate-pulse rounded-xl bg-secondary/60" aria-hidden />)
              : shown.length ? shown.map((g, i) => <LeadRow key={g.lead.id} lead={g.lead} reposts={g.reposts} index={i} intro={intro} selected={active?.lead.id === g.lead.id} onSelect={() => setSelectedId(g.lead.id)} />)
              : leads !== null && <li className="grid justify-items-center gap-3 px-6 py-14 text-center">
                  <p className="font-heading text-xl">{filtered ? "No leads match" : followUps ? "No follow-ups scheduled" : "Nothing waiting"}</p>
                  <p className="max-w-64 text-[13px] leading-5 text-muted-foreground">{filtered ? "Try another filter, or clear them to see everything." : followUps ? "Set a date on a replied lead and it will show up here." : "New requests appear after the next scan. You can also add a post yourself."}</p>
                  {filtered && <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>}
                </li>}
          </ul>
          <p className="hidden items-center gap-3 border-t px-4 py-2.5 font-mono text-[11px] text-muted-foreground lg:flex"><span>j k move</span><span>c copy reply</span><span>e replied</span><span>/ search</span></p>
        </section>

        <div className={cn("min-w-0", explicit ? "fixed inset-0 z-40 bg-background lg:static lg:z-auto" : "hidden lg:block")}>
          {active
            ? <LeadDetail key={active.lead.id} lead={active.lead} reposts={active.reposts} actionsRef={actions} onBack={() => setSelectedId(null)} />
            : <div className="grid h-full place-items-center p-10 text-center text-sm text-muted-foreground">{leads === null ? "Loading" : "Select a lead to read the post and edit the reply."}</div>}
        </div>
      </div>
    </div>
  );
}

function TabButton({ selected, onClick, label, count }: { selected: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button type="button" role="tab" aria-selected={selected} onClick={onClick}
      className={cn("flex items-center gap-2 px-3 py-2.5 text-sm whitespace-nowrap text-muted-foreground shadow-[inset_0_-2px_0_transparent] transition-[color,box-shadow] duration-150 outline-ring hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2", selected && "font-medium text-foreground shadow-[inset_0_-2px_0_var(--foreground)]")}>
      {label}<span className="font-mono text-xs tabular">{count}</span>
    </button>
  );
}

function FiltersMenu(p: {
  platform: string; setPlatform: (v: string) => void; kind: string; setKind: (v: string) => void; priority: string; setPriority: (v: string) => void;
  sort: string; setSort: (v: string) => void; grouped: boolean; setGrouped: (v: boolean) => void; followUps: boolean; activeFilters: number;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label={p.activeFilters ? `Filters, ${p.activeFilters} active` : "Filters"}>
          <SlidersHorizontal strokeWidth={1.5} /><span className="hidden sm:inline">Filters</span>
          {p.activeFilters > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary font-mono text-[11px] text-primary-foreground">{p.activeFilters}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-72 gap-4 p-4">
        <Field label="Platform" value={p.platform} onChange={p.setPlatform} options={[["all", "All platforms"], ...Object.entries(PLATFORMS)]} />
        <Field label="Type" value={p.kind} onChange={p.setKind} options={[["all", "All types"], ...KINDS.map(k => [k, k[0].toUpperCase() + k.slice(1)] as [string, string])]} />
        <Field label="Priority" value={p.priority} onChange={p.setPriority} options={[["all", "Any priority"], ...PRIORITIES.map(x => [x, x[0].toUpperCase() + x.slice(1)] as [string, string])]} />
        {!p.followUps && <Field label="Sort" value={p.sort} onChange={p.setSort} options={[["urgent", "Highest intent"], ["newest", "Newest first"], ["oldest", "Oldest first"]]} />}
        <label className="flex items-center justify-between gap-3 border-t pt-4 text-sm">Group similar posts<Switch checked={p.grouped} onCheckedChange={p.setGrouped} /></label>
      </PopoverContent>
    </Popover>
  );
}

function Field({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full" aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
