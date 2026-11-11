"use client";

import { useEffect, useRef } from "react";
import { Bot, Radar, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLeads } from "./leads-provider";

const time = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

// The two backend jobs, simulated for the demo: find buyer posts, then comment on them.
export function AgentConsole() {
  const { log, running, runScan, runAgent, stage, reset } = useLeads();
  const box = useRef<HTMLOListElement>(null);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [log]);
  return (
    <section aria-label="Agent" className="grid gap-3 rounded-2xl bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 className="eyebrow">Agent</h2>
          <p className="text-[13px] text-text-2">{running === "scan" ? "Fetching posts" : running === "agent" ? "Posting comments" : "Finds buyer posts on LinkedIn and X, drafts a comment for each, and posts it when you approve."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" disabled={!!running} onClick={reset}><RotateCcw strokeWidth={1.5} /> Reset demo</Button>
          <Button variant="outline" disabled={!!running} onClick={runScan}><Radar className={cn(running === "scan" && "animate-spin")} strokeWidth={1.5} /> Fetch posts</Button>
          <Button disabled={!!running} onClick={runAgent}><Bot className={cn(running === "agent" && "animate-pulse")} strokeWidth={1.5} /> Run agent</Button>
        </div>
      </div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Pipeline">
        {["Fetch posts", "Screen with AI", "Draft comments", "Post comments"].map((name, i) => (
          <li key={name} className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] transition-colors duration-300",
            stage === i + 1 ? "bg-gold font-medium text-ink" : stage > i + 1 && running ? "bg-mint text-ink" : "bg-secondary text-text-2")}>
            <span className={cn("size-2 shrink-0 rounded-full", stage === i + 1 ? "animate-pulse bg-ink" : "bg-current opacity-40")} aria-hidden />
            {name}
          </li>
        ))}
      </ol>
      {log.length > 0 && (
        <ol ref={box} className="quiet-scroll grid max-h-40 gap-1 overflow-y-auto rounded-xl bg-secondary p-3 text-[13px] leading-5" aria-live="polite">
          {log.map((l, i) => (
            <li key={i} className={cn("flex gap-3", l.tone === "done" && "font-medium")}>
              <span className="shrink-0 tabular text-muted-foreground">{time(l.at)}</span>
              <span className={cn(l.tone === "match" && "rounded-full bg-mint px-2 text-ink")}>{l.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
