import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

// Locally the key comes from the project's .env, one folder up (same file as inbox.py); on Vercel from the project env.
try {
  process.loadEnvFile(path.resolve(process.cwd(), "..", ".env"));
} catch {}

import classifier from "@/lib/classifier.json";
const { prompt: PROMPT, schema: SCHEMA } = classifier;

// The link is open to anyone, and each check spends Claude credit, so cap checks per visitor.
// shortcut: per-server-instance memory, a busy abuser across instances gets more; move to a database counter if that happens
const recent = new Map<string, number[]>();
const LIMIT = 20, WINDOW_MS = 3600e3;

export async function POST(req: Request) {
  for (const [key, times] of recent) if (!times.some(t => Date.now() - t < WINDOW_MS)) recent.delete(key);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= LIMIT) return Response.json({ error: "Too many checks this hour. Try again later." }, { status: 429 });
  recent.set(ip, [...hits, now]);

  const b = await req.json().catch(() => null);
  if (typeof b?.author !== "string" || typeof b?.text !== "string" || !b.author.trim() || !b.text.trim()) {
    return Response.json({ error: "Author and post text are required." }, { status: 400 });
  }
  if (b.author.length > 200 || b.text.length > 20000) return Response.json({ error: "Keep the author under 200 characters and the post under 20,000 characters." }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Claude isn't set up on this server." }, { status: 503 });
  try {
    const msg = await new Anthropic().messages.create({
      model: "claude-haiku-5-5", max_tokens: 1500,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: PROMPT.replace("%s", () => b.author.slice(0, 200)).replace("%s", () => b.text.slice(0, 4000)) }],
    });
    const raw = msg.content.find((c) => c.type === "text")?.text ?? "";
    return Response.json(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)));
  } catch {
    return Response.json({ error: "Claude couldn't check the post. Try again." }, { status: 502 });
  }
}
