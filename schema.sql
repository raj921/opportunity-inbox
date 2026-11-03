-- Leads table in Neon Postgres. The daily scan (inbox.py) inserts rows; the web inbox reads and updates them.
create table if not exists leads (
  id          text primary key,              -- li_<LinkedIn activity number>, see lead_id() in inbox.py
  url         text not null,
  platform    text not null default 'linkedin', -- linkedin | x
  author      text not null,
  kind        text not null default 'other', -- workshop | training | product | other
  priority    text not null default 'warm',  -- hot | warm | cold
  why         text not null default '',
  reply       text not null default '',
  excerpt     text not null default '',
  query       text,                          -- the LinkedIn search that found it
  source      text not null default 'scan',  -- scan | test | manual
  posted_date text,
  found_at    timestamptz,
  status      text not null default 'new',   -- new | replied | talking | won | lost | skipped
  status_at   timestamptz,
  replied_at  timestamptz,                   -- first time someone replied, for reply-time stats
  follow_up   date,
  notes       text not null default '',
  created_at  timestamptz not null default now()
);

-- Worker heartbeat, independent of browser refreshes. No secrets or raw provider errors.
create table if not exists source_health (
  platform text primary key,
  checked_at timestamptz not null,
  last_success_at timestamptz,
  status text not null,
  posts integer not null default 0,
  leads integer not null default 0,
  detail text not null default ''
);
