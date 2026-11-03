"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, CalendarClock, Copy, NotebookPen, Check, Sparkles, Save, MessageSquare, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { localDate, isFollowUpDue, PLATFORMS, STATUSES, type Lead, type Priority, type Status } from "@/lib/lead-utils";
import { SLA_MS, useLeads } from "./leads-provider";

export const STATUS_LABEL: Record<Status, string> = {
  new: "Waiting", replied: "Replied", talking: "In conversation", won: "Won", lost: "Lost", skipped: "Skipped",
};
const SOURCE_LABEL = { scan: "Discovered", test: "5-day test", manual: "Added by hand" };
const PRIORITY_DOT: Record<Priority, string> = { hot: "bg-hot", warm: "bg-warm", cold: "bg-cold" };

export const fmtDur = (ms: number) => {
  const m = Math.round(Math.abs(ms) / 60000);
  return m < 60 ? `${m} min` : m < 2880 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} days`;
};
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function PriorityLabel({ priority }: { priority: Priority }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize text-text-2">
      <span className={cn("size-2 rounded-full", PRIORITY_DOT[priority])} aria-hidden />
      {priority}
    </span>
  );
}

// The signature: a small clock that empties over the 2-hour reply window.
export function ReplyClock({ lead, now }: { lead: Lead; now: number }) {
  if (lead.status !== "new") {
    const done = lead.status === "won" || lead.status === "replied" || lead.status === "talking";
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
        <span className={cn("size-2 rounded-full", done ? "bg-good" : lead.status === "lost" ? "bg-late" : "bg-muted-foreground/50")} aria-hidden />
        {STATUS_LABEL[lead.status]}{lead.statusAt ? ` · ${fmtDay(lead.statusAt)}` : ""}
      </span>
    );
  }
  if (!lead.foundAt) return <span className="font-mono text-xs text-muted-foreground">Posted {lead.postedDate}</span>;
  const left = Date.parse(lead.foundAt) + SLA_MS - now;
  const share = Math.max(0, Math.min(1, left / SLA_MS));
  const r = 7, c = 2 * Math.PI * r;
  return (
    <span className={cn("inline-flex items-center gap-2 font-mono text-xs tabular", left < 0 ? "text-late" : "text-brand-ink")}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="-rotate-90">
        <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
        {left >= 0 && <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - share)} />}
      </svg>
      {left >= 0 ? `${fmtDur(left)} to reply` : `Overdue ${fmtDur(left)}`}
    </span>
  );
}

export function LeadCard({ lead: l, reposts }: { lead: Lead; reposts: Lead[] }) {
  const { patch, now, focus } = useLeads();
  const [reply, setReply] = useState(l.reply);
  const [notes, setNotes] = useState(l.notes);
  const [showNotes, setShowNotes] = useState(!!l.notes);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = useRef({ reply: false, notes: false });
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { if (!dirty.current.reply) setReply(l.reply); }, [l.reply]);
  useEffect(() => { if (!dirty.current.notes) setNotes(l.notes); }, [l.notes]);
  const focused = focus === l.id || reposts.some(r => r.id === focus);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  }, [focused]);

  const saveText = async (field: "reply" | "notes", value: string) => {
    if (!dirty.current[field]) return true;
    const ok = await patch(l.id, { [field]: value });
    if (ok) { dirty.current[field] = false; setSaved(field === "reply" ? "Draft saved" : "Notes saved"); }
    else setSaved("Not saved. Retry before leaving this page.");
    return ok;
  };
  const setStatus = async (s: Status) => {
    setBusy(true);
    if (await saveText("reply", reply) && await saveText("notes", notes)) {
      await patch(l.id, { status: s }, s === "new" ? "Moved back to waiting" : `Marked ${STATUS_LABEL[s].toLowerCase()}`);
    }
    setBusy(false);
  };
  const saveDraft = async () => { setBusy(true); await saveText("reply", reply); setBusy(false); };
  const saveNotes = async () => { setBusy(true); await saveText("notes", notes); setBusy(false); };
  const copyReply = async () => {
    try { await navigator.clipboard.writeText(reply); toast.success("Reply copied", { description: "Open the original post and review your comment before sending." }); }
    catch { toast.error("Copy didn't work. Select the draft and copy it manually."); }
  };
  const followUpDue = isFollowUpDue(l, localDate(now));
  const initials = l.author.split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase();
  return (
    <article ref={ref} id={"lead-" + l.id} className={cn("lead-panel", focused && "ring-2 ring-ring")}>
      <header className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border bg-secondary font-heading text-sm font-semibold text-text-2" aria-hidden>{initials}</span>
        <div className="min-w-0"><h3 className="text-sm font-semibold">{l.author}</h3><p className="mt-1 text-[11px] text-muted-foreground">{PLATFORMS[l.platform] ?? l.platform}<span className="mx-1.5 opacity-40">/</span><span className="capitalize">{l.kind}</span><span className="mx-1.5 opacity-40">/</span>{SOURCE_LABEL[l.source]}</p></div>
        <div className="ml-auto flex flex-wrap items-center gap-3"><PriorityLabel priority={l.priority} /><span className="hidden h-4 w-px bg-border sm:block" /><ReplyClock lead={l} now={now} /></div>
      </header>
      <div className="grid lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">The opportunity</p>
          {/\b(closed|applications? (?:are |is |now )?closed|no longer accepting)\b/i.test(l.excerpt) && <p className="flex items-start gap-2 rounded-lg bg-late/10 p-3 text-xs leading-5 text-late"><CircleAlert className="mt-0.5 size-3.5 shrink-0" /> This post may be closed. Check the original before reaching out.</p>}
          {l.excerpt && <p className="text-sm leading-6 text-text-2 [overflow-wrap:anywhere]">{l.excerpt}</p>}
          <div className="rounded-lg bg-good/5 px-3 py-2.5"><p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-good"><Check className="size-3.5" /> Why it matters</p><p className="text-xs leading-5 text-text-2">{l.why}</p></div>
          {reposts.length > 0 && <p className="text-xs leading-5 text-muted-foreground">Similar posts by {reposts.map((r,i)=><span key={r.id}>{i>0 && ", "}<a href={r.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{r.author}</a></span>)}. <span>Ungroup to manage separately.</span></p>}
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-ink hover:underline">View original post <ArrowUpRight className="size-3.5" /></a>
        </div>
        <div className="flex flex-col gap-3 border-t bg-background/60 p-5 lg:border-t-0 lg:border-l">
          <label htmlFor={"reply-"+l.id} className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"><span className="flex items-center gap-1.5"><Sparkles className="size-3.5 text-brand-ink" /> Outreach draft</span><span className="font-normal normal-case tracking-normal">Make it personal</span></label>
          <Textarea id={"reply-"+l.id} value={reply} maxLength={4000} disabled={busy} placeholder="Write a thoughtful reply to start the conversation…" className="min-h-32 flex-1 resize-y border-transparent bg-card text-xs leading-6 shadow-none" onChange={e=>{setReply(e.target.value);dirty.current.reply=true;setSaved("Unsaved draft");}} />
          <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" disabled={!reply || busy} onClick={copyReply}><Copy /> Copy reply</Button><Button variant="ghost" size="sm" disabled={busy || !dirty.current.reply} onClick={saveDraft}><Save /> Save draft</Button><span className="ml-auto text-[10px] text-muted-foreground" role="status">{saved}</span></div>
        </div>
      </div>
      {showNotes && <div className="grid gap-2 border-t px-5 py-4"><label htmlFor={"notes-"+l.id} className="text-xs font-medium">Conversation notes</label><Textarea id={"notes-"+l.id} value={notes} maxLength={4000} disabled={busy} placeholder="Context, client needs, and the next step…" className="min-h-16 text-sm" onChange={e=>{setNotes(e.target.value);dirty.current.notes=true;setSaved("Unsaved notes");}} /><Button variant="outline" size="sm" className="w-fit" disabled={busy || !dirty.current.notes} onClick={saveNotes}><Save /> Save notes</Button></div>}
      <footer className="flex flex-wrap items-center gap-2 border-t px-5 py-3">
        <MessageSquare className="mr-1 size-3.5 text-muted-foreground" />
        <Select value={l.status} onValueChange={s=>setStatus(s as Status)} disabled={busy}><SelectTrigger aria-label={`Status for ${l.author}`} className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s=><SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent></Select>
        {l.status === "new" && <Button variant="ghost" size="sm" disabled={busy} onClick={()=>setStatus("replied")}><Check /> Mark replied</Button>}
        <Button variant="ghost" size="sm" className="text-muted-foreground" aria-expanded={showNotes} disabled={busy || dirty.current.notes} onClick={()=>setShowNotes(!showNotes)}><NotebookPen /> {showNotes ? "Hide notes" : "Notes"}</Button>
        {(l.status === "replied" || l.status === "talking") && <label className={cn("ml-auto flex items-center gap-2 text-xs",followUpDue ? "text-late" : "text-muted-foreground")}><CalendarClock className="size-3.5" /><span>{followUpDue ? "Follow-up due" : "Follow up"}</span><Input type="date" aria-label={`Follow-up date for ${l.author}`} value={l.followUp ?? ""} disabled={busy} className="h-8 w-36 text-xs" onChange={async e=>{const value=e.target.value;setBusy(true);await patch(l.id,{followUp:value||null},value?"Follow-up scheduled":"Follow-up cleared");setBusy(false);}} /></label>}
      </footer>
    </article>
  );
}
