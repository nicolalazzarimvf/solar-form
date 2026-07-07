/** Experimental deploy origins — ingest auto-tags events ADV when Origin matches. */
export const EXPERIMENTAL_SOLAR_FORM_ORIGINS = new Set([
  'https://solar-form-git-experimental-mvfs-projects-bffd3209.vercel.app',
]);

export function normalizeEventTags(raw: unknown, origin: string | null): string[] {
  const tags = new Set<string>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string' && item.trim()) tags.add(item.trim());
    }
  }
  if (origin && EXPERIMENTAL_SOLAR_FORM_ORIGINS.has(origin)) {
    tags.add('ADV');
  }
  return [...tags];
}
