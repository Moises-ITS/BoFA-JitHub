from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app import models

router = APIRouter()

@router.get("/events")
def get_events(db: Session = Depends(get_db)):
    events = db.query(models.Event).all()
    return events

@router.get("/events/{event_id}")
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter(models.Event.event_id == event_id).first()
    return event
