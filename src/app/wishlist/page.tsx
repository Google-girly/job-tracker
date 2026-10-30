import Link from "next/link";
import { WishlistActions } from "@/components/WishlistActions";
import { WishlistAdd } from "@/components/WishlistAdd";
import { listApplications } from "@/lib/db";
import type { Match } from "@/lib/match";
import { getResume } from "@/lib/resume";
import { scoreColor, wishlistJobs } from "@/lib/statuses";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const [apps, resume] = await Promise.all([listApplications(), getResume()]);
  const jobs = wishlistJobs(apps);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Wishlist</h1>
        <p className="text-sm text-zinc-500">Jobs you might apply to, best match first. Mark one Applied and it moves to your tracker.</p>
      </div>

      {!resume && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <Link href="/resume" className="font-medium underline">
            Add your resume
          </Link>{" "}
          so new jobs get scored.
        </p>
      )}

      <WishlistAdd />

      {jobs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Nothing here yet. Paste a job link above.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {jobs.map((job) => {
            const match: Match | null = job.match_json ? JSON.parse(job.match_json) : null;
            return (
              <li key={job.id} className="flex gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="shrink-0">
                  {job.match_score != null ? (
                    <span className={`inline-block w-12 rounded-lg py-2 text-center text-lg font-semibold tabular-nums ${scoreColor(job.match_score)}`}>
                      {job.match_score}
                    </span>
                  ) : (
                    <span className="inline-block w-12 rounded-lg bg-zinc-100 py-2 text-center text-lg text-zinc-400 dark:bg-zinc-900">–</span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div>
                    <p className="font-medium">
                      {job.role} <span className="text-zinc-500">· {job.company}</span>
                    </p>
                    {job.location && <p className="text-sm text-zinc-500">{job.location}</p>}
                  </div>
                  {match ? (
                    <>
                      <p className="text-sm">{match.verdict}</p>
                      {match.red_flags.length > 0 && (
                        <p className="text-sm text-rose-600">
                          ⚑ {match.red_flags[0]}
                          {match.red_flags.length > 1 && <span className="text-zinc-500"> (+{match.red_flags.length - 1} more)</span>}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-zinc-500">
                      {job.description ? "Not scored yet." : "No job description found. Open Details to paste it in."}
                    </p>
                  )}
                  <WishlistActions id={job.id} url={job.url} canScore={!match && Boolean(job.description && resume)} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
