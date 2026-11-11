import { leadId, type Lead } from "./lead-utils";

// Demo only: a simulated backend. Every post, person and company here is fictional, and nothing leaves the browser.
const post = (author: string, platform: "linkedin" | "x", slug: string, n: number, kind: Lead["kind"], priority: Lead["priority"], excerpt: string, why: string, reply: string): Lead => {
  const url = platform === "linkedin" ? `https://www.linkedin.com/posts/${slug}_demo-activity-760000000000000010${n}` : `https://x.com/${slug}/status/199000000000000010${n}`;
  return { id: leadId(url), url, platform, author, kind, priority, why, reply, excerpt, query: null, source: "csv", postedDate: null,
    foundAt: null, status: "new", statusAt: null, repliedAt: null, followUp: null, notes: "" };
};

// What one "Fetch posts" run finds.
export const INCOMING: Lead[] = [
  post("Ananya Desai · Crestwave Bank", "linkedin", "crestwave-bank", 1, "training", "hot",
    "Our compliance team needs AI training on reviewing regulatory circulars, and we would like to start this month. Any recommended trainers?",
    "Bank's compliance team asking for AI training on reviewing circulars, with a start date this month.",
    "Hi Ananya, we run AI training for compliance teams, built around reviewing circulars and policies. Happy to share an agenda. DM us."),
  post("@founder_kabir", "x", "founder_kabir", 2, "product", "warm",
    "Looking for a team to build an AI agent that answers sales enquiries on WhatsApp for my startup. Need it live in six weeks.",
    "Founder looking for a team to build an AI agent that answers sales enquiries on WhatsApp.",
    "Hi Kabir, we build WhatsApp AI agents that answer enquiries and hand hot leads to your team. Happy to demo. DM us."),
  post("Lumen Hospitals", "linkedin", "lumen-hospitals", 3, "workshop", "hot",
    "We are planning an AI workshop for 30 hospital administrators. Budget is approved, so please share proposals.",
    "Hospital group asking for an AI workshop for 30 administrators, with a budget mentioned.",
    "Hello, we run AI workshops for hospital administrators, focused on scheduling and reporting. Happy to share a one-day format. DM us."),
  post("Rhea Kapoor · Tidal Foods", "linkedin", "tidal-foods", 4, "product", "warm",
    "We need an AI tool that turns our sales data into weekly insights for regional managers. Looking for a build partner.",
    "FMCG brand wants an AI tool that turns sales data into weekly insights for regional managers.",
    "Hi Rhea, we build AI analytics tools that turn sales data into plain-English weekly insights. Happy to scope it. DM us."),
];

export const SCAN = { linkedin: 214, x: 38, seen: 41 };
export const SCAN_STEPS: [string, number][] = [
  ["Connecting to LinkedIn and X search", 700],
  [`Running 9 buyer-intent searches on LinkedIn: ${SCAN.linkedin} posts`, 1100],
  [`Running 17 searches on X: ${SCAN.x} posts`, 900],
  [`Skipping ${SCAN.seen} posts already seen`, 600],
  [`Screening ${SCAN.linkedin + SCAN.x - SCAN.seen} new posts with AI`, 1400],
];

// Demo stand-in for the AI screener: a keyword score for posts added by hand.
export function screen(text: string): Pick<Lead, "kind" | "priority" | "why" | "reply"> {
  const t = text.toLowerCase();
  const kind: Lead["kind"] = /workshop/.test(t) ? "workshop" : /training|upskill|course/.test(t) ? "training" : /build|develop|app|platform|chatbot|agent|tool|rfp/.test(t) ? "product" : "other";
  const asking = /looking for|need|seeking|recommend|rfp|anyone|hiring a|want/.test(t);
  const priority: Lead["priority"] = asking && /budget|deadline|this (week|month|quarter)|urgent|asap|₹|\$/.test(t) ? "hot" : asking ? "warm" : "cold";
  const need = kind === "workshop" ? "an AI workshop" : kind === "training" ? "AI training for the team" : kind === "product" ? "an AI-powered product" : "help with AI";
  return {
    kind, priority,
    why: asking ? `The author is asking for ${need}.` : "No clear buying request, so worth a manual look.",
    reply: kind === "other" ? "" : `Hi, we ${kind === "product" ? "build AI-powered products" : "run practical AI workshops and training"} and this sounds like a good fit. Happy to share how we'd approach it. DM us.`,
  };
}

export const AGENT_LIMIT = 5;
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Moves the demo dataset so the newest lead is a few hours old, keeping charts and reply clocks current.
export function rebase(leads: Lead[], now = Date.now()): Lead[] {
  const newest = Math.max(...leads.map(l => Date.parse(l.foundAt ?? "") || 0));
  if (!newest) return leads;
  const shift = Math.floor((now - newest - 2 * 3600e3) / 86400e3) * 86400e3; // whole days, so dates keep their weekday spacing
  const iso = (s: string | null) => s && new Date(Date.parse(s) + shift).toISOString();
  const day = (s: string | null) => s && new Date(Date.parse(s) + shift).toISOString().slice(0, 10);
  return leads.map(l => ({ ...l, foundAt: iso(l.foundAt), statusAt: iso(l.statusAt), repliedAt: iso(l.repliedAt), followUp: day(l.followUp) }));
}
