"""
RETIRED — DO NOT DEPLOY. See EDEN/README.md.

The events/RSVP/clubs API this service exposed now lives in the Express backend
at react-webapp/backend/src/routes/events.ts, served under /api/events, /api/rsvp
and /api/clubs against the same Postgres this service used. The frontend no
longer calls port 8000 at all.

Kept only as reference for the scoring/scraper code alongside it. Starting this
process serves a second, divergent copy of the events API against live data.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from app.routers import clubs, events, rsvp, sandbox

app = FastAPI()

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    print("422 Validation error:", exc.errors())
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

app.include_router(clubs.router)
app.include_router(rsvp.router)
app.include_router(events.router)
app.include_router(sandbox.router)

