import { describe, expect, it } from 'vitest';
import { buildRecapCsvHref, escapeCsvCell, recapSubmissionsToCsv } from './recapCsv';
import type { RecapSubmissionRow } from './recapExport';

describe('escapeCsvCell', () => {
  it('leaves simple strings unquoted', () => {
    expect(escapeCsvCell('booked')).toBe('booked');
  });

  it('quotes strings with commas', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
  });

  it('escapes embedded double quotes', () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });
});

describe('recapSubmissionsToCsv', () => {
  it('includes header and one data row', () => {
    const rows: RecapSubmissionRow[] = [
      {
        submission_id: '123',
        status: 'booked',
        first_at: '2026-07-10T09:00:00.000Z',
        last_at: '2026-07-10T10:00:00.000Z',
        last_step: 'Confirmation: Booking succeeded',
        last_event_type: 'booking_result',
        tags: ['ADV'],
        milestones: {
          saw_form: true,
          started: true,
          reached_booking: true,
          booked: true,
        },
      },
    ];

    const csv = recapSubmissionsToCsv(rows);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe(
      'submission_id,status,first_at,last_at,last_step,last_event_type,tags,milestone_saw_form,milestone_started,milestone_reached_booking,milestone_booked'
    );
    expect(lines[1]).toContain('123,booked,');
    expect(lines[1]).toContain('ADV');
  });
});

describe('buildRecapCsvHref', () => {
  it('builds href with date params', () => {
    expect(buildRecapCsvHref('2026-07-01', '2026-07-07')).toBe(
      '/api/recap/csv?date_from=2026-07-01&date_to=2026-07-07'
    );
  });

  it('omits empty params', () => {
    expect(buildRecapCsvHref('', '')).toBe('/api/recap/csv');
  });
});
