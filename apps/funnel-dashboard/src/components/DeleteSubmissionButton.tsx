'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  submissionId: string;
};

export function DeleteSubmissionButton({ submissionId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete all funnel events for this submission?\n\n${submissionId}\n\nThis cannot be undone.`
      )
    ) {
      return;
    }
    setPending(true);
    try {
      const res = await fetch(
        `/api/submissions/${encodeURIComponent(submissionId)}`,
        { method: 'DELETE', credentials: 'same-origin' }
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string; deleted?: number };
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        void handleDelete();
      }}
      disabled={pending}
      className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950"
    >
      {pending ? '…' : 'Delete'}
    </button>
  );
}
