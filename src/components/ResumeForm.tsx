"use client";

import { startTransition, useActionState } from "react";
import { saveResume } from "@/app/actions";

export function ResumeForm({ text }: { text: string }) {
  const [state, formAction, pending] = useActionState(saveResume, {});

  return (
    <form
      // onSubmit instead of the action prop so React doesn't clear the textarea after saving.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        e.currentTarget.querySelector<HTMLInputElement>('input[type="file"]')!.value = "";
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Upload a new version (PDF, .docx, or .txt)
        <input
          type="file"
          name="file"
          accept=".pdf,.docx,.txt,.md"
          className="text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-100"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Resume text
        <span className="text-xs font-normal text-zinc-500">
          This is exactly what gets compared with each job. Fix anything the file import garbled, or paste your resume here directly.
        </span>
        <textarea
          name="text"
          // Remount with fresh text after an upload replaces it.
          key={text}
          defaultValue={text}
          rows={24}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-800"
          placeholder="Paste your resume here…"
        />
      </label>

      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}
      {state.saved && !pending && <p className="text-sm text-emerald-600">Saved.</p>}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Saving…" : "Save resume"}
        </button>
      </div>
    </form>
  );
}
