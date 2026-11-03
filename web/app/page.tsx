"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lead, Status } from "@/lib/leads";

const SLA = 2 * 3600e3;
const POLL_MS = 15000; // the hourly scan appends to leads.jsonl; this picks new lines up within 15 s
const QUERIES: [string, number, number][] = [
  ['"looking for" "development partner" NOT hiring', 19, 6],
  ['"looking for" (vendor OR agency OR "service provider") develop platform NOT hiring', 17, 6],
  ['"looking for" (vendor OR agency OR "service provider") build app NOT hiring', 20, 2],
  ['"looking for" LMS (provider OR vendor) NOT hiring', 20, 2],
  ['RFP (platform OR LMS OR app) development NOT hiring', 20, 2],
  ['"AI training" "for our team" NOT hiring', 20, 1],
  ['"looking for" "AI workshop" NOT hiring', 20, 0],
  ['(recommend OR recommendations) ("AI trainer" OR "AI workshop" OR "AI training") NOT hiring', 20, 0],
];
type Tab = Status | "all" | "perf";
type Toast = { id: number; title: string; body: string; tone: "" | "ok" | "err"; jump?: string };
type Alert = { id: string; author: string; kind: string; at: number };

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
};
const foundMs = (l: Lead) => (l.foundAt ? Date.parse(l.foundAt) : null);
const sortKey = (l: Lead) => foundMs(l) ?? Date.parse(l.postedDate ?? "0");
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDate = (ms: number) => new Date(ms).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const fmtDur = (ms: number) => {
  const m = Math.round(Math.abs(ms) / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

function sla(l: Lead, now: number): [string, string] {
  if (l.status === "replied") return ["done", "Replied"];
  if (l.status === "skipped") return ["", "Skipped"];
  const f = foundMs(l);
  if (!f) return ["", "From the 5-day test"];
  const left = f + SLA - now;
  return left >= 0 ? ["due", `Reply by ${fmtTime(f + SLA)} · ${fmtDur(left)} left`] : ["late", `Overdue by ${fmtDur(left)}`];
}

function chime() {
  try {
    const a = new AudioContext();
    [660, 880].forEach((f, i) => {
      const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + i * 0.14;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(a.destination);
      o.start(t);
      o.stop(t + 0.32);
    });
  } catch {}
}

export default function Inbox() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [live, setLive] = useState<"connecting" | "on" | "off">("connecting");
  const [checkedAt, setCheckedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>("new");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unseen, setUnseen] = useState(0);
  const [popOpen, setPopOpen] = useState(false);
  const [sound, setSound] = useState(false);
  const [notifyPerm, setNotifyPerm] = useState<NotificationPermission | "unsupported">("default");
  const [flash, setFlash] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const known = useRef<Set<string> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const soundRef = useRef(false);
  soundRef.current = sound;
  const leadsRef = useRef<Lead[] | null>(null);
  leadsRef.current = leads;
  const writes = useRef(0); // bumped around every save, so a refresh that overlapped a save can't undo it on screen

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [{ ...t, id }, ...ts].slice(0, 4));
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.jump ? 9000 : 4000);
  }, []);

  const jumpTo = useCallback((id: string) => {
    const l = leadsRef.current?.find((x) => x.id === id);
    if (l) setTab((t) => (t === "all" || t === l.status ? t : l.status));
    setKind("all");
    setQ("");
    setPopOpen(false);
    setFlash(id);
    setTimeout(() => {
      document.getElementById("c-" + id)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    }, 50);
    setTimeout(() => setFlash(null), 2400);
  }, []);

  const announce = useCallback((fresh: Lead[], since: boolean) => {
    if (!fresh.length) return;
    setAlerts((a) => [...fresh.map((l) => ({ id: l.id, author: l.author, kind: l.kind, at: Date.now() })), ...a].slice(0, 12));
    setUnseen((n) => n + fresh.length);
    const first = fresh[0];
    const title = fresh.length === 1 ? `New ${first.kind} lead from ${first.author}` : `${fresh.length} new leads ${since ? "since your last visit" : "just arrived"}`;
    const body = fresh.length === 1 ? first.why : fresh.slice(0, 3).map((l) => l.author).join(", ") + (fresh.length > 3 ? "…" : "");
    toast({ title, body, tone: "", jump: first.id });
    if (soundRef.current) chime();
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
      const n = new Notification(title, { body, tag: "opportunity-inbox" });
      n.onclick = () => { window.focus(); jumpTo(first.id); n.close(); };
    }
  }, [toast, jumpTo]);

  const load = useCallback(async () => {
    try {
      const startedAt = writes.current;
      const r = await fetch("/api/leads", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const list: Lead[] = (await r.json()).leads;
      if (writes.current !== startedAt) return;
      list.sort((a, b) => sortKey(b) - sortKey(a));
      if (known.current === null) {
        const last = Number(store.get("lastVisit") || 0);
        if (last) announce(list.filter((l) => l.status === "new" && (foundMs(l) ?? 0) > last), true);
      } else {
        announce(list.filter((l) => !known.current!.has(l.id)), false);
      }
      known.current = new Set(list.map((l) => l.id));
      store.set("lastVisit", String(Date.now()));
      setLeads(list);
      setLive("on");
      setCheckedAt(Date.now());
    } catch {
      setLive("off");
    }
  }, [announce]);

  useEffect(() => {
    setSound(store.get("chime") === "1");
    setNotifyPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    load();
    const poll = setInterval(load, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 30000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(poll); clearInterval(clock); window.removeEventListener("focus", onFocus); };
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA/.test((document.activeElement as HTMLElement)?.tagName ?? "");
      if ((e.key === "/" && !typing) || (e.key === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setTab((t) => (t === "perf" ? "new" : t));
        setTimeout(() => searchRef.current?.focus());
      }
      if (e.key === "Escape") setPopOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const counts = useMemo(() => {
    const c = { new: 0, replied: 0, skipped: 0, all: 0, late: 0, today: 0 };
    const dayStart = new Date(now).setHours(0, 0, 0, 0);
    for (const l of leads ?? []) {
      c.all++;
      c[l.status]++;
      const f = foundMs(l);
      if (l.status === "new" && f && f + SLA < now) c.late++;
      if (l.status === "replied" && Date.parse(l.statusAt ?? "0") >= dayStart) c.today++;
    }
    return c;
  }, [leads, now]);

  useEffect(() => {
    document.title = (counts.new ? `(${counts.new}) ` : "") + "Opportunity Inbox";
  }, [counts.new]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (leads ?? []).filter((l) => (tab === "all" || l.status === tab) && (kind === "all" || l.kind === kind)
      && (!s || [l.author, l.why, l.excerpt, l.reply].join(" ").toLowerCase().includes(s)));
  }, [leads, tab, kind, q]);

  async function patch(id: string, body: Partial<Pick<Lead, "status" | "reply">>, okMsg?: string) {
    const prev = leads;
    writes.current++;
    setLeads((ls) => ls?.map((l) => (l.id === id ? { ...l, ...body, statusAt: body.status ? (body.status === "new" ? null : new Date().toISOString()) : l.statusAt } : l)) ?? ls);
    const r = await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    writes.current++;
    if (!r?.ok) {
      setLeads(prev);
      toast({ title: "Couldn't save", body: (await r?.json().catch(() => null))?.error ?? "Is the inbox server still running?", tone: "err" });
      return false;
    }
    if (okMsg) toast({ title: okMsg, body: "", tone: "ok" });
    return true;
  }

  async function copyAndOpen(l: Lead, reply: string) {
    try {
      await navigator.clipboard.writeText(reply);
      toast({ title: "Reply copied", body: "Paste it as a comment on the post, then mark it replied.", tone: "ok" });
    } catch {
      toast({ title: "Copy didn't work", body: "Select the draft text and copy it yourself.", tone: "err" });
    }
    window.open(l.url, "_blank", "noopener");
  }

  const kinds = ["all", ...new Set((leads ?? []).map((l) => l.kind))];
  const tabs: [Tab, string, number | null][] = [["new", "Waiting", counts.new], ["replied", "Replied", counts.replied], ["skipped", "Skipped", counts.skipped], ["all", "All", counts.all], ["perf", "Search performance", null]];

  return (
    <>
      <header className="bar gutter">
        <div className="inner">
          <div className="brand">
            Opportunity Inbox
            <span className={`live ${live === "on" ? "on" : ""}`}><i />
              <span>{live === "on" ? `Live · checked ${fmtTime(checkedAt)}` : live === "off" ? "Can't reach the inbox server" : "Connecting…"}</span>
            </span>
          </div>
          <button className="btn btn-secondary" type="button" onClick={() => setAdding(true)}>Add a lead</button>
          <div style={{ position: "relative" }}>
            <button className="btn btn-secondary btn-icon" type="button" aria-haspopup="true" aria-expanded={popOpen}
              aria-label={unseen ? `Alerts, ${unseen} new` : "Alerts"} onClick={() => { setPopOpen((o) => !o); setUnseen(0); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
              {unseen > 0 && <span className="count">{unseen}</span>}
            </button>
            {popOpen && (
              <div className="pop">
                <h3>Alerts</h3>
                <ul>
                  {alerts.length ? alerts.map((a) => (
                    <li key={a.id + a.at}><button type="button" onClick={() => jumpTo(a.id)}><b>{a.author}</b><span className="meta">{a.kind} · {fmtTime(a.at)}</span></button></li>
                  )) : <li className="meta" style={{ padding: "6px 10px 10px" }}>New leads show up here while this page is open.</li>}
                </ul>
                <div className="row">
                  <label className="switch" htmlFor="chime">
                    <input type="checkbox" id="chime" checked={sound} onChange={(e) => { setSound(e.target.checked); store.set("chime", e.target.checked ? "1" : "0"); if (e.target.checked) chime(); }} />
                    Play a sound for new leads
                  </label>
                </div>
                <div className="row">
                  {notifyPerm === "granted" ? <span>Desktop notifications are on.</span>
                    : notifyPerm === "denied" ? <span>Desktop notifications are blocked in your browser settings.</span>
                    : notifyPerm === "unsupported" ? <span>This browser can't show desktop notifications.</span>
                    : <button className="btn btn-secondary" type="button" onClick={async () => setNotifyPerm(await Notification.requestPermission())}>Turn on desktop notifications</button>}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="desk gutter">
        <div className="inner">
          <div>
            <div className="eyebrow">LinkedIn lead finder · checks every hour</div>
            <h1>{leads === null ? "Loading leads…" : counts.new === 0 ? "All caught up. No leads waiting." : `${counts.new} lead${counts.new > 1 ? "s" : ""} waiting for a reply`}</h1>
            <p>People on LinkedIn asking to buy an AI workshop, AI training or a product build. Claude picks the real buyers and drafts a reply; you post it from your own account within 2 hours.</p>
          </div>
          <div className="stats">
            <div className="stat"><b>{counts.new}</b><span>Waiting</span></div>
            <div className={`stat ${counts.late ? "warn" : ""}`}><b>{counts.late}</b><span>Overdue (over 2 h)</span></div>
            <div className="stat"><b>{counts.today}</b><span>Replied today</span></div>
            <div className="stat"><b>{counts.all}</b><span>All leads</span></div>
          </div>
        </div>
      </section>

      <main className="gutter">
        <div className="inner">
          <div className="tabs" role="tablist">
            {tabs.map(([id, label, n]) => (
              <button key={id} className="tab" role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)}>
                {label}{n !== null && <span className="n">{n}</span>}
              </button>
            ))}
          </div>

          {tab === "perf" ? (
            <div style={{ display: "grid", gap: 12 }}>
              <p className="caption">5-day test, 29 Oct to 3 Nov 2026: 156 posts checked, 19 real buyers. Up to 20 most relevant posts per search.</p>
              <div className="panel">
                <table>
                  <thead><tr><th>Search</th><th style={{ textAlign: "right" }}>Posts</th><th style={{ textAlign: "right" }}>Leads</th><th>Hit rate</th></tr></thead>
                  <tbody>
                    {QUERIES.map(([query, p, n]) => {
                      const pct = Math.round((100 * n) / p);
                      return (
                        <tr key={query}><td><code>{query}</code></td><td className="num">{p}</td><td className="num">{n}</td>
                          <td><div className="meter"><div className="t"><i style={{ width: `${pct}%` }} /></div><span>{pct}%</span></div></td></tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              <div className="toolbar">
                <label className="search" htmlFor="q">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  <span className="sr">Search leads</span>
                  <input id="q" ref={searchRef} type="search" placeholder="Search author, need or reply" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
                  <kbd>/</kbd>
                </label>
                <div className="seg" role="group" aria-label="Filter by type">
                  {kinds.map((k) => (
                    <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{k === "all" ? "All types" : k[0].toUpperCase() + k.slice(1)}</button>
                  ))}
                </div>
              </div>
              {live === "off" && <div className="notice">The inbox server isn't answering. Check that <code>npm run dev</code> is still running in the web folder.</div>}
              <div className="list">
                {leads === null ? <><div className="skeleton" /><div className="skeleton" /></>
                  : shown.length ? shown.map((l) => <LeadCard key={l.id} lead={l} now={now} flash={flash === l.id} onPatch={patch} onOpen={copyAndOpen} />)
                  : <div className="empty">{q || kind !== "all" ? "No leads match. Clear the search or pick another type." : tab === "new" ? "No leads waiting. New ones appear here as soon as the hourly scan finds them." : "Nothing here yet."}</div>}
              </div>
            </div>
          )}
          <footer>New leads arrive from the hourly LinkedIn scan. Reposts of one project can show up as separate leads.</footer>
        </div>
      </main>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            <span className="dot" /><b>{t.title}</b>
            {t.jump && <button className="btn btn-secondary" type="button" onClick={() => { jumpTo(t.jump!); setToasts((ts) => ts.filter((x) => x.id !== t.id)); }}>Show</button>}
            {t.body && <p>{t.body}</p>}
          </div>
        ))}
      </div>

      {adding && <AddLead onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); toast({ title: "Lead added", body: "It's in Waiting with a 2-hour reply timer.", tone: "ok" }); load().then(() => jumpTo(id)); }} onExists={(id) => { setAdding(false); toast({ title: "Already in the inbox", body: "This post is already a lead.", tone: "err" }); jumpTo(id); }} />}
    </>
  );
}

function LeadCard({ lead: l, now, flash, onPatch, onOpen }: {
  lead: Lead; now: number; flash: boolean;
  onPatch: (id: string, body: Partial<Pick<Lead, "status" | "reply">>, okMsg?: string) => Promise<boolean>;
  onOpen: (l: Lead, reply: string) => void;
}) {
  const [reply, setReply] = useState(l.reply);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setReply(l.reply); }, [l.reply]); // a poll never overwrites a draft being typed
  const [cls, label] = sla(l, now);
  const f = foundMs(l);
  const src = { hourly: "Hourly scan", test: "5-day test", manual: "Added by hand" }[l.source] ?? "Hourly scan";
  const when = l.postedDate ? `Posted ${l.postedDate}` : f ? `Found ${fmtDate(f)}` : "";
  const setStatus = async (s: Status, msg: string) => { setBusy(true); await onPatch(l.id, { status: s }, msg); setBusy(false); };

  return (
    <article className={`lead ${flash ? "flash" : ""}`} id={"c-" + l.id}>
      <div className="lead-top">
        <span className={`badge k-${l.kind}`}>{l.kind}</span>
        <span className="author">{l.author}</span>
        <span className="meta">{when} · {src}</span>
        <span className={`badge sla ${cls}`}>{label}</span>
      </div>
      {l.excerpt && <p className="excerpt">{l.excerpt}</p>}
      <p className="why"><b>Why it&apos;s a lead:</b> {l.why}</p>
      <div className="draft">
        <label htmlFor={"r-" + l.id}>Draft reply <span>{saved}</span></label>
        <textarea id={"r-" + l.id} value={reply}
          onFocus={() => { editing.current = true; setSaved(""); }}
          onChange={(e) => setReply(e.target.value)}
          onBlur={async () => { editing.current = false; if (reply !== l.reply && (await onPatch(l.id, { reply }))) setSaved("Saved"); }} />
      </div>
      <div className="actions">
        <button className="btn btn-primary" type="button" onClick={() => onOpen(l, reply)}>Copy reply &amp; open post ↗</button>
        {l.status === "new" ? (
          <>
            <button className="btn btn-mint" type="button" disabled={busy} onClick={() => setStatus("replied", "Marked replied")}>Mark replied</button>
            <button className="btn btn-tertiary" type="button" disabled={busy} onClick={() => setStatus("skipped", "Skipped")}>Skip</button>
          </>
        ) : (
          <button className="btn btn-tertiary" type="button" disabled={busy} onClick={() => setStatus("new", "Moved back to waiting")}>Move back to waiting</button>
        )}
        {l.status !== "new" && l.statusAt && <span className="who">{l.status === "replied" ? "Replied" : "Skipped"} {fmtDate(Date.parse(l.statusAt))}</span>}
      </div>
    </article>
  );
}

type Verdict = { match: boolean; kind: string; reason: string; reply: string };

function AddLead({ onClose, onAdded, onExists }: { onClose: () => void; onAdded: (id: string) => void; onExists: (id: string) => void }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [f, setF] = useState({ url: "", author: "", text: "" });
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { dlg.current?.showModal(); }, []);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setF({ ...f, [k]: e.target.value }); setVerdict(null); setMsg(null); };

  async function check() {
    if (!form.current?.reportValidity()) return;
    setBusy(true);
    setMsg({ tone: "", text: "Claude is reading the post…" });
    const r = await fetch("/api/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ author: f.author, text: f.text }) }).catch(() => null);
    const body = await r?.json().catch(() => null);
    setBusy(false);
    if (!r?.ok || !body) return setMsg({ tone: "no", text: body?.error ?? "Claude couldn't check the post. Try again." });
    setVerdict(body);
    setMsg({ tone: body.match ? "yes" : "no", text: (body.match ? `Real buyer · ${body.kind}. ` : "Not a buyer. ") + body.reason });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!verdict) return;
    setBusy(true);
    const r = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, kind: verdict.kind, why: verdict.reason, reply: verdict.reply }) }).catch(() => null);
    const body = await r?.json().catch(() => null);
    setBusy(false);
    if (r?.status === 409) return onExists(body.id);
    if (!r?.ok) return setMsg({ tone: "no", text: body?.error ?? "Couldn't add the lead. Is the inbox server running?" });
    onAdded(body.id);
  }

  return (
    <dialog ref={dlg} aria-labelledby="addTitle" onClose={onClose}>
      <form ref={form} onSubmit={save}>
        <div className="dlg-head"><h2 id="addTitle">Add a lead</h2><button className="btn btn-tertiary" type="button" aria-label="Close" onClick={onClose}>✕</button></div>
        <div className="dlg-body">
          <p>Found a post yourself? Paste it here. Claude checks if it&apos;s a real buyer and drafts a reply, using the same rules as the hourly scan.</p>
          <div className="field"><label htmlFor="fUrl">Post link</label><input id="fUrl" type="url" required placeholder="https://www.linkedin.com/posts/…" value={f.url} onChange={set("url")} /></div>
          <div className="field"><label htmlFor="fAuthor">Author</label><input id="fAuthor" required placeholder="Name on the post" value={f.author} onChange={set("author")} /></div>
          <div className="field"><label htmlFor="fText">Post text</label><textarea id="fText" required placeholder="Paste the post" value={f.text} onChange={set("text")} /></div>
          {msg && <div className={`verdict ${msg.tone}`}>{msg.text}</div>}
        </div>
        <div className="dlg-foot">
          <button className="btn btn-tertiary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-secondary" type="button" disabled={busy} onClick={check}>Check with Claude</button>
          <button className="btn btn-primary" type="submit" disabled={busy || !verdict}>{verdict && !verdict.match ? "Add anyway" : "Add to inbox"}</button>
        </div>
      </form>
    </dialog>
  );
}
