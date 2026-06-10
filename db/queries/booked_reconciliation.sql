-- Read-only reconciliation for the "Booked" filter fix.
--
-- Context: the submission-list "Booked" quick filter used to match only when
-- "Booking succeeded" was a submission's LATEST event. Users frequently navigate
-- on after booking (which appends a newer page_view), so those bookings were
-- hidden. The filter now matches a booking recorded at ANY point, which also
-- makes it consistent with the recap "Booked" card.
--
-- Run this against the dashboard database BEFORE release and record the numbers
-- in the PR. `hidden_by_old_filter` is the count the old logic was dropping;
-- `booked_any_event` should equal the recap "Booked" value for the same window.
--
--   psql "$DATABASE_URL" -f db/queries/booked_reconciliation.sql
--
-- To compare against the rolling 7-day recap window, uncomment the WHERE lines.

WITH latest AS (
  SELECT DISTINCT ON (submission_id)
    submission_id, step, event_type
  FROM journey_events
  -- WHERE created_at >= NOW() - INTERVAL '7 days'
  ORDER BY submission_id, created_at DESC, id DESC
),
latest_booked AS (
  SELECT COUNT(*)::bigint AS n
  FROM latest
  WHERE step ILIKE '%Confirmation: Booking succeeded%'
    AND event_type ILIKE '%booking_result%'
),
any_booked AS (
  SELECT COUNT(DISTINCT submission_id)::bigint AS n
  FROM journey_events
  WHERE step ILIKE '%Confirmation: Booking succeeded%'
    AND event_type ILIKE '%booking_result%'
    -- AND created_at >= NOW() - INTERVAL '7 days'
)
SELECT
  (SELECT n FROM latest_booked) AS booked_latest_only,
  (SELECT n FROM any_booked)    AS booked_any_event,
  (SELECT n FROM any_booked) - (SELECT n FROM latest_booked) AS hidden_by_old_filter;
