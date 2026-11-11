// Lead types and pure helpers shared by the CSV loader and browser.

export const KINDS = ["workshop", "training", "product", "other"] as const;
export const PRIORITIES = ["hot", "warm", "cold"] as const;
export const STATUSES = ["new", "replied", "talking", "won", "lost", "skipped"] as const;
export const PLATFORMS = { linkedin: "LinkedIn", x: "X", reddit: "Reddit", bluesky: "Bluesky", facebook: "Facebook", other: "Other" } as const;
export const ACTIVE_PLATFORMS = { linkedin: "LinkedIn", x: "X" } as const;
export type Kind = (typeof KINDS)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];
export type LeadPatch = { status?: Status; reply?: string; notes?: string; followUp?: string | null };

export function parsePostUrl(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch { return null; }
}

export function postPlatform(url: URL): keyof typeof PLATFORMS {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "linkedin.com") return "linkedin";
  if (host === "x.com" || host === "twitter.com") return "x";
  if (host === "reddit.com" || host === "old.reddit.com") return "reddit";
  if (host === "bsky.app") return "bluesky";
  if (host === "facebook.com" || host === "m.facebook.com") return "facebook";
  return "other";
}

export const localDate = (ms = Date.now()) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const validDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
export const isFollowUpDue = (l: Lead, today: string) => !!l.followUp && l.followUp <= today && ["replied", "talking"].includes(l.status);
export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
}

export function leadsCsv(leads: Lead[]) {
  const cell = (v: unknown) => {
    const s = String(v ?? "");
    // Spreadsheet apps evaluate formulas even inside quoted CSV fields.
    return '"' + (/^[\s]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"';
  };
  return [
    ["Author", "Platform", "Type", "Priority", "Status", "Found", "Follow-up", "Post", "Why", "Draft comment", "Notes", "Commented at", "Status changed"],
    ...leads.map(l => [l.author, PLATFORMS[l.platform], l.kind, l.priority, l.status, l.foundAt ?? l.postedDate, l.followUp, l.url, l.why, l.reply, l.notes, l.repliedAt, l.statusAt]),
  ].map(row => row.map(cell).join(",")).join("\r\n");
}

export type Lead = {
  id: string;
  url: string;
  platform: keyof typeof PLATFORMS;
  author: string;
  kind: Kind;
  priority: Priority;
  why: string;
  reply: string;
  excerpt: string;
  query: string | null;
  source: "csv" | "manual";
  postedDate: string | null;
  foundAt: string | null;
  status: Status;
  statusAt: string | null;
  repliedAt: string | null;
  followUp: string | null; // YYYY-MM-DD
  notes: string;
};

// The LinkedIn activity number or the X post number names a post across URL variants.
export function leadId(url: string) {
  const m = url.match(/activity[-:](\d{10,})/);
  if (m) return "li_" + m[1];
  const parsed = parsePostUrl(url);
  const host = parsed?.hostname.replace(/^www\./, "");
  const x = host === "x.com" || host === "twitter.com" ? parsed?.pathname.match(/\/[^/]+\/status\/(\d+)/) : null;
  if (x) return "x_" + x[1];
  const reddit = host === "reddit.com" || host === "old.reddit.com" ? parsed?.pathname.match(/\/r\/[^/]+\/comments\/([a-z0-9]+)/) : null;
  if (reddit) return "reddit_" + reddit[1];
  let h = 0;
  for (const c of url) h = (h * 31 + c.codePointAt(0)!) | 0;
  return "url_" + (h >>> 0).toString(36);
}

export const leadTime = (l: Pick<Lead, "foundAt" | "postedDate">) => Date.parse(l.foundAt ?? l.postedDate ?? "") || 0;

const words = (t: string) => new Set(t.toLowerCase().match(/[a-z0-9$]{4,}/g) ?? []);

export type LeadGroup = { lead: Lead; reposts: Lead[] };

// ponytail: similarity is a heuristic, not identity. The inbox can show individual posts when grouping is wrong.
export function groupReposts(leads: Lead[]): LeadGroup[] {
  const groups: { lead: Lead; reposts: Lead[]; words: Set<string> }[] = [];
  for (const l of [...leads].sort((a, b) => leadTime(a) - leadTime(b))) {
    const w = words(l.excerpt);
    const g = w.size >= 8 && groups.find((g) => {
      let shared = 0;
      for (const x of w) if (g.words.has(x)) shared++;
      return shared / (w.size + g.words.size - shared) >= 0.5;
    });
    if (g) g.reposts.push(l);
    else groups.push({ lead: l, reposts: [], words: w });
  }
  return groups.map(({ lead, reposts }) => ({ lead, reposts }));
}
