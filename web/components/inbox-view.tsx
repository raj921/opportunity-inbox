"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, CalendarClock, CheckCheck, CircleAlert, Flame, Inbox, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddLeadDialog } from "@/components/add-lead-dialog";
import { LeadCard, STATUS_LABEL } from "@/components/lead-card";
import { SLA_MS, useLeads } from "@/components/leads-provider";
import { cn } from "@/lib/utils";
import { isFollowUpDue, KINDS, leadTime, leadsCsv, localDate, PLATFORMS, PRIORITIES, type Status } from "@/lib/lead-utils";

type Tab = Status | "all";
const TABS: Tab[] = ["new", "replied", "talking", "won", "lost", "skipped", "all"];
const RANK = { hot: 0, warm: 1, cold: 2 };

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
  const searchRef = useRef<HTMLInputElement>(null);
  const today = localDate(now);
  const items = useMemo(() => grouped ? groups : (leads ?? []).map(lead => ({ lead, reposts: [] })), [grouped, groups, leads]);
  const clearFilters = () => { setQ(""); setKind("all"); setPlatform("all"); setPriority("all"); setQueue("all"); };

  useEffect(() => {
    const g = focus && items.find(g => g.lead.id === focus || g.reposts.some(r => r.id === focus));
    if (g) { setTab(g.lead.status); setKind("all"); setPlatform("all"); setPriority("all"); setQ(""); setQueue("all"); }
  }, [focus, items]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return;
      const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement)?.tagName ?? "");
      if ((e.key === "/" && !typing) || (e.key === "k" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const waiting = items.filter(g => g.lead.status === "new");
  const hot = waiting.filter(g => g.lead.priority === "hot").length;
  const due = items.filter(g => isFollowUpDue(g.lead, today)).length;
  const overdue = waiting.filter(g => g.lead.foundAt && leadTime(g.lead) + SLA_MS < now).length;
  const base = followUps ? items.filter(g => ["replied", "talking"].includes(g.lead.status) && g.lead.followUp) : items;
  const counts: Record<string, number> = { all: base.length };
  for (const { lead } of base) counts[lead.status] = (counts[lead.status] ?? 0) + 1;
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

  function exportCsv() {
    const url = URL.createObjectURL(new Blob(["\uFEFF", leadsCsv(shown.map(g => g.lead))], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url; link.download = `opportunities-${today}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const chooseQueue = (value: string) => { clearFilters(); setTab("all"); setQueue(value); };
  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Your growth workspace <span className="mx-2 text-border">/</span> {followUps ? "Follow-ups" : "Overview"}</p>
          <h1>{followUps ? "Keep the conversation going." : "Your next opportunity starts here."}</h1>
          <p className="page-description">{followUps ? "A clear next step for every conversation. Follow through, stay useful, win the work." : "Real buying intent. Thoughtful outreach. Everything you need to turn a post into a client."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!shown.length}><ArrowDownToLine /> Export</Button>
          <AddLeadDialog />
        </div>
      </header>

      {!followUps && <section className="focus-banner" aria-label="Daily focus">
        <div className="relative z-10 max-w-xl">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[#e9c66b]"><span className="size-1.5 rounded-full bg-current" /> Make your next move</p>
          <h2 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">{leads === null ? "A little focus. A lot of possibility." : hot ? `${hot} hot ${hot === 1 ? "opportunity deserves" : "opportunities deserve"} your attention.` : due ? `${due} conversations are ready for a follow-up.` : "Good conversations start with showing up."}</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-white/65">{hot ? "Start with buyers who have a clear need. Your tailored reply is ready to make your own." : "Review new requests, add a personal touch, and give every promising lead a next step."}</p>
          <button className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#e9c66b] hover:text-white" onClick={() => { chooseQueue(hot ? "hot" : due ? "due" : "all"); document.getElementById("opportunity-list")?.scrollIntoView({ behavior: "smooth" }); }}>Open your action queue <ArrowRight className="size-4" /></button>
        </div>
        <div className="focus-art" aria-hidden><span /><span /><span /><i>↗</i></div>
      </section>}

      {!followUps && <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Lead overview">
        <Metric label="Awaiting a reply" value={leads === null ? "—" : waiting.length} note="New opportunities" icon={<Inbox />} onClick={() => { clearFilters(); setTab("new"); }} active={!followUps && tab === "new" && queue === "all"} />
        <Metric label="High intent" value={leads === null ? "—" : hot} note="Hot leads to prioritize" icon={<Flame />} onClick={() => chooseQueue("hot")} active={queue === "hot"} />
        <Metric label="Follow-ups due" value={leads === null ? "—" : due} note="Keep momentum going" icon={<CalendarClock />} onClick={() => chooseQueue("due")} active={queue === "due"} />
        <Metric label="Past reply target" value={leads === null ? "—" : overdue} note="2 hours from discovery" icon={<CircleAlert />} onClick={() => chooseQueue("overdue")} active={queue === "overdue"} />
      </section>}
      {followUps && <div className="flex flex-wrap gap-2"><Button variant={queue === "all" ? "default" : "outline"} onClick={() => chooseQueue("all")}>All scheduled · {base.length}</Button><Button variant={queue === "due" ? "default" : "outline"} onClick={() => chooseQueue("due")}>Due now · {due}</Button></div>}

      <section id="opportunity-list" className="scroll-mt-20 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3"><h2 className="font-heading text-xl font-semibold tracking-tight">{followUps ? "Scheduled follow-ups" : "Opportunity inbox"}</h2><span className="text-xs text-muted-foreground">{leads === null ? "Loading…" : `${shown.length} ${shown.length === 1 ? "opportunity" : "opportunities"}`}</span></div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={grouped} onChange={e => setGrouped(e.target.checked)} className="size-3.5 accent-[var(--brand-ink)]" /> Group similar posts</label>
        </div>
        {!followUps && <div className="flex gap-1 overflow-x-auto border-b pb-0" aria-label="Pipeline filters">{TABS.map(t => <button key={t} aria-pressed={tab === t} onClick={() => { setTab(t); setQueue("all"); }} className={cn("pipeline-tab", tab === t && "pipeline-tab-active")}>{t === "all" ? "All leads" : STATUS_LABEL[t]}<span>{counts[t] ?? 0}</span></button>)}</div>}
        <div className="filter-bar">
          <label className="relative min-w-0 flex-1 basis-56"><span className="sr-only">Search opportunities</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input ref={searchRef} type="search" placeholder="Search people, requests, notes…" value={q} onChange={e => setQ(e.target.value)} className="h-10 border-transparent bg-transparent pl-9 shadow-none" /></label>
          <SlidersHorizontal className="hidden size-4 text-muted-foreground sm:block" />
          <Filter value={platform} onChange={setPlatform} label="Platform" options={[["all", "All sources"], ...Object.entries(PLATFORMS)]} />
          <Filter value={kind} onChange={setKind} label="Type" options={[["all", "All types"], ...KINDS.map(k => [k, k[0].toUpperCase() + k.slice(1)] as [string, string])]} />
          <Filter value={priority} onChange={setPriority} label="Priority" options={[["all", "Any priority"], ...PRIORITIES.map(p => [p, p[0].toUpperCase() + p.slice(1)] as [string, string])]} />
          {!followUps && <Filter value={sort} onChange={setSort} label="Sort" options={[["urgent", "Highest intent"], ["newest", "Newest first"], ["oldest", "Oldest first"]]} />}
        </div>
        {filtered && <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{queue === "due" ? "Follow-ups due today or earlier" : queue === "hot" ? "Hot leads waiting for a reply" : queue === "overdue" ? "Waiting longer than the reply target" : "Showing filtered opportunities"}</span><Button variant="ghost" size="sm" onClick={clearFilters}><X /> Clear filters</Button></div>}
        {live === "off" && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-late/20 bg-late/5 p-4 text-sm"><span>Unable to refresh the inbox. {leads ? "Showing the last loaded data." : "Check the connection and try again."}</span><Button variant="outline" onClick={reload}>Retry connection</Button></div>}
        <div className="grid gap-4">
          {leads === null && live !== "off" ? [0, 1, 2].map(i => <div key={i} className="h-60 animate-pulse rounded-2xl border bg-card" aria-label="Loading opportunities" />)
            : shown.length ? shown.map(g => <LeadCard key={g.lead.id} lead={g.lead} reposts={g.reposts} />)
            : leads !== null && <div className="empty-state"><span className="mb-4 grid size-12 place-items-center rounded-2xl border bg-background"><CheckCheck className="size-6 text-brand-ink" /></span><h3 className="font-heading text-lg font-semibold">{filtered ? "Nothing matches just yet." : followUps ? "Every conversation has its moment." : "A clear inbox. A fresh start."}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{filtered ? "Try another source or clear your filters to see more opportunities." : followUps ? "Set a follow-up date on a replied lead to plan your next conversation." : "New buyer requests will appear after a successful scan. You can also add a post yourself."}</p>{filtered && <Button variant="outline" className="mt-5" onClick={clearFilters}>Clear filters</Button>}</div>}
        </div>
      </section>
      <p className="text-center text-xs text-muted-foreground">Thoughtful outreach wins. Review every draft before posting from your own account.</p>
    </div>
  );
}

function Metric({ label, value, note, icon, onClick, active }: { label: string; value: string | number; note: string; icon: React.ReactNode; onClick: () => void; active: boolean }) {
  return <button onClick={onClick} className={cn("metric-card text-left", active && "metric-card-active")} aria-pressed={active}><span className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">{label}<span className="metric-icon">{icon}</span></span><strong className="mt-4 block font-heading text-3xl font-semibold tracking-tight tabular">{value}</strong><span className="mt-1 block text-[11px] text-muted-foreground">{note}</span></button>;
}
function Filter({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger className="h-9 w-auto min-w-28 border-transparent bg-transparent shadow-none" aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>;
}
