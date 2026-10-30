import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AppDocument, Application, DocumentKind, Status } from "./statuses";

// Local SQLite file. Swapping to Supabase/Postgres later only means rewriting this file.
const DB_PATH = path.join(process.cwd(), "data", "tracker.db");

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  // Wait on locks (several Next.js workers can open the file at once) instead of failing.
  const db = new DatabaseSync(DB_PATH, { timeout: 5000 });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      company      TEXT NOT NULL,
      role         TEXT NOT NULL,
      url          TEXT,
      location     TEXT,
      source       TEXT,
      status       TEXT NOT NULL DEFAULT 'saved',
      applied_date TEXT,
      notes        TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      kind           TEXT NOT NULL,
      filename       TEXT NOT NULL,
      stored_name    TEXT NOT NULL,
      mime_type      TEXT NOT NULL,
      size           INTEGER NOT NULL,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  addColumns(db, "applications", {
    description: "TEXT",
    match_score: "INTEGER",
    match_json: "TEXT",
    matched_at: "TEXT",
  });
  return db;
}

// Columns added after the table was first created.
function addColumns(db: DatabaseSync, table: string, columns: Record<string, string>) {
  const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
  for (const [name, type] of Object.entries(columns)) {
    if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  }
}

// Bump when open() changes so a running dev server reconnects and migrates.
const SCHEMA_VERSION = 3;

// Opened lazily and reused across hot reloads in dev.
const globalForDb = globalThis as unknown as { db?: DatabaseSync; dbVersion?: number };
function conn() {
  if (!globalForDb.db || globalForDb.dbVersion !== SCHEMA_VERSION) {
    globalForDb.db?.close();
    globalForDb.db = open();
    globalForDb.dbVersion = SCHEMA_VERSION;
  }
  return globalForDb.db;
}

// node:sqlite returns null-prototype objects; copy into plain ones so React can pass them to client components.
function plain<T>(row: unknown): T {
  return { ...(row as T) };
}
const toApplication = plain<Application>;

export type ApplicationInput = Omit<
  Application,
  "id" | "created_at" | "updated_at" | "doc_count" | "match_score" | "match_json" | "matched_at"
>;

export function listApplications(): Application[] {
  return conn()
    .prepare(
      `SELECT a.*, (SELECT COUNT(*) FROM documents d WHERE d.application_id = a.id) AS doc_count
       FROM applications a
       ORDER BY COALESCE(a.applied_date, a.created_at) DESC, a.id DESC`,
    )
    .all()
    .map(toApplication);
}

export function getApplication(id: number): Application | undefined {
  const row = conn().prepare("SELECT * FROM applications WHERE id = ?").get(id);
  return row ? toApplication(row) : undefined;
}

export function createApplication(input: ApplicationInput): number {
  const result = conn()
    .prepare(
      `INSERT INTO applications (company, role, url, location, source, status, applied_date, notes, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.company, input.role, input.url, input.location, input.source,
      input.status, input.applied_date, input.notes, input.description,
    );
  return Number(result.lastInsertRowid);
}

export function updateApplication(id: number, input: ApplicationInput) {
  conn().prepare(
    `UPDATE applications
     SET company = ?, role = ?, url = ?, location = ?, source = ?, status = ?, applied_date = ?, notes = ?,
         -- A new job description makes the old match score meaningless.
         match_score = CASE WHEN description IS ? THEN match_score END,
         match_json  = CASE WHEN description IS ? THEN match_json END,
         matched_at  = CASE WHEN description IS ? THEN matched_at END,
         description = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    input.company, input.role, input.url, input.location, input.source, input.status, input.applied_date, input.notes,
    input.description, input.description, input.description, input.description, id,
  );
}

export function setStatus(id: number, status: Status) {
  // Moving a card to "Applied" stamps today's date if none was set.
  conn().prepare(
    `UPDATE applications
     SET status = ?,
         applied_date = CASE WHEN ? = 'applied' AND applied_date IS NULL THEN date('now', 'localtime') ELSE applied_date END,
         updated_at = datetime('now')
     WHERE id = ?`,
  ).run(status, status, id);
}

export function deleteApplication(id: number) {
  conn().prepare("DELETE FROM applications WHERE id = ?").run(id);
}

export function listDocuments(applicationId: number): AppDocument[] {
  return conn()
    .prepare("SELECT * FROM documents WHERE application_id = ? ORDER BY kind, created_at DESC")
    .all(applicationId)
    .map(plain<AppDocument>);
}

export function getDocument(id: number): AppDocument | undefined {
  const row = conn().prepare("SELECT * FROM documents WHERE id = ?").get(id);
  return row ? plain<AppDocument>(row) : undefined;
}

export function createDocument(doc: {
  application_id: number;
  kind: DocumentKind;
  filename: string;
  stored_name: string;
  mime_type: string;
  size: number;
}) {
  conn()
    .prepare(
      `INSERT INTO documents (application_id, kind, filename, stored_name, mime_type, size)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(doc.application_id, doc.kind, doc.filename, doc.stored_name, doc.mime_type, doc.size);
}

export function deleteDocument(id: number) {
  conn().prepare("DELETE FROM documents WHERE id = ?").run(id);
}

export function saveMatch(id: number, score: number, json: string) {
  conn()
    .prepare("UPDATE applications SET match_score = ?, match_json = ?, matched_at = datetime('now') WHERE id = ?")
    .run(score, json, id);
}

export function getSetting(key: string): string | null {
  const row = conn().prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return (row?.value as string | null | undefined) ?? null;
}

export function setSetting(key: string, value: string | null) {
  conn()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}
