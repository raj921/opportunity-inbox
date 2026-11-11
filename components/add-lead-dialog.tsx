"use client";

import { screen, sleep } from "@/lib/simulation";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ACTIVE_PLATFORMS, leadId, parsePostUrl, postPlatform, type Lead } from "@/lib/lead-utils";
import { useLeads } from "./leads-provider";

const EMPTY = { url: "", author: "", text: "" };

export function AddLeadDialog() {
  const { add, jumpTo } = useLeads();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setF({ ...f, [k]: e.target.value });
    setError("");
  };

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !e.currentTarget.reportValidity()) return;
    const url = parsePostUrl(f.url.trim());
    if (!url) return setError("Enter a valid public HTTP or HTTPS post link.");
    const platform = postPlatform(url);
    if (!Object.hasOwn(ACTIVE_PLATFORMS, platform)) return setError("Only LinkedIn and X post links are supported.");
    const author = f.author.trim();
    const excerpt = f.text.trim();
    if (!author || !excerpt) return setError("Enter an author and post text.");
    const lead: Lead = {
      id: leadId(url.href), url: url.href, platform, author,
      ...screen(excerpt), excerpt,
      query: null, source: "manual", postedDate: null, foundAt: new Date().toISOString(),
      status: "new", statusAt: null, repliedAt: null, followUp: null, notes: "",
    };
    setBusy(true);
    setError("");
    try {
      await sleep(900); // the demo screener stands in for the AI check
      if (!await add(lead)) {
        setError("This post may already be in the inbox, or it could not be saved.");
        return;
      }
      setOpen(false);
      toast.success(lead.kind === "other" ? "Lead added for a manual look" : `Screened: ${lead.priority} ${lead.kind} lead`, { description: lead.why });
      jumpTo(lead.id);
    } catch {
      setError("Couldn't save the lead. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (busy) return; setOpen(o); if (o) { setF(EMPTY); setError(""); } }}>
      <DialogTrigger asChild>
        <Button><Plus strokeWidth={1.5} /> Add a lead</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={save} className="grid gap-5" id="add-lead">
          <DialogHeader>
            <DialogTitle className="font-heading">Add a lead</DialogTitle>
            <DialogDescription>Save a LinkedIn or X post to your inbox and draft a comment. Demo mode · fictional data, simulated fetching and posting.</DialogDescription>
          </DialogHeader>
          <fieldset disabled={busy} className="grid min-w-0 gap-4">
            <Field id="f-url" label="Post link"><Input id="f-url" type="url" required maxLength={2000} placeholder="https://www.linkedin.com/posts/…" value={f.url} onChange={set("url")} /></Field>
            <Field id="f-author" label="Author"><Input id="f-author" required maxLength={200} placeholder="Name on the post" value={f.author} onChange={set("author")} /></Field>
            <Field id="f-text" label="Post text"><Textarea id="f-text" required maxLength={20000} placeholder="Paste the post" className="min-h-28" value={f.text} onChange={set("text")} /></Field>
            {error && <p className="text-sm text-foreground" role="alert">{error}</p>}
          </fieldset>
          <DialogFooter>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Add to inbox"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
