import { neon } from "@neondatabase/serverless";
import type { Lead, Status } from "./lead-utils";

// Leads live in Neon Postgres (schema.sql). The daily scan inserts them; the inbox reads and updates them.
const sql = neon(process.env.DATABASE_URL!);

const COLUMNS = `id, url, platform, author, kind, priority, why, reply, excerpt, query, source, posted_date as "postedDate",
  found_at as "foundAt", status, status_at as "statusAt", replied_at as "repliedAt",
  to_char(follow_up, 'YYYY-MM-DD') as "followUp", notes`;

export async function listLeads() {
  return (await sql.query(`select ${COLUMNS} from leads order by coalesce(found_at, posted_date::timestamptz) desc`)) as Lead[];
}

export async function insertLead(l: Omit<Lead, "status" | "statusAt" | "repliedAt" | "followUp" | "notes" | "postedDate">) {
  const rows = await sql.query(
    `insert into leads (id, url, platform, author, kind, priority, why, reply, excerpt, query, source, found_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) on conflict (id) do nothing returning id`,
    [l.id, l.url, l.platform, l.author, l.kind, l.priority, l.why, l.reply, l.excerpt, l.query, l.source, l.foundAt],
  );
  return rows.length > 0; // false: the post is already a lead
}

export type LeadPatch = { status?: Status; reply?: string; notes?: string; followUp?: string | null };

// Reply time counts from when a lead was found to the first move out of "new"; moving it back to "new" resets it.
export async function updateLead(id: string, p: LeadPatch) {
  const rows = await sql.query(
    `update leads set
       status = coalesce($2::text, status),
       status_at = case when $2::text is null then status_at else now() end,
       replied_at = case when $2::text is null then replied_at
                         when $2::text = 'new' then null
                         when $2::text = 'skipped' then replied_at
                         else coalesce(replied_at, now()) end,
       reply = coalesce($3::text, reply),
       notes = coalesce($4::text, notes),
       follow_up = case when $5::boolean then $6::date else follow_up end
     where id = $1 returning id`,
    [id, p.status ?? null, p.reply ?? null, p.notes ?? null, "followUp" in p, p.followUp ?? null],
  );
  return rows.length > 0;
}
