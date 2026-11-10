"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ACTIVE_PLATFORMS, groupReposts, KINDS, parsePostUrl, postPlatform, PRIORITIES, STATUSES, validDate, type Lead, type LeadGroup, type LeadPatch } from "@/lib/lead-utils";

const STORAGE_KEY = "opportunity-inbox:business-agent-v1:leads";

type Alert = { id: string; author: string; kind: string; at: number };
type Ctx = {
  leads: Lead[];
  groups: LeadGroup[];
  now: number;
  alerts: Alert[];
  unseen: number;
  markSeen: () => void;
  sound: boolean;
  setSound: (on: boolean) => void;
  add: (lead: Lead) => Promise<boolean>;
  patch: (id: string, body: LeadPatch, okMsg?: string) => Promise<boolean>;
  focus: string | null;
  jumpTo: (id: string) => void;
};

const LeadsContext = createContext<Ctx | null>(null);
export const useLeads = () => useContext(LeadsContext)!;

function isActiveLead(value: unknown): value is Lead {
  if (!value || typeof value !== "object") return false;
  const lead = value as Lead;
  const url = typeof lead.url === "string" ? parsePostUrl(lead.url) : null;
  return !!url && Object.hasOwn(ACTIVE_PLATFORMS, lead.platform) && postPlatform(url) === lead.platform
    && [lead.id, lead.author, lead.why, lead.reply, lead.excerpt, lead.notes].every(v => typeof v === "string")
    && !!lead.id && KINDS.includes(lead.kind) && PRIORITIES.includes(lead.priority) && STATUSES.includes(lead.status)
    && (lead.source === "csv" || lead.source === "manual")
    && (lead.query === null || typeof lead.query === "string")
    && [lead.postedDate, lead.followUp].every(v => v === null || validDate(v))
    && [lead.foundAt, lead.statusAt, lead.repliedAt].every(v => v === null || (typeof v === "string" && Number.isFinite(Date.parse(v))));
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
    setTimeout(() => { void a.close(); }, 650);
  } catch {}
}

export function LeadsProvider({ children, initialLeads }: { children: React.ReactNode; initialLeads: Lead[] }) {
  const activeInitial = useMemo(() => initialLeads.filter(isActiveLead), [initialLeads]);
  const [leads, setLeads] = useState(activeInitial);
  const current = useRef(activeInitial);
  const [now, setNow] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unseen, setUnseen] = useState(0);
  const [sound, setSoundState] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const restored: unknown = JSON.parse(saved);
        if (!Array.isArray(restored)) throw new Error("Invalid saved leads");
        const initialIds = new Set(activeInitial.map(lead => lead.id));
        const active = restored.filter(value => isActiveLead(value) && (value.source !== "csv" || initialIds.has(value.id)));
        if (restored.length && !active.length) throw new Error("No supported saved leads");
        current.current = active;
        setLeads(active);
        if (active.length !== restored.length) {
          toast.error("Some saved leads were omitted", { description: "Removed or unsupported opportunities were not restored." });
        }
      }
      setSoundState(localStorage.getItem("chime") === "1");
    } catch {
      toast.error("Couldn't restore saved changes", { description: "Showing the initial opportunities." });
    }
    setNow(Date.now());
    const clock = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(clock);
  }, []);

  const jumpTo = useCallback((id: string) => {
    setFocus(id);
    setTimeout(() => setFocus(f => f === id ? null : f), 2400);
  }, []);

  const save = useCallback((next: Lead[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      toast.error("Couldn't save your edit", { description: "Your edit hasn't been saved. Please try again." });
      return false;
    }
    current.current = next;
    setLeads(next);
    return true;
  }, []);

  const patch = useCallback(async (id: string, body: LeadPatch, okMsg?: string) => {
    const existing = current.current.find(l => l.id === id);
    if (!existing) return false;
    const stamp = new Date().toISOString();
    const updated = { ...existing, ...body };
    if (body.status && body.status !== existing.status) {
      updated.statusAt = stamp;
      if (body.status === "replied" && !updated.repliedAt) updated.repliedAt = stamp;
    }
    if (!save(current.current.map(l => l.id === id ? updated : l))) return false;
    if (okMsg) toast.success(okMsg);
    return true;
  }, [save]);

  const add = useCallback(async (lead: Lead) => {
    if (!isActiveLead(lead)) {
      toast.error("Only valid LinkedIn and X leads can be added");
      return false;
    }
    if (current.current.some(l => l.id === lead.id)) {
      toast.error("This post is already in the inbox");
      return false;
    }
    if (!save([lead, ...current.current])) return false;
    setAlerts(a => [{ id: lead.id, author: lead.author, kind: lead.kind, at: Date.now() }, ...a].slice(0, 12));
    setUnseen(n => n + 1);
    if (sound) chime();
    return true;
  }, [save, sound]);

  const groups = useMemo(() => groupReposts(leads), [leads]);
  const value: Ctx = {
    leads, groups, now, alerts, unseen, focus, jumpTo, add, patch,
    markSeen: () => setUnseen(0),
    sound,
    setSound: on => {
      setSoundState(on);
      try { localStorage.setItem("chime", on ? "1" : "0"); } catch {}
      if (on) chime();
    },
  };
  return <LeadsContext.Provider value={value}>{children}</LeadsContext.Provider>;
}
