"use client";

import { useEffect, useRef } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLeads } from "@/components/leads-provider";

export function AgentPanel({ onInspect }: { onInspect: (id: string) => void }) {
  const { agent, leads, startAgent, pauseAgent, resetAgent } = useLeads();
  const demoLeads = leads.filter(lead => lead.query === "autonomous-demo");
  const started = agent.events.length > 0 || demoLeads.length > 0;
  const complete = agent.stage === "Complete — no real posts sent";
  const activityRef = useRef<HTMLDivElement>(null);
  const latestEventId = agent.events[0]?.id;

  useEffect(() => {
    if (activityRef.current) activityRef.current.scrollTop = 0;
  }, [latestEventId]);

  return (
    <section aria-labelledby="agent-heading" className="portal-card grid gap-4">
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="agent-heading" className="text-sm font-medium">Autonomous agent</h2>
          <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-medium text-ink">Demo mode</span>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">Scripted discovery, qualification, comment preparation and checks without approval. Publishing is simulated; no comments are actually published.</p>
      </div>
      <div className="grid gap-2">
        {agent.running
          ? <Button size="sm" variant="outline" onClick={pauseAgent}><Pause strokeWidth={1.5} /> Pause agent</Button>
          : <Button size="sm" onClick={startAgent} disabled={complete}><Play strokeWidth={1.5} /> {complete ? "Demo complete" : started ? "Resume agent" : "Start agent"}</Button>}
        <Button size="sm" variant="outline" onClick={resetAgent} disabled={!started && !agent.running} aria-describedby="agent-reset-note"><RotateCcw strokeWidth={1.5} /> Reset demo</Button>
        <p id="agent-reset-note" className="text-[11px] leading-4 text-muted-foreground">Reset removes only demo leads and activity.</p>
      </div>
      <p role="status" aria-live="polite" aria-atomic="true" className="grid gap-1 border-y py-3 text-xs leading-5">
        <span className="font-medium">{agent.running ? "Running" : complete ? "Complete" : started ? "Not running" : "Ready"}</span>
        <span className="text-muted-foreground">Stage: {agent.stage}</span>
      </p>
      <div className="grid min-w-0 gap-2">
        <h3 id="agent-activity-heading" className="eyebrow">Demo activity · latest first</h3>
        <div ref={activityRef} role="log" aria-labelledby="agent-activity-heading" aria-live="polite" aria-relevant="additions" tabIndex={0} className="quiet-scroll max-h-48 overflow-y-auto rounded-xl [overflow-anchor:none] focus-visible:outline-2 focus-visible:outline-ring xl:max-h-64">
          {agent.events.length > 0 ? <ol className="grid gap-2">
            {agent.events.map(event => {
              const lead = demoLeads.find(item => item.id === event.id.split(":")[0] || item.author === event.author);
              return (
                <li key={event.id} className="grid gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs leading-5">
                  <div className="min-w-0 [overflow-wrap:anywhere]">
                    <p className="flex flex-wrap items-baseline gap-x-2 font-medium">{event.author} <time dateTime={event.at} className="font-normal text-muted-foreground">{new Date(event.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></p>
                    <p className="text-text-2">{event.outcome}</p>
                  </div>
                  {lead && <Button size="xs" variant="outline" className="justify-self-start" onClick={() => onInspect(lead.id)} aria-label={`Inspect demo outcome for ${event.author}`}>Inspect</Button>}
                </li>
              );
            })}
          </ol> : <p className="text-xs leading-5 text-muted-foreground">Start the demo to watch the agent work. No accounts are connected and no live posts are fetched.</p>}
        </div>
      </div>
    </section>
  );
}
