import Link from "next/link";
import { Board } from "@/components/Board";
import { StatusSelect } from "@/components/StatusSelect";
import { WishlistSidebar } from "@/components/WishlistSidebar";
import { listApplications } from "@/lib/db";
import { wishlistJobs, type Application } from "@/lib/statuses";

export const dynamic = "force-dynamic";

function stats(apps: Application[]) {
  const applied = apps.filter((a) => a.status !== "saved");
  const responded = applied.filter((a) => ["oa", "interview", "offer", "rejected"].includes(a.status));
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return [
    { label: "Applied", value: applied.length },
    { label: "This week", value: applied.filter((a) => a.applied_date && a.applied_date >= weekAgo).length },
    { label: "Response rate", value: applied.length ? `${Math.round((responded.length / applied.length) * 100)}%` : "–" },
    { label: "Interviews", value: apps.filter((a) => a.status === "interview" || a.status === "offer").length },
    { label: "Offers", value: apps.filter((a) => a.status === "offer").length },
  ];
}

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view = "board" } = await searchParams;
  const apps = await listApplications();

  const tab = (id: string, label: string) => (
    <Link
      href={`/?view=${id}`}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        view === id
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
      }`}
    >
      {label}
    </Link>
  );

  return (
    // Board on the left, wishlist panel on the right (stacked below on small screens).
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats(apps).map((s) => (
            <div key={s.label} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs uppercase tracking-wide text-zinc-500">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1">
          {tab("board", "Board")}
          {tab("table", "Table")}
        </div>

        {apps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-zinc-500">No applications yet.</p>
            <Link href="/applications/new" className="mt-2 inline-block text-sm font-medium underline">
              Add your first one
            </Link>
          </div>
        ) : view === "table" ? (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Applied</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {apps.map((a) => (
                  <tr key={a.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className="px-4 py-3 font-medium">
                      {a.url ? (
                        <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">
                          {a.company} ↗
                        </a>
                      ) : (
                        a.company
                      )}
                    </td>
                    <td className="px-4 py-3">{a.role}</td>
                    <td className="px-4 py-3">
                      <StatusSelect id={a.id} status={a.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-500">{a.applied_date ?? "–"}</td>
                    <td className="px-4 py-3 text-zinc-500">{a.location ?? "–"}</td>
                    <td className="px-4 py-3 text-zinc-500">{a.source ?? "–"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/applications/${a.id}`} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Board applications={apps} />
        )}
      </div>
      <WishlistSidebar jobs={wishlistJobs(apps)} />
    </div>
  );
}
