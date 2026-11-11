"use client";

import { useLeads } from "@/components/leads-provider";
import { StatStrip } from "@/components/stat-strip";

const SOURCES = [
  { id: "linkedin", name: "LinkedIn", description: "Scripted professional buying signals let the demo agent qualify opportunities and prepare relevant comments. No LinkedIn account is connected." },
  { id: "x", name: "X", description: "Scripted short-form conversations let the demo agent prepare concise comments and simulate outcomes. No X account is connected." },
] as const;

export default function SourcesPage() {
  const { leads } = useLeads();
  const sources = SOURCES.map((source) => {
    const platformLeads = leads.filter((lead) => lead.platform === source.id);
    const demoLeads = platformLeads.filter((lead) => lead.query === "autonomous-demo");
    return {
      ...source,
      savedLeads: platformLeads.length,
      queuedDemoLeads: demoLeads.filter((lead) => lead.status === "new").length,
      simulatedComments: demoLeads.filter((lead) => lead.repliedAt !== null).length,
    };
  });
  const simulatedComments = leads.filter((lead) => lead.query === "autonomous-demo" && lead.repliedAt !== null).length;

  return (
    <div className="portal-page">
      <header className="portal-header">
        <div className="portal-heading">
          <h1 className="portal-title">Sources</h1>
          <p className="portal-description">Explore the autonomous demo with scripted LinkedIn and X fixtures, not live social feeds.</p>
          <p className="portal-notice">Demo mode · no real connections · no comments actually published</p>
        </div>
      </header>

      <StatStrip compact items={[
        { label: "Saved leads", value: leads.length, accent: "gold", note: "All saved platforms" },
        { label: "Demo sources", value: sources.length, accent: "sky", note: "Scripted LinkedIn and X fixtures" },
        { label: "Simulated comments", value: simulatedComments, accent: "mint", note: "Demo leads with a recorded comment time" },
      ]} />

      <div className="portal-grid">
        <div className="grid min-w-0 gap-5">
          <section aria-labelledby="available-sources-title" className="grid min-w-0 gap-4">
            <div className="grid gap-1">
              <h2 id="available-sources-title" className="font-heading text-xl font-bold tracking-[-0.03em]">Available in the demo</h2>
              <p className="text-sm text-muted-foreground">Scripted fixtures ready to explore in Inbox.</p>
            </div>
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              {sources.map((source) => (
                <article key={source.id} className="portal-card flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-heading text-xl font-bold tracking-[-0.03em]">{source.name}</h3>
                    <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">Not connected</span>
                  </div>
                  <p className="w-fit rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-text-2">Scripted demo fixtures available</p>
                  <p className="flex-1 text-sm leading-6 text-text-2">{source.description}</p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-4 border-t pt-4 sm:grid-cols-3">
                    <div><dt className="text-xs text-muted-foreground">Saved leads</dt><dd className="mt-1 font-mono text-xl font-medium tabular">{source.savedLeads}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Queued demo leads</dt><dd className="mt-1 font-mono text-xl font-medium tabular">{source.queuedDemoLeads}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Simulated comments</dt><dd className="mt-1 font-mono text-xl font-medium tabular">{source.simulatedComments}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside aria-label="About demo sources" className="grid min-w-0 gap-5">
          <section className="portal-card grid gap-3">
            <h2 className="font-heading text-lg font-bold tracking-[-0.03em]">Autonomous, not live</h2>
            <p className="text-sm leading-6 text-muted-foreground">Start the agent in Inbox to discover scripted posts, qualify leads, prepare comments, run scripted checks and simulate publishing or skipping. The demo runs without human approval and never fetches or publishes real posts.</p>
          </section>
          <section className="portal-card grid gap-3">
            <h2 className="font-heading text-lg font-bold tracking-[-0.03em]">Inspect every outcome</h2>
            <p className="text-sm leading-6 text-muted-foreground">Inbox activity shows the agent&apos;s stages and decisions. Inspect any fixture to read its prepared comment and simulated result, even after it leaves the new queue. Pause or resume the demo at any time; reset clears only demo leads and activity.</p>
            <p className="border-t pt-3 text-xs leading-5 text-muted-foreground">Simulated comment counts use recorded comment times, including demo leads that later move to another stage.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
