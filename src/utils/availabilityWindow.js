/** Default booking window length (calendar days from start_date). */
export const AVAILABILITY_NUMBER_OF_DAYS = 5;

/** UK local hour at/after which tomorrow's slots are excluded. */
export const AVAILABILITY_CUTOFF_HOUR_UK = 18;

const LONDON_TZ = 'Europe/London';

/**
 * Calendar parts for a Date in Europe/London (handles BST/GMT).
 * @param {Date} date
 * @returns {{ year: number, month: number, day: number, hour: number }}
 */
export function getLondonParts(date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
  };
}

/**
 * Format as DD-MM-YYYY (Carolyn / Project Solar get-availability).
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} day 1-31
 */
export function formatDdMmYyyy(year, month, day) {
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${dd}-${mm}-${year}`;
}

/**
 * Add calendar days to a Y-M-D triple (UTC noon arithmetic avoids DST edge cases).
 * @returns {{ year: number, month: number, day: number }}
 */
export function addCalendarDays(year, month, day, deltaDays) {
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

/**
 * Query params for GET /get-availability.
 * Before 18:00 UK → start tomorrow; at/after 18:00 UK → start day after tomorrow.
 *
 * @param {Date} [now]
 * @returns {{ start_date: string, number_of_days: number }}
 */
export function getAvailabilityQueryParams(now = new Date()) {
  const london = getLondonParts(now);
  const offsetDays = london.hour >= AVAILABILITY_CUTOFF_HOUR_UK ? 2 : 1;
  const start = addCalendarDays(london.year, london.month, london.day, offsetDays);
  return {
    start_date: formatDdMmYyyy(start.year, start.month, start.day),
    number_of_days: AVAILABILITY_NUMBER_OF_DAYS,
  };
}

/**
 * Append start_date + number_of_days to a get-availability base URL that already has postcode.
 * @param {string} url
 * @param {Date} [now]
 */
export function appendAvailabilityWindowParams(url, now = new Date()) {
  const { start_date, number_of_days } = getAvailabilityQueryParams(now);
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}start_date=${encodeURIComponent(start_date)}&number_of_days=${number_of_days}`;
}
