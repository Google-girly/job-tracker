import "server-only";
import path from "node:path";
import * as db from "./db";

// The base resume used for match scoring, stored as plain text in the settings table.
export type Resume = { text: string; filename: string | null; updatedAt: string };

export async function getResume(): Promise<Resume | null> {
  const [text, filename, updatedAt] = await Promise.all([
    db.getSetting("resume_text"),
    db.getSetting("resume_filename"),
    db.getSetting("resume_updated_at"),
  ]);
  return text ? { text, filename, updatedAt: updatedAt ?? "" } : null;
}

export async function saveResume(text: string, filename: string | null) {
  await db.setSetting("resume_text", text);
  await db.setSetting("resume_filename", filename);
  // Same "YYYY-MM-DD HH:MM:SS" UTC format as timestamps from lib/db.ts, so it compares with matched_at.
  await db.setSetting("resume_updated_at", new Date().toISOString().slice(0, 19).replace("T", " "));
}

export async function extractResumeText(file: File): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (ext === ".pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: true });
    return text;
  }
  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return value;
  }
  if (ext === ".txt" || ext === ".md") return new TextDecoder().decode(bytes);
  throw new Error("Upload a PDF, Word (.docx), or text file, or paste your resume as text.");
}
