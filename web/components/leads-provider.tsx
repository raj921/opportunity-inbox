"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { groupReposts, leadTime, type Lead } from "@/lib/lead-utils";
import type { LeadPatch } from "@/lib/lead-utils";

const POLL_MS = 30000; // the scan adds leads once a day; this also picks up teammates' changes
export const SLA_MS = 2 * 3600e3;

type Alert = { id: string; author: string; kind: string; at: number };
type Ctx = {
  leads: Lead[] | null;
  groups: ReturnType<typeof groupReposts>;
  live: "connecting" | "on" | "off";
  checkedAt: number;
  now: number;
  alerts: Alert[];
  unseen: number;
  markSeen: () => void;
  sound: boolean;
  setSound: (on: boolean) => void;
  reload: () => Promise<void>;
  patch: (id: string, body: LeadPatch, okMsg?: string) => Promise<boolean>;
  focus: string | null;
  jumpTo: (id: string) => void;
};

const LeadsContext = createContext<Ctx | null>(null);
export const useLeads = () => useContext(LeadsContext)!;

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
};

export function chime() {
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
    setTimeout(() => { void a.close(); }, 650);
  } catch {}
}

export function LeadsProvider({ children }: { children: React.ReactNode }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [live, setLive] = useState<Ctx["live"]>("connecting");
  const [checkedAt, setCheckedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unseen, setUnseen] = useState(0);
  const [sound, setSoundState] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const known = useRef<Set<string> | null>(null);
  const writes = useRef(0); // bumped around every save, so a refresh that overlapped a save can't undo it on screen
  const pending = useRef(new Map<string, Promise<boolean>>());
  const refresh = useRef(0);
  const soundRef = useRef(false);
  soundRef.current = sound;

  const jumpTo = useCallback((id: string) => {
    setFocus(id);
    setTimeout(() => setFocus((f) => (f === id ? null : f)), 2400);
  }, []);

  const announce = useCallback((fresh: Lead[], since: boolean) => {
    if (!fresh.length) return;
    setAlerts((a) => [...fresh.map((l) => ({ id: l.id, author: l.author, kind: l.kind, at: Date.now() })), ...a].slice(0, 12));
    setUnseen((n) => n + fresh.length);
    const first = fresh[0];
    const title = fresh.length === 1 ? `New ${first.priority} ${first.kind} lead from ${first.author}`
      : `${fresh.length} new leads ${since ? "since your last visit" : "just arrived"}`;
    const body = fresh.length === 1 ? first.why : fresh.slice(0, 3).map((l) => l.author).join(", ") + (fresh.length > 3 ? "…" : "");
    toast(title, { description: body, duration: 9000, action: { label: "Show", onClick: () => jumpTo(first.id) } });
    if (soundRef.current) chime();
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
      const n = new Notification(title, { body, tag: "opportunity-inbox" });
      n.onclick = () => { window.focus(); jumpTo(first.id); n.close(); };
    }
  }, [jumpTo]);

  const reload = useCallback(async () => {
    try {
      const startedAt = writes.current;
      const request = ++refresh.current;
      if (pending.current.size) return;
      const r = await fetch("/api/leads", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const list: Lead[] = (await r.json()).leads;
      if (writes.current !== startedAt || pending.current.size || request !== refresh.current) return;
      if (known.current === null) {
        const last = Number(store.get("lastVisit") || 0);
        if (last) announce(list.filter((l) => l.status === "new" && leadTime(l) > last), true);
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
    setSoundState(store.get("chime") === "1");
    reload();
    const poll = setInterval(reload, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 30000);
    window.addEventListener("focus", reload);
    return () => { clearInterval(poll); clearInterval(clock); window.removeEventListener("focus", reload); };
  }, [reload]);

  const patch = useCallback(async (id: string, body: LeadPatch, okMsg?: string) => {
    // Serialize writes to the same lead. Apply only confirmed server data; no list-wide rollback.
    const task = (pending.current.get(id) ?? Promise.resolve(true)).then(async () => {
      writes.current++;
      const r = await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
      const data = await r?.json().catch(() => null);
      writes.current++;
      if (!r?.ok || !data?.lead) {
        toast.error("Couldn't save", { description: data?.error ?? "Your edit hasn't been saved. Check your connection and retry." });
        return false;
      }
      setLeads(ls => ls?.map(l => l.id === id ? data.lead : l) ?? ls);
      if (okMsg) toast.success(okMsg);
      return true;
    });
    pending.current.set(id, task);
    try { return await task; }
    finally { if (pending.current.get(id) === task) pending.current.delete(id); }
  }, []);

  const groups = useMemo(() => groupReposts(leads ?? []), [leads]);
  const value: Ctx = {
    leads, groups, live, checkedAt, now, alerts, unseen, focus, jumpTo, reload, patch,
    markSeen: () => setUnseen(0),
    sound,
    setSound: (on) => { setSoundState(on); store.set("chime", on ? "1" : "0"); if (on) chime(); },
  };
  return <LeadsContext.Provider value={value}>{children}</LeadsContext.Provider>;
}
