'use client';

import { useState } from 'react';

export function CollapsibleJson({
  label,
  data,
  defaultOpen = false,
}: {
  label: string;
  data: unknown;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  let text = '';
  try {
    text = JSON.stringify(data, null, 2);
  } catch {
    text = String(data);
  }
  const preview = text.length > 120 ? `${text.slice(0, 120)}…` : text;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-zinc-800 dark:text-zinc-200"
      >
        <span>{label}</span>
        <span className="text-zinc-500">{open ? '▼' : '▶'}</span>
      </button>
      {open ? (
        <pre className="max-h-96 overflow-auto border-t border-zinc-200 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
          {text}
        </pre>
      ) : (
        <div className="border-t border-zinc-200 px-3 py-2 font-mono text-xs text-zinc-500 dark:border-zinc-700">
          {preview}
        </div>
      )}
    </div>
  );
}
