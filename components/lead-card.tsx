"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, CircleAlert, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PLATFORMS, type Lead, type Priority, type Status } from "@/lib/lead-utils";
import { useLeads } from "./leads-provider";

export const STATUS_LABEL: Record<Status, string> = {
  new: "Ready to comment", replied: "Commented", talking: "In conversation", won: "Won", lost: "Lost", skipped: "Skipped",
};
const DOT: Record<Priority, string> = { hot: "bg-hot", warm: "bg-warm", cold: "bg-cold" };

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function PriorityLabel({ priority }: { priority: Priority }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium capitalize text-text-2">
      <span className={cn("size-2 rounded-[3px] ring-1 ring-ink/30", DOT[priority])} aria-hidden />
      {priority}
    </span>
  );
}

export function LeadRow({ lead: l, reposts, selected, onSelect, index, intro, posting }: {
  lead: Lead; reposts: Lead[]; selected: boolean; onSelect: () => void; index: number; intro: boolean; posting?: boolean;
}) {
  const meta = [l.priority[0].toUpperCase() + l.priority.slice(1), PLATFORMS[l.platform] ?? l.platform, l.kind[0].toUpperCase() + l.kind.slice(1)];
  if (reposts.length) meta.push(`+${reposts.length} similar`);
  return (
    <li className={cn(intro && "rise")} style={intro ? ({ "--i": Math.min(index, 8) } as React.CSSProperties) : undefined}>
      <button type="button" id={`row-${l.id}`} onClick={onSelect} aria-current={selected ? "true" : undefined}
        className={cn("grid w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1 rounded-2xl px-3.5 py-3 text-left transition-colors duration-150 hover:bg-secondary",
          selected && "bg-gold text-ink shadow-[inset_0_0_0_1px_#111111] hover:bg-gold")}>
        <span className={cn("mt-[7px] size-2 rounded-[3px] ring-1 ring-ink/30", DOT[l.priority])} aria-hidden />
        <span className="truncate text-sm font-medium">{l.author}</span>
        {posting ? <span className="animate-pulse self-start rounded-full bg-mint px-2 text-xs leading-5 font-medium text-ink">Posting</span>
          : <span className={cn("self-start text-xs leading-5", selected ? "text-ink" : "text-muted-foreground")}>{STATUS_LABEL[l.status]}</span>}
        <span className={cn("col-span-2 col-start-2 line-clamp-2 text-[13px] leading-5", selected ? "text-ink" : "text-text-2")}>{l.why}</span>
        <span className={cn("col-span-2 col-start-2 text-[11px]", selected ? "text-ink" : "text-muted-foreground")}>{meta.join(" · ")}</span>
      </button>
    </li>
  );
}

export function LeadDetail({ lead: l, reposts, onBack }: {
  lead: Lead; reposts: Lead[]; onBack: () => void;
}) {
  const { patch } = useLeads();
  const [reply, setReply] = useState(l.reply);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const latest = useRef({ id: l.id, reply });
  latest.current = { id: l.id, reply };

  useEffect(() => { if (!dirty.current) setReply(l.reply); }, [l.reply]);
  // Preserve a draft when moving to another lead or page.
  useEffect(() => () => {
    const { id, reply } = latest.current;
    if (dirty.current) void patch(id, { reply });
  }, [patch]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const saveDraft = async () => {
    if (busy || !dirty.current) return;
    setBusy(true);
    if (await patch(l.id, { reply })) {
      dirty.current = false;
      setSaved("Draft saved");
    } else setSaved("Not saved. Retry before leaving this page.");
    setBusy(false);
  };

  const closed = /\b(closed|applications? (?:are |is |now )?closed|no longer accepting)\b/i.test(l.excerpt);
  const found = l.foundAt ? `Found ${fmtDay(l.foundAt)}, ${fmtTime(Date.parse(l.foundAt))}` : l.postedDate ? `Posted ${l.postedDate}` : "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="quiet-scroll min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto grid max-w-[720px] gap-8 px-5 py-6 lg:px-9 lg:py-9">
          <header className="grid gap-4">
            <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground lg:hidden" onClick={onBack}><ArrowLeft /> Inbox</Button>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{PLATFORMS[l.platform] ?? l.platform}</span><span aria-hidden>·</span>
              <span className="capitalize">{l.kind}</span>
              {l.source === "manual" && <><span aria-hidden>·</span><span>Added by hand</span></>}
              {found && <><span aria-hidden>·</span><span>{found}</span></>}
            </p>
            <div className="flex items-center justify-between gap-4">
              <h2 className="min-w-0 font-heading text-2xl leading-tight font-bold tracking-[-0.03em] [overflow-wrap:anywhere]">{l.author}</h2>
              <span className="shrink-0"><PriorityLabel priority={l.priority} /></span>
            </div>
          </header>

          <section className="grid gap-3">
            <h3 className="eyebrow">The post</h3>
            {closed && <p className="flex items-start gap-2 text-[13px] leading-5 text-foreground"><CircleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} /> This post may be closed. Check the original before reaching out.</p>}
            <div className="grid gap-4 rounded-2xl bg-secondary p-5">
              {l.excerpt && <p className="text-[15px] leading-7 [overflow-wrap:anywhere]">{l.excerpt}</p>}
              <p className={cn("text-[13px] leading-5 text-text-2", l.excerpt && "border-t pt-4")}><b className="font-medium text-foreground">Why it matches.</b> {l.why}</p>
            </div>
            {reposts.length > 0 && (
              <p className="text-[13px] leading-5 text-muted-foreground">
                Also shared by {reposts.map((r, i) => <span key={r.id}>{i > 0 && ", "}<a href={r.url} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-4 transition-colors hover:text-foreground">{r.author}</a></span>)}.
              </p>
            )}
          </section>

          <section className="grid gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={`reply-${l.id}`} className="eyebrow">Draft comment</label>
              <span className="text-xs text-muted-foreground" role="status">{saved}</span>
            </div>
            <Textarea id={`reply-${l.id}`} value={reply} maxLength={4000} disabled={busy} placeholder="Write a helpful comment that speaks to what they need."
              className="min-h-40 resize-y text-[15px] leading-7"
              onChange={(e) => { setReply(e.target.value); dirty.current = true; setSaved("Unsaved changes"); }} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button variant="outline" size="sm" disabled={busy || !dirty.current} onClick={saveDraft}>Save draft</Button>
              <p className="text-xs leading-5 text-muted-foreground">Demo mode: posting is simulated</p>
            </div>
          </section>
        </article>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t bg-card px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:px-10">
        {l.status === "new" && <Button disabled={busy || !reply} onClick={async () => {
          setBusy(true);
          if (await patch(l.id, { reply, status: "replied" }, "Comment posted (demo)")) dirty.current = false;
          setBusy(false);
        }}><Send strokeWidth={1.5} /> Post comment</Button>}
        {l.repliedAt && <p className="flex items-center gap-2 rounded-full bg-mint px-3.5 py-2 text-[13px] font-medium text-ink"><Check className="size-4" strokeWidth={2} /> Comment posted {fmtDay(l.repliedAt)}, {fmtTime(Date.parse(l.repliedAt))}</p>}
        {/* Demo leads are fictional, so only hand-added posts link out. */}
        {l.source === "manual" && <Button variant="outline" asChild><a href={l.url} target="_blank" rel="noopener noreferrer">Open post <ArrowUpRight strokeWidth={1.5} /></a></Button>}
      </footer>
    </div>
  );
}
