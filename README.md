# Opportunity Inbox

A focused workspace for finding social posts with buying intent, preparing outreach, and following a lead through to a client.

## What works

- Scheduled LinkedIn and X discovery, with optional Reddit discovery through Apify.
- One shared Claude screening contract for automatic and manual leads. Closed requests, vendor ads and completed-work recaps are excluded by the prompt; generated drafts must not invent credentials or past work.
- Split-view inbox: a ranked list beside the full lead, with a 2-hour reply ruler, platform/type/priority filters, search, similar-post grouping (optional) and keyboard shortcuts (`j`/`k` move, `c` copy reply, `e` mark replied, `/` search). On phones the lead opens full screen.
- Action queues for hot leads, overdue replies and follow-ups; notes and editable outreach drafts.
- CSV export of the current filtered view, including protection against spreadsheet formula injection.
- Results reporting and per-source worker health. A synced inbox is not presented as proof of a successful scan.
- Manual imports from any HTTP(S) post link, including Reddit, Facebook and Bluesky. Facebook/Bluesky automatic discovery is not implemented.

## Local setup

Python 3.12+ and Node 22.18+ are required.

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd web
npm ci
npm run dev
```

Put `APIFY_TOKEN` and `ANTHROPIC_API_KEY` in the root `.env`. Set `DATABASE_URL` in the root `.env` or `web/.env.local`; the local scanner uses the same database as the web app. Next.js reads `web/.env.local`. Never commit credentials.

Apply `schema.sql` to the database before starting the web app. The worker also applies this idempotent schema before making paid requests. It creates the lead table and the `source_health` heartbeat table without removing existing data.

From the repository root:

```sh
.venv/bin/python inbox.py
```

This calls paid providers and sends any configured Slack/Sheets notifications. Offline development uses the tests below. `LOCAL_ONLY=1` explicitly permits JSONL export when no database is configured; those files do not feed the deployed web inbox.

The UI saves a draft or note when you press its Save button. Moving a lead to another status saves pending edits first. Copying a reply does not send it; open the source and post manually.

## Cloud operation

Vercel project root: `web`. Set `DATABASE_URL` and `ANTHROPIC_API_KEY` in Vercel for the target environment. Deploy with the existing Vercel project; the local `.vercel` association should not be committed.

GitHub Actions runs `.github/workflows/inbox.yml` daily at 00:30 UTC / 06:00 IST. Configure repository secrets `DATABASE_URL`, `APIFY_TOKEN`, and `ANTHROPIC_API_KEY`; `SLACK_WEBHOOK_URL` is optional. Use the same database for the worker and Vercel.

Scheduled runs enable Reddit by default; set the repository variable `REDDIT_ENABLED=false` to disable it. Local runs enable it with `REDDIT_ENABLED=true`. Reddit searches are capped at 10 results per query across 3 queries, with a $0.25 actor spend ceiling per run. Its current provider schema is documented at https://apify.com/apify/reddit-scraper/input-schema. X uses https://apify.com/xquik/x-tweet-scraper/input-schema with 100 posts total and matching-search attribution.

Source status is first available after the updated worker runs. Missing/stale heartbeats are explicitly shown; a healthy zero-result search is different from a failed search. The scanner has a five-minute actor timeout and isolates failures by network. Failed posts are not marked seen; successful post IDs are checkpointed atomically.

Searches are bounded, not exhaustive: delayed daily runs widen to a week, outages beyond a week need a backfill, and result caps can omit posts. Repost grouping is a word-overlap heuristic and can be turned off. Desktop alerts require the workspace to remain open. API authentication remains unchanged for now, as requested.

## Verification

```sh
.venv/bin/python -m unittest discover -s tests -v
cd web
npm test
npm run build -- --webpack
```

Tests use offline fakes; they do not spend provider credit, write production data or send messages. Webpack is an alternative build path for environments where Turbopack's internal socket is blocked. CI runs the same checks on source changes.
