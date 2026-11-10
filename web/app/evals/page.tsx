import { StatStrip } from "@/components/stat-strip";
import data from "@/lib/eval-results.json";

const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(1)}%`;
const NAMES: Record<string, string> = { linkedin: "LinkedIn", x: "X", reddit: "Reddit" };
const TARGET = 90;

export const metadata = { title: "Evals · Futurelab Studios" };

export default function EvalsPage() {
  return (
    <div className="mx-auto grid max-w-[1120px] gap-7 px-5 py-6 lg:px-10 lg:py-10">
      <header className="grid gap-1.5">
        <h1 className="font-heading text-[40px] leading-none font-bold tracking-[-0.03em]">Evals</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">How well the tool judges real posts against hand-set labels. Run on {data.date}, target {TARGET}%.</p>
      </header>

      {data.runs.map((r) => {
        const score = (100 * r.correct) / r.total;
        return (
          <section key={r.label} className="grid gap-3" aria-label={r.label}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="font-heading text-2xl font-bold tracking-[-0.03em]">{r.label}</h2>
              <p className="text-[13px] text-muted-foreground">{r.note}</p>
            </div>
            <StatStrip items={[
              { label: "Correct verdicts", value: pct(r.correct, r.total), accent: score >= TARGET ? "mint" : "rose", note: `${r.correct} of ${r.total}, ${score >= TARGET ? "meets" : "below"} target` },
              { label: "Buyers caught", value: `${r.caught}/${r.buyers}`, accent: "gold", note: pct(r.caught, r.buyers) },
              { label: "Non-buyers rejected", value: `${r.rejected}/${r.others}`, accent: "sky", note: pct(r.rejected, r.others) },
              { label: "Replies passed", value: `${r.replies[0]}/${r.replies[1]}`, accent: "lilac", note: "AI judge, threshold 0.7" },
            ]} />
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div className="grid content-start gap-3.5 rounded-2xl bg-card p-6">
                <h3 className="eyebrow">By platform</h3>
                {r.platforms.map((p) => (
                  <div key={p.name} className="grid gap-1.5">
                    <div className="flex justify-between text-sm"><span>{NAMES[p.name] ?? p.name}</span><span className="tabular">{p.correct} of {p.total}</span></div>
                    <div className="h-1 rounded-full bg-accent"><div className="h-full rounded-full bg-chart-1" style={{ width: `${(100 * p.correct) / p.total}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="grid content-start gap-3 rounded-2xl bg-card p-6">
                <h3 className="eyebrow">Wrong verdicts ({r.misses.length})</h3>
                <ul className="grid divide-y">
                  {r.misses.map((m) => (
                    <li key={m.post} className="grid gap-1 py-3 first:pt-0 last:pb-0">
                      <p className="text-sm [overflow-wrap:anywhere]">{m.post}…</p>
                      <p className="text-xs text-muted-foreground">{NAMES[m.platform] ?? m.platform} · expected {m.expected.toLowerCase()}, got {m.got.toLowerCase()}</p>
                      <p className="text-[13px] leading-5 text-text-2">{m.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        );
      })}

      <section className="grid gap-4 rounded-2xl bg-card p-6" aria-label="Scraper sample">
        <h2 className="font-heading text-2xl font-bold tracking-[-0.03em]">Scraper sample</h2>
        <div className="-mx-6 overflow-x-auto px-6">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="eyebrow border-b text-left">
              <th className="py-2.5 pr-4">Source</th><th className="py-2.5 pr-4">Status</th>
              {["Time", "Posts", "Bad results", "Leads accepted"].map((h) => <th key={h} className="py-2.5 pl-4 text-right">{h}</th>)}
            </tr></thead>
            <tbody>
              {data.sources.map((s) => (
                <tr key={s.name} className="border-b last:border-0">
                  <td className="py-3.5 pr-4 font-medium">{NAMES[s.name]}</td>
                  <td className="py-3.5 pr-4 capitalize">{s.status.toLowerCase()}</td>
                  <td className="py-3.5 pl-4 text-right tabular">{s.secs} s</td>
                  <td className="py-3.5 pl-4 text-right tabular">{s.posts}</td>
                  <td className="py-3.5 pl-4 text-right tabular">{s.bad}</td>
                  <td className="py-3.5 pl-4 text-right tabular">{s.leads} of {s.unique}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] leading-5 text-muted-foreground">Small capped sample. The two test sets differ, so don&apos;t compare their scores directly. With so few buyers, one post moves the buyer score a lot.</p>
      </section>
    </div>
  );
}
