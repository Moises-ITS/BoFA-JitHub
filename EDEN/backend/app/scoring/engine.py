"""
Engagement scoring engine.

For each event_post:
  avg_last_ten_likes = avg likes of the 10 posts before this one (same club)
  engagement_score   = (likes + comments) / avg_last_ten_likes

For each event:
  recap_engagement_score = engagement_score of its recap post
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

from app.database import SessionLocal
from app import models


def run():
    db = SessionLocal()
    try:
        clubs = db.query(models.Club).all()
        total_scored = 0

        for club in clubs:
            # Get all posts for this club ordered by date ascending
            posts = (
                db.query(models.EventPost)
                .join(models.Event, models.Event.event_id == models.EventPost.event_id)
                .filter(models.Event.club_id == club.club_id)
                .order_by(models.EventPost.post_datetime.asc())
                .all()
            )

            if not posts:
                continue

            likes_history = []

            for post in posts:
                # avg likes of the 10 posts before this one
                if len(likes_history) >= 1:
                    window = likes_history[-10:]
                    avg = sum(window) / len(window)
                    post.avg_likes_last_ten = round(avg, 4)

                    if avg > 0:
                        score = ((post.likes or 0) + (post.comments or 0)) / avg
                        post.engagement_score = round(score, 4)
                    else:
                        post.engagement_score = None
                else:
                    post.avg_likes_last_ten = None
                    post.engagement_score = None

                likes_history.append(post.likes or 0)
                total_scored += 1

            # Write recap_engagement_score to each event
            for post in posts:
                if post.engagement_score is not None:
                    event = db.query(models.Event).filter(models.Event.event_id == post.event_id).first()
                    if event and event.event_type == "recap":
                        event.recap_engagement_score = post.engagement_score

        db.commit()
        print(f"Scored {total_scored} posts across {len(clubs)} clubs.")

    finally:
        db.close()


if __name__ == "__main__":
    run()
