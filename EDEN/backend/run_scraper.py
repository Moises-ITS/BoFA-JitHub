import sys
import os
sys.path.append(os.path.dirname(__file__))

import re
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.database import SessionLocal
from app import models
from app.scraper.instagram import _scrape_handle, _load_cookies
from app.scraper.classifier import classify_post
from playwright.sync_api import sync_playwright


def classify_all(posts, max_workers=8):
    """Classify all posts in parallel, return list of (post, result) pairs."""
    results = [None] * len(posts)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(classify_post, p["caption"], p["image_url"]): i for i, p in enumerate(posts)}
        for future in as_completed(futures):
            results[futures[future]] = future.result()
    return results


def process_club(db, club, posts):
    total_events = 0
    total_skipped = 0

    # Clear any partial data from a previous interrupted run (children before parents)
    existing_ids = [e.event_id for e in db.query(models.Event).filter(models.Event.club_id == club.club_id).all()]
    if existing_ids:
        db.query(models.Collaboration).filter(models.Collaboration.event_id.in_(existing_ids)).delete()
        db.query(models.Sponsor).filter(models.Sponsor.event_id.in_(existing_ids)).delete()
        db.query(models.EventPost).filter(models.EventPost.event_id.in_(existing_ids)).delete()
        db.query(models.Event).filter(models.Event.club_id == club.club_id).delete()
        db.commit()

    classifications = classify_all(posts)

    for post, result in zip(posts, classifications):
        if result is None:
            total_skipped += 1
            continue
        raw_date = result.get("date")
        date = None
        if raw_date and re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw_date):
            try:
                datetime.strptime(raw_date, "%Y-%m-%d")
                date = raw_date
            except ValueError:
                pass

        def clean_time(val):
            if not val:
                return None
            # Strip date prefix if GPT returned a full datetime
            if "T" in str(val):
                val = str(val).split("T")[1]
            if re.fullmatch(r"\d{2}:\d{2}(:\d{2})?", str(val)):
                return val
            return None

        event = models.Event(
            club_id=club.club_id,
            event_name=result.get("event_name") or f"{club.name} Event",
            event_type=result.get("post_type"),
            date=date,
            start_time=clean_time(result.get("start_time")),
            end_time=clean_time(result.get("end_time")),
            campus_location=result.get("campus_location"),
            event_room=result.get("event_room"),
            has_free_food=result.get("has_free_food") or False,
            virtual=result.get("virtual") or False,
            is_external=result.get("is_external") or False,
            is_open_to_public=result.get("is_open_to_public") if result.get("is_open_to_public") is not None else True,
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
            post_url=post.get("post_url"),
            caption=post.get("caption"),
        )
        db.add(event_post)

        for partner in (result.get("collaborators") or []):
            if partner:
                db.add(models.Collaboration(event_id=event.event_id, partner_name=str(partner)))
        for sponsor in (result.get("sponsors") or []):
            if sponsor:
                db.add(models.Sponsor(event_id=event.event_id, sponsor_name=str(sponsor)))

        db.commit()
        total_events += 1
        print(f"  + [{result.get('post_type')}] {result.get('event_name')}")

    return total_events, total_skipped


PROGRESS_FILE = os.path.join(os.path.dirname(__file__), "scraped_clubs.txt")

def _load_done_ids() -> set[int]:
    if not os.path.exists(PROGRESS_FILE):
        return set()
    with open(PROGRESS_FILE) as f:
        return {int(line.strip()) for line in f if line.strip().isdigit()}

def _mark_done(club_id: int):
    with open(PROGRESS_FILE, "a") as f:
        f.write(f"{club_id}\n")


def run():
    db = SessionLocal()
    total_events = 0
    total_posts = 0
    total_skipped = 0

    try:
        done_club_ids = _load_done_ids()

        clubs = db.query(models.Club).filter(
            models.Club.instagram_handle.isnot(None),
            models.Club.is_active == True
        ).all()

        clubs = [c for c in clubs if c.club_id not in done_club_ids]
        print(f"  (skipping {len(done_club_ids)} already-processed clubs)\n")

        print(f"Fetching data for {len(clubs)} clubs via Playwright...\n")
        cookies = _load_cookies()

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/122.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 800},
            )
            if cookies:
                context.add_cookies(cookies)
            page = context.new_page()

            for i, club in enumerate(clubs):
                handle = club.instagram_handle.lower()
                print(f"[{club.name}] @{handle} ({i + 1}/{len(clubs)})")
                posts = _scrape_handle(page, handle)
                print(f"  Found {len(posts)} posts — classifying...")
                total_posts += len(posts)
                events, skipped = process_club(db, club, posts)
                total_events += events
                total_skipped += skipped
                if len(posts) > 0:
                    _mark_done(club.club_id)
                else:
                    print(f"  (0 posts — will retry next run)")
                if i < len(clubs) - 1:
                    page.wait_for_timeout(1000)

            browser.close()

    finally:
        db.close()

    print(f"\nDone.")
    print(f"  Events created : {total_events}")
    print(f"  Posts processed: {total_posts}")
    print(f"  Posts skipped  : {total_skipped}")


if __name__ == "__main__":
    run()
