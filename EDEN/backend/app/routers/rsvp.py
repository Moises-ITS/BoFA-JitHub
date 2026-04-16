from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import List, Optional
from app.database import get_db
from app import models

router = APIRouter(prefix="/rsvp", tags=["rsvp"])


class RSVPBody(BaseModel):
    user_id: str
    user_name: Optional[str] = None
    user_major: Optional[str] = None
    user_interests: Optional[str] = None
    user_clubs: Optional[str] = None
    status: str = "going"


class BatchStatusBody(BaseModel):
    user_id: str
    event_ids: List[int]


class BatchAttendeesBody(BaseModel):
    event_ids: List[int]


@router.get("/user/{user_id}")
def get_user_rsvps(user_id: str, db: Session = Depends(get_db)):
    """Return every event the user is currently RSVP'd to."""
    rows = (
        db.query(
            models.EventRSVP.event_id,
            models.EventRSVP.status,
            models.EventRSVP.rsvp_time,
            models.Event.event_name,
            models.Event.date,
            models.Event.start_time,
            models.Event.event_category,
            models.Event.virtual,
            models.Event.has_free_food,
            models.Club.name.label("club_name"),
        )
        .join(models.Event, models.Event.event_id == models.EventRSVP.event_id)
        .outerjoin(models.Club, models.Club.club_id == models.Event.club_id)
        .filter(
            models.EventRSVP.user_id == user_id,
            models.EventRSVP.status == "going",
        )
        .all()
    )

    return [
        {
            "event_id": row.event_id,
            "status": row.status,
            "rsvp_time": row.rsvp_time.isoformat() if row.rsvp_time else None,
            "event_name": row.event_name,
            "date": row.date.isoformat() if row.date else None,
            "start_time": row.start_time.strftime("%H:%M:%S") if row.start_time else None,
            "event_category": row.event_category,
            "virtual": row.virtual,
            "has_free_food": row.has_free_food,
            "club_name": row.club_name or "NJIT",
        }
        for row in rows
    ]


@router.post("/{event_id}")
def upsert_rsvp(event_id: int, body: RSVPBody, db: Session = Depends(get_db)):
    """Create or update an RSVP for an event."""
    db.execute(
        text("""
            INSERT INTO event_rsvps (event_id, user_id, user_name, user_major, user_interests, user_clubs, status)
            VALUES (:event_id, :user_id, :user_name, :user_major, :user_interests, :user_clubs, :status)
            ON CONFLICT (event_id, user_id) DO UPDATE SET
                status = EXCLUDED.status,
                user_name = EXCLUDED.user_name,
                user_major = EXCLUDED.user_major,
                user_interests = EXCLUDED.user_interests,
                user_clubs = EXCLUDED.user_clubs,
                rsvp_time = NOW()
        """),
        {
            "event_id": event_id,
            "user_id": body.user_id,
            "user_name": body.user_name,
            "user_major": body.user_major,
            "user_interests": body.user_interests,
            "user_clubs": body.user_clubs,
            "status": body.status,
        }
    )
    db.commit()
    return {"ok": True}


@router.delete("/{event_id}/{user_id}")
def delete_rsvp(event_id: int, user_id: str, db: Session = Depends(get_db)):
    """Remove an RSVP."""
    db.query(models.EventRSVP).filter(
        models.EventRSVP.event_id == event_id,
        models.EventRSVP.user_id == user_id,
    ).delete()
    db.commit()
    return {"ok": True}


@router.get("/{event_id}/attendees")
def get_attendees(event_id: int, db: Session = Depends(get_db)):
    """Return attendee count and a preview list (up to 5)."""
    rows = (
        db.query(models.EventRSVP.user_id, models.EventRSVP.user_name, models.EventRSVP.user_major)
        .filter(
            models.EventRSVP.event_id == event_id,
            models.EventRSVP.status == "going",
        )
        .all()
    )
    preview = [
        {"user_id": r.user_id, "user_name": r.user_name or "Anonymous", "user_major": r.user_major or ""}
        for r in rows[:20]
    ]
    return {"count": len(rows), "preview": preview}


@router.post("/batch-attendees")
def batch_attendees(body: BatchAttendeesBody, db: Session = Depends(get_db)):
    """Return attendee counts and previews for multiple events in one request."""
    if not body.event_ids:
        return {}

    rows = (
        db.query(
            models.EventRSVP.event_id,
            models.EventRSVP.user_id,
            models.EventRSVP.user_name,
            models.EventRSVP.user_major,
        )
        .filter(
            models.EventRSVP.event_id.in_(body.event_ids),
            models.EventRSVP.status == "going",
        )
        .order_by(models.EventRSVP.event_id.asc(), models.EventRSVP.rsvp_time.desc())
        .all()
    )

    attendee_map = {
        str(event_id): {"count": 0, "preview": []}
        for event_id in body.event_ids
    }

    for row in rows:
        entry = attendee_map[str(row.event_id)]
        entry["count"] += 1
        if len(entry["preview"]) < 20:
            entry["preview"].append({
                "user_id": row.user_id,
                "user_name": row.user_name or "Anonymous",
                "user_major": row.user_major or "",
            })

    return attendee_map


@router.post("/batch-status")
def batch_status(body: BatchStatusBody, db: Session = Depends(get_db)):
    """Return a map of event_id → status for the given user across multiple events."""
    if not body.event_ids:
        return {}
    rows = (
        db.query(models.EventRSVP.event_id, models.EventRSVP.status)
        .filter(
            models.EventRSVP.user_id == body.user_id,
            models.EventRSVP.event_id.in_(body.event_ids),
        )
        .all()
    )
    return {str(r.event_id): r.status for r in rows}
