"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddLeadDialog } from "@/components/add-lead-dialog";
import { LeadCard, STATUS_LABEL } from "@/components/lead-card";
import { SLA_MS, useLeads } from "@/components/leads-provider";
import { cn } from "@/lib/utils";
import { KINDS, leadTime, PRIORITIES, type Status } from "@/lib/lead-utils";

type Tab = Status | "all";
const TABS: Tab[] = ["new", "replied", "talking", "won", "lost", "skipped", "all"];
const RANK = { hot: 0, warm: 1, cold: 2 };

export default function InboxPage() {
  const { leads, groups, now, live, focus } = useLeads();
  const [tab, setTab] = useState<Tab>("new");
  const [kind, setKind] = useState("all");
  const [priority, setPriority] = useState("all");
  const [sort, setSort] = useState<"urgent" | "newest">("urgent");
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // A lead opened from an alert switches to the tab it is in.
  useEffect(() => {
    const g = focus && groups.find((g) => g.lead.id === focus || g.reposts.some((r) => r.id === focus));
    if (g) { setTab((t) => (t === "all" || t === g.lead.status ? t : g.lead.status)); setKind("all"); setPriority("all"); setQ(""); }
  }, [focus, groups]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement)?.tagName ?? "");
      if ((e.key === "/" && !typing) || (e.key === "k" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const today = new Date(now).toISOString().slice(0, 10);
  const stats = useMemo(() => {
    const waiting = groups.filter((g) => g.lead.status === "new");
    return {
      waiting: waiting.length,
      hot: waiting.filter((g) => g.lead.priority === "hot").length,
      overdue: waiting.filter((g) => g.lead.foundAt && Date.parse(g.lead.foundAt) + SLA_MS < now).length,
      followUps: groups.filter((g) => g.lead.followUp && g.lead.followUp <= today && (g.lead.status === "replied" || g.lead.status === "talking")).length,
    };
  }, [groups, now, today]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: groups.length };
    for (const g of groups) c[g.lead.status] = (c[g.lead.status] ?? 0) + 1;
    return c;
  }, [groups]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return groups
      .filter(({ lead: l }) => (tab === "all" || l.status === tab) && (kind === "all" || l.kind === kind) && (priority === "all" || l.priority === priority)
        && (!s || [l.author, l.why, l.excerpt, l.reply, l.notes].join(" ").toLowerCase().includes(s)))
      .sort((a, b) => (sort === "urgent" ? RANK[a.lead.priority] - RANK[b.lead.priority] : 0) || leadTime(b.lead) - leadTime(a.lead));
  }, [groups, tab, kind, priority, q, sort]);

  return (
    <div className="mx-auto grid max-w-[1120px] gap-8 px-4 py-8 md:px-8 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <p className="font-mono text-xs text-muted-foreground">{new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">Inbox</h1>
          <p className="max-w-xl text-sm leading-6 text-text-2">People on LinkedIn asking to buy an AI workshop, AI training or a product build. Reply from your own account within 2 hours.</p>
        </div>
        <AddLeadDialog />
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Summary">
        <Stat label="Waiting for a reply" value={stats.waiting} bright />
        <Stat label="Hot leads waiting" value={stats.hot} />
        <Stat label="Past the 2-hour mark" value={stats.overdue} tone={stats.overdue ? "late" : undefined} />
        <Stat label="Follow-ups due" value={stats.followUps} tone={stats.followUps ? "late" : undefined} />
      </section>

      <section className="grid gap-4">
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div className="flex min-w-max gap-1 border-b" role="tablist" aria-label="Pipeline">
            {TABS.map((t) => (
              <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}
                className={cn("-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  tab === t && "border-foreground text-foreground")}>
                {t === "all" ? "All" : STATUS_LABEL[t]}
                <span className="font-mono text-xs text-muted-foreground tabular">{counts[t] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 basis-64">
            <span className="sr-only">Search leads</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <Input ref={searchRef} type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 bg-card pr-10 pl-9" />
            <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">/</kbd>
          </label>
          <Filter value={kind} onChange={setKind} label="Type" options={[["all", "All types"], ...KINDS.map((k) => [k, k[0].toUpperCase() + k.slice(1)] as [string, string])]} />
          <Filter value={priority} onChange={setPriority} label="Priority" options={[["all", "Any priority"], ...PRIORITIES.map((p) => [p, p[0].toUpperCase() + p.slice(1)] as [string, string])]} />
          <Filter value={sort} onChange={(v) => setSort(v as typeof sort)} label="Sort" options={[["urgent", "Hottest first"], ["newest", "Newest first"]]} />
        </div>

        {live === "off" && <p className="rounded-xl border bg-late/10 px-4 py-3 text-sm">The lead database isn&apos;t answering. Changes won&apos;t save until it&apos;s back.</p>}

        <div className="grid gap-4">
          {leads === null ? [0, 1, 2].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl border bg-card" />)
            : shown.length ? shown.map((g) => <LeadCard key={g.lead.id} lead={g.lead} reposts={g.reposts} />)
            : <Empty tab={tab} filtered={!!q || kind !== "all" || priority !== "all"} />}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, bright, tone }: { label: string; value: number; bright?: boolean; tone?: "late" }) {
  return (
    <div className={cn("grid gap-3 rounded-2xl border p-4 md:p-5", bright ? "border-transparent bg-brand text-[#111]" : "bg-card")}>
      <span className={cn("text-xs", bright ? "text-[#111]/70" : "text-muted-foreground")}>{label}</span>
      <span className={cn("font-heading text-3xl font-medium tabular", tone === "late" && "text-late")}>{value}</span>
    </div>
  );
}

function Filter({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-36 bg-card" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function Empty({ tab, filtered }: { tab: Tab; filtered: boolean }) {
  const text = filtered ? "No leads match. Clear the search or the filters."
    : tab === "new" ? "No leads waiting. New ones appear here after the daily scan."
    : tab === "won" ? "No won deals yet. Move a lead to Won when the client signs."
    : "Nothing here yet.";
  return <div className="rounded-2xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">{text}</div>;
}
