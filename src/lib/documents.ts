import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import * as db from "./db";
import type { AppDocument, DocumentKind } from "./statuses";
import { createAdminClient } from "./supabase/server";

// Uploaded files live in a private Supabase Storage bucket, one folder per application.
const BUCKET = "documents";

// Vercel caps request bodies at 4.5 MB, so keep each file under that.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".rtf": "application/rtf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const bucket = () => createAdminClient().storage.from(BUCKET);

// Returns an error message, or undefined if the file is fine.
export function checkFile(file: File): string | undefined {
  const ext = path.extname(file.name).toLowerCase();
  if (!MIME_TYPES[ext]) return `"${file.name}" isn't a supported file type (PDF, Word, ODT, RTF, TXT, MD).`;
  if (file.size > MAX_FILE_BYTES) return `"${file.name}" is over 4 MB.`;
}

export async function saveDocument(applicationId: number, kind: DocumentKind, file: File) {
  const ext = path.extname(file.name).toLowerCase();
  // Never use the uploaded name in the storage path; it's only kept for display.
  const storagePath = `${applicationId}/${randomUUID()}${ext}`;
  const { error } = await bucket().upload(storagePath, file, { contentType: MIME_TYPES[ext] });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  await db.createDocument({
    application_id: applicationId,
    kind,
    filename: path.basename(file.name),
    stored_name: storagePath,
    mime_type: MIME_TYPES[ext],
    size: file.size,
  });
}

export async function readDocument(doc: AppDocument): Promise<ArrayBuffer | undefined> {
  const { data } = await bucket().download(doc.stored_name);
  return data?.arrayBuffer();
}

export async function removeDocument(doc: AppDocument) {
  await db.deleteDocument(doc.id);
  await bucket().remove([doc.stored_name]);
}

export async function removeApplicationFiles(applicationId: number) {
  const { data } = await bucket().list(String(applicationId));
  if (data?.length) await bucket().remove(data.map((f) => `${applicationId}/${f.name}`));
}
