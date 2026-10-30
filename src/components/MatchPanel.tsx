"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { scoreApplication } from "@/app/actions";
import type { Match } from "@/lib/match";
import { scoreColor } from "@/lib/statuses";

const LEVELS: Record<Match["level"], string> = {
  new_grad: "New grad",
  entry: "Entry level",
  mid: "Mid level",
  senior: "Senior",
  unclear: "Level unclear",
};

type Props = {
  applicationId: number;
  match: Match | null;
  matchedAt: string | null;
  hasResume: boolean;
  hasDescription: boolean;
  resumeUpdatedAt: string | null;
};

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</h3>
      <ul className="flex flex-col gap-1 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className={tone} aria-hidden>
              •
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MatchPanel({ applicationId, match, matchedAt, hasResume, hasDescription, resumeUpdatedAt }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const score = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await scoreApplication(applicationId);
      if (result.error) setError(result.error);
    });

  const staleResume = match && matchedAt && resumeUpdatedAt && resumeUpdatedAt > matchedAt;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Resume match</h2>
          <p className="text-sm text-zinc-500">How well this job fits your resume.</p>
        </div>
        {hasResume && hasDescription && (
          <button
            type="button"
            onClick={score}
            disabled={pending}
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {pending ? "Scoring…" : match ? "Re-score" : "Score match"}
          </button>
        )}
      </div>

      {!hasResume ? (
        <p className="text-sm text-zinc-500">
          <Link href="/resume" className="font-medium text-zinc-900 underline dark:text-zinc-100">
            Add your resume
          </Link>{" "}
          to score jobs.
        </p>
      ) : !hasDescription ? (
        <p className="text-sm text-zinc-500">Add the job description above (Autofill usually grabs it), save, then score.</p>
      ) : !match ? (
        <p className="text-sm text-zinc-500">{pending ? "Comparing your resume with this posting…" : "Not scored yet."}</p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <span className={`rounded-lg px-3 py-2 text-2xl font-semibold tabular-nums ${scoreColor(match.score)}`}>{match.score}</span>
            <div className="min-w-0">
              <p className="text-sm">{match.verdict}</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {LEVELS[match.level]} · Scored {matchedAt?.slice(0, 10)}
              </p>
            </div>
          </div>
          {staleResume && (
            <p className="text-xs text-amber-600">You&apos;ve updated your resume since this was scored. Re-score to refresh it.</p>
          )}
          <List title="Red flags" items={match.red_flags} tone="text-rose-500" />
          <div className="grid gap-4 sm:grid-cols-2">
            <List title="You have" items={match.matched_skills} tone="text-emerald-500" />
            <List title="You're missing" items={match.missing_skills} tone="text-amber-500" />
          </div>
          <List title="Tailoring tips" items={match.tailoring_tips} tone="text-blue-500" />
        </>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </section>
  );
}
