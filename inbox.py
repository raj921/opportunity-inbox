"""Opportunity inbox: LinkedIn and X posts asking for AI workshops/training or a product build -> the web inbox.

Runs daily (GitHub Actions). Search LinkedIn, X and optionally Reddit via Apify; skip seen posts,
ask Claude which are real buyer requests, and save those with a priority and a draft reply
to the Neon database the web inbox reads. LOCAL_ONLY=1 explicitly enables offline JSONL export.
"""
import json
import os
import re
import sys
import time
import tempfile
from decimal import Decimal
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlsplit

import anthropic
import psycopg
import requests
from apify_client import ApifyClient
from dotenv import dotenv_values

ROOT = Path(__file__).parent
ENV = {"DATABASE_URL": dotenv_values(ROOT / "web/.env.local").get("DATABASE_URL"), **dotenv_values(ROOT / ".env"), **os.environ}  # .env locally, repo secrets in Actions
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

# X search: exact phrases first, because they find buyers but are rare (about 1-2 a month each). The LinkedIn searches follow for reach;
# they are noisier, so the classifier filters them. X writes NOT as a leading minus. xquik charges only for posts returned.
X_QUERIES = [
    '"need an app developer"',
    '"looking for an app developer"',
    '"need someone to build an app"',
    '"looking for a developer to build"',
    '"looking for an AI agency"',
    '"recommend an AI consultant"',
    '"AI workshop for our team"',
    '"AI training for our team"',
] + [q.replace("NOT ", "-") for q in QUERIES]
X_MAX_POSTS = 100  # bounded across all phrases; current pricing is set by the actor
REDDIT_QUERIES = ['"looking for" "app developer"', '"AI training" "team"', '"looking for" "development partner"']
WINDOW_SECONDS = {"1h": 3600, "24h": 86400, "week": 7 * 86400}

# One contract for scheduled and hand-added posts; Vercel ships web/ as its project root.
CLASSIFIER = json.loads((ROOT / "web/lib/classifier.json").read_text())
PROMPT, SCHEMA = CLASSIFIER["prompt"], CLASSIFIER["schema"]


def posted_limit(last_run, now):
    # Round UP: a delayed daily run needs a week, not a 24-hour window with a gap.
    gap = now - last_run
    return "1h" if gap <= 3600 else "24h" if gap <= 86400 else "week"


def lead_id(url):
    # Same as leadId() in web/lib/lead-utils.ts: the LinkedIn activity number or the X post number names a post
    # across URL variants (x.com / twitter.com, tracking parameters).
    m = re.search(r"activity[-:](\d{10,})", url)
    if m:
        return "li_" + m[1]
    try:
        host = (urlsplit(url).hostname or "").lower().removeprefix("www.")
    except ValueError:
        host = ""
    m = re.search(r"/[^/]+/status/(\d+)", urlsplit(url).path) if host in ("x.com", "twitter.com") else None
    if m:
        return "x_" + m[1]
    m = re.search(r"/r/[^/]+/comments/([a-z0-9]+)", urlsplit(url).path) if host in ("reddit.com", "old.reddit.com") else None
    if m:
        return "reddit_" + m[1]
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
    run = client.actor(actor).call(run_input=run_input, run_timeout=timedelta(minutes=5),
                                   max_total_charge_usd=Decimal("0.25") if actor == "apify/reddit-scraper" else None)
    # Out of credit, or a free-plan run limit (some actors then "succeed" with empty placeholder items): fail loudly
    # rather than treat it as "no posts".
    if not run or run.status != "SUCCEEDED" or "limit exceeded" in (run.status_message or "").lower():
        raise RuntimeError(f"Apify run of {actor} did not succeed: {run.status if run else 'no run'} {run.status_message if run else ''}")
    items = list(client.dataset(run.default_dataset_id).iterate_items())
    if any(p.get("error") or p.get("reasonCode") == "unavailable" for p in items):
        raise RuntimeError("Source returned an error or unavailable result; retry required")
    return [p for p in items if not p.get("reasonCode")]


def fetch_posts(limit, now, reports=None):
    """Posts from every network as dicts of platform, url, author, text, query, plus how many networks failed."""
    posts, errors = [], 0
    since = time.strftime("%Y-%m-%d", time.gmtime(now - WINDOW_SECONDS[limit]))
    reports = reports if reports is not None else {}
    sources = [
        ("linkedin", lambda: [linkedin_post(p) for p in run_actor("harvestapi/linkedin-post-search", {
            "searchQueries": QUERIES, "sortBy": "date", "postedLimit": limit, "maxPosts": MAX_POSTS_PER_QUERY})]),
        ("x", lambda: [x_post(t) for t in run_actor("xquik/x-tweet-scraper", {
            "searchTerms": [f"{q} since:{since}" for q in X_QUERIES], "queryType": "Latest", "maxItems": X_MAX_POSTS,
            "includeSearchTerms": True})]),
    ]
    if ENV.get("REDDIT_ENABLED") == "true":
        sources.append(("reddit", lambda: [reddit_post(p) for p in run_actor("apify/reddit-scraper", {
            "scrapeMode": "posts", "searchQueries": REDDIT_QUERIES, "searchSort": "new",
            "searchTimeFilter": {"1h": "hour", "24h": "day", "week": "week"}[limit],
            "maxSearchResultsPerQuery": 10, "includeNsfw": False})]))
    else:
        reports["reddit"] = {"status": "disabled", "posts": 0, "leads": 0, "detail": "Automatic discovery is not enabled. You can still add Reddit posts manually."}
    for name, fetch in sources:
        try:
            found = fetch()
            if any(not p["url"] or not p["text"] for p in found):
                raise RuntimeError("Source returned incomplete posts; review actor output")
            posts += found
            cap = {"linkedin": len(QUERIES) * MAX_POSTS_PER_QUERY, "x": X_MAX_POSTS, "reddit": len(REDDIT_QUERIES) * 10}[name]
            reports[name] = {"status": "limited" if len(found) >= cap else "ok", "posts": len(found), "leads": 0,
                             "detail": "Result cap reached; some posts may be missing." if len(found) >= cap else "Scan completed. No results is normal for narrow searches."}
        except Exception as e:  # one network down must not stop the other
            errors += 1
            reports[name] = {"status": "error", "posts": 0, "leads": 0, "detail": "Search failed. Check the worker logs and provider credits."}
            print(f"{time.strftime('%F %T')} {name} search failed: {e!r}", file=sys.stderr)
    return posts, errors


def linkedin_post(p):
    return {"platform": "linkedin", "url": p.get("linkedinUrl"), "author": (p.get("author") or {}).get("name") or "unknown",
            "text": p.get("content") or "", "query": (p.get("query") or {}).get("search"), "urn": p.get("shareUrn")}


def x_post(t):
    a = t.get("author") or {}
    return {"platform": "x", "url": t.get("url") or t.get("twitterUrl"), "author": a.get("name") or a.get("userName") or "unknown",
            "text": t.get("fullText") or t.get("text") or "", "query": t.get("searchTerm") or "X exact phrases"}


def reddit_post(p):
    return {"platform": "reddit", "url": f"https://www.reddit.com/r/{p['communityName']}/comments/{p['id']}/",
            "author": p.get("authorName") or "unknown", "text": "\n".join(filter(None, [p.get("title"), p.get("body")])),
            "query": "Reddit buyer searches"}


def record_health(reports):
    if not ENV.get("DATABASE_URL"):
        return
    with psycopg.connect(ENV["DATABASE_URL"]) as db:
        for name, r in reports.items():
            db.execute("""insert into source_health (platform, checked_at, last_success_at, status, posts, leads, detail)
                          values (%s, now(), case when %s in ('ok', 'limited') then now() end, %s, %s, %s, %s)
                          on conflict (platform) do update set checked_at = excluded.checked_at,
                          last_success_at = coalesce(excluded.last_success_at, source_health.last_success_at),
                          status = excluded.status, posts = excluded.posts, leads = excluded.leads, detail = excluded.detail""",
                       (name, r["status"], r["status"], r["posts"], r["leads"], r["detail"]))


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
    elif ENV.get("LOCAL_ONLY") == "1":  # explicit offline export; the web inbox always reads Neon
        with open(ROOT / "leads.jsonl", "a") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    else:
        raise RuntimeError("DATABASE_URL is required. Use LOCAL_ONLY=1 only for offline exports.")


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


MAX_COMMENTS = 10  # per run; keeps the LinkedIn account clear of spam limits


def comment(lead, urn, reply):
    """Post the draft reply as a LinkedIn comment through Composio, then mark the lead replied."""
    r = requests.post("https://backend.composio.dev/api/v3.1/tools/execute/LINKEDIN_CREATE_COMMENT_ON_POST",
                      headers={"x-api-key": ENV["COMPOSIO_API_KEY"]}, timeout=30,
                      json={"user_id": ENV["COMPOSIO_USER_ID"], "arguments": {
                          "actor": ENV["LINKEDIN_ACTOR"], "object": urn, "target_urn": urn, "message": {"text": reply}}})
    r.raise_for_status()
    if not r.json().get("successful"):
        raise RuntimeError(f"Composio comment failed: {r.json().get('error')}")
    if ENV.get("DATABASE_URL"):
        with psycopg.connect(ENV["DATABASE_URL"]) as db:
            db.execute("update leads set status = 'replied', status_at = now(), replied_at = coalesce(replied_at, now()) where id = %s and status = 'new'", (lead,))


def main():
    if not ENV.get("DATABASE_URL") and ENV.get("LOCAL_ONLY") != "1":
        raise RuntimeError("DATABASE_URL is required before scanning; no posts have been marked seen.")
    if ENV.get("DATABASE_URL"):
        with psycopg.connect(ENV["DATABASE_URL"]) as db:
            db.execute((ROOT / "schema.sql").read_text())
    now = time.time()
    state = json.loads(STATE.read_text()) if STATE.exists() else {"last_run": 0, "seen": []}
    seen = dict.fromkeys(lead_id(u) if u.startswith("http") else u for u in state["seen"])
    claude = anthropic.Anthropic(api_key=ENV["ANTHROPIC_API_KEY"])
    leads = comments = 0
    ok = False
    reports = {}
    failed = 1
    try:
        posts, failed = fetch_posts(posted_limit(state["last_run"], now), now, reports)
        for post in posts:
            url, author, text = post["url"], post["author"], post["text"]
            if not url or lead_id(url) in seen or not text:
                continue
            try:
                verdict = classify(claude, author, text)
                if verdict.get("match"):
                    notify(url, author, verdict, text, post["query"], post["platform"])
                    leads += 1
                    # Off unless AUTO_COMMENT=1. A failed comment leaves the lead waiting for a person, never retried.
                    if ENV.get("AUTO_COMMENT") == "1" and (post.get("urn") or "").startswith(("urn:li:share:", "urn:li:ugcPost:")) \
                            and verdict.get("reply") and comments < MAX_COMMENTS:
                        try:
                            comment(lead_id(url), post["urn"], verdict["reply"])
                            comments += 1
                        except Exception as e:
                            print(f"{time.strftime('%F %T')} comment failed on {url}: {e!r}", file=sys.stderr)
                    if post["platform"] in reports:
                        reports[post["platform"]]["leads"] += 1
            except Exception as e:  # one bad post (Claude/Slack/Sheet down) must not stop the rest
                failed += 1
                if post["platform"] in reports:
                    reports[post["platform"]].update(status="error", detail="Some posts could not be processed. They will be retried.")
                print(f"{time.strftime('%F %T')} error on {url}: {e!r}", file=sys.stderr)
                continue
            seen[lead_id(url)] = None  # insertion order keeps the most recently processed posts
        ok = not failed
    finally:
        # Always save seen, so posts already alerted are never alerted twice.
        # Advance last_run only on a clean run, so the next window is wide enough to re-fetch failed posts.
        with tempfile.NamedTemporaryFile(mode="w", dir=STATE.parent, delete=False) as f:
            json.dump({"last_run": now if ok else state["last_run"], "seen": list(seen)[-5000:]}, f)
        os.replace(f.name, STATE)
        record_health(reports)
    print(f"{time.strftime('%F %T')} leads={leads} comments={comments} failed={failed} seen={len(seen)}")
    return failed


if __name__ == "__main__":
    if sys.argv[1:] == ["--test"]:
        assert posted_limit(0, 1_000_000) == "week"
        assert posted_limit(1_000_000 - 3600, 1_000_000) == "1h"
        assert posted_limit(1_000_000 - 7200, 1_000_000) == "24h"
        assert posted_limit(1_000_000 - 86400 - 3600, 1_000_000) == "week"
        assert posted_limit(1_000_000 - 4200, 1_000_000) == "24h"
        assert lead_id("https://www.linkedin.com/posts/x_y-activity-7523256979247513602-H2j8") == "li_7523256979247513602"
        assert lead_id("https://x.com/steve/status/1985123456789012345?s=20") == "x_1985123456789012345"
        assert lead_id("https://twitter.com/steve/status/1985123456789012345") == "x_1985123456789012345"
        assert lead_id("https://example.com/p/1") == "url_1oa81w1"  # matches leadId() in web/lib/lead-utils.ts
        assert linkedin_post({"linkedinUrl": "u", "author": {"name": "A"}, "content": "c", "query": {"search": "q"}, "shareUrn": "urn:li:share:1"}) == \
            {"platform": "linkedin", "url": "u", "author": "A", "text": "c", "query": "q", "urn": "urn:li:share:1"}
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
        ENV.pop("DATABASE_URL", None)
        ENV["LOCAL_ONLY"] = "1"
        ENV.setdefault("ANTHROPIC_API_KEY", "test")
        fetch_posts = lambda limit, now, reports: ([linkedin_post({"linkedinUrl": u, "content": "x"}) for u in ("a", "b")], 0)
        classify = lambda claude, author, text: {"match": True, "kind": "product", "reason": "", "reply": ""}
        def notify(url, author, verdict, post_text="", query=None, platform="linkedin"):
            if url == "b":
                raise RuntimeError("slack down")
        assert main() == 1
        assert json.loads(STATE.read_text()) == {"last_run": 0, "seen": [lead_id("a")]}
        print("ok")
    else:
        sys.exit(1 if main() else 0)  # non-zero exit marks the run failed in the log / GitHub Actions
