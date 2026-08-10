# EDEN — RETIRED

**This service is no longer part of the running system. Do not deploy it, and do
not add features here.**

## What it was

A FastAPI service on port 8000 serving the campus events feed: `/events/*`,
`/rsvp/*`, and `/clubs`. The React frontend called it directly via
`VITE_EVENTS_API_URL`.

## Why it was retired

- It read and wrote the **same Postgres** the Express backend already connects
  to. `events`, `clubs`, `event_posts`, `event_rsvps`, `collaborations`, and
  `sponsors` are all in the main database — the split bought no isolation.
- It was **never deployed**. There is no Procfile, Dockerfile, or railway config
  in this directory, and `VITE_EVENTS_API_URL` was set in no environment. Every
  production build therefore pointed the Events page at `http://localhost:8000`,
  so the feed could not load for any student.
- Its WebSocket feed could not work even locally on a clean install:
  `requirements.txt` pinned bare `uvicorn`, which ships no WebSocket
  implementation, so `/events/ws` upgrades were rejected.

## Where the code lives now

| Was | Now |
| --- | --- |
| `app/routers/events.py`, `rsvp.py`, `clubs.py` | `react-webapp/backend/src/routes/events.ts` (thin) + `src/services/eventsService.ts` (logic) |
| `app/club_directory.py` | `react-webapp/backend/src/services/clubDirectory.ts` |
| `app/realtime.py` (WebSocket fan-out) | `react-webapp/backend/src/realtime/eventsSocket.ts` |
| `GET /events/*` on `:8000` | `GET /api/events/*` on the Express backend |

The frontend now derives its events base from `API_BASE_URL` — see
`react-webapp/frontend/lib/api.ts`. There is exactly one origin to configure.

## The Instagram scraper

`app/scraper/`, `run_scraper.py`, and `scraper_tools/` are **also retired** and
not scheduled by anything. The events pipeline is now student-submitted:
students post their own club's events through the Events page, which writes
directly to `events` + `event_posts`.

The scraper code is kept, unmodified, only as a reference for the
`engagement_score` / `likes` columns it originally populated. Reviving it would
mean re-establishing Instagram session handling (`ig_cookies.json`) and deciding
how scraped events should coexist with student submissions.
