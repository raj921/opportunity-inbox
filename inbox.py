"""Opportunity inbox: LinkedIn posts asking for AI workshops/training or a product build -> Google Sheet + Slack.

Run hourly (GitHub Actions). Each run: search LinkedIn via Apify, skip posts already seen,
ask Claude which are real buyer requests, add those as Sheet rows (and ping Slack) with a draft reply.
"""
import json
import os
import sys
import time
from pathlib import Path

import anthropic
import requests
from apify_client import ApifyClient
from dotenv import dotenv_values

ROOT = Path(__file__).parent
ENV = {**dotenv_values(ROOT / ".env"), **os.environ}  # .env locally, repo secrets in Actions
STATE = ROOT / "state.json"  # {"last_run": epoch, "seen": [post urls]}

# LinkedIn search syntax (quotes, OR, NOT); billed per post returned, so a narrow query that finds nothing is free.
# NOT hiring: "we're looking for an engineer" job ads were half the results without it.
QUERIES = [
    '"looking for" "AI workshop" NOT hiring',
    '"AI training" "for our team" NOT hiring',
    '(recommend OR recommendations) ("AI trainer" OR "AI workshop" OR "AI training") NOT hiring',
    '"looking for" (vendor OR agency OR "service provider") build app NOT hiring',
    '"looking for" (vendor OR agency OR "service provider") develop platform NOT hiring',
    '"looking for" "development partner" NOT hiring',
    'RFP (platform OR LMS OR app) development NOT hiring',
    '"looking for" LMS (provider OR vendor) NOT hiring',
    '"anyone recommend" ("AI agency" OR "AI developer" OR "AI consultant")',
]
MAX_POSTS_PER_QUERY = 25

PROMPT = """You screen LinkedIn posts for a team that runs AI workshops/trainings and builds AI-powered products.
Is the AUTHOR asking to BUY one of those (wants a workshop/training for their team, or wants a product/app/platform built)?
Public RFPs/tenders inviting vendors to build a platform or deliver training ARE matches, even if shared on someone else's behalf.
Posts by vendors/trainers advertising their own services, job seekers, and generic AI opinion posts are NOT matches.

Reply with JSON only: {"match": true|false, "kind": "workshop"|"training"|"product"|"other", "reason": "<one line>", "reply": "<empty if no match>"}

If it is a match, "reply" is the comment WE post to win the work: 2-3 sentences in first person plural, name their specific need,
say we run AI workshops/build AI products and can help, end by inviting them to DM. No congratulations, no wishing them luck.
If the author is only relaying someone else's need, address the person who needs it.

Post by %s:
%s"""

SCHEMA = {"type": "object", "additionalProperties": False, "required": ["match", "kind", "reason", "reply"], "properties": {
    "match": {"type": "boolean"}, "kind": {"type": "string", "enum": ["workshop", "training", "product", "other"]},
    "reason": {"type": "string"}, "reply": {"type": "string"}}}


def posted_limit(last_run, now):
    # 1h window is cheapest, but if a run was missed (laptop asleep) widen so nothing slips through.
    gap = now - last_run
    return "1h" if gap <= 3600 + 600 else "24h" if gap <= 86400 else "week"


def fetch_posts(limit):
    client = ApifyClient(ENV["APIFY_TOKEN"])
    run = client.actor("harvestapi/linkedin-post-search").call(run_input={
        "searchQueries": QUERIES, "sortBy": "date", "postedLimit": limit, "maxPosts": MAX_POSTS_PER_QUERY,
    })
    return client.dataset(run.default_dataset_id).list_items().items


def fields(post):
    return (post.get("linkedinUrl"), (post.get("author") or {}).get("name") or "unknown", post.get("content") or "")


def classify(claude, author, text):
    msg = claude.messages.create(model="claude-haiku-5-5", max_tokens=1500,
                                 output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
                                 messages=[{"role": "user", "content": PROMPT % (author, text[:4000])}])
    raw = next((b.text for b in msg.content if b.type == "text"), "")
    try:
        return json.loads(raw[raw.index("{"):raw.rindex("}") + 1])
    except ValueError:
        # Never silently drop: an unparseable verdict goes to a human.
        return {"match": True, "kind": "other", "reason": "classifier output unparseable, check manually", "reply": ""}


def notify(url, author, verdict):
    text = (f":rotating_light: *{verdict['kind']}* lead from *{author}* (reply within 2h)\n{url}\n"
            f"_{verdict['reason']}_\n> {verdict.get('reply') or ''}")
    if ENV.get("SHEET_WEBHOOK_URL"):  # Apps Script in the Sheet appends one row (sheet_webhook.gs)
        row = {"kind": verdict["kind"], "author": author, "url": url, "reason": verdict["reason"], "reply": verdict.get("reply") or ""}
        requests.post(ENV["SHEET_WEBHOOK_URL"], json=row, timeout=30).raise_for_status()
    if ENV.get("SLACK_WEBHOOK_URL"):
        requests.post(ENV["SLACK_WEBHOOK_URL"], json={"text": text}, timeout=20).raise_for_status()
    if not (ENV.get("SHEET_WEBHOOK_URL") or ENV.get("SLACK_WEBHOOK_URL")):  # nothing set up: local file
        with open(ROOT / "leads.md", "a") as f:
            f.write(f"- {time.strftime('%F %H:%M')} {text}\n\n")


def main():
    now = time.time()
    state = json.loads(STATE.read_text()) if STATE.exists() else {"last_run": 0, "seen": []}
    seen = set(state["seen"])
    claude = anthropic.Anthropic(api_key=ENV["ANTHROPIC_API_KEY"])
    leads = 0
    for post in fetch_posts(posted_limit(state["last_run"], now)):
        url, author, text = fields(post)
        if not url or url in seen or not text:
            continue
        verdict = classify(claude, author, text)
        if verdict.get("match"):
            notify(url, author, verdict)
            leads += 1
        seen.add(url)  # only after notify succeeded, so a Slack failure retries next run
    # Save last_run only after the whole run succeeds, so a crash widens the next window.
    STATE.write_text(json.dumps({"last_run": now, "seen": sorted(seen)[-5000:]}))
    print(f"{time.strftime('%F %T')} leads={leads} seen={len(seen)}")


if __name__ == "__main__":
    if sys.argv[1:] == ["--test"]:
        assert posted_limit(0, 1_000_000) == "week"
        assert posted_limit(1_000_000 - 3600, 1_000_000) == "1h"
        assert posted_limit(1_000_000 - 7200, 1_000_000) == "24h"
        assert fields({"linkedinUrl": "u", "author": {"name": "A"}, "content": "c"}) == ("u", "A", "c")
        assert fields({}) == (None, "unknown", "")
        # LinkedIn rejects a query with more than 5 OR/AND/NOT operators
        assert all(sum(w in ("OR", "AND", "NOT") for w in q.split()) <= 5 for q in QUERIES)
        print("ok")
    else:
        main()
