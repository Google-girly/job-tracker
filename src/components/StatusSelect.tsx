"use client";

import { useTransition } from "react";
import { setStatus } from "@/app/actions";
import { STATUSES, statusInfo, type Status } from "@/lib/statuses";

export function StatusSelect({ id, status }: { id: number; status: Status }) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={pending}
      aria-label="Status"
      onChange={(e) => startTransition(() => setStatus(id, e.target.value as Status))}
      className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${statusInfo(status).color} disabled:opacity-50`}
    >
      {STATUSES.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
