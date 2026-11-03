"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Check, CircleAlert, Radio, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddLeadDialog } from "@/components/add-lead-dialog";
import { useLeads } from "@/components/leads-provider";
import { cn } from "@/lib/utils";

type Health = { platform: string; checkedAt: string; lastSuccessAt: string | null; status: string; posts: number; leads: number; detail: string };
const SOURCES = [
  { id: "linkedin", name: "LinkedIn", mark: "in", color: "#2867b2", description: "Workshop requests, training needs, development partners and public RFPs.", scope: "9 buyer-intent searches", method: "Apify · scheduled discovery" },
  { id: "x", name: "X / Twitter", mark: "𝕏", color: "#242b28", description: "Direct requests for app developers, AI agencies and team training.", scope: "8 exact-phrase searches · 100-post cap", method: "Apify · scheduled discovery" },
  { id: "reddit", name: "Reddit", mark: "r/", color: "#c84c25", description: "Public discussions asking for development help and AI training partners.", scope: "3 focused searches · 10 results per query", method: "Apify · optional discovery" },
];
const date = (s: string | null | undefined) => s ? new Date(s).toLocaleString("en-GB", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }) : "Not verified";

export default function SourcesPage() {
  const { leads, now, live } = useLeads();
  const [health, setHealth] = useState<Health[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/sources", { cache:"no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setHealth(data.sources); setError("");
    } catch { setError("We can't verify the latest scans. Lead data and discovery health are checked separately."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); const timer=setInterval(load,60000); return ()=>clearInterval(timer); }, [load]);
  return <div className="workspace-page">
    <header className="page-heading"><div><p className="eyebrow">Discovery / Sources</p><h1>More places. Better signals.</h1><p className="page-description">See where opportunities come from and when each source was last checked. Every match goes through the same buyer-intent screening.</p></div><Button variant="outline" disabled={busy} onClick={load}><RefreshCw className={cn(busy && "animate-spin")} /> Refresh status</Button></header>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 text-sm"><ShieldCheck className="size-5 text-brand-ink" /><span>Lead database: <strong>{live === "on" ? "Connected" : live === "off" ? "Unavailable" : "Connecting"}</strong></span><span className="ml-auto text-xs text-muted-foreground">Status below comes from the worker, not your browser refresh.</span></div>
    {error && <p role="alert" className="rounded-xl border border-late/20 bg-late/5 p-4 text-sm">{error}</p>}
    <div className="grid gap-4 xl:grid-cols-3">{SOURCES.map(source=>{
      const row=health.find(h=>h.platform===source.id);
      const stale=!!row && now-Date.parse(row.checkedAt)>48*3600e3;
      const good=!error && row?.status==="ok" && !stale;
      const label=error?"Unverified":!row?"Awaiting first scan":row.status==="disabled"?"Not enabled":stale?"Scan overdue":row.status==="ok"?"Scan healthy":row.status==="limited"?"Result cap reached":"Needs attention";
      return <article key={source.id} className="flex flex-col rounded-2xl border bg-card p-6">
        <div className="mb-6 flex items-center justify-between"><span className="grid size-11 place-items-center rounded-xl text-xl font-semibold text-white" style={{background:source.color}}>{source.mark}</span><span className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px]",good?"border-good/20 bg-good/5 text-good":"text-muted-foreground")}>{good?<Check className="size-3"/>:<CircleAlert className="size-3"/>}{label}</span></div>
        <h2 className="font-heading text-xl font-semibold">{source.name}</h2><p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{source.method}</p><p className="mt-4 min-h-16 text-sm leading-6 text-text-2">{source.description}</p>
        <p className="my-5 flex items-center gap-2 text-xs text-muted-foreground"><Search className="size-3.5"/>{source.scope}</p>
        <dl className="mt-auto grid grid-cols-2 gap-4 border-t pt-5"><div><dt className="text-[10px] text-muted-foreground">Posts in last scan</dt><dd className="mt-1 font-heading text-2xl">{row && row.status!=="disabled" ? row.posts : "—"}</dd></div><div><dt className="text-[10px] text-muted-foreground">Leads in inbox</dt><dd className="mt-1 font-heading text-2xl">{leads ? leads.filter(l=>l.platform===source.id).length : "—"}</dd></div></dl>
        <div className="mt-5 space-y-2 rounded-lg bg-background p-3 text-[11px] text-muted-foreground"><p className="flex justify-between gap-2"><span>Last attempt</span><span>{date(row?.checkedAt)}</span></p><p className="flex justify-between gap-2"><span>Last successful scan</span><span>{date(row?.lastSuccessAt)}</span></p></div>
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">{row?.detail ?? "No worker heartbeat has been recorded for this source yet. A deployed interface alone does not confirm discovery is running."}</p>
      </article>;
    })}</div>
    <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border bg-card p-6"><div className="max-w-xl"><p className="eyebrow">Beyond automated discovery</p><h2 className="font-heading text-xl font-semibold">Found something somewhere else?</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Bring in posts from Facebook, Bluesky, Reddit or any public link. Add the text and let AI check the opportunity, or save it for manual review.</p></div><AddLeadDialog /></section>
    <div className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border p-5"><Radio className="mb-3 size-5 text-brand-ink"/><h3 className="text-sm font-semibold">Honest coverage</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">Scheduled discovery runs daily. Sources can return no matches, hit a result cap, or fail independently. Manual imports are available across networks; automated Facebook and Bluesky discovery is not connected.</p></div><div className="rounded-xl border p-5"><ArrowUpRight className="mb-3 size-5 text-brand-ink"/><h3 className="text-sm font-semibold">A human stays in the loop</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">Buyer intent and draft replies are suggestions. Review the original request, tailor your response, and post from your own account. Nothing is sent automatically by this workspace.</p></div></div>
  </div>;
}
