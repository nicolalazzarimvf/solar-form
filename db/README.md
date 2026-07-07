# Funnel dashboard database (Heroku Postgres)

## Create database

1. In Heroku: add the **Heroku Postgres** add-on to an app (or create a new app for this).
2. Open the database **Settings** → copy **URI** (includes `sslmode=require`).

## Run migration

From your machine (Heroku CLI):

```bash
heroku pg:psql -a YOUR_HEROKU_APP_NAME -f db/migrations/001_journey_events.sql
```

Or with a raw connection string:

```bash
psql "$DATABASE_URL" -f db/migrations/001_journey_events.sql
psql "$DATABASE_URL" -f db/migrations/002_journey_event_tags.sql
```

## Vercel (funnel-dashboard)

Add the same URI to the **funnel-dashboard** Vercel project as `DATABASE_URL`.

Use **Settings → Environment Variables** for Production and Preview as needed.
