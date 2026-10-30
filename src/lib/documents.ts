import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as db from "./db";
import type { AppDocument, DocumentKind } from "./statuses";

// Uploaded files live next to the database, one folder per application.
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".rtf": "application/rtf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

// Returns an error message, or undefined if the file is fine.
export function checkFile(file: File): string | undefined {
  const ext = path.extname(file.name).toLowerCase();
  if (!MIME_TYPES[ext]) return `"${file.name}" isn't a supported file type (PDF, Word, ODT, RTF, TXT, MD).`;
  if (file.size > MAX_FILE_BYTES) return `"${file.name}" is over 10 MB.`;
}

export async function saveDocument(applicationId: number, kind: DocumentKind, file: File) {
  const ext = path.extname(file.name).toLowerCase();
  // Never use the uploaded name on disk; it's only kept for display.
  const storedName = `${randomUUID()}${ext}`;
  const dir = path.join(UPLOAD_DIR, String(applicationId));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, storedName), Buffer.from(await file.arrayBuffer()));

  db.createDocument({
    application_id: applicationId,
    kind,
    filename: path.basename(file.name),
    stored_name: storedName,
    mime_type: MIME_TYPES[ext],
    size: file.size,
  });
}

export function readDocument(doc: AppDocument) {
  return fs.readFile(path.join(UPLOAD_DIR, String(doc.application_id), doc.stored_name));
}

export async function removeDocument(doc: AppDocument) {
  db.deleteDocument(doc.id);
  await fs.rm(path.join(UPLOAD_DIR, String(doc.application_id), doc.stored_name), { force: true });
}

export async function removeApplicationFiles(applicationId: number) {
  await fs.rm(path.join(UPLOAD_DIR, String(applicationId)), { recursive: true, force: true });
}
