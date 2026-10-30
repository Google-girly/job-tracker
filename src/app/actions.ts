"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAllowedEmail } from "@/lib/allowed-email";
import { requireUser } from "@/lib/auth";
import * as db from "@/lib/db";
import { checkFile, removeApplicationFiles, removeDocument, saveDocument } from "@/lib/documents";
import { canonicalJobUrl, extractJob, type JobDetails } from "@/lib/extract";
import { isDocumentKind, isStatus, type DocumentKind, type Status } from "@/lib/statuses";
import { createAuthClient } from "@/lib/supabase/server";

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
  await requireUser();
  const input = parseForm(form);
  if ("error" in input) return input;

  const uploads = [
    { kind: "resume" as const, files: filesFrom(form, "resume") },
    { kind: "cover_letter" as const, files: filesFrom(form, "cover_letter") },
  ];
  const fileError = checkFiles(uploads);
  if (fileError) return { error: fileError };

  const id = await db.createApplication(input);
  await saveFiles(id, uploads);
  revalidatePath("/");
  redirect("/");
}

export async function updateApplication(id: number, _prev: FormState, form: FormData): Promise<FormState> {
  await requireUser();
  const input = parseForm(form);
  if ("error" in input) return input;
  await db.updateApplication(id, input);
  revalidatePath("/");
  redirect("/");
}

export async function setStatus(id: number, status: Status) {
  await requireUser();
  if (!isStatus(status)) throw new Error("Invalid status");
  await db.setStatus(id, status);
  revalidatePath("/");
  revalidatePath("/wishlist");
}

export async function autofillFromUrl(url: string): Promise<JobDetails | { error: string }> {
  await requireUser();
  try {
    const details = await extractJob(url.trim());
    if (!details.company && !details.role) return { error: "Couldn't find job details on that page. Fill it in manually." };
    return details;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't read that link." };
  }
}

export async function uploadDocuments(applicationId: number, _prev: FormState, form: FormData): Promise<FormState> {
  await requireUser();
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
  await requireUser();
  const doc = await db.getDocument(id);
  if (!doc) return;
  await removeDocument(doc);
  revalidatePath(`/applications/${doc.application_id}`);
  revalidatePath("/");
}

export async function deleteApplication(id: number, goHome = true) {
  await requireUser();
  await removeApplicationFiles(id);
  await db.deleteApplication(id);
  revalidatePath("/");
  revalidatePath("/wishlist");
  if (goHome) redirect("/");
}

export type WishlistState = { error?: string; added?: string };

// Paste a link: read the posting and save it as "Saved".
export async function addToWishlist(_prev: WishlistState, form: FormData): Promise<WishlistState> {
  await requireUser();
  let url: string;
  try {
    url = canonicalJobUrl(String(form.get("url") ?? ""));
  } catch {
    return { error: "That doesn't look like a link." };
  }

  const existing = await db.findApplicationByUrl(url);
  if (existing) return { error: `Already on your list: ${existing.company}, ${existing.role}.` };

  let details: JobDetails;
  try {
    details = await extractJob(url);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't read that link." };
  }
  if (!details.company || !details.role) {
    return { error: "Couldn't read the job from that page. Use + Add application to enter it by hand." };
  }

  await db.createApplication({
    company: details.company,
    role: details.role,
    url,
    location: details.location ?? null,
    source: details.source ?? null,
    status: "saved",
    applied_date: null,
    notes: null,
    description: details.description ?? null,
  });
  revalidatePath("/");
  revalidatePath("/wishlist");
  return { added: `${details.company}, ${details.role}` };
}

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Wrong email or password." };
  if (!isAllowedEmail(data.user.email)) {
    await supabase.auth.signOut();
    return { error: "This account doesn't have access." };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect("/login");
}
