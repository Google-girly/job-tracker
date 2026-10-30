import "server-only";
import postgres from "postgres";
import type { AppDocument, Application, DocumentKind, Status } from "./statuses";

// Supabase Postgres. Schema lives in supabase/migrations (apply with `npm run db:migrate`).
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set. Add it to .env.local.");
  return (globalForDb.sql ??= postgres(process.env.DATABASE_URL, {
    // Supabase's transaction pooler (port 6543) doesn't support prepared statements.
    prepare: false,
    max: 5,
  }));
}

// Timestamps come back as "YYYY-MM-DD HH:MM:SS" UTC strings, which the UI slices and compares.
const ts = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as ${column}`;
const APPLICATION_COLUMNS = `id, company, role, url, location, source, status, applied_date::text as applied_date, notes,
  description, match_score, match_json, ${ts("matched_at")}, ${ts("created_at")}, ${ts("updated_at")}`;
const DOCUMENT_COLUMNS = `id, application_id, kind, filename, stored_name, mime_type, size, ${ts("created_at")}`;

// Dates like "applied today" follow this time zone rather than the server's (UTC on Vercel).
const TIME_ZONE = process.env.APP_TIMEZONE || "America/Los_Angeles";

export type ApplicationInput = Omit<
  Application,
  "id" | "created_at" | "updated_at" | "doc_count" | "match_score" | "match_json" | "matched_at"
>;

export async function listApplications(): Promise<Application[]> {
  const sql = db();
  return sql<Application[]>`
    select ${sql.unsafe(APPLICATION_COLUMNS)},
      (select count(*)::int from documents d where d.application_id = a.id) as doc_count
    from applications a
    order by coalesce(a.applied_date::timestamptz, a.created_at) desc, a.id desc`;
}

export async function getApplication(id: number): Promise<Application | undefined> {
  const sql = db();
  const [row] = await sql<Application[]>`select ${sql.unsafe(APPLICATION_COLUMNS)} from applications where id = ${id}`;
  return row;
}

export async function createApplication(input: ApplicationInput): Promise<number> {
  const [row] = await db()<{ id: number }[]>`
    insert into applications (company, role, url, location, source, status, applied_date, notes, description)
    values (${input.company}, ${input.role}, ${input.url}, ${input.location}, ${input.source},
            ${input.status}, ${input.applied_date}, ${input.notes}, ${input.description})
    returning id`;
  return row.id;
}

export async function updateApplication(id: number, input: ApplicationInput) {
  const description = input.description;
  await db()`
    update applications
    set company = ${input.company}, role = ${input.role}, url = ${input.url}, location = ${input.location},
        source = ${input.source}, status = ${input.status}, applied_date = ${input.applied_date}, notes = ${input.notes},
        -- A new job description makes the old match score meaningless.
        match_score = case when description is not distinct from ${description}::text then match_score end,
        match_json  = case when description is not distinct from ${description}::text then match_json end,
        matched_at  = case when description is not distinct from ${description}::text then matched_at end,
        description = ${description},
        updated_at = now()
    where id = ${id}`;
}

export async function setStatus(id: number, status: Status) {
  // Moving a card to "Applied" stamps today's date if none was set.
  await db()`
    update applications
    set status = ${status},
        applied_date = case
          when ${status}::text = 'applied' and applied_date is null then (now() at time zone ${TIME_ZONE})::date
          else applied_date end,
        updated_at = now()
    where id = ${id}`;
}

export async function deleteApplication(id: number) {
  await db()`delete from applications where id = ${id}`;
}

export async function saveMatch(id: number, score: number, json: string) {
  await db()`update applications set match_score = ${score}, match_json = ${json}, matched_at = now() where id = ${id}`;
}

export async function listDocuments(applicationId: number): Promise<AppDocument[]> {
  const sql = db();
  return sql<AppDocument[]>`
    select ${sql.unsafe(DOCUMENT_COLUMNS)} from documents
    where application_id = ${applicationId}
    order by kind, created_at desc`;
}

export async function getDocument(id: number): Promise<AppDocument | undefined> {
  const sql = db();
  const [row] = await sql<AppDocument[]>`select ${sql.unsafe(DOCUMENT_COLUMNS)} from documents where id = ${id}`;
  return row;
}

export async function createDocument(doc: {
  application_id: number;
  kind: DocumentKind;
  filename: string;
  stored_name: string;
  mime_type: string;
  size: number;
}) {
  await db()`
    insert into documents (application_id, kind, filename, stored_name, mime_type, size)
    values (${doc.application_id}, ${doc.kind}, ${doc.filename}, ${doc.stored_name}, ${doc.mime_type}, ${doc.size})`;
}

export async function deleteDocument(id: number) {
  await db()`delete from documents where id = ${id}`;
}

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db()<{ value: string | null }[]>`select value from settings where key = ${key}`;
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string | null) {
  await db()`
    insert into settings (key, value) values (${key}, ${value})
    on conflict (key) do update set value = excluded.value`;
}

export async function findApplicationByUrl(url: string): Promise<Pick<Application, "id" | "company" | "role"> | undefined> {
  const [row] = await db()<Pick<Application, "id" | "company" | "role">[]>`
    select id, company, role from applications where url = ${url} limit 1`;
  return row;
}
