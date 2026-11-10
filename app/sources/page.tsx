"use client";

import { toast } from "sonner";
import { useLeads } from "@/components/leads-provider";
import { Button } from "@/components/ui/button";

const SOURCES = [
  { id: "linkedin", name: "LinkedIn", connected: true, description: "Review business requests and prepare relevant comments for professional conversations." },
  { id: "x", name: "X", connected: true, description: "Explore short-form buying signals and draft concise comments that join the conversation." },
  { id: "reddit", name: "Reddit", connected: false, description: "Community discovery and comment drafting are not connected for Reddit." },
  { id: "facebook", name: "Facebook", connected: false, description: "Group discovery and comment drafting are not connected for Facebook." },
] as const;

export default function SourcesPage() {
  const { leads } = useLeads();

  return (
    <div className="portal-page">
      <header className="portal-header">
        <div className="portal-heading">
          <h1 className="portal-title">Sources</h1>
          <p className="portal-description">Discover potential customers and prepare thoughtful comments on LinkedIn and X.</p>
          <p id="connection-preview" className="portal-notice">Preview only · no live accounts or posting</p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {SOURCES.map(({ id, name, connected, description }) => {
          const platformLeads = leads.filter(lead => lead.platform === id);
          return (
            <article key={id} className="flex flex-col rounded-2xl border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="w-fit rounded-xl border bg-secondary px-3 py-2 font-mono text-sm font-medium text-text-2">{name}</span>
                <Button
                  type="button"
                  size="sm"
                  variant={connected ? "secondary" : "outline"}
                  aria-label={`${name}: ${connected ? "Connected" : "Not connected"}`}
                  aria-describedby="connection-preview"
                  onClick={() => toast.info(`${name} connection preview`, { description: "No live integrations are enabled. No account is connected and no posts or comments are fetched or published." })}
                >
                  {connected ? "Connected" : "Not connected"}
                </Button>
              </div>
              <h2 className="mt-6 font-heading text-2xl font-bold tracking-[-0.03em]">{name}</h2>
              <p className="mt-4 flex-1 text-sm leading-6 text-text-2">{description}</p>
              <dl className="mt-5 grid grid-cols-3 gap-4 border-t pt-5">
                <div><dt className="text-[13px] text-muted-foreground">Leads in inbox</dt><dd className="mt-1.5 text-2xl font-medium tracking-[-0.03em] tabular">{platformLeads.length}</dd></div>
                <div><dt className="text-[13px] text-muted-foreground">Ready to comment</dt><dd className="mt-1.5 text-2xl font-medium tracking-[-0.03em] tabular">{platformLeads.filter(lead => lead.status === "new").length}</dd></div>
                <div><dt className="text-[13px] text-muted-foreground">Comments recorded</dt><dd className="mt-1.5 text-2xl font-medium tracking-[-0.03em] tabular">{platformLeads.filter(lead => lead.repliedAt).length}</dd></div>
              </dl>
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border p-6"><h3 className="eyebrow">Discover the right conversations</h3><p className="mt-2 text-[13px] leading-6 text-muted-foreground">Review buying signals, open a post for context and decide whether your business can help.</p></div>
        <div className="rounded-2xl border p-6"><h3 className="eyebrow">You stay in control</h3><p className="mt-2 text-[13px] leading-6 text-muted-foreground">Prepare a relevant comment and record its status in your inbox. Connection labels and activity are a preview, not evidence of live discovery or posting.</p></div>
      </div>
    </div>
  );
}
