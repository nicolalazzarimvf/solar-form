-- Heroku Postgres / any PostgreSQL 14+
-- Run once: psql $DATABASE_URL -f db/migrations/001_journey_events.sql

CREATE TABLE IF NOT EXISTS journey_events (
  id BIGSERIAL PRIMARY KEY,
  submission_id TEXT NOT NULL,
  session_id TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL,
  step TEXT NOT NULL DEFAULT '',
  response_summary TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journey_events_submission_created
  ON journey_events (submission_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_journey_events_session_created
  ON journey_events (session_id, created_at DESC);

COMMENT ON TABLE journey_events IS 'Solar booking funnel telemetry keyed by Chameleon submissionId';
