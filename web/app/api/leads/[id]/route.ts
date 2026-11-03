import { updateLead, type LeadPatch } from "@/lib/db";
import { STATUSES, validDate } from "@/lib/lead-utils";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => null);
  const patch: LeadPatch = {};
  const bad = (msg: string) => Response.json({ error: msg }, { status: 400 });
  if (b?.status !== undefined) {
    if (!STATUSES.includes(b.status)) return bad("Unknown status.");
    patch.status = b.status;
  }
  for (const k of ["reply", "notes"] as const) {
    if (b?.[k] === undefined) continue;
    if (typeof b[k] !== "string" || b[k].length > 4000) return bad(`${k} must be text under 4,000 characters.`);
    patch[k] = b[k];
  }
  if (b?.followUp !== undefined) {
    if (b.followUp !== null && !validDate(b.followUp)) return bad("Follow-up must be a real calendar date.");
    patch.followUp = b.followUp;
  }
  if (!Object.keys(patch).length) return bad("Nothing to change.");
  const lead = await updateLead(id, patch);
  if (!lead) return Response.json({ error: "Lead not found." }, { status: 404 });
  return Response.json({ lead });
}
