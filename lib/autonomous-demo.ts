import type { Lead } from "@/lib/lead-utils";

export type AgentEvent = { id: string; author: string; outcome: string; at: string };
export type AgentState = { running: boolean; stage: string; events: AgentEvent[] };

type Stage = "discover" | "qualify" | "draft" | "check" | "publish";
type Fixture = {
  id: string;
  url: string;
  platform: "linkedin" | "x";
  author: string;
  kind: Lead["kind"];
  priority: Lead["priority"];
  excerpt: string;
  qualification: string;
  draft: string;
  check: string;
  passes: boolean;
};

const STAGES: Stage[] = ["discover", "qualify", "draft", "check", "publish"];
const JOURNAL = "[autonomous-demo-events] ";
const LABELS: Record<Stage, string> = {
  discover: "Discovering a fictional post",
  qualify: "Qualifying with scripted criteria",
  draft: "Preparing a scripted reply",
  check: "Checking the scripted reply",
  publish: "Simulating publication — no real posting",
};

// Every person, post, draft, and evaluation below is fictional and prewritten.
// Platform-shaped URLs are illustrative identifiers, not verified live posts.
const FIXTURES: Fixture[] = [
  {
    id: "autonomous-demo-linkedin-workshop",
    url: "https://www.linkedin.com/posts/fictional-mira-example_ai-workshop-activity-9000000000000000001-demo",
    platform: "linkedin",
    author: "Mira Example (fictional)",
    kind: "workshop",
    priority: "hot",
    excerpt: "FICTIONAL DEMO POST: Our small design team wants a practical AI workshop. Looking for ideas that help us prototype responsibly, not another slide deck.",
    qualification: "Scripted qualification: PASS — explicit request for a practical team workshop; relevant, public business context.",
    draft: "A hands-on session built around one real design workflow can be a useful starting point. What does your team most want to prototype? Happy to share a sample workshop outline.",
    check: "Scripted safety check: PASS — relevant, helpful question; no private data, unsupported claims, or pressure. No live moderation or AI evaluation was performed.",
    passes: true,
  },
  {
    id: "autonomous-demo-x-product",
    url: "https://x.com/fictionalTheoDemo/status/9000000000000000002",
    platform: "x",
    author: "Theo Sample (fictional)",
    kind: "product",
    priority: "warm",
    excerpt: "FICTIONAL DEMO POST: Building an internal knowledge-search tool for our ops team. Any tips for validating an AI prototype before we invest in a full rollout?",
    qualification: "Scripted qualification: PASS — specific product discovery need and a request for practical advice.",
    draft: "Start with a small set of representative questions and compare the prototype against your current search workflow. Track answer usefulness and source quality before expanding. Which knowledge sources are in scope?",
    check: "Scripted safety check: PASS — actionable, on-topic advice without guarantees or unsolicited links. No live moderation or AI evaluation was performed.",
    passes: true,
  },
  {
    id: "autonomous-demo-linkedin-rejected",
    url: "https://www.linkedin.com/posts/fictional-nova-example_training-activity-9000000000000000003-demo",
    platform: "linkedin",
    author: "Nova Placeholder (fictional)",
    kind: "training",
    priority: "cold",
    excerpt: "FICTIONAL DEMO POST: Exploring AI training for our sales team. We are still figuring out what a realistic outcome would look like.",
    qualification: "Scripted qualification: PASS — a relevant training inquiry; any reply must avoid unsubstantiated performance promises.",
    draft: "Our AI training will guarantee that your sales double in a week.",
    check: "Scripted safety check: REJECTED — the prepared draft makes an unsupported revenue guarantee. Skipped automatically; this reply was not published, even in simulation. No live moderation or AI evaluation was performed.",
    passes: false,
  },
];

type DemoStep = { fixture: Fixture; stage: Stage; label: string };

export function isDemoLead(lead: Lead) {
  return lead.query === "autonomous-demo";
}

function journalEvents(lead: Lead): AgentEvent[] {
  if (!isDemoLead(lead)) return [];
  const line = lead.notes.split("\n").find(value => value.startsWith(JOURNAL));
  if (!line) return [];
  try {
    const values: unknown = JSON.parse(line.slice(JOURNAL.length));
    if (!Array.isArray(values)) return [];
    return values.filter((event): event is AgentEvent => {
      if (!event || typeof event !== "object") return false;
      const value = event as AgentEvent;
      return typeof value.id === "string" && STAGES.some(stage => value.id === `${lead.id}:${stage}`)
        && value.author === lead.author && typeof value.outcome === "string"
        && typeof value.at === "string" && Number.isFinite(Date.parse(value.at));
    });
  } catch {
    return [];
  }
}

export function demoEvents(leads: Lead[]): AgentEvent[] {
  return leads.flatMap(journalEvents).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}

// Keep the execution checkpoint when a user edits a demo lead's visible notes.
export function preserveDemoJournal(lead: Lead, notes: string) {
  if (!isDemoLead(lead)) return notes;
  const journal = lead.notes.split("\n").find(line => line.startsWith(JOURNAL));
  const visible = notes.split("\n").filter(line => !line.startsWith(JOURNAL)).join("\n");
  return journal ? `${visible}\n${journal}` : visible;
}

export function nextDemoStep(leads: Lead[]): DemoStep | null {
  for (const fixture of FIXTURES) {
    const existing = leads.find(lead => lead.id === fixture.id);
    // Never overwrite a non-demo lead, even if its identifier collides.
    if (existing && !isDemoLead(existing)) continue;
    if (existing && existing.status !== "new") continue;
    const events = existing ? journalEvents(existing) : [];
    const stage = STAGES.find(value => (value !== "publish" || fixture.passes) && !events.some(event => event.id === `${fixture.id}:${value}`));
    if (stage) return { fixture, stage, label: LABELS[stage] };
  }
  return null;
}

export function applyDemoStep(leads: Lead[], step: DemoStep, at: string): Lead[] {
  const { fixture, stage } = step;
  const existing = leads.find(lead => lead.id === fixture.id);
  if (existing && !isDemoLead(existing)) return leads;
  if (stage === "publish" && !fixture.passes) return leads;
  const lead: Lead = existing ? { ...existing } : {
    id: fixture.id,
    url: fixture.url,
    platform: fixture.platform,
    author: fixture.author,
    kind: fixture.kind,
    priority: fixture.priority,
    why: "Fictional autonomous demo opportunity. Qualification has not run yet.",
    reply: "",
    excerpt: fixture.excerpt,
    query: "autonomous-demo",
    source: "manual",
    postedDate: null,
    foundAt: at,
    status: "new",
    statusAt: at,
    repliedAt: null,
    followUp: null,
    notes: "AUTONOMOUS DEMO ONLY. Fictional author and post; illustrative, unverified platform URL. All drafts and checks are scripted. No external service is contacted and no real reply is posted.",
  };
  const events = journalEvents(lead);
  if (events.some(event => event.id === `${fixture.id}:${stage}`)) return leads;
  let outcome: string;
  switch (stage) {
    case "discover":
      outcome = `Discovered a fictional ${fixture.platform === "x" ? "X" : "LinkedIn"} fixture locally. No live search performed.`;
      break;
    case "qualify":
      lead.why = fixture.qualification;
      outcome = fixture.qualification;
      break;
    case "draft":
      lead.reply = fixture.draft;
      outcome = "Prepared the prewritten, scripted demo reply. No AI request was made.";
      break;
    case "check":
      outcome = fixture.check;
      if (!fixture.passes) {
        lead.status = "skipped";
        lead.statusAt = at;
      }
      break;
    case "publish":
      // Publication is a local state transition only, never a network request.
      lead.status = "replied";
      lead.statusAt = at;
      lead.repliedAt = at;
      outcome = "SIMULATED PUBLICATION: scripted checks passed; automatically marked replied without human approval. Nothing was sent to LinkedIn or X.";
      break;
  }
  const event: AgentEvent = { id: `${fixture.id}:${stage}`, author: fixture.author, outcome, at };
  const visible = lead.notes.split("\n").filter(line => !line.startsWith(JOURNAL)).join("\n");
  lead.notes = `${visible}\n${outcome}\n${JOURNAL}${JSON.stringify([...events, event])}`;
  return existing ? leads.map(value => value.id === lead.id ? lead : value) : [lead, ...leads];
}
