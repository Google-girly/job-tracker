import { WishlistActions } from "@/components/WishlistActions";
import { WishlistAdd } from "@/components/WishlistAdd";
import { listApplications } from "@/lib/db";
import { wishlistJobs } from "@/lib/statuses";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const jobs = wishlistJobs(await listApplications());

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Wishlist</h1>
        <p className="text-sm text-zinc-500">Jobs you might apply to, newest first. Mark one Applied and it moves to your tracker.</p>
      </div>

      <WishlistAdd />

      {jobs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Nothing here yet. Paste a job link above.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {jobs.map((job) => (
            <li key={job.id} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div>
                <p className="font-medium">
                  {job.role} <span className="text-zinc-500">· {job.company}</span>
                </p>
                <p className="text-sm text-zinc-500">
                  {[job.location, job.source, `added ${job.created_at.slice(0, 10)}`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <WishlistActions id={job.id} url={job.url} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
