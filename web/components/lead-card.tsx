"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, CalendarClock, Copy, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PLATFORMS, STATUSES, type Lead, type Priority, type Status } from "@/lib/lead-utils";
import { SLA_MS, useLeads } from "./leads-provider";

export const STATUS_LABEL: Record<Status, string> = {
  new: "Waiting", replied: "Replied", talking: "In conversation", won: "Won", lost: "Lost", skipped: "Skipped",
};
const SOURCE_LABEL = { scan: "Daily scan", test: "5-day test", manual: "Added by hand" };
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
  const editing = useRef<"reply" | "notes" | null>(null);
  const ref = useRef<HTMLElement>(null);

  // A refresh never overwrites text someone is typing.
  useEffect(() => { if (editing.current !== "reply") setReply(l.reply); }, [l.reply]);
  useEffect(() => { if (editing.current !== "notes") setNotes(l.notes); }, [l.notes]);
  useEffect(() => {
    if (focus === l.id) ref.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  }, [focus, l.id]);

  const setStatus = async (s: Status) => {
    setBusy(true);
    await patch(l.id, { status: s }, s === "new" ? "Moved back to waiting" : `Marked ${STATUS_LABEL[s].toLowerCase()}`);
    setBusy(false);
  };
  const saveText = async (field: "reply" | "notes", value: string) => {
    editing.current = null;
    if (value !== l[field] && (await patch(l.id, { [field]: value }))) setSaved(field === "reply" ? "Draft saved" : "Notes saved");
  };
  const copyAndOpen = async () => {
    try {
      await navigator.clipboard.writeText(reply);
      toast.success("Reply copied", { description: "Paste it as a comment on the post, then mark it replied." });
    } catch {
      toast.error("Copy didn't work", { description: "Select the draft and copy it yourself." });
    }
    window.open(l.url, "_blank", "noopener");
  };
  const followUpDue = l.followUp && l.followUp <= new Date(now).toISOString().slice(0, 10) && (l.status === "replied" || l.status === "talking");

  return (
    <article ref={ref} id={"lead-" + l.id}
      className={cn("grid gap-4 rounded-2xl border bg-card p-5 transition-shadow duration-300 md:p-6", focus === l.id && "ring-2 ring-ring")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <PriorityLabel priority={l.priority} />
        <h3 className="text-[15px] font-medium">{l.author}</h3>
        <span className="font-mono text-xs text-muted-foreground">{PLATFORMS[l.platform] ?? l.platform} · {l.kind} · {SOURCE_LABEL[l.source]}</span>
        <span className="ml-auto"><ReplyClock lead={l} now={now} /></span>
      </div>

      {l.excerpt && <p className="line-clamp-4 border-l-2 border-brand pl-3 text-sm leading-6 text-text-2 [overflow-wrap:anywhere]">{l.excerpt}</p>}
      <p className="text-sm leading-6"><span className="text-muted-foreground">Why it&apos;s a lead </span>{l.why}</p>

      {reposts.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Also shared by{" "}
          {reposts.map((r, i) => (
            <span key={r.id}>{i > 0 && ", "}<a href={r.url} target="_blank" rel="noopener" className="text-text-2 underline decoration-border underline-offset-2 hover:text-foreground">{r.author}</a></span>
          ))}
        </p>
      )}

      <div className="grid gap-2">
        <label htmlFor={"reply-" + l.id} className="flex justify-between text-xs text-muted-foreground">
          Draft reply <span>{saved}</span>
        </label>
        <Textarea id={"reply-" + l.id} value={reply} className="min-h-24 resize-y bg-background text-sm leading-6"
          onFocus={() => { editing.current = "reply"; setSaved(""); }}
          onChange={(e) => setReply(e.target.value)}
          onBlur={() => saveText("reply", reply)} />
      </div>

      {showNotes && (
        <div className="grid gap-2">
          <label htmlFor={"notes-" + l.id} className="text-xs text-muted-foreground">Notes</label>
          <Textarea id={"notes-" + l.id} value={notes} placeholder="Who you spoke to, what they need, next step" className="min-h-16 resize-y bg-background text-sm"
            onFocus={() => { editing.current = "notes"; setSaved(""); }}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => saveText("notes", notes)} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={copyAndOpen}><Copy strokeWidth={1.5} /> Copy reply &amp; open post <ArrowUpRight strokeWidth={1.5} /></Button>
        {l.status === "new" && <Button variant="secondary" disabled={busy} onClick={() => setStatus("replied")}>Mark replied</Button>}
        <Select value={l.status} onValueChange={(v) => setStatus(v as Status)} disabled={busy}>
          <SelectTrigger className="w-40" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1">
          {(l.status === "replied" || l.status === "talking") && (
            <label className={cn("flex items-center gap-1.5 text-xs", followUpDue ? "text-late" : "text-muted-foreground")}>
              <CalendarClock className="size-4" strokeWidth={1.5} />
              <span className="sr-only">Follow up on</span>
              <Input type="date" value={l.followUp ?? ""} className="h-8 w-36 text-xs" aria-label="Follow-up date"
                onChange={(e) => patch(l.id, { followUp: e.target.value || null }, e.target.value ? "Follow-up set" : "Follow-up cleared")} />
            </label>
          )}
          {!showNotes && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setShowNotes(true)}>
              <NotebookPen strokeWidth={1.5} /> Notes
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
