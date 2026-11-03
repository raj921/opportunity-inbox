// Lead types and pure helpers, shared by the API routes and the browser.

export const KINDS = ["workshop", "training", "product", "other"] as const;
export const PRIORITIES = ["hot", "warm", "cold"] as const;
export const STATUSES = ["new", "replied", "talking", "won", "lost", "skipped"] as const;
export const PLATFORMS = { linkedin: "LinkedIn", x: "X" } as const;
export type Kind = (typeof KINDS)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];

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
  source: "scan" | "test" | "manual";
  postedDate: string | null;
  foundAt: string | null;
  status: Status;
  statusAt: string | null;
  repliedAt: string | null;
  followUp: string | null; // YYYY-MM-DD
  notes: string;
};

// The LinkedIn activity number or the X post number names a post across URL variants. Same as lead_id() in inbox.py.
export function leadId(url: string) {
  const m = url.match(/activity[-:](\d{10,})/);
  if (m) return "li_" + m[1];
  const x = url.match(/(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/);
  if (x) return "x_" + x[1];
  let h = 0;
  for (const c of url) h = (h * 31 + c.charCodeAt(0)) | 0;
  return "url_" + (h >>> 0).toString(36);
}

export const leadTime = (l: Pick<Lead, "foundAt" | "postedDate">) => Date.parse(l.foundAt ?? l.postedDate ?? "") || 0;

const words = (t: string) => new Set(t.toLowerCase().match(/[a-z0-9$]{4,}/g) ?? []);

// One project shared by several people becomes one lead. Measured on real leads: reposts share 59-100% of their
// words, different projects at most 43%, so 50% separates them.
export function groupReposts(leads: Lead[]) {
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
