import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { ROOT } from "@/lib/leads";

// Same key as inbox.py: the project's .env, one folder up.
try {
  process.loadEnvFile(path.join(ROOT, ".env"));
} catch {}

// Keep in sync with PROMPT and SCHEMA in inbox.py, so hand-added posts are judged like the hourly scan's.
const PROMPT = `You screen LinkedIn posts for a team that runs AI workshops/trainings and builds AI-powered products.
Is the AUTHOR asking to BUY one of those (wants a workshop/training for their team, or wants a product/app/platform built)?
Public RFPs/tenders inviting vendors to build a platform or deliver training ARE matches, even if shared on someone else's behalf.
Posts by vendors/trainers advertising their own services, job seekers, and generic AI opinion posts are NOT matches.

Reply with JSON only: {"match": true|false, "kind": "workshop"|"training"|"product"|"other", "reason": "<one line>", "reply": "<empty if no match>"}

If it is a match, "reply" is the comment WE post to win the work: 2-3 sentences in first person plural, name their specific need,
say we run AI workshops/build AI products and can help, end by inviting them to DM. No congratulations, no wishing them luck.
If the author is only relaying someone else's need, address the person who needs it.

Post by %s:
%s`;

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["match", "kind", "reason", "reply"],
  properties: {
    match: { type: "boolean" }, kind: { type: "string", enum: ["workshop", "training", "product", "other"] },
    reason: { type: "string" }, reply: { type: "string" },
  },
};

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (typeof b?.author !== "string" || typeof b?.text !== "string" || !b.author.trim() || !b.text.trim()) {
    return Response.json({ error: "Author and post text are required." }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "ANTHROPIC_API_KEY is missing from .env." }, { status: 503 });
  try {
    const msg = await new Anthropic().messages.create({
      model: "claude-haiku-5-5", max_tokens: 1500,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: PROMPT.replace("%s", b.author.slice(0, 200)).replace("%s", b.text.slice(0, 4000)) }],
    });
    const raw = msg.content.find((c) => c.type === "text")?.text ?? "";
    return Response.json(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)));
  } catch (e) {
    return Response.json({ error: "Claude couldn't check the post. Try again." , detail: String(e).slice(0, 200) }, { status: 502 });
  }
}
