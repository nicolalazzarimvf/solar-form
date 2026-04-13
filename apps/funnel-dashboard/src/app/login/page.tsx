import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { loginWithGoogle } from './actions';

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Solar funnel dashboard
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          MVF Google accounts only (@mvfglobal.com).
        </p>
        <form action={loginWithGoogle}>
          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Sign in with Google
          </button>
        </form>
      </div>
    </div>
  );
}
