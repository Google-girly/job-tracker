"use client";

import { useState, useTransition } from "react";

// Two-click confirm instead of window.confirm().
export function DeleteButton({ action, label = "Delete" }: { action: () => Promise<void>; label?: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => (armed ? startTransition(action) : setArmed(true))}
      onBlur={() => setArmed(false)}
      className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950"
    >
      {pending ? "Deleting…" : armed ? "Click again to confirm" : label}
    </button>
  );
}
