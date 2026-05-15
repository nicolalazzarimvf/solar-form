import { corsHeaders, handleCors } from '../_shared/cors.ts';

const MVF_API_URL = 'https://sejpbjqjfxmehyvlweil.supabase.co/functions/v1';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    let phone = url.searchParams.get('phone')?.trim() ?? req.headers.get('phone')?.trim() ?? '';
    if (!phone && req.method === 'POST') {
      try {
        const body = (await req.json()) as { phone?: string };
        phone = body.phone?.trim() ?? '';
      } catch {
        /* ignore */
      }
    }

    if (!phone) {
      return new Response(JSON.stringify({ error: 'phone is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const apiKey = Deno.env.get('PROJECT_SOLAR_MVF_API_KEY');
    const mvfUrl = `${MVF_API_URL}/check-customer-eligibility?phone=${encodeURIComponent(phone)}`;
    const mvfHeaders: Record<string, string> = {};
    if (anonKey) {
      mvfHeaders.Authorization = `Bearer ${anonKey}`;
    } else if (apiKey) {
      mvfHeaders['x-api-key'] = apiKey;
      mvfHeaders.phone = phone;
    } else {
      return new Response(
        JSON.stringify({ error: 'SUPABASE_ANON_KEY or PROJECT_SOLAR_MVF_API_KEY not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const proxyRes = await fetch(mvfUrl, {
      method: 'GET',
      headers: mvfHeaders,
    });

    const data = await proxyRes.text();
    return new Response(data, {
      status: proxyRes.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
