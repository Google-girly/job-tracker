import Link from "next/link";
import type { Match } from "@/lib/match";
import { scoreColor, type Application } from "@/lib/statuses";
import { MarkAppliedButton } from "./MarkAppliedButton";
import { WishlistAdd } from "./WishlistAdd";

// Right-hand panel on the dashboard: wishlist jobs best match first, scrolling independently of the board.
export function WishlistSidebar({ jobs }: { jobs: Application[] }) {
  return (
    <aside className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 lg:sticky lg:top-6 lg:max-h-[calc(100vh-6rem)] dark:border-zinc-800">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">
          Wishlist <span className="text-sm font-normal text-zinc-500">({jobs.length})</span>
        </h2>
        <Link href="/wishlist" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          Full view →
        </Link>
      </div>

      <WishlistAdd compact />

      {jobs.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">Paste a job link to start your wishlist.</p>
      ) : (
        <ol className="-mx-1 flex min-h-0 flex-col gap-2 overflow-y-auto px-1">
          {jobs.map((job) => {
            const match: Match | null = job.match_json ? JSON.parse(job.match_json) : null;
            return (
              <li key={job.id} className="flex gap-3 rounded-md border border-zinc-200 p-2.5 dark:border-zinc-800">
                {job.match_score != null ? (
                  <span className={`h-fit shrink-0 rounded-md px-1.5 py-1 text-sm font-semibold tabular-nums ${scoreColor(job.match_score)}`}>
                    {job.match_score}
                  </span>
                ) : (
                  <span className="h-fit shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-sm text-zinc-400 dark:bg-zinc-900">–</span>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Link href={`/applications/${job.id}`} className="min-w-0 hover:underline">
                    <p className="truncate text-sm font-medium" title={job.role}>
                      {job.role}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {[job.company, job.location].filter(Boolean).join(" · ")}
                    </p>
                  </Link>
                  {match && match.red_flags.length > 0 && (
                    <p className="truncate text-xs text-rose-600" title={match.red_flags.join("\n")}>
                      ⚑ {match.red_flags[0]}
                    </p>
                  )}
                  <div className="flex gap-2">
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                      >
                        Apply ↗
                      </a>
                    )}
                    <MarkAppliedButton id={job.id} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
