"use client";

import { useActionState } from "react";
import { deleteDocument, uploadDocuments, type FormState } from "@/app/actions";
import { ACCEPTED_FILE_TYPES, DOCUMENT_KINDS, type AppDocument } from "@/lib/statuses";
import { DeleteButton } from "./DeleteButton";

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function Documents({ applicationId, documents }: { applicationId: number; documents: AppDocument[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(uploadDocuments.bind(null, applicationId), {});

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div>
        <h2 className="font-semibold">Resume & cover letter</h2>
        <p className="text-sm text-zinc-500">The versions you sent for this job.</p>
      </div>

      {DOCUMENT_KINDS.map((kind) => {
        const docs = documents.filter((d) => d.kind === kind.id);
        if (docs.length === 0) return null;
        return (
          <div key={kind.id} className="flex flex-col gap-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">{kind.label}</h3>
            <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {docs.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span aria-hidden>📄</span>
                  <a href={`/documents/${doc.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium hover:underline">
                    {doc.filename}
                  </a>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {formatSize(doc.size)} · {doc.created_at.slice(0, 10)}
                  </span>
                  <a href={`/documents/${doc.id}?download=1`} className="shrink-0 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                    Download
                  </a>
                  <DeleteButton action={() => deleteDocument(doc.id)} label="Remove" />
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {documents.length === 0 && <p className="text-sm text-zinc-400">Nothing attached yet.</p>}

      <form action={formAction} className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <select
          name="kind"
          aria-label="Document type"
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {DOCUMENT_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          type="file"
          name="files"
          multiple
          required
          accept={ACCEPTED_FILE_TYPES}
          className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-100"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
        {state.error && <p className="w-full text-sm text-rose-600">{state.error}</p>}
      </form>
    </section>
  );
}
