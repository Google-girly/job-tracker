"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { addToWishlist } from "@/app/actions";

export function WishlistAdd({ compact = false }: { compact?: boolean }) {
  const [state, formAction, pending] = useActionState(addToWishlist, {});
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear the box only once a job is in; on an error the link stays so it can be fixed.
  useEffect(() => {
    if ((state.added || state.notice) && inputRef.current) inputRef.current.value = "";
  }, [state]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-2"
    >
      <div className={compact ? "flex flex-col gap-2" : "flex gap-2"}>
        <input
          ref={inputRef}
          type="url"
          name="url"
          required
          disabled={pending}
          placeholder={compact ? "Paste a job link" : "Paste a job link (Greenhouse, Lever, Ashby, Workday, career pages…)"}
          className="w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-800"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Reading & scoring…" : "Add"}
        </button>
      </div>
      {pending && (
        <p className="text-sm text-zinc-500">
          {compact
            ? "Usually ~10 seconds, up to a minute for hard-to-read pages…"
            : "Reading the posting and comparing it with your resume. Usually about 10 seconds; pages that need a deeper read (LinkedIn, Amazon, JavaScript-heavy sites) can take up to a minute."}
        </p>
      )}
      {!pending && state.error && <p className="text-sm text-rose-600">{state.error}</p>}
      {!pending && state.notice && <p className="text-sm text-amber-600">{state.notice}</p>}
      {!pending && state.added && <p className="text-sm text-emerald-600">Added and scored {state.added}.</p>}
    </form>
  );
}
