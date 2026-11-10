"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowUpRight, Check, CircleAlert, Copy, Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { isFollowUpDue, localDate, PLATFORMS, type Lead, type Priority, type Status } from "@/lib/lead-utils";
import { SLA_MS, useLeads } from "./leads-provider";

export const STATUS_LABEL: Record<Status, string> = {
  new: "Waiting", replied: "Replied", talking: "In conversation", won: "Won", lost: "Lost", skipped: "Skipped",
};
const STEPS: Status[] = ["new", "replied", "talking", "won"];
const STEP_LABEL: Partial<Record<Status, string>> = { new: "Waiting", replied: "Replied", talking: "Talking", won: "Won" };
const SOURCE_LABEL = { scan: "Found by the scan", test: "From the 5-day test", manual: "Added by hand" };
const DOT: Record<Priority, string> = { hot: "bg-hot", warm: "bg-warm", cold: "bg-cold" };

export const fmtDur = (ms: number) => {
  const m = Math.round(Math.abs(ms) / 60000);
  return m < 60 ? `${m} min` : m < 2880 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} days`;
};
const fmtShort = (ms: number) => {
  const m = Math.max(1, Math.round(Math.abs(ms) / 60000));
  return m < 60 ? `${m} m` : m < 1440 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} m` : `${Math.floor(m / 1440)} d`;
};
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

// Short clock for a list row: time left to reply, or where the lead stands once it has moved on.
function leadClock(l: Lead, now: number): { text: string; tone: "soon" | "late" | "quiet" } {
  if (l.status !== "new") return { text: STATUS_LABEL[l.status], tone: "quiet" };
  if (!l.foundAt) return { text: l.postedDate ? fmtDay(l.postedDate) : "", tone: "quiet" };
  const left = Date.parse(l.foundAt) + SLA_MS - now;
  return left >= 0 ? { text: `${fmtShort(left)} left`, tone: "soon" } : { text: `Overdue ${fmtShort(left)}`, tone: "late" };
}
const TONE = { soon: "font-medium", late: "rounded-full bg-rose px-2 font-medium text-ink", quiet: "text-muted-foreground" };

export function LeadRow({ lead: l, reposts, selected, onSelect, index, intro }: {
  lead: Lead; reposts: Lead[]; selected: boolean; onSelect: () => void; index: number; intro: boolean;
}) {
  const { now } = useLeads();
  const clock = leadClock(l, now);
  const meta = [l.priority[0].toUpperCase() + l.priority.slice(1), PLATFORMS[l.platform] ?? l.platform, l.kind[0].toUpperCase() + l.kind.slice(1)];
  if (reposts.length) meta.push(`+${reposts.length} similar`);
  return (
    <li className={cn(intro && "rise")} style={intro ? ({ "--i": Math.min(index, 8) } as React.CSSProperties) : undefined}>
      <button type="button" id={`row-${l.id}`} onClick={onSelect} aria-current={selected ? "true" : undefined}
        className={cn("grid w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1 rounded-2xl px-3.5 py-3 text-left transition-colors duration-150 hover:bg-secondary",
          selected && "bg-gold text-ink shadow-[inset_0_0_0_1px_#111111] hover:bg-gold")}>
        <span className={cn("mt-[7px] size-2 rounded-[3px] ring-1 ring-ink/30", DOT[l.priority])} aria-hidden />
        <span className="truncate text-sm font-medium">{l.author}</span>
        <span className={cn("self-start text-xs leading-5 tabular", TONE[clock.tone], selected && clock.tone === "quiet" && "text-ink")}>{clock.text}</span>
        <span className={cn("col-span-2 col-start-2 line-clamp-2 text-[13px] leading-5", selected ? "text-ink" : "text-text-2")}>{l.why}</span>
        <span className={cn("col-span-2 col-start-2 text-[11px]", selected ? "text-ink" : "text-muted-foreground")}>{meta.join(" · ")}</span>
      </button>
    </li>
  );
}

// The signature: a ruler across the 2-hour reply window. The fill is time already used; it turns red at the deadline.
function ReplyRuler({ lead, now }: { lead: Lead; now: number }) {
  const found = lead.foundAt ? Date.parse(lead.foundAt) : null;
  if (lead.status !== "new" || !found) return null;
  const left = found + SLA_MS - now;
  const late = left < 0;
  const used = Math.max(0, Math.min(1, 1 - left / SLA_MS));
  return (
    <section aria-label="Reply clock" className={cn("grid gap-3 rounded-2xl p-5 text-ink", late ? "bg-rose" : "bg-gold")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <p className="font-heading text-xl font-bold tracking-[-0.03em]">{late ? "Past the 2-hour target" : `Reply by ${fmtTime(found + SLA_MS)}`}</p>
        <p className="text-sm font-medium tabular">{late ? `Overdue ${fmtDur(left)}` : `${fmtDur(left)} left`}</p>
      </div>
      <div className="relative h-5" role="img" aria-label={late ? `Overdue by ${fmtDur(left)}` : `${fmtDur(left)} of the 2-hour target left`}>
        <span className="absolute inset-x-0 top-0 h-1.5 overflow-hidden rounded-full bg-ink/15">
          <span className={cn("block h-full origin-left rounded-full transition-transform duration-1000 ease-[var(--ease-snap)] bg-ink")} style={{ transform: `scaleX(${used})` }} />
        </span>
        {[0, 25, 50, 75, 100].map((p) => (
          <span key={p} className="absolute bottom-0 w-px bg-ink/40" style={{ left: `${p}%`, height: p % 50 === 0 ? 11 : 6, transform: p === 100 ? "translateX(-1px)" : undefined }} />
        ))}
      </div>
      <div className="flex justify-between text-[11px] tabular"><span>Found {fmtTime(found)}</span><span>{fmtTime(found + SLA_MS / 2)}</span><span>{fmtTime(found + SLA_MS)}</span></div>
    </section>
  );
}

function Kbd({ children }: { children: string }) {
  return <kbd className="ml-1 hidden rounded border border-current/25 px-1 text-[10px] leading-4 opacity-70 lg:inline">{children}</kbd>;
}

export type DetailActions = { copy: () => void; markReplied: () => void };

export function LeadDetail({ lead: l, reposts, onBack, actionsRef }: {
  lead: Lead; reposts: Lead[]; onBack: () => void; actionsRef: React.MutableRefObject<DetailActions | null>;
}) {
  const { patch, now } = useLeads();
  const [reply, setReply] = useState(l.reply);
  const [notes, setNotes] = useState(l.notes);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = useRef({ reply: false, notes: false });
  const latest = useRef({ id: l.id, reply, notes });
  latest.current = { id: l.id, reply, notes };

  useEffect(() => { if (!dirty.current.reply) setReply(l.reply); }, [l.reply]);
  useEffect(() => { if (!dirty.current.notes) setNotes(l.notes); }, [l.notes]);
  // Moving to another lead or page saves what was typed, and closing the tab asks first.
  useEffect(() => () => {
    const { id, reply, notes } = latest.current;
    if (dirty.current.reply) void patch(id, { reply });
    if (dirty.current.notes) void patch(id, { notes });
  }, [patch]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current.reply || dirty.current.notes) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const saveText = async (field: "reply" | "notes", value: string) => {
    if (!dirty.current[field]) return true;
    const ok = await patch(l.id, { [field]: value });
    if (ok) { dirty.current[field] = false; setSaved(field === "reply" ? "Draft saved" : "Notes saved"); }
    else setSaved("Not saved. Retry before leaving this page.");
    return ok;
  };
  const setStatus = async (s: Status) => {
    if (s === l.status) return;
    setBusy(true);
    if (await saveText("reply", reply) && await saveText("notes", notes)) {
      await patch(l.id, { status: s }, s === "new" ? "Moved back to waiting" : `Marked ${STATUS_LABEL[s].toLowerCase()}`);
    }
    setBusy(false);
  };
  const copyReply = useCallback(async () => {
    if (!latest.current.reply) return;
    try { await navigator.clipboard.writeText(latest.current.reply); toast.success("Reply copied", { description: "Open the post, review the comment and send it from your own account." }); }
    catch { toast.error("Copy didn't work. Select the draft and copy it manually."); }
  }, []);
  useEffect(() => { actionsRef.current = { copy: copyReply, markReplied: () => { if (l.status === "new") void setStatus("replied"); } }; });

  const followUpDue = isFollowUpDue(l, localDate(now));
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
              <span className="capitalize">{l.kind}</span><span aria-hidden>·</span>
              <span>{SOURCE_LABEL[l.source]}</span>
              {found && <><span aria-hidden>·</span><span>{found}</span></>}
            </p>
            <h2 className="font-heading text-[34px] leading-[1.1] font-bold tracking-[-0.03em] [overflow-wrap:anywhere] lg:text-[40px]">{l.author}</h2>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <PriorityLabel priority={l.priority} />
              <Stage status={l.status} busy={busy} onChange={setStatus} />
            </div>
          </header>

          <ReplyRuler lead={l} now={now} />

          {(l.status === "replied" || l.status === "talking") && (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary p-5">
              <div>
                <h3 className="eyebrow">Follow-up</h3>
                <p className={cn("mt-0.5 text-[13px]", followUpDue ? "text-foreground" : "text-muted-foreground")}>{followUpDue ? "A follow-up is due" : l.followUp ? "Scheduled" : "Pick a day to follow up"}</p>
              </div>
              <Input type="date" aria-label={`Follow-up date for ${l.author}`} value={l.followUp ?? ""} disabled={busy} className="w-44"
                onChange={async (e) => { const v = e.target.value; setBusy(true); await patch(l.id, { followUp: v || null }, v ? "Follow-up scheduled" : "Follow-up cleared"); setBusy(false); }} />
            </section>
          )}

          <section className="grid gap-3">
            <h3 className="eyebrow">The post</h3>
            {closed && <p className="flex items-start gap-2 text-[13px] leading-5 text-foreground"><CircleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} /> This post may be closed. Check the original before reaching out.</p>}
            <div className="grid gap-4 rounded-2xl bg-secondary p-5">
              {l.excerpt ? <p className="text-[15px] leading-7 [overflow-wrap:anywhere]">{l.excerpt}</p> : <p className="text-sm text-muted-foreground">No text was saved for this post.</p>}
              <p className="border-t pt-4 text-[13px] leading-5 text-text-2"><b className="font-medium text-foreground">Why it matches.</b> {l.why}</p>
            </div>
            {reposts.length > 0 && (
              <p className="text-[13px] leading-5 text-muted-foreground">
                Also shared by {reposts.map((r, i) => <span key={r.id}>{i > 0 && ", "}<a href={r.url} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-4 transition-colors hover:text-foreground">{r.author}</a></span>)}.
              </p>
            )}
          </section>

          <section className="grid gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={`reply-${l.id}`} className="eyebrow">Draft reply</label>
              <span className="text-xs text-muted-foreground" role="status">{saved}</span>
            </div>
            <Textarea id={`reply-${l.id}`} value={reply} maxLength={4000} disabled={busy} placeholder="Write a reply that names what they need and invites them to talk."
              className="min-h-40 resize-y text-[15px] leading-7"
              onChange={(e) => { setReply(e.target.value); dirty.current.reply = true; setSaved("Unsaved changes"); }} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button variant="outline" size="sm" disabled={busy || !dirty.current.reply} onClick={async () => { setBusy(true); await saveText("reply", reply); setBusy(false); }}>Save draft</Button>
              <p className="text-xs leading-5 text-muted-foreground">Review it, then post it from your own account. Nothing is sent for you.</p>
            </div>
          </section>

          <section className="grid gap-3">
            <label htmlFor={`notes-${l.id}`} className="eyebrow">Notes</label>
            <Textarea id={`notes-${l.id}`} value={notes} maxLength={4000} disabled={busy} placeholder="Who you spoke to, what they need, the next step."
              className="min-h-24 resize-y text-sm leading-6"
              onChange={(e) => { setNotes(e.target.value); dirty.current.notes = true; setSaved("Unsaved changes"); }} />
            <Button variant="outline" size="sm" className="w-fit" disabled={busy || !dirty.current.notes} onClick={async () => { setBusy(true); await saveText("notes", notes); setBusy(false); }}>Save notes</Button>
          </section>
        </article>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t bg-card px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:px-10">
        <Button onClick={copyReply} disabled={!reply || busy}><Copy strokeWidth={1.5} /> Copy reply <Kbd>C</Kbd></Button>
        <Button variant="outline" asChild><a href={l.url} target="_blank" rel="noopener noreferrer">Open post <ArrowUpRight strokeWidth={1.5} /></a></Button>
        {l.status === "new" && <Button variant="ghost" className="ml-auto" disabled={busy} onClick={() => setStatus("replied")}><Check strokeWidth={1.5} /> Mark replied <Kbd>E</Kbd></Button>}
      </footer>
    </div>
  );
}

// The pipeline as one segmented control; Lost and Skipped sit behind the menu so the main path stays short.
function Stage({ status, busy, onChange }: { status: Status; busy: boolean; onChange: (s: Status) => void }) {
  const off = status === "lost" || status === "skipped";
  return (
    <div role="group" aria-label="Stage" className="flex w-full items-center gap-0.5 rounded-full bg-accent p-1 sm:w-auto">
      {STEPS.map((s) => (
        <button key={s} type="button" disabled={busy} aria-pressed={status === s} onClick={() => onChange(s)}
          className={cn("h-8 flex-1 rounded-full px-3.5 text-[13px] text-text-2 transition-[background-color,color] duration-300 ease-[var(--ease-snap)] hover:text-foreground disabled:opacity-60 sm:flex-none",
            status === s && "bg-gold font-medium text-ink shadow-[inset_0_0_0_1px_#111111] hover:text-ink")}>
          {STEP_LABEL[s]}
        </button>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" disabled={busy} aria-label="More stages" aria-pressed={off}
            className={cn("grid h-8 min-w-8 place-items-center rounded-full px-2 text-[13px] text-text-2 transition-[background-color,color] duration-300 hover:text-foreground disabled:opacity-60",
              off && "bg-gold font-medium text-ink shadow-[inset_0_0_0_1px_#111111]")}>
            {off ? STATUS_LABEL[status] : <Ellipsis className="size-4" strokeWidth={1.5} />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onChange("lost")}>Lost</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onChange("skipped")}>Skipped</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
