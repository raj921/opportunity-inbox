"use client";

import { useMemo, useState } from "react";
import { STATUS_LABEL } from "@/components/lead-card";
import { useLeads } from "@/components/leads-provider";
import { StatStrip } from "@/components/stat-strip";
import { cn } from "@/lib/utils";
import { ACTIVE_PLATFORMS, localDate, STATUSES } from "@/lib/lead-utils";

const pct = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : 0);
const timestamp = (value: string | null) => {
  const ms = Date.parse(value ?? "");
  return Number.isFinite(ms) ? ms : null;
};
const fullDate = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function ResultsPage() {
  const { leads, now } = useLeads();
  const [range, setRange] = useState<7 | 14>(14);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const r = useMemo(() => {
    const all = leads.filter((lead) => lead.platform in ACTIVE_PLATFORMS);
    const discovered = new Map<string, number>();
    const comments = new Map<string, number>();
    let newest: number | null = null;
    let commented = 0;
    let talking = 0;
    let won = 0;

    for (const lead of all) {
      const foundAt = timestamp(lead.foundAt);
      const repliedAt = timestamp(lead.repliedAt);
      const statusAt = timestamp(lead.statusAt);
      for (const ms of [foundAt, repliedAt, statusAt]) {
        if (ms !== null && (newest === null || ms > newest)) newest = ms;
      }
      if (foundAt !== null) {
        const key = localDate(foundAt);
        discovered.set(key, (discovered.get(key) ?? 0) + 1);
      }
      if (repliedAt !== null) {
        commented++;
        const key = localDate(repliedAt);
        comments.set(key, (comments.get(key) ?? 0) + 1);
      }
      if (lead.status === "talking") talking++;
      if (lead.status === "won") won++;
    }

    const end = new Date(newest ?? now);
    end.setHours(0, 0, 0, 0);
    const days = Array.from({ length: range }, (_, index) => {
      const date = new Date(end);
      date.setDate(end.getDate() - (range - 1 - index));
      const key = localDate(date.getTime());
      return { key, ms: date.getTime(), discovered: discovered.get(key) ?? 0, comments: comments.get(key) ?? 0 };
    });
    const peak = Math.max(1, ...days.map((day) => Math.max(day.discovered, day.comments)));
    const step = Math.max(1, Math.ceil(peak / 4));

    return {
      all, commented, talking, won, newest, days,
      max: step * 4,
      ticks: [step * 4, step * 3, step * 2, step, 0],
      discoveriesInRange: days.reduce((sum, day) => sum + day.discovered, 0),
      commentsInRange: days.reduce((sum, day) => sum + day.comments, 0),
      platforms: Object.entries(ACTIVE_PLATFORMS).map(([platform, name]) => {
        const items = all.filter((lead) => lead.platform === platform);
        return { platform, name, total: items.length, commented: items.filter((lead) => timestamp(lead.repliedAt) !== null).length, won: items.filter((lead) => lead.status === "won").length };
      }),
    };
  }, [leads, now, range]);

  const selected = r.days.find((day) => day.key === selectedDay) ?? r.days[r.days.length - 1];
  const hasActivity = r.discoveriesInRange > 0 || r.commentsInRange > 0;
  const interval = r.newest === null ? "No dated activity yet" : `${fullDate(r.days[0].ms)} – ${fullDate(r.days[r.days.length - 1].ms)}`;

  return (
    <div className="portal-page">
      <header className="portal-header">
        <div className="portal-heading">
          <h1 className="portal-title">Insights</h1>
          <p className="portal-description">Lead discovery, comment activity, and pipeline outcomes across LinkedIn and X.</p>
          <p className="portal-notice">Demo mode · fictional data, simulated fetching and posting</p>
        </div>
      </header>

      <StatStrip items={[
        { label: "Leads discovered", value: r.all.length, accent: "gold", note: "All LinkedIn and X leads" },
        { label: "Commented", value: r.commented, accent: "mint", note: `${pct(r.commented, r.all.length)}% of ${r.all.length} discovered leads` },
        { label: "Conversations", value: r.talking, accent: "sky", note: "Currently in conversation" },
        { label: "Won", value: r.won, accent: "lilac", note: `${pct(r.won, r.all.length)}% conversion · ${r.all.length} discovered leads` },
      ]} />

      <section aria-labelledby="activity-title" className="grid min-w-0 gap-5 rounded-2xl border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-1.5">
            <h2 id="activity-title" className="font-heading text-2xl font-bold tracking-[-0.03em]">Discovery & comments</h2>
            <p className="text-sm text-muted-foreground">{interval}</p>
            <p className="text-xs text-muted-foreground">Window ends on the latest recorded activity, not today. Dates use your local time.</p>
          </div>
          <div role="group" aria-label="Chart date range" className="flex rounded-lg border p-1">
            {([7, 14] as const).map((days) => (
              <button key={days} type="button" aria-pressed={range === days} onClick={() => { setRange(days); setSelectedDay(null); }}
                className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", range === days ? "bg-gold text-ink" : "text-muted-foreground hover:bg-secondary")}>
                {days} days
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <span className="flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-sm bg-sky" />Leads discovered <strong className="font-mono tabular">{r.discoveriesInRange}</strong></span>
            <span className="flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-sm bg-rose" />Comments <strong className="font-mono tabular">{r.commentsInRange}</strong></span>
          </div>
          <span className="text-xs text-muted-foreground">Selected window totals</span>
        </div>

        {hasActivity ? (
          <figure aria-label={`Daily leads discovered and comments, ${interval}`} className="grid min-w-0 gap-3">
            <figcaption className="grid gap-1 rounded-lg bg-secondary px-3 py-2 text-xs sm:flex sm:flex-wrap sm:items-center sm:gap-x-4" aria-live="polite" aria-atomic="true">
              <span className="font-medium">{fullDate(selected.ms)}</span>
              <span>{selected.discovered} leads discovered · {selected.comments} comments</span>
            </figcaption>
            <div className="text-[11px] text-muted-foreground">Count</div>
            <div className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
              <div aria-hidden className="relative h-56 font-mono text-[11px] text-muted-foreground tabular sm:h-64">
                {r.ticks.map((tick) => <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (100 * tick) / r.max}%` }}>{tick}</span>)}
              </div>
              <div className="relative h-56 min-w-0 sm:h-64">
                {r.ticks.map((tick) => <div aria-hidden key={tick} className={cn("absolute inset-x-0 border-t", tick === 0 ? "border-border" : "border-dashed border-border/70")} style={{ bottom: `${(100 * tick) / r.max}%` }} />)}
                <div className="absolute inset-0 grid gap-1 sm:gap-2" style={{ gridTemplateColumns: `repeat(${range}, minmax(0, 1fr))` }}>
                  {r.days.map((day) => {
                    const label = `${fullDate(day.ms)}: ${day.discovered} leads discovered, ${day.comments} comments`;
                    return (
                      <button key={day.key} type="button" aria-label={label} aria-pressed={selected.key === day.key} title={label}
                        onMouseEnter={() => setSelectedDay(day.key)} onFocus={() => setSelectedDay(day.key)} onClick={() => setSelectedDay(day.key)}
                        className={cn("relative flex h-full min-w-0 items-end justify-center gap-0.5 rounded-t px-0.5 transition-colors hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:gap-1 sm:px-1", selected.key === day.key && "bg-secondary/60")}>
                        <span aria-hidden className="relative w-1/2 max-w-6 rounded-t-sm bg-sky" style={{ height: `${(100 * day.discovered) / r.max}%` }} />
                        <span aria-hidden className="relative w-1/2 max-w-6 rounded-t-sm bg-rose" style={{ height: `${(100 * day.comments) / r.max}%` }} />
                      </button>
                    );
                  })}
                </div>
              </div>
              <span />
              <div aria-hidden className="mt-3 grid gap-1 font-mono text-[10px] text-muted-foreground tabular sm:gap-2 sm:text-[11px]" style={{ gridTemplateColumns: `repeat(${range}, minmax(0, 1fr))` }}>
                {r.days.map((day, index) => (
                  <span key={day.key} className={cn("text-center", index !== 0 && index !== Math.floor((range - 1) / 2) && index !== range - 1 && "invisible sm:visible")}>
                    {new Date(day.ms).getDate()}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-center text-[11px] text-muted-foreground">Day of month · hover, focus, or tap a day for counts</p>
          </figure>
        ) : (
          <div className="grid min-h-64 place-content-center gap-2 rounded-xl border border-dashed px-5 text-center">
            <p className="font-medium">No discovery or comment activity in this window</p>
            <p className="max-w-md text-sm text-muted-foreground">New discoveries and recorded comment times will appear here. Try the 14-day view to see a wider interval.</p>
          </div>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Discoveries use the time each lead was found; comments use the recorded comment time, not the latest status change.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5 rounded-2xl border bg-card p-5 sm:p-6">
          <div className="grid gap-1.5">
            <h2 className="font-heading text-2xl font-bold tracking-[-0.03em]">Platform performance</h2>
            <p className="text-sm text-muted-foreground">All-time totals and comment coverage by platform.</p>
          </div>
          <div className="grid gap-4">
            {r.platforms.map((platform) => (
              <div key={platform.platform} className="grid gap-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium">{platform.name}</h3>
                  <span className="font-mono text-sm tabular">{platform.total} leads</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary" role="meter" aria-label={`${platform.name} comment rate`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct(platform.commented, platform.total)} aria-valuetext={`${platform.commented} of ${platform.total} leads commented`}>
                  <div className="h-full rounded-full bg-rose" style={{ width: `${pct(platform.commented, platform.total)}%` }} />
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span>{platform.commented} commented · {pct(platform.commented, platform.total)}% of leads</span>
                  <span>{platform.won} won</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Comment coverage counts leads with a recorded comment time, including those that later moved to another stage.</p>
        </div>

        <div className="grid content-start gap-5 rounded-2xl border bg-card p-5 sm:p-6">
          <div className="grid gap-1.5">
            <h2 className="font-heading text-2xl font-bold tracking-[-0.03em]">Current pipeline</h2>
            <p className="text-sm text-muted-foreground">Each lead appears once in its current stage.</p>
          </div>
          <ul className="grid gap-4">
            {STATUSES.map((status) => {
              const count = r.all.filter((lead) => lead.status === status).length;
              return (
                <li key={status} className="grid gap-2">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-text-2">{STATUS_LABEL[status]}</span>
                    <span className="font-mono tabular">{count}<span className="ml-2 text-xs text-muted-foreground">{pct(count, r.all.length)}%</span></span>
                  </div>
                  <div aria-hidden className="h-1.5 rounded-full bg-secondary"><div className={cn("h-full rounded-full", status === "won" ? "bg-good" : status === "new" ? "bg-chart-1" : "bg-chart-4")} style={{ width: `${pct(count, r.all.length)}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
