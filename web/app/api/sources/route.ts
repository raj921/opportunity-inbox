import { sourceHealth } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ sources: await sourceHealth() });
  } catch {
    return Response.json({ error: "Scan health is unavailable. The worker must run successfully before source status can be verified." }, { status: 503 });
  }
}
