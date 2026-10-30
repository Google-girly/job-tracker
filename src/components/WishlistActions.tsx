"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteApplication, setStatus } from "@/app/actions";
import { DeleteButton } from "./DeleteButton";

export function WishlistActions({ id, url }: { id: number; url: string | null }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Apply ↗
        </a>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => setStatus(id, "applied"))}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Applied
      </button>
      <Link href={`/applications/${id}`} className="px-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        Details
      </Link>
      <DeleteButton action={() => deleteApplication(id, false)} label="Remove" />
    </div>
  );
}
