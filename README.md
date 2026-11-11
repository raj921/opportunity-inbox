# Business Agent

A frontend-only business-agent prototype for discovering buying intent on LinkedIn and X, preparing public comments and tracking outreach. It does not connect accounts, fetch social posts or publish comments.

## Local setup

Use Node.js 22.18+:

```sh
npm ci
npm run dev
```

Open http://localhost:3100. No Python, database, credentials or paid providers are needed.

## Autonomous demo agent

The inbox includes Start/Pause and Reset demo controls. A browser-local agent replays curated fictional LinkedIn and X opportunities through discovery, qualification, prepared drafting, scripted checks and simulated publishing. No approval is required. Passing comments move to Commented; rejected opportunities retain a skip reason in the activity log.

All agent outcomes are simulations, not posting receipts. No Apify, Composio, account authentication or live AI evaluation is used. The agent runs only while the application is open; reloading preserves saved outcomes but does not restart execution. Reset removes only agent-demo opportunities, preserving existing opportunities and edits.

For production, replace the demo operations with backend workers calling discovery, agent evaluation and authorized action providers. External publication must be confirmed before recording a real published outcome.

## Prototype workflow

- The inbox loads 32 opportunities from `public/data/opportunities.csv`: 29 LinkedIn and 3 X posts. Skipped records have been removed. Pipeline statuses and comment timestamps are illustrative activity, not records of actual outreach.
- Existing CSV opportunities retain local draft editing and original-post links. Autonomous demo opportunities use prepared, read-only comments and do not link to fictional posts.
- Drafts and manual additions persist only in this browser. Manual additions and platform filters support LinkedIn and X. Inbox pipeline filters and illustrative historical activity remain available.
- Sources shows only LinkedIn and X demo discovery, not authenticated connections. No platform accounts are connected.
- Insights derives counts, conversion rates, platform performance and daily discovery/comment activity from loaded leads, including simulated agent outcomes. These are demo metrics, not evidence of real outreach.
- Follow-up controls and dataset-provenance labels are not shown in the portal. CSV export remains available.
- Inbox tabs are Ready to comment, Commented, In conversation and All. Won/lost opportunities remain available under All and in Insights; there are no separate Won, Lost or Skipped tabs.
- Inbox, Insights and Sources share a full-width workspace, responsive gutters, compact overview tiles and aligned page headers. On wide screens each page pairs its primary content with a supporting right rail: agent activity in Inbox, pipeline in Insights, and demo guidance in Sources. Smaller screens stack the blocks; Inbox retains its mobile full-screen lead detail.

The CSV's `Commented at` and `Status changed` columns preserve activity timestamps through import/export. Edit the file and rebuild to update the baseline. Browser edits use a business-agent-specific storage key; the previous inbox's saved data is not loaded. Clearing site storage restores the baseline.

## Production deployment

`npm run build` generates a static site in `out` (`output: 'export'`). Serve that directory with a static host, not `next start`. For Vercel, use the repository root, `npm ci`, `npm run build`, and the `out` output directory. No environment variables are required.

## Verification

```sh
npm test
npm run build
```

Tests and builds do not fetch leads or publish comments.
