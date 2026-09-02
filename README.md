# Schafer Olympics

Schafer Olympics is a Cloudflare Worker + static-assets application with **Supabase as the production source of truth** for events, participants, registrations, scorecards, tournament state, and Olympic standings.

## Production architecture

```text
Browser / scoring device
        |
        v
Cloudflare Worker
        |
        v
Supabase PostgreSQL / REST API
        |
        +---- optional background backup ----> Notion
```

The browser never receives the Supabase secret key or the Notion API token. Server-side API routes run through the Worker and use Cloudflare secrets.

## Public scoreboard

`GET /api/scores` reads `olympic_events` from Supabase and calculates standings from the stored placement arrays and event point values.

The outer Worker applies a short Cloudflare edge cache to public score reads so many spectators refreshing at once do not generate the same database request repeatedly.

Supabase remains the source of truth. The scoreboard does not require Notion to be available.

## Score entry

Event-specific scorecards and tournament controllers save their operational state to Supabase. Server-side Worker code validates and derives event placements/status before updating the event results used by the public standings.

Existing score-entry autosave behavior is intentionally preserved.

## Required Cloudflare secrets

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `ADMIN_SCORE_CODE`
- `DISCORD_WEBHOOK_URL`

`SUPABASE_SECRET_KEY` must remain server-side only and must never be added to browser JavaScript or committed to this repository.

## Optional Notion backup

`NOTION_API_TOKEN` is optional. When configured, supported write paths can send backup updates to Notion using `ctx.waitUntil(...)`. Backup failures are caught and logged and do not determine whether the primary Supabase operation succeeds.

If Notion backup is not wanted, the Worker can operate without `NOTION_API_TOKEN`.

## Data model

Primary Supabase tables include:

- `olympic_events`
- `participants`
- `registrations`
- `event_participants`
- `event_pairs`
- `event_scorecards`
- `cornhole_matches`
- `adult_soccer_matches`
- `wiffle_ball_matches`
- `kids_soccer_sides`
- `slip_slide_entries`
- `egg_toss_results`

SQL/schema and migration utilities are kept under `supabase/`.

## Deployment

Cloudflare Worker configuration is in `wrangler.jsonc`. Static assets are served from the repository root and `/api/*` requests run through the Worker first.

The configured Worker entry point is `worker-kids-soccer.js`, which delegates through the composed Worker modules for the remaining API routes.

## Reliability notes

- Public score reads are cached briefly at the Cloudflare edge.
- Production reads/writes use Supabase rather than Notion.
- Notion backup is optional and asynchronous.
- Row-level security is enabled on the Supabase public tables; server-side Worker access uses the secret Supabase credential.
- Operational datasets are small and indexed for the current event workload.
