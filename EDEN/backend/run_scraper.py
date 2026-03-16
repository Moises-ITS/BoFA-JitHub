import sys
import os
sys.path.append(os.path.dirname(__file__))

from app.database import SessionLocal
from app import models
from app.scraper.instagram import get_profile, get_posts
from app.scraper.classifier import classify_post


def run():
    db = SessionLocal()
    total_events = 0
    total_posts = 0
    total_skipped = 0

    try:
        clubs = db.query(models.Club).filter(
            models.Club.instagram_handle.isnot(None),
            models.Club.is_active == True
        ).limit(1).all()

        print(f"Scraping {len(clubs)} clubs...\n")

        for club in clubs:
            handle = club.instagram_handle
            print(f"[{club.name}] @{handle}")

            try:
                profile = get_profile(handle)
                club.follower_count = profile["follower_count"]
                db.commit()

                posts = get_posts(handle)
                print(f"  Found {len(posts)} posts")

                for post in posts:
                    result = classify_post(post["caption"], post["image_url"])

                    if result is None:
                        total_skipped += 1
                        continue

                    event = models.Event(
                        club_id=club.club_id,
                        event_name=result.get("event_name") or f"{club.name} Event",
                        event_type=result.get("post_type"),
                        date=result.get("date"),
                        start_time=result.get("start_time"),
                        end_time=result.get("end_time"),
                        campus_location=result.get("campus_location"),
                        event_room=result.get("event_room"),
                        has_free_food=result.get("has_free_food") or False,
                        virtual=result.get("virtual") or False,
                        is_external=result.get("is_external") or False,
                        external_location_name=result.get("external_location_name"),
                        event_link=result.get("event_link"),
                    )
                    db.add(event)
                    db.flush()

                    event_post = models.EventPost(
                        event_id=event.event_id,
                        post_type=result.get("post_type"),
                        post_datetime=post["timestamp"],
                        likes=post["likes"],
                        comments=post["comments"],
                    )
                    db.add(event_post)
                    db.commit()

                    total_events += 1
                    total_posts += 1
                    print(f"  + [{result.get('post_type')}] {result.get('event_name')}")

            except Exception as e:
                print(f"  Error scraping @{handle}: {e}")
                db.rollback()
                continue

    finally:
        db.close()

    print(f"\nDone.")
    print(f"  Events created : {total_events}")
    print(f"  Posts inserted : {total_posts}")
    print(f"  Posts skipped  : {total_skipped}")




if __name__ == "__main__":
    run()
