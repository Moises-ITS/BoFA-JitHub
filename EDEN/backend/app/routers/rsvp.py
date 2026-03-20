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
