"use client";

import { useMemo } from "react";
import { fmtDur, STATUS_LABEL } from "@/components/lead-card";
import { useLeads } from "@/components/leads-provider";
import { StatStrip } from "@/components/stat-strip";
import { cn } from "@/lib/utils";
import { KINDS, leadTime, localDate, median, PLATFORMS, STATUSES } from "@/lib/lead-utils";

const DAYS = 14;
const dayKey = localDate;
const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);

export default function ResultsPage() {
  const { groups, now, leads, live, reload } = useLeads();

  const r = useMemo(() => {
    const all = groups.map((g) => g.lead);
    const engaged = all.filter((l) => l.repliedAt || ["replied", "talking", "won"].includes(l.status));
    const times = all.filter((l) => l.repliedAt && l.foundAt).map((l) => Date.parse(l.repliedAt!) - Date.parse(l.foundAt!)).sort((a, b) => a - b);
    const days = Array.from({ length: DAYS }, (_, i) => {
      const ms = now - (DAYS - 1 - i) * 86400e3;
      const key = dayKey(ms);
      const onDay = all.filter((l) => leadTime(l) && dayKey(leadTime(l)) === key);
      return { key, ms, total: onDay.length, hot: onDay.filter((l) => l.priority === "hot").length };
    });
    const byQuery = new Map<string, { leads: number; hot: number; replied: number }>();
    for (const l of all) {
      const k = l.query ?? "";
      const row = byQuery.get(k) ?? { leads: 0, hot: 0, replied: 0 };
      row.leads++;
      if (l.priority === "hot") row.hot++;
      if (engaged.includes(l)) row.replied++;
      byQuery.set(k, row);
    }
    return {
      all, engaged, days,
      median: median(times),
      won: all.filter((l) => l.status === "won").length,
      maxDay: Math.max(4, ...days.map((d) => d.total)),
      queries: [...byQuery.entries()].sort((a, b) => b[1].leads - a[1].leads),
    };
  }, [groups, now]);

  const reposts = (leads?.length ?? 0) - r.all.length;
  const ticks = [r.maxDay, Math.round(r.maxDay / 2), 0];

  return (
    <div className="mx-auto grid max-w-[1120px] gap-7 px-5 py-6 lg:px-10 lg:py-10">
      <header className="grid gap-1.5">
        <h1 className="font-heading text-[40px] leading-none font-normal tracking-[-0.02em]">Insights</h1>
        <p className="text-sm text-muted-foreground">The last {DAYS} days. Similar posts count once.</p>
      </header>

      {leads === null ? (
        <div role="status" className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
          {live === "off" ? <>Insights are unavailable until the lead database reconnects. <button className="underline underline-offset-4" onClick={reload}>Retry</button></> : "Loading"}
        </div>
      ) : (
        <>
          {live === "off" && <p role="alert" className="rounded-xl border bg-late/5 p-4 text-sm">Showing the last loaded numbers. The database connection is unavailable.</p>}

          <StatStrip items={[
            { label: "Leads found", value: r.all.length, note: reposts ? `${reposts} reposts merged` : undefined },
            { label: "Replied", value: `${pct(r.engaged.length, r.all.length)}%`, note: `${r.engaged.length} of ${r.all.length} leads` },
            { label: "Typical reply time", value: r.median === null ? "–" : fmtDur(r.median), note: "Median, found to replied" },
            { label: "Won", value: r.won, note: r.engaged.length ? `${pct(r.won, r.engaged.length)}% of replied leads` : "No replies yet" },
          ]} />

          <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="grid gap-6 rounded-2xl border bg-card p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-heading text-2xl font-normal tracking-[-0.01em]">Leads per day</h2>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-clay" />Hot</span>
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-chart-3" />Warm or cold</span>
                </div>
              </div>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
                <div className="flex h-56 flex-col justify-between font-mono text-[11px] text-muted-foreground tabular">
                  {ticks.map((t) => <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">{t}</span>)}
                </div>
                <div className="relative h-56">
                  {ticks.map((t) => <div key={t} className={cn("absolute inset-x-0 border-t", t === 0 ? "border-line" : "border-dashed border-border")} style={{ bottom: `${(100 * t) / r.maxDay}%` }} />)}
                  <div className="absolute inset-0 flex items-end gap-1 md:gap-1.5">
                    {r.days.map((d) => (
                      <div key={d.key} className="flex h-full flex-1 flex-col justify-end" title={`${d.key}: ${d.total} leads, ${d.hot} hot`}>
                        <div className="flex flex-col overflow-hidden rounded-t-[3px]" style={{ height: `${(100 * d.total) / r.maxDay}%` }}>
                          <div className="bg-clay" style={{ flexBasis: `${pct(d.hot, d.total)}%` }} />
                          <div className="flex-1 bg-chart-3" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <span />
                <div className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground">
                  {[r.days[0], r.days[Math.floor(DAYS / 2)], r.days[DAYS - 1]].map((d, i) => (
                    <span key={d.key}>{i === 2 ? "Today" : new Date(d.ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid content-start gap-6 rounded-2xl border bg-card p-6">
              <div className="grid gap-4">
                <h2 className="font-heading text-2xl font-normal tracking-[-0.01em]">Pipeline</h2>
                <ul className="grid gap-3.5">
                  {STATUSES.map((s) => {
                    const n = r.all.filter((l) => l.status === s).length;
                    return (
                      <li key={s} className="grid gap-1.5">
                        <div className="flex justify-between text-sm"><span className="text-text-2">{STATUS_LABEL[s]}</span><span className="font-mono tabular">{n}</span></div>
                        <div className="h-1 rounded-full bg-secondary"><div className={cn("h-full rounded-full", s === "won" ? "bg-good" : "bg-chart-4")} style={{ width: `${pct(n, r.all.length)}%` }} /></div>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-6 border-t pt-5">
                <Tally title="Platform" rows={Object.entries(PLATFORMS).map(([p, name]) => [name, r.all.filter((l) => l.platform === p).length])} />
                <Tally title="Type" rows={KINDS.map((k) => [k[0].toUpperCase() + k.slice(1), r.all.filter((l) => l.kind === k).length])} />
              </div>
            </div>
          </section>

          <section className="grid gap-4 rounded-2xl border bg-card p-6">
            <div className="grid gap-1">
              <h2 className="font-heading text-2xl font-normal tracking-[-0.01em]">Which searches find buyers</h2>
              <p className="text-sm text-muted-foreground">Leads from before 3 Nov don&apos;t record their search, so they are grouped as earlier leads.</p>
            </div>
            <div className="-mx-6 overflow-x-auto px-6">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-left text-[13px] text-muted-foreground">
                    <th className="py-2.5 pr-4 font-normal">Search</th>
                    <th className="py-2.5 pr-4 text-right font-normal">Leads</th>
                    <th className="py-2.5 pr-4 text-right font-normal">Hot</th>
                    <th className="py-2.5 text-right font-normal">Replied</th>
                  </tr>
                </thead>
                <tbody>
                  {r.queries.map(([q, v]) => (
                    <tr key={q} className="border-b last:border-0">
                      <td className="py-3.5 pr-4">{q ? <code className="font-mono text-xs">{q}</code> : <span className="text-muted-foreground">Earlier leads</span>}</td>
                      <td className="py-3.5 pr-4 text-right font-mono tabular">{v.leads}</td>
                      <td className="py-3.5 pr-4 text-right font-mono tabular">{v.hot}</td>
                      <td className="py-3.5 text-right font-mono tabular">{v.replied}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Tally({ title, rows }: { title: string; rows: (string | number)[][] }) {
  return (
    <dl className="grid content-start gap-2">
      <dt className="text-[13px] text-muted-foreground">{title}</dt>
      {rows.map(([name, n]) => (
        <dd key={name} className="flex justify-between text-sm"><span className="text-text-2">{name}</span><span className="font-mono tabular">{n}</span></dd>
      ))}
    </dl>
  );
}
