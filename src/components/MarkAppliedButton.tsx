"use client";

import { useTransition } from "react";
import { setStatus } from "@/app/actions";

export function MarkAppliedButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setStatus(id, "applied"))}
      className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      {pending ? "Moving…" : "Applied"}
    </button>
  );
}
