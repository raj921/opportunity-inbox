"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddLeadDialog } from "@/components/add-lead-dialog";
import { useLeads } from "@/components/leads-provider";
import { cn } from "@/lib/utils";

type Health = { platform: string; checkedAt: string; lastSuccessAt: string | null; status: string; posts: number; leads: number; detail: string };
const SOURCES = [
  { id: "linkedin", name: "LinkedIn", mark: "in", description: "Workshop requests, training needs, development partners and public RFPs.", scope: "9 buyer-intent searches", method: "Apify, scheduled" },
  { id: "x", name: "X", mark: "𝕏", description: "Direct requests for app developers, AI agencies and team training, plus the LinkedIn buyer searches.", scope: "17 searches, 100 posts at most", method: "Apify, scheduled" },
  { id: "reddit", name: "Reddit", mark: "r/", description: "Public discussions asking for development help and AI training partners.", scope: "3 focused searches, 10 results each", method: "Apify, optional" },
];
const date = (s: string | null | undefined) => s ? new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Not verified";

export default function SourcesPage() {
  const { leads, now, live } = useLeads();
  const [health, setHealth] = useState<Health[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/sources", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setHealth(data.sources); setError("");
    } catch { setError("We can't verify the latest scans. Lead data and discovery health are checked separately."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); const timer = setInterval(load, 60000); return () => clearInterval(timer); }, [load]);

  return (
    <div className="mx-auto grid max-w-[1120px] gap-7 px-5 py-6 lg:px-10 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="grid gap-1.5">
          <h1 className="font-heading text-[40px] leading-none font-bold tracking-[-0.03em]">Sources</h1>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">Where leads come from and when each source was last checked. Every match goes through the same buyer-intent screening.</p>
        </div>
        <Button variant="outline" disabled={busy} onClick={load}><RefreshCw className={cn(busy && "animate-spin")} strokeWidth={1.5} /> Refresh</Button>
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border bg-card px-5 py-4 text-sm">
        <span className="flex items-center gap-2"><span className={cn("size-2 rounded-full", live === "on" ? "bg-good" : live === "off" ? "bg-late" : "bg-muted-foreground")} />Lead database: <strong className="font-medium">{live === "on" ? "connected" : live === "off" ? "unavailable" : "connecting"}</strong></span>
        <span className="text-[13px] text-muted-foreground sm:ml-auto">Scan status comes from the worker, not from this page refreshing.</span>
      </div>
      {error && <p role="alert" className="rounded-xl border bg-rose text-ink border-transparent p-4 text-sm">{error}</p>}

      <div className="grid gap-4 xl:grid-cols-3">
        {SOURCES.map((source) => {
          const row = health.find((h) => h.platform === source.id);
          const stale = !!row && now - Date.parse(row.checkedAt) > 48 * 3600e3;
          const good = !error && row?.status === "ok" && !stale;
          const label = error ? "Unverified" : !row ? "Awaiting first scan" : row.status === "disabled" ? "Not enabled" : stale ? "Scan overdue" : row.status === "ok" ? "Scan healthy" : row.status === "limited" ? "Result cap reached" : "Needs attention";
          return (
            <article key={source.id} className="flex flex-col rounded-2xl border bg-card p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="grid size-10 place-items-center rounded-xl border bg-secondary font-mono text-sm font-medium text-text-2" aria-hidden>{source.mark}</span>
                <span className="inline-flex items-center gap-2 text-[13px] text-text-2"><span className={cn("size-2 rounded-full", good ? "bg-good" : row && !stale && row.status !== "ok" && row.status !== "disabled" ? "bg-late" : "bg-muted-foreground/60")} aria-hidden />{label}</span>
              </div>
              <h2 className="mt-6 font-heading text-2xl font-bold tracking-[-0.03em]">{source.name}</h2>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{source.method}</p>
              <p className="mt-4 min-h-16 text-sm leading-6 text-text-2">{source.description}</p>
              <p className="my-4 text-[13px] text-muted-foreground">{source.scope}</p>
              <dl className="mt-auto grid grid-cols-2 gap-4 border-t pt-5">
                <div><dt className="text-[13px] text-muted-foreground">Posts in last scan</dt><dd className="mt-1.5 text-2xl font-medium tracking-[-0.03em] tabular">{row && row.status !== "disabled" ? row.posts : "–"}</dd></div>
                <div><dt className="text-[13px] text-muted-foreground">Leads in inbox</dt><dd className="mt-1.5 text-2xl font-medium tracking-[-0.03em] tabular">{leads ? leads.filter((l) => l.platform === source.id).length : "–"}</dd></div>
              </dl>
              <div className="mt-5 grid gap-1.5 rounded-[16px] bg-secondary p-3.5 text-xs leading-5 text-muted-foreground">
                <p className="flex justify-between gap-3"><span>Last attempt</span><span className="font-mono tabular">{date(row?.checkedAt)}</span></p>
                <p className="flex justify-between gap-3"><span>Last success</span><span className="font-mono tabular">{date(row?.lastSuccessAt)}</span></p>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{row?.detail ?? "No scan has reported for this source yet. A deployed site alone doesn't confirm discovery is running."}</p>
            </article>
          );
        })}
      </div>

      <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border bg-card p-6">
        <div className="max-w-xl">
          <h2 className="font-heading text-2xl font-bold tracking-[-0.03em]">Found something somewhere else?</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Add a post from Facebook, Bluesky, Reddit or any public link. Paste the text and let Claude check it, or save it for a manual look.</p>
        </div>
        <AddLeadDialog />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border p-6"><h3 className="eyebrow">What is covered</h3><p className="mt-2 text-[13px] leading-6 text-muted-foreground">Scheduled discovery runs daily. A source can return no matches, hit its result cap, or fail on its own. Facebook and Bluesky are manual imports only; their automatic discovery isn&apos;t connected.</p></div>
        <div className="rounded-2xl border p-6"><h3 className="eyebrow">A person stays in the loop</h3><p className="mt-2 text-[13px] leading-6 text-muted-foreground">Buyer intent and draft replies are suggestions. Read the original post, adjust the reply and send it from your own account. Nothing is sent for you.</p></div>
      </div>
    </div>
  );
}
