import { NextRequest, NextResponse } from 'next/server';

function extractToken(req: NextRequest): string {
  const bearer = req.headers.get('authorization') ?? '';
  if (bearer.startsWith('Bearer ')) {
    return bearer.slice(7).trim();
  }
  return (req.headers.get('x-api-key') ?? '').trim();
}

/**
 * Validates a static API token from Authorization: Bearer or x-api-key.
 * Returns a NextResponse on failure, or null when auth succeeds.
 */
export function checkApiToken(
  req: NextRequest,
  envVar = 'RECAP_API_TOKEN'
): NextResponse | null {
  const secret = process.env[envVar]?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const token = extractToken(req);
  if (!token || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
