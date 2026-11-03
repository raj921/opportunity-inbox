import { appendLead, leadId, readLeads } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ leads: await readLeads() });
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
  if ((await readLeads()).some((l) => l.id === id)) {
    return Response.json({ error: "This post is already in the inbox.", id }, { status: 409 });
  }
  const kind = ["workshop", "training", "product", "other"].includes(b.kind) ? b.kind : "other";
  await appendLead({
    url, author, kind,
    why: str(b.why, 1000) ?? "Added by hand",
    reply: str(b.reply, 4000) ?? "",
    excerpt: text.replace(/\s+/g, " ").slice(0, 360),
    source: "manual",
    foundAt: new Date().toISOString(),
  });
  return Response.json({ id }, { status: 201 });
}
