from fastapi import APIRouter, depends
from sqlalchemy.orm import Session
from app.database import get_db
from app import models

router = APIRouter()

@router.get("/clubs")
def get_clubs(db: Session = Depends(get_db)):
  clubs = db.query(models.Club).all()
  return clubs
