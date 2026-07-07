-- Tags for funnel events (e.g. ADV = CRO-693 experimental build).
-- Run once: psql "$DATABASE_URL" -f db/migrations/002_journey_event_tags.sql

ALTER TABLE journey_events
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_journey_events_tags_gin
  ON journey_events USING GIN (tags);

COMMENT ON COLUMN journey_events.tags IS 'Labels such as ADV (experimental solar-form deploy); filterable in funnel dashboard';
