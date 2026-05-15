import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findPostcodesWithSlots, loadOutwardCodesFromDisk } from '@/lib/findPostcodesWithSlots';

const DEFAULT_BASE = 'https://sejpbjqjfxmehyvlweil.supabase.co/functions/v1';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = (process.env.MVF_FUNCTIONS_BASE || DEFAULT_BASE).trim();
  const apiKey = (process.env.MVF_API_KEY || '').trim();

  let body: { n?: number; maxRequests?: number; distinctAreasOnly?: boolean };
  try {
    body = (await req.json().catch(() => ({}))) as {
      n?: number;
      maxRequests?: number;
      distinctAreasOnly?: boolean;
    };
  } catch {
    body = {};
  }

  const targetN = Math.min(25, Math.max(1, Number(body.n) || 3));
  const maxRequests = Math.min(2000, Math.max(targetN * 5, Number(body.maxRequests) || 500));
  const distinctAreasOnly = body.distinctAreasOnly !== false;

  let outwards: string[];
  try {
    outwards = loadOutwardCodesFromDisk();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load outward codes';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    const { hits, requests } = await findPostcodesWithSlots({
      baseUrl,
      apiKey,
      outwards,
      targetN,
      maxRequests,
      sleepMs: 40,
      distinctAreasOnly,
    });

    return NextResponse.json({
      ok: true,
      hits,
      requests,
      wanted: targetN,
      message:
        hits.length < targetN
          ? distinctAreasOnly
            ? `Found ${hits.length} of ${targetN} in different postcode areas within ${requests} requests. Try again or raise maxRequests.`
            : `Only found ${hits.length} of ${targetN} within ${requests} requests. Try again or raise maxRequests.`
          : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'get-availability failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
