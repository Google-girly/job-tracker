"use client";

import Link from "next/link";
import { useOptimistic, useState, startTransition } from "react";
import { setStatus } from "@/app/actions";
import { STATUSES, type Application, type Status } from "@/lib/statuses";

export function Board({ applications }: { applications: Application[] }) {
  const [apps, moveOptimistic] = useOptimistic(applications, (current, move: { id: number; status: Status }) =>
    current.map((a) => (a.id === move.id ? { ...a, status: move.status } : a)),
  );
  const [dragOver, setDragOver] = useState<Status | null>(null);

  function drop(status: Status, e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const id = Number(e.dataTransfer.getData("text/plain"));
    const app = apps.find((a) => a.id === id);
    if (!app || app.status === status) return;
    startTransition(async () => {
      moveOptimistic({ id, status });
      await setStatus(id, status);
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {/* Saved jobs live in the wishlist panel instead of a column. */}
      {STATUSES.filter((s) => s.id !== "saved").map((s) => {
        const column = apps.filter((a) => a.status === s.id);
        return (
          <section
            key={s.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(s.id);
            }}
            onDragLeave={() => setDragOver((cur) => (cur === s.id ? null : cur))}
            onDrop={(e) => drop(s.id, e)}
            className={`flex w-64 shrink-0 flex-col gap-2 rounded-lg p-2 transition-colors ${
              dragOver === s.id ? "bg-zinc-200 dark:bg-zinc-800" : "bg-zinc-100 dark:bg-zinc-900"
            }`}
          >
            <h2 className="flex items-center justify-between px-1 py-1 text-sm font-semibold">
              {s.label}
              <span className="rounded-full bg-white px-2 text-xs text-zinc-500 dark:bg-zinc-800">{column.length}</span>
            </h2>
            {column.map((a) => (
              <Link
                key={a.id}
                href={`/applications/${a.id}`}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", String(a.id))}
                className="cursor-grab rounded-md border border-zinc-200 bg-white p-3 shadow-sm hover:border-zinc-400 active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-950"
              >
                <p className="font-medium">{a.company}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{a.role}</p>
                {Boolean(a.location || a.applied_date || a.doc_count) && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {[a.location, a.applied_date, a.doc_count ? `📎 ${a.doc_count}` : null].filter(Boolean).join(" · ")}
                  </p>
                )}
              </Link>
            ))}
            {column.length === 0 && <p className="px-1 py-4 text-center text-xs text-zinc-400">Drop here</p>}
          </section>
        );
      })}
    </div>
  );
}
