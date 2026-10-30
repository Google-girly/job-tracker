import "server-only";
import path from "node:path";
import * as db from "./db";

// The base resume used for match scoring, stored as plain text in the settings table.
export type Resume = { text: string; filename: string | null; updatedAt: string };

export function getResume(): Resume | null {
  const text = db.getSetting("resume_text");
  if (!text) return null;
  return { text, filename: db.getSetting("resume_filename"), updatedAt: db.getSetting("resume_updated_at") ?? "" };
}

export function saveResume(text: string, filename: string | null) {
  db.setSetting("resume_text", text);
  db.setSetting("resume_filename", filename);
  // Same format as SQLite's datetime('now') so it compares with matched_at.
  db.setSetting("resume_updated_at", new Date().toISOString().slice(0, 19).replace("T", " "));
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
