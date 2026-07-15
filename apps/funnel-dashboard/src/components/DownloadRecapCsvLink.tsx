import Link from 'next/link';
import { buildRecapCsvHref } from '@/lib/recapCsv';

type Props = {
  dateFrom?: string;
  dateTo?: string;
  disabled?: boolean;
};

export function DownloadRecapCsvLink({ dateFrom, dateTo, disabled }: Props) {
  if (disabled) {
    return (
      <span
        className="inline-flex cursor-not-allowed items-center rounded-md border border-emerald-200/50 bg-white/50 px-3 py-1.5 text-xs font-medium text-emerald-800/50 dark:border-emerald-900/40 dark:bg-zinc-950/30 dark:text-emerald-400/40"
        aria-disabled
      >
        Download CSV
      </span>
    );
  }

  return (
    <Link
      href={buildRecapCsvHref(dateFrom, dateTo)}
      className="inline-flex items-center rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900 transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-200 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40"
    >
      Download CSV
    </Link>
  );
}
