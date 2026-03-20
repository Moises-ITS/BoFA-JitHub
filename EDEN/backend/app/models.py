'''
translation dictionary between python and postgresql
gets the data from postgresql

doesn't know how to connect, just grabs the values
'''

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, Date, Time, DateTime, Numeric, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from .database import Base

class Club(Base):
  __tablename__ = "clubs"

  club_id = Column(Integer, primary_key=True)
  name = Column(String(255), nullable=False)
  instagram_handle = Column(String(255))
  follower_count = Column(Integer)
  is_active = Column(Boolean, default=True)

class Event(Base):
  __tablename__ = "events"
  event_id = Column(Integer, primary_key=True)
  club_id = Column(Integer, ForeignKey("clubs.club_id"))
  event_name = Column(String(255), nullable=False)
  event_type = Column(String(100))
  date = Column(Date)
  day_of_week = Column(String(20))
  start_time = Column(Time)
  end_time = Column(Time)
  virtual = Column(Boolean, default=False)
  is_external = Column(Boolean, default=False)
  campus_location = Column(String(255))
  event_room = Column(String(255))
  external_location_name = Column(String(255))
  distance_from_campus = Column(Numeric(6, 2))
  transportation_required = Column(Boolean, default=False)
  has_free_food = Column(Boolean, default=False)
  is_open_to_public = Column(Boolean, default=True)
  event_link = Column(String(500))
  promo_link = Column(String(500))
  days_until_midterm = Column(Integer)
  recap_engagement_score = Column(Numeric(8, 4))
  predicted_engagement_score = Column(Numeric(8,4))
  event_category = Column(String(50))

class EventPost(Base):
  __tablename__ = "event_posts"
  post_id = Column(Integer, primary_key = True)
  event_id = Column(Integer, ForeignKey("events.event_id"))
  post_type = Column(String(10))
  post_datetime = Column(DateTime)
  likes = Column(Integer)
  likes_estimated = Column(Boolean, default=False)
  comments = Column(Integer)
  avg_likes_last_ten = Column(Numeric(8,4))
  engagement_score = Column(Numeric(8, 4))
  post_url = Column(String(500))
  caption = Column(String)

class Collaboration(Base):
  __tablename__ = "collaborations"
  collab_id = Column(Integer, primary_key = True)
  event_id = Column(Integer, ForeignKey("events.event_id"))
  partner_name = Column(String(255))
  
class Sponsor(Base):
  __tablename__ = "sponsors"
  sponsor_id = Column(Integer, primary_key = True)
  event_id = Column(Integer, ForeignKey("events.event_id"))
  sponsor_name = Column(String(255))

class EventRSVP(Base):
  __tablename__ = "event_rsvps"
  rsvp_id        = Column(Integer, primary_key=True, autoincrement=True)
  event_id       = Column(Integer, ForeignKey("events.event_id", ondelete="CASCADE"), nullable=False)
  user_id        = Column(Text, nullable=False)
  user_name      = Column(Text)
  user_major     = Column(Text)
  user_interests = Column(Text)
  user_clubs     = Column(Text)
  rsvp_time      = Column(DateTime, default=lambda: datetime.now(timezone.utc))
  status         = Column(Text, nullable=False, default="going")
  __table_args__ = (UniqueConstraint("event_id", "user_id"),)

