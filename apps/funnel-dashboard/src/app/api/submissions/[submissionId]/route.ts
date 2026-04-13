import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPool } from '@/lib/db';

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ submissionId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { submissionId: raw } = await context.params;
  const submissionId = decodeURIComponent(raw ?? '').trim();
  if (!submissionId) {
    return NextResponse.json({ error: 'Invalid submission id' }, { status: 400 });
  }

  try {
    const pool = getPool();
    const result = await pool.query('DELETE FROM journey_events WHERE submission_id = $1', [
      submissionId,
    ]);
    const deleted = result.rowCount ?? 0;
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Database error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
