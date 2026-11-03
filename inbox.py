"""Opportunity inbox: LinkedIn and X posts asking for AI workshops/training or a product build -> the web inbox.

Runs daily (GitHub Actions). Each run: search LinkedIn and X via Apify, skip posts already seen,
ask Claude which are real buyer requests, and save those with a priority and a draft reply
to the Neon database the web inbox reads (or leads.jsonl when no database is set).
"""
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import anthropic
import psycopg
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

# X search: exact phrases only. A loose OR query returned only AI chatter in testing; exact phrases found 5 buyers in 10 posts,
# but they are rare (about 1-2 a month per phrase), so there are several. xquik charges only for posts returned.
X_QUERIES = [
    '"need an app developer"',
    '"looking for an app developer"',
    '"need someone to build an app"',
    '"looking for a developer to build"',
    '"looking for an AI agency"',
    '"recommend an AI consultant"',
    '"AI workshop for our team"',
    '"AI training for our team"',
]
X_MAX_POSTS = 100  # all phrases together, newest first; $0.015 at most
WINDOW_SECONDS = {"1h": 3600, "24h": 86400, "week": 7 * 86400}

PROMPT = """You screen social media posts (LinkedIn, X) for a team that runs AI workshops/trainings and builds AI-powered products.
Is the AUTHOR asking to BUY one of those (wants a workshop/training for their team, or wants a product/app/platform built)?
Public RFPs/tenders inviting vendors to build a platform or deliver training ARE matches, even if shared on someone else's behalf.
Posts by vendors/trainers advertising their own services, job seekers, and generic AI opinion posts are NOT matches.

Reply with JSON only: {"match": true|false, "kind": "workshop"|"training"|"product"|"other", "priority": "hot"|"warm"|"cold", "reason": "<one line>", "reply": "<empty if no match>"}

"priority" ranks how worth chasing a match is: "hot" = the buyer is reachable and the post names a budget, a deadline or a clear scope;
"warm" = a real need with few details; "cold" = aggregated tender lists, needs far from AI workshops or products, or little chance to reach the buyer.

If it is a match, "reply" is the comment WE post to win the work: 2-3 sentences in first person plural, name their specific need,
say we run AI workshops/build AI products and can help, end by inviting them to DM. No congratulations, no wishing them luck.
If the author is only relaying someone else's need, address the person who needs it.

Post by %s:
%s"""

SCHEMA = {"type": "object", "additionalProperties": False, "required": ["match", "kind", "priority", "reason", "reply"], "properties": {
    "match": {"type": "boolean"}, "kind": {"type": "string", "enum": ["workshop", "training", "product", "other"]},
    "priority": {"type": "string", "enum": ["hot", "warm", "cold"]}, "reason": {"type": "string"}, "reply": {"type": "string"}}}


def posted_limit(last_run, now):
    # Slack on each window: scheduled runs start late (GitHub Actions can lag by an hour or more).
    gap = now - last_run
    return "1h" if gap <= 3600 + 600 else "24h" if gap <= 86400 + 3 * 3600 else "week"


def lead_id(url):
    # Same as leadId() in web/lib/lead-utils.ts: the LinkedIn activity number or the X post number names a post
    # across URL variants (x.com / twitter.com, tracking parameters).
    m = re.search(r"activity[-:](\d{10,})", url)
    if m:
        return "li_" + m[1]
    m = re.search(r"(?:twitter|x)\.com/[^/]+/status/(\d+)", url)
    if m:
        return "x_" + m[1]
    h = 0
    for c in url:
        h = (h * 31 + ord(c)) & 0xFFFFFFFF
    return "url_" + base36(h)


def base36(n):
    s = ""
    while True:
        n, r = divmod(n, 36)
        s = "0123456789abcdefghijklmnopqrstuvwxyz"[r] + s
        if not n:
            return s


def run_actor(actor, run_input):
    client = ApifyClient(ENV["APIFY_TOKEN"])
    run = client.actor(actor).call(run_input=run_input)
    # Out of credit, or a free-plan run limit (some actors then "succeed" with empty placeholder items): fail loudly
    # rather than treat it as "no posts".
    if not run or run.status != "SUCCEEDED" or "limit exceeded" in (run.status_message or "").lower():
        raise RuntimeError(f"Apify run of {actor} did not succeed: {run.status if run else 'no run'} {run.status_message if run else ''}")
    return client.dataset(run.default_dataset_id).list_items().items


def fetch_posts(limit, now):
    """Posts from every network as dicts of platform, url, author, text, query, plus how many networks failed."""
    posts, errors = [], 0
    since = time.strftime("%Y-%m-%d", time.gmtime(now - WINDOW_SECONDS[limit]))
    for name, fetch in [
        ("linkedin", lambda: [linkedin_post(p) for p in run_actor("harvestapi/linkedin-post-search", {
            "searchQueries": QUERIES, "sortBy": "date", "postedLimit": limit, "maxPosts": MAX_POSTS_PER_QUERY})]),
        ("x", lambda: [x_post(t) for t in run_actor("xquik/x-tweet-scraper", {
            "searchTerms": [f"{q} since:{since}" for q in X_QUERIES], "queryType": "Latest", "maxItems": X_MAX_POSTS})]),
    ]:
        try:
            posts += fetch()
        except Exception as e:  # one network down must not stop the other
            errors += 1
            print(f"{time.strftime('%F %T')} {name} search failed: {e!r}", file=sys.stderr)
    return posts, errors


def linkedin_post(p):
    return {"platform": "linkedin", "url": p.get("linkedinUrl"), "author": (p.get("author") or {}).get("name") or "unknown",
            "text": p.get("content") or "", "query": (p.get("query") or {}).get("search")}


def x_post(t):
    a = t.get("author") or {}
    return {"platform": "x", "url": t.get("url") or t.get("twitterUrl"), "author": a.get("name") or a.get("userName") or "unknown",
            "text": t.get("fullText") or t.get("text") or "", "query": "X exact phrases"}


def classify(claude, author, text):
    msg = claude.messages.create(model="claude-haiku-5-5", max_tokens=1500,
                                 output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
                                 messages=[{"role": "user", "content": PROMPT % (author, text[:4000])}])
    raw = next((b.text for b in msg.content if b.type == "text"), "")
    try:
        return json.loads(raw[raw.index("{"):raw.rindex("}") + 1])
    except ValueError:
        # Never silently drop: an unparseable verdict goes to a human.
        return {"match": True, "kind": "other", "priority": "warm", "reason": "classifier output unparseable, check manually", "reply": ""}


def save_lead(row):
    if ENV.get("DATABASE_URL"):
        # A retried post is skipped by the primary key, so it is never saved twice.
        with psycopg.connect(ENV["DATABASE_URL"]) as db:
            db.execute("""insert into leads (id, url, platform, author, kind, priority, why, reply, excerpt, query, source, found_at)
                          values (%(id)s, %(url)s, %(platform)s, %(author)s, %(kind)s, %(priority)s, %(why)s, %(reply)s, %(excerpt)s,
                                  %(query)s, %(source)s, %(foundAt)s)
                          on conflict (id) do nothing""", row)
    else:  # no database set up: a local file the web inbox can also read
        with open(ROOT / "leads.jsonl", "a") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def notify(url, author, verdict, post_text="", query=None, platform="linkedin"):
    save_lead({"id": lead_id(url), "url": url, "platform": platform, "author": author, "kind": verdict["kind"], "priority": verdict.get("priority") or "warm",
               "why": verdict["reason"], "reply": verdict.get("reply") or "", "excerpt": " ".join(post_text.split())[:360],
               "query": query, "source": "scan", "foundAt": datetime.now().astimezone().isoformat(timespec="seconds")})
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
    ok = False
    try:
        posts, failed = fetch_posts(posted_limit(state["last_run"], now), now)  # a failed network counts as a failure
        for post in posts:
            url, author, text = post["url"], post["author"], post["text"]
            if not url or url in seen or not text:
                continue
            try:
                verdict = classify(claude, author, text)
                if verdict.get("match"):
                    notify(url, author, verdict, text, post["query"], post["platform"])
                    leads += 1
            except Exception as e:  # one bad post (Claude/Slack/Sheet down) must not stop the rest
                failed += 1
                print(f"{time.strftime('%F %T')} error on {url}: {e!r}", file=sys.stderr)
                continue
            seen.add(url)  # only after notify succeeded, so a failed post is retried next run
        ok = not failed
    finally:
        # Always save seen, so posts already alerted are never alerted twice.
        # Advance last_run only on a clean run, so the next window is wide enough to re-fetch failed posts.
        STATE.write_text(json.dumps({"last_run": now if ok else state["last_run"], "seen": sorted(seen)[-5000:]}))
    print(f"{time.strftime('%F %T')} leads={leads} failed={failed} seen={len(seen)}")
    return failed


if __name__ == "__main__":
    if sys.argv[1:] == ["--test"]:
        assert posted_limit(0, 1_000_000) == "week"
        assert posted_limit(1_000_000 - 3600, 1_000_000) == "1h"
        assert posted_limit(1_000_000 - 7200, 1_000_000) == "24h"
        assert posted_limit(1_000_000 - 86400 - 3600, 1_000_000) == "24h"  # a daily run that started an hour late
        assert lead_id("https://www.linkedin.com/posts/x_y-activity-7523256979247513602-H2j8") == "li_7523256979247513602"
        assert lead_id("https://x.com/steve/status/1985123456789012345?s=20") == "x_1985123456789012345"
        assert lead_id("https://twitter.com/steve/status/1985123456789012345") == "x_1985123456789012345"
        assert lead_id("https://example.com/p/1") == "url_1oa81w1"  # matches leadId() in web/lib/lead-utils.ts
        assert linkedin_post({"linkedinUrl": "u", "author": {"name": "A"}, "content": "c", "query": {"search": "q"}}) == \
            {"platform": "linkedin", "url": "u", "author": "A", "text": "c", "query": "q"}
        assert x_post({"url": "u", "author": {"userName": "a"}, "fullText": "t"})["author"] == "a"
        assert linkedin_post({})["author"] == "unknown"
        # LinkedIn rejects a query with more than 5 OR/AND/NOT operators
        assert all(sum(w in ("OR", "AND", "NOT") for w in q.split()) <= 5 for q in QUERIES)
        # X down: the LinkedIn posts still come through, and the run counts one failure.
        def run_actor(actor, run_input):
            if actor.startswith("xquik"):
                raise RuntimeError("x down")
            return [{"linkedinUrl": "u", "content": "c"}]
        posts, errors = fetch_posts("24h", 1_000_000)
        assert [p["url"] for p in posts] == ["u"] and errors == 1
        # A failing post: the good one is saved as seen, the bad one isn't, and last_run doesn't advance.
        import tempfile
        STATE = Path(tempfile.mkdtemp()) / "state.json"
        ENV.setdefault("ANTHROPIC_API_KEY", "test")
        fetch_posts = lambda limit, now: ([linkedin_post({"linkedinUrl": u, "content": "x"}) for u in ("a", "b")], 0)
        classify = lambda claude, author, text: {"match": True, "kind": "product", "reason": "", "reply": ""}
        def notify(url, author, verdict, post_text="", query=None, platform="linkedin"):
            if url == "b":
                raise RuntimeError("slack down")
        assert main() == 1
        assert json.loads(STATE.read_text()) == {"last_run": 0, "seen": ["a"]}
        print("ok")
    else:
        sys.exit(1 if main() else 0)  # non-zero exit marks the run failed in the log / GitHub Actions
