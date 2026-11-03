import { promises as fs } from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(process.cwd(), "..");
const FEED = path.join(ROOT, "leads.jsonl"); // appended by inbox.py every hour, and by "Add a lead"
const EDITS = path.join(ROOT, "leads-state.json"); // what people change in the inbox: status and edited replies

export const STATUSES = ["new", "replied", "skipped"] as const;
export type Status = (typeof STATUSES)[number];
export type Lead = {
  id: string;
  url: string;
  author: string;
  kind: string;
  why: string;
  reply: string;
  excerpt?: string;
  postedDate?: string;
  foundAt?: string;
  source: "hourly" | "test" | "manual";
  status: Status;
  statusAt?: string | null;
};

// The LinkedIn activity number identifies a post across URL variants, so a repost URL tweak doesn't duplicate it.
export function leadId(url: string) {
  const m = url.match(/activity[-:](\d{10,})/);
  if (m) return "li_" + m[1];
  let h = 0;
  for (const c of url) h = (h * 31 + c.charCodeAt(0)) | 0;
  return "url_" + (h >>> 0).toString(36);
}

async function readEdits(): Promise<Record<string, Partial<Lead>>> {
  try {
    return JSON.parse(await fs.readFile(EDITS, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw e;
  }
}

export async function readLeads(): Promise<Lead[]> {
  let raw = "";
  try {
    raw = await fs.readFile(FEED, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const byId = new Map<string, Lead>();
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue; // a line inbox.py is still writing; the next poll reads it whole
    }
    if (!row.url) continue;
    const id = leadId(row.url);
    if (!byId.has(id)) byId.set(id, { status: "new", source: "hourly", ...row, id }); // first sighting keeps its found time
  }
  const edits = await readEdits();
  return [...byId.values()].map((l) => ({ ...l, ...edits[l.id] }));
}

let queue: Promise<unknown> = Promise.resolve();

// Writes go one at a time, so two quick clicks can't overwrite each other's edit.
export function editLead(id: string, patch: Partial<Lead>) {
  const run = queue.then(async () => {
    const edits = await readEdits();
    edits[id] = { ...edits[id], ...patch };
    await fs.writeFile(EDITS + ".tmp", JSON.stringify(edits, null, 1));
    await fs.rename(EDITS + ".tmp", EDITS);
  });
  queue = run.catch(() => {});
  return run;
}

export async function appendLead(row: Omit<Lead, "id" | "status">) {
  await fs.appendFile(FEED, JSON.stringify(row) + "\n");
}
