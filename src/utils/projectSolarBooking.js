/**
 * Normalise raw phone input to E.164 UK (+44…) for Project Solar book-appointment.
 */
export function normalizeUkPhoneE164(raw) {
  const digits = String(raw || '')
    .trim()
    .replace(/\D/g, '');
  if (digits.length < 10) return '';
  if (digits.startsWith('44') && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `+44${digits.slice(1)}`;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `+44${digits.startsWith('0') ? digits.slice(1) : digits}`;
  }
  return '';
}

/**
 * Edge function returns { status, message, upstream_status, details } — not always { error }.
 */
export function formatBookAppointmentApiError(errorData) {
  if (!errorData || typeof errorData !== 'object') {
    return 'Failed to book appointment';
  }
  const chunks = [];
  if (typeof errorData.message === 'string' && errorData.message.trim()) {
    chunks.push(errorData.message.trim());
  }
  if (typeof errorData.error === 'string' && errorData.error.trim()) {
    chunks.push(errorData.error.trim());
  }
  if (typeof errorData.reason === 'string' && errorData.reason.trim()) {
    chunks.push(errorData.reason.trim());
  }
  const d = errorData.details;
  if (d != null) {
    if (typeof d === 'string') chunks.push(d);
    else if (typeof d === 'object' && !Array.isArray(d)) {
      if (typeof d.message === 'string') chunks.push(d.message);
      if (d.errors && typeof d.errors === 'object') {
        chunks.push(JSON.stringify(d.errors));
      } else if (!d.message) {
        chunks.push(JSON.stringify(d));
      }
    } else if (Array.isArray(d)) {
      chunks.push(d.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join('; '));
    }
  }
  if (errorData.upstream_status != null && errorData.upstream_status !== '') {
    chunks.push(`upstream HTTP ${errorData.upstream_status}`);
  }
  const out = chunks.filter(Boolean).join(' — ');
  return out || 'Failed to book appointment';
}
