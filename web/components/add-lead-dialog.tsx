"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/lead-utils";
import { useLeads } from "./leads-provider";
import { PriorityLabel } from "./lead-card";

type Verdict = { match: boolean; kind: string; priority: Priority; reason: string; reply: string };
const EMPTY = { url: "", author: "", text: "" };

export function AddLeadDialog() {
  const { reload, jumpTo } = useLeads();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "check" | "save">("");

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setF({ ...f, [k]: e.target.value });
    setVerdict(null);
    setError("");
  };

  async function check(form: HTMLFormElement | null) {
    if (busy || !form?.reportValidity()) return;
    setBusy("check");
    setError("");
    const r = await fetch("/api/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ author: f.author, text: f.text }) }).catch(() => null);
    const body = await r?.json().catch(() => null);
    setBusy("");
    if (!r?.ok || !body) return setError(body?.error ?? "Claude couldn't check the post. Try again.");
    setVerdict(body);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("save");
    const r = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, kind: verdict?.kind ?? "other", priority: verdict?.priority ?? "warm", why: verdict?.reason ?? "Added by hand; not screened by AI", reply: verdict?.reply ?? "" }) }).catch(() => null);
    const body = await r?.json().catch(() => null);
    setBusy("");
    if (r?.status === 409) {
      setOpen(false);
      toast("Already in the inbox", { description: "This post is already a lead." });
      return jumpTo(body.id);
    }
    if (!r?.ok) return setError(body?.error ?? "Couldn't add the lead. Check your connection.");
    setOpen(false);
    toast.success("Lead added", { description: "It's in Waiting with a 2-hour reply clock." });
    await reload();
    jumpTo(body.id);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (busy) return; setOpen(o); if (o) { setF(EMPTY); setVerdict(null); setError(""); } }}>
      <DialogTrigger asChild>
        <Button><Plus strokeWidth={1.5} /> Add a lead</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={save} className="grid gap-5" id="add-lead">
          <DialogHeader>
            <DialogTitle className="font-heading">Add a lead</DialogTitle>
            <DialogDescription>Save a post from any network. Optionally check buyer intent and generate a tailored reply before adding it.</DialogDescription>
          </DialogHeader>
          <fieldset disabled={!!busy} className="grid min-w-0 gap-4">
            <Field id="f-url" label="Post link"><Input id="f-url" type="url" required maxLength={2000} placeholder="https://www.linkedin.com/posts/…" value={f.url} onChange={set("url")} /></Field>
            <Field id="f-author" label="Author"><Input id="f-author" required maxLength={200} placeholder="Name on the post" value={f.author} onChange={set("author")} /></Field>
            <Field id="f-text" label="Post text"><Textarea id="f-text" required maxLength={20000} placeholder="Paste the post" className="min-h-28" value={f.text} onChange={set("text")} /></Field>
            {verdict && (
              <div className={cn("grid gap-1.5 rounded-xl border p-3 text-sm", verdict.match ? "bg-good/10" : "bg-late/10")}>
                <div className="flex items-center gap-3 font-medium">
                  {verdict.match ? `Real buyer · ${verdict.kind}` : "Not a buyer"}
                  {verdict.match && <PriorityLabel priority={verdict.priority} />}
                </div>
                <p className="text-text-2">{verdict.reason}</p>
              </div>
            )}
            {error && <p className="text-sm text-late" role="alert">{error}</p>}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={!!busy} onClick={(e) => check(e.currentTarget.form)}>
              {busy === "check" ? "Checking…" : "Check with Claude"}
            </Button>
            <Button type="submit" disabled={!!busy}>{busy === "save" ? "Saving…" : !verdict ? "Save without AI" : !verdict.match ? "Add anyway" : "Add to inbox"}</Button>
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
