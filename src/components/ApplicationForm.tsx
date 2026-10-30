"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef, useState } from "react";
import { autofillFromUrl, type FormState } from "@/app/actions";
import { ACCEPTED_FILE_TYPES, STATUSES, type Application } from "@/lib/statuses";

type Props = {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  initial?: Application;
  submitLabel: string;
};

const fileInput =
  "text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-100";

const input =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-800";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

export function ApplicationForm({ action, initial, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [autofill, setAutofill] = useState<{ pending?: boolean; message?: string; error?: boolean }>({});

  const field = (name: string) => formRef.current!.elements.namedItem(name) as HTMLInputElement;

  async function runAutofill() {
    const url = field("url").value.trim();
    if (!url) return setAutofill({ message: "Paste a job link first.", error: true });

    setAutofill({ pending: true });
    const result = await autofillFromUrl(url);
    if ("error" in result) return setAutofill({ message: result.error, error: true });

    const filled = (["company", "role", "location", "source", "description"] as const).filter((key) => {
      if (result[key]) field(key).value = result[key];
      return result[key];
    });
    setAutofill({ message: `Filled ${filled.join(", ")}. Double-check before saving.` });
  }

  return (
    <form
      ref={formRef}
      // Submitting via onSubmit (not the action prop) stops React from clearing the form when the server returns an error.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-4"
    >
      <Field label="Job posting link">
        <div className="flex gap-2">
          <input
            type="url"
            name="url"
            defaultValue={initial?.url ?? ""}
            className={input}
            placeholder="Paste a link to autofill: Greenhouse, Lever, Ashby, company career pages…"
            // Autofill on paste when the form is still blank.
            onPaste={() => setTimeout(() => !field("company").value && !field("role").value && runAutofill())}
          />
          <button
            type="button"
            onClick={runAutofill}
            disabled={autofill.pending}
            className="shrink-0 rounded-md border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {autofill.pending ? "Reading…" : "Autofill"}
          </button>
        </div>
        {autofill.message && (
          <span className={`text-xs font-normal ${autofill.error ? "text-rose-600" : "text-emerald-600"}`}>{autofill.message}</span>
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company *">
          <input name="company" required defaultValue={initial?.company} className={input} placeholder="Stripe" />
        </Field>
        <Field label="Role *">
          <input name="role" required defaultValue={initial?.role} className={input} placeholder="Software Engineer, New Grad" />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={initial?.status ?? "saved"} className={input}>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date applied">
          <input type="date" name="applied_date" defaultValue={initial?.applied_date ?? ""} className={input} />
        </Field>
        <Field label="Location">
          <input name="location" defaultValue={initial?.location ?? ""} className={input} placeholder="San Francisco / Remote" />
        </Field>
        <Field label="Source">
          <input name="source" defaultValue={initial?.source ?? ""} className={input} placeholder="LinkedIn, referral, career fair…" />
        </Field>
      </div>
      <Field label="Job description">
        <textarea
          name="description"
          rows={8}
          defaultValue={initial?.description ?? ""}
          className={input}
          placeholder="Autofill usually pulls this in. Otherwise paste the posting here for reference."
        />
      </Field>
      <Field label="Notes">
        <textarea
          name="notes"
          rows={5}
          defaultValue={initial?.notes ?? ""}
          className={input}
          placeholder="Recruiter name, interview questions, follow-up dates…"
        />
      </Field>

      {!initial && (
        // On the edit page, documents are managed in their own section.
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Resume for this job">
            <input type="file" name="resume" accept={ACCEPTED_FILE_TYPES} className={fileInput} />
          </Field>
          <Field label="Cover letter">
            <input type="file" name="cover_letter" accept={ACCEPTED_FILE_TYPES} className={fileInput} />
          </Field>
        </div>
      )}

      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          Cancel
        </Link>
      </div>
    </form>
  );
}
