/**
 * Batches funnel + API telemetry to the funnel-dashboard ingest API.
 * Only sends when submissionId is set (after Optimizely prefill).
 */

const MAX_EVENTS_PER_FLUSH = 50;
const FLUSH_DEBOUNCE_MS = 2500;
const MAX_JSON_CHARS = 12000;

let gettersRef = {
  getSubmissionId: () => '',
  getSessionId: () => '',
};

const queue = [];
let flushTimer = null;

/** Chameleon / dataLayer may send submissionId as a number. */
function normalizeId(value) {
  if (value == null || value === '') return '';
  return String(value).trim();
}

function getTelemetryConfig() {
  const url = (import.meta.env.VITE_FUNNEL_TELEMETRY_URL || '').trim();
  const key = (import.meta.env.VITE_FUNNEL_TELEMETRY_KEY || '').trim();
  return { url, key, enabled: Boolean(url && key) };
}

/**
 * @param {{ getSubmissionId: () => string, getSessionId: () => string }} getters
 */
export function configureFunnelTelemetry(getters) {
  gettersRef = getters;
}

function stringifyPayload(payload) {
  try {
    const s = JSON.stringify(payload ?? {});
    if (s.length <= MAX_JSON_CHARS) return payload ?? {};
    return {
      _truncated: true,
      chars: s.length,
      preview: s.slice(0, MAX_JSON_CHARS),
    };
  } catch {
    return { _error: 'stringify_failed' };
  }
}

/**
 * @param {object} opts
 * @param {string} opts.event_type
 * @param {string} [opts.step]
 * @param {string|null} [opts.response_summary]
 * @param {object} [opts.payload]
 * @param {string} [opts.submissionIdOverride] use when context ref is not updated yet (same tick as setState)
 * @param {string} [opts.sessionIdOverride]
 */
export function queueFunnelEvent({
  event_type,
  step = '',
  response_summary = null,
  payload = {},
  submissionIdOverride,
  sessionIdOverride,
}) {
  const submission_id = normalizeId(
    submissionIdOverride ?? gettersRef.getSubmissionId() ?? ''
  );
  if (!submission_id) return;
  const session_id = normalizeId(sessionIdOverride ?? gettersRef.getSessionId() ?? '');
  queue.push({
    submission_id,
    session_id,
    event_type,
    step,
    response_summary,
    payload: stringifyPayload(payload),
  });
  if (queue.length >= MAX_EVENTS_PER_FLUSH) {
    void flushFunnelTelemetry();
  } else {
    scheduleFlush();
  }
}

function scheduleFlush() {
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushFunnelTelemetry();
  }, FLUSH_DEBOUNCE_MS);
}

export async function flushFunnelTelemetry() {
  if (flushTimer != null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;
  const { url, key, enabled } = getTelemetryConfig();
  if (!enabled) {
    queue.length = 0;
    return;
  }
  const batch = queue.splice(0, MAX_EVENTS_PER_FLUSH);
  try {
    const res = await fetch(url.replace(/\/$/, ''), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ events: batch }),
    });
    if (!res.ok) {
      console.warn(
        '[funnelTelemetry] flush failed',
        res.status,
        await res.text().catch(() => '')
      );
      queue.unshift(...batch);
    }
  } catch (e) {
    console.warn('[funnelTelemetry] flush failed', e);
    queue.unshift(...batch);
  }
}

/** Best-effort flush when the tab hides (keepalive). */
function setupVisibilityFlush() {
  if (typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || queue.length === 0) return;
    const { url, key, enabled } = getTelemetryConfig();
    if (!enabled) return;
    const batch = queue.splice(0, MAX_EVENTS_PER_FLUSH);
    const endpoint = url.replace(/\/$/, '');
    try {
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      }).catch(() => {
        queue.unshift(...batch);
      });
    } catch {
      queue.unshift(...batch);
    }
  });
}

setupVisibilityFlush();

/** Redact obvious PII keys for stored payloads. */
export function redactTelemetryObject(obj, depth = 0) {
  if (obj == null || depth > 6) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.slice(0, 30).map((item) => redactTelemetryObject(item, depth + 1));
  }
  const out = {};
  const sensitive = new Set([
    'email',
    'emailAddress',
    'email_address',
    'phone',
    'phoneNumber',
    'phone_number',
    'mobile',
    'firstname',
    'lastname',
    'firstName',
    'lastName',
    'fullAddress',
    'addressLine',
  ]);
  for (const [k, v] of Object.entries(obj)) {
    if (sensitive.has(k)) {
      out[k] = v ? '[redacted]' : v;
    } else if (k === 'line1' || k === 'line_1' || k === 'line2' || k === 'line_2') {
      out[k] = v ? '[redacted]' : v;
    } else {
      out[k] = redactTelemetryObject(v, depth + 1);
    }
  }
  return out;
}

/** Trim large Google Solar-style payloads for storage. */
export function slimSolarResponseForTelemetry(data) {
  if (!data || typeof data !== 'object') return data;
  const { name, center, imageryDate, imageryProcessedDate, imageryQuality, solarPotential } = data;
  const stats = solarPotential?.roofSegmentStats;
  const panelN = solarPotential?.solarPanels?.length;
  return {
    name,
    center,
    imageryDate,
    imageryProcessedDate,
    imageryQuality,
    roofSegmentStatsCount: Array.isArray(stats) ? stats.length : 0,
    solarPanelsCount: typeof panelN === 'number' ? panelN : 0,
  };
}
