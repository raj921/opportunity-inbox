import { editLead, readLeads, STATUSES, type Lead } from "@/lib/leads";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => null);
  const patch: Partial<Lead> = {};
  if (b?.status !== undefined) {
    if (!STATUSES.includes(b.status)) return Response.json({ error: "Unknown status." }, { status: 400 });
    patch.status = b.status;
    patch.statusAt = b.status === "new" ? null : new Date().toISOString();
  }
  if (b?.reply !== undefined) {
    if (typeof b.reply !== "string" || b.reply.length > 4000) return Response.json({ error: "Reply must be text under 4,000 characters." }, { status: 400 });
    patch.reply = b.reply;
  }
  if (!Object.keys(patch).length) return Response.json({ error: "Nothing to change." }, { status: 400 });
  if (!(await readLeads()).some((l) => l.id === id)) return Response.json({ error: "Lead not found." }, { status: 404 });
  await editLead(id, patch);
  return Response.json({ ok: true });
}
