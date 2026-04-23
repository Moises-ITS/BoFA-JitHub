from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.club_directory import serialize_club_collection

router = APIRouter()

@router.get("/clubs")
def get_clubs(db: Session = Depends(get_db)):
  clubs = db.query(models.Club).order_by(models.Club.name.asc()).all()
  return serialize_club_collection(clubs)
