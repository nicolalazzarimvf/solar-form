import { config } from '../config/env';

/**
 * Identifies Supabase Edge Function calls in funnel telemetry payloads.
 * @param {string} functionSlug e.g. 'get-availability', 'book-appointment'
 */
export function supabaseEdgeMeta(functionSlug) {
  let host = '';
  try {
    host = new URL(config.projectSolarMvfApiUrl).hostname;
  } catch {
    /* ignore */
  }
  const path = `/functions/v1/${functionSlug}`;
  return {
    provider: 'supabase_edge',
    edge_function: functionSlug,
    supabase_endpoint: host ? `https://${host}${path}` : path,
  };
}
