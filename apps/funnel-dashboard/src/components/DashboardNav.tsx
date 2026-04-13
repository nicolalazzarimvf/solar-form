'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';

export function DashboardNav() {
  const { data: session } = useSession();

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-700">
      <div>
        <Link href="/" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Solar funnel dashboard
        </Link>
        <p className="text-sm text-zinc-500">
          {session?.user?.email ? `Signed in as ${session.user.email}` : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Sign out
      </button>
    </header>
  );
}
