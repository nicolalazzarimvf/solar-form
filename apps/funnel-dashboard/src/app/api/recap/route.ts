import { NextRequest, NextResponse } from 'next/server';
import { checkApiToken } from '@/lib/apiTokenAuth';
import { getPool } from '@/lib/db';
import { fetchRecapExport, parseRecapDateRange } from '@/lib/recapExport';

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, x-api-key',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonWithCors(body: unknown, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(corsHeaders())) {
    headers.set(key, value);
  }
  return NextResponse.json(body, { ...init, headers });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  const authError = checkApiToken(req);
  if (authError) {
    const headers = new Headers(authError.headers);
    for (const [key, value] of Object.entries(corsHeaders())) {
      headers.set(key, value);
    }
    return new NextResponse(authError.body, { status: authError.status, headers });
  }

  const dateFrom = req.nextUrl.searchParams.get('date_from') ?? undefined;
  const dateTo = req.nextUrl.searchParams.get('date_to') ?? undefined;
  const parsed = parseRecapDateRange(dateFrom ?? undefined, dateTo ?? undefined);

  if (!parsed.ok) {
    return jsonWithCors({ error: parsed.error }, { status: 400 });
  }

  try {
    const pool = getPool();
    const data = await fetchRecapExport(pool, parsed.range);
    return jsonWithCors(data);
  } catch (e) {
    console.error('[recap] export failed', e);
    return jsonWithCors({ error: 'Database error' }, { status: 500 });
  }
}
