# Business Agent

A frontend-only business-agent prototype for discovering buying intent on LinkedIn and X, preparing public comments and tracking outreach. It does not connect accounts, fetch social posts or publish comments.

## Local setup

Use Node.js 22.18+:

```sh
npm ci
npm run dev
```

Open http://localhost:3100. No Python, database, credentials or paid providers are needed.

## Prototype workflow

- The inbox loads 32 opportunities from `public/data/opportunities.csv`: 29 LinkedIn and 3 X posts. Skipped records have been removed. Pipeline statuses and comment timestamps are illustrative activity, not records of actual outreach.
- Review and edit a draft comment, save it locally, and open the original post for context. The detail panel has a smaller author heading with its priority tag aligned to the right, and no stage controls, notes editor, copy action or preview dialog.
- Drafts and manual additions persist only in this browser. Manual additions and platform filters support LinkedIn and X. Inbox pipeline filters and illustrative historical activity remain available.
- Sources shows LinkedIn and X as Connected, with Reddit and Facebook Not connected. These are preview states, not authenticated integrations. Bluesky, Other and Evals are not portal options.
- Insights derives counts, conversion rates, platform performance and daily discovery/comment activity from the loaded leads. Its 7/14-day chart ends at the latest recorded activity, so the displayed date interval remains meaningful for a fixed dataset.
- Follow-up controls and dataset-provenance labels are not shown in the portal. CSV export remains available.
- Inbox tabs are Ready to comment, Commented, In conversation and All. Won/lost opportunities remain available under All and in Insights; there are no separate Won, Lost or Skipped tabs.
- Inbox, Insights and Sources share one centered 1120px page container, responsive page padding and header styles. The inbox uses compact overview tiles above its desktop split-pane view.

The CSV's `Commented at` and `Status changed` columns preserve activity timestamps through import/export. Edit the file and rebuild to update the baseline. Browser edits use a business-agent-specific storage key; the previous inbox's saved data is not loaded. Clearing site storage restores the baseline.

## Production deployment

`npm run build` generates a static site in `out` (`output: 'export'`). Serve that directory with a static host, not `next start`. For Vercel, use the repository root, `npm ci`, `npm run build`, and the `out` output directory. No environment variables are required.

## Verification

```sh
npm test
npm run build
```

Tests and builds do not fetch leads or publish comments.
