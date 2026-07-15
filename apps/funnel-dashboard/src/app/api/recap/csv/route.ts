import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPool } from '@/lib/db';
import { recapCsvFilename, recapSubmissionsToCsv } from '@/lib/recapCsv';
import { fetchRecapExport, parseRecapDateRange } from '@/lib/recapExport';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dateFrom = req.nextUrl.searchParams.get('date_from') ?? undefined;
  const dateTo = req.nextUrl.searchParams.get('date_to') ?? undefined;
  const parsed = parseRecapDateRange(dateFrom ?? undefined, dateTo ?? undefined);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const pool = getPool();
    const data = await fetchRecapExport(pool, parsed.range);
    const csv = recapSubmissionsToCsv(data.submissions);
    const filename = recapCsvFilename(parsed.range.dateFrom, parsed.range.dateTo);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[recap/csv] export failed', e);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
