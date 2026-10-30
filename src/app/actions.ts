"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import * as db from "@/lib/db";
import { checkFile, removeApplicationFiles, removeDocument, saveDocument } from "@/lib/documents";
import { extractJob, type JobDetails } from "@/lib/extract";
import { MatchError, scoreMatch } from "@/lib/match";
import { extractResumeText, getResume, saveResume as storeResume } from "@/lib/resume";
import { isDocumentKind, isStatus, type DocumentKind, type Status } from "@/lib/statuses";

export type FormState = { error?: string };

function optional(form: FormData, key: string): string | null {
  const value = String(form.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function filesFrom(form: FormData, key: string): File[] {
  return form.getAll(key).filter((f): f is File => f instanceof File && f.size > 0);
}

async function saveFiles(applicationId: number, uploads: { kind: DocumentKind; files: File[] }[]) {
  for (const { kind, files } of uploads) {
    for (const file of files) await saveDocument(applicationId, kind, file);
  }
}

function checkFiles(uploads: { files: File[] }[]): string | undefined {
  return uploads.flatMap((u) => u.files.map(checkFile)).find(Boolean);
}

function parseForm(form: FormData): db.ApplicationInput | { error: string } {
  const company = optional(form, "company");
  const role = optional(form, "role");
  const status = form.get("status");
  const url = optional(form, "url");

  if (!company || !role) return { error: "Company and role are required." };
  if (!isStatus(status)) return { error: "Pick a valid status." };
  if (url && !/^https?:\/\//i.test(url)) return { error: "Link must start with http:// or https://" };

  return {
    company,
    role,
    url,
    status,
    location: optional(form, "location"),
    source: optional(form, "source"),
    applied_date: optional(form, "applied_date"),
    notes: optional(form, "notes"),
    description: optional(form, "description"),
  };
}

export async function createApplication(_prev: FormState, form: FormData): Promise<FormState> {
  const input = parseForm(form);
  if ("error" in input) return input;

  const uploads = [
    { kind: "resume" as const, files: filesFrom(form, "resume") },
    { kind: "cover_letter" as const, files: filesFrom(form, "cover_letter") },
  ];
  const fileError = checkFiles(uploads);
  if (fileError) return { error: fileError };

  const id = db.createApplication(input);
  await saveFiles(id, uploads);
  // Score in the background so saving doesn't wait on the model.
  if (input.description && getResume() && process.env.ANTHROPIC_API_KEY) {
    after(() => runScore(id).catch((e) => console.error(`Auto-scoring application ${id} failed:`, e)));
  }
  revalidatePath("/");
  redirect("/");
}

export async function updateApplication(id: number, _prev: FormState, form: FormData): Promise<FormState> {
  const input = parseForm(form);
  if ("error" in input) return input;
  db.updateApplication(id, input);
  revalidatePath("/");
  redirect("/");
}

export async function setStatus(id: number, status: Status) {
  if (!isStatus(status)) throw new Error("Invalid status");
  db.setStatus(id, status);
  revalidatePath("/");
}

export async function autofillFromUrl(url: string): Promise<JobDetails | { error: string }> {
  try {
    const details = await extractJob(url.trim());
    if (!details.company && !details.role) return { error: "Couldn't find job details on that page. Fill it in manually." };
    return details;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't read that link." };
  }
}

export async function uploadDocuments(applicationId: number, _prev: FormState, form: FormData): Promise<FormState> {
  const kind = form.get("kind");
  if (!isDocumentKind(kind)) return { error: "Pick what kind of document this is." };
  const uploads = [{ kind, files: filesFrom(form, "files") }];
  if (uploads[0].files.length === 0) return { error: "Choose a file to upload." };
  const fileError = checkFiles(uploads);
  if (fileError) return { error: fileError };

  await saveFiles(applicationId, uploads);
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/");
  return {};
}

export async function deleteDocument(id: number) {
  const doc = db.getDocument(id);
  if (!doc) return;
  await removeDocument(doc);
  revalidatePath(`/applications/${doc.application_id}`);
  revalidatePath("/");
}

async function runScore(id: number) {
  const app = db.getApplication(id);
  const resume = getResume();
  if (!app?.description || !resume) return;
  const match = await scoreMatch(resume.text, { company: app.company, role: app.role, description: app.description });
  db.saveMatch(id, match.score, JSON.stringify(match));
}

export async function scoreApplication(id: number): Promise<{ error?: string }> {
  const app = db.getApplication(id);
  if (!app) return { error: "Application not found." };
  if (!getResume()) return { error: "Add your resume first." };
  if (!app.description) return { error: "Add the job description first." };
  try {
    await runScore(id);
  } catch (e) {
    if (e instanceof MatchError) return { error: e.message };
    console.error(e);
    return { error: "Scoring failed. Check the terminal running the dev server for details." };
  }
  revalidatePath(`/applications/${id}`);
  revalidatePath("/");
  return {};
}

export async function saveResume(_prev: FormState & { saved?: boolean }, form: FormData): Promise<FormState & { saved?: boolean }> {
  const file = filesFrom(form, "file")[0];
  let text = String(form.get("text") ?? "").trim();
  let filename = getResume()?.filename ?? null;

  if (file) {
    if (file.size > 10 * 1024 * 1024) return { error: "That file is over 10 MB." };
    try {
      text = (await extractResumeText(file)).trim();
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Couldn't read that file." };
    }
    if (!text) return { error: "Couldn't find any text in that file. If it's a scanned PDF, paste the text instead." };
    filename = file.name;
  }
  if (!text) return { error: "Upload a file or paste your resume text." };

  storeResume(text, filename);
  revalidatePath("/", "layout");
  return { saved: true };
}

export async function deleteApplication(id: number) {
  db.deleteApplication(id);
  await removeApplicationFiles(id);
  revalidatePath("/");
  redirect("/");
}
