import { insertLead, listLeads } from "@/lib/db";
import { KINDS, leadId, PRIORITIES } from "@/lib/lead-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ leads: await listLeads() });
}

// "Add a lead": a post someone found by hand, already checked by /api/check.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null);
  const url = str(b?.url, 2000), author = str(b?.author, 200), text = str(b?.text, 20000);
  if (!url || !/^https?:\/\//.test(url) || !author || !text) {
    return Response.json({ error: "Post link, author and post text are required." }, { status: 400 });
  }
  const id = leadId(url);
  const added = await insertLead({
    id, url, author,
    platform: /(^|\.)(x|twitter)\.com\//.test(new URL(url).hostname + "/") ? "x" : "linkedin",
    kind: KINDS.includes(b.kind) ? b.kind : "other",
    priority: PRIORITIES.includes(b.priority) ? b.priority : "warm",
    why: str(b.why, 1000) ?? "Added by hand",
    reply: str(b.reply, 4000) ?? "",
    excerpt: text.replace(/\s+/g, " ").slice(0, 360),
    query: null,
    source: "manual",
    foundAt: new Date().toISOString(),
  });
  if (!added) return Response.json({ error: "This post is already in the inbox.", id }, { status: 409 });
  return Response.json({ id }, { status: 201 });
}
