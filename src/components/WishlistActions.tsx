"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteApplication, scoreApplication, setStatus } from "@/app/actions";
import { DeleteButton } from "./DeleteButton";

type Props = { id: number; url: string | null; canScore: boolean };

const secondary =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function WishlistActions({ id, url, canScore }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

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
      <button type="button" disabled={pending} onClick={() => startTransition(() => setStatus(id, "applied"))} className={secondary}>
        Applied
      </button>
      {canScore && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(undefined);
              const result = await scoreApplication(id);
              if (result.error) setError(result.error);
            })
          }
          className={secondary}
        >
          {pending ? "Scoring…" : "Score"}
        </button>
      )}
      <Link href={`/applications/${id}`} className="px-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        Details
      </Link>
      <DeleteButton action={() => deleteApplication(id, false)} label="Remove" />
      {error && <p className="w-full text-sm text-rose-600">{error}</p>}
    </div>
  );
}
