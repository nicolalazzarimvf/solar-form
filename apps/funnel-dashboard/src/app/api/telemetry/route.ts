import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

const MAX_BODY_BYTES = 512 * 1024;
const MAX_EVENTS = 100;

type IngestEvent = {
  submission_id: string;
  session_id?: string;
  event_type: string;
  step?: string;
  response_summary?: string | null;
  payload?: Record<string, unknown>;
};

function corsHeaders(req: NextRequest): HeadersInit {
  const origin = req.headers.get('origin') ?? '';
  const allowed = (process.env.ALLOWED_CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowOrigin =
    allowed.length === 0 ? '*' : allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function validateEvent(raw: unknown): IngestEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const submission_id = typeof o.submission_id === 'string' ? o.submission_id.trim() : '';
  const event_type = typeof o.event_type === 'string' ? o.event_type.trim() : '';
  if (!submission_id || !event_type) return null;
  const session_id = typeof o.session_id === 'string' ? o.session_id : '';
  const step = typeof o.step === 'string' ? o.step : '';
  const response_summary =
    o.response_summary === null || o.response_summary === undefined
      ? null
      : String(o.response_summary);
  const payload =
    o.payload && typeof o.payload === 'object' && !Array.isArray(o.payload)
      ? (o.payload as Record<string, unknown>)
      : {};
  return {
    submission_id,
    session_id,
    event_type,
    step,
    response_summary,
    payload,
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);
  const secret = process.env.TELEMETRY_INGEST_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Server misconfiguration' },
      { status: 500, headers }
    );
  }

  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  const contentLength = req.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413, headers });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers });
  }

  const eventsRaw = (body as { events?: unknown })?.events;
  if (!Array.isArray(eventsRaw) || eventsRaw.length === 0) {
    return NextResponse.json({ error: 'events array required' }, { status: 400, headers });
  }
  if (eventsRaw.length > MAX_EVENTS) {
    return NextResponse.json({ error: 'Too many events' }, { status: 400, headers });
  }

  const events: IngestEvent[] = [];
  for (const item of eventsRaw) {
    const v = validateEvent(item);
    if (!v) {
      return NextResponse.json({ error: 'Invalid event' }, { status: 400, headers });
    }
    events.push(v);
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const ev of events) {
      await client.query(
        `INSERT INTO journey_events (submission_id, session_id, event_type, step, response_summary, payload)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          ev.submission_id,
          ev.session_id ?? '',
          ev.event_type,
          ev.step ?? '',
          ev.response_summary,
          JSON.stringify(ev.payload ?? {}),
        ]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[telemetry] insert failed', e);
    return NextResponse.json({ error: 'Database error' }, { status: 500, headers });
  } finally {
    client.release();
  }

  return NextResponse.json({ ok: true, inserted: events.length }, { headers });
}
