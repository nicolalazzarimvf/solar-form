/**
 * Browser-safe proxy for MVF check-customer-eligibility (MVF endpoint lacks CORS on preflight).
 * GET ?phone=<E.164> — no auth required from the client; Bearer anon is added server-side.
 */
const DEFAULT_MVF_BASE = 'https://sejpbjqjfxmehyvlweil.supabase.co/functions/v1';
const DEFAULT_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlanBianFqZnhtZWh5dmx3ZWlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI2MzMwODYsImV4cCI6MjA0ODIwOTA4Nn0.8pFmhFXMPhVPkSHnVJlWDuey0FUFa0dHHkT8yvYbNJs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function setCors(res) {
  for (const [key, value] of Object.entries(CORS)) {
    res.setHeader(key, value);
  }
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
  if (!phone) {
    res.status(400).json({ error: 'phone query param required' });
    return;
  }

  const base = (process.env.MVF_FUNCTIONS_BASE || DEFAULT_MVF_BASE).replace(/\/$/, '');
  const anon =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_ANON;
  const mvfUrl = `${base}/check-customer-eligibility?phone=${encodeURIComponent(phone)}`;

  try {
    const mvfRes = await fetch(mvfUrl, {
      headers: { Authorization: `Bearer ${anon}` },
    });
    const body = await mvfRes.text();
    res.status(mvfRes.status);
    res.setHeader('Content-Type', 'application/json');
    res.end(body);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
