"""
Re-classify existing events with event_category using saved captions.

Usage:
  python reclassify_categories.py          # classify only uncategorized events
  python reclassify_categories.py --reset  # wipe all categories and re-classify everything
"""
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app import models

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

CATEGORIES = [
    "fundraiser",
    "exposure",
    "volunteering",
    "workshop",
    "info session",
    "site tour",
    "recruiting",
    "general meeting",
    "social",
    "conference",
    "study support",
    "other",
]

SYSTEM_PROMPT = (
    "You are classifying NJIT student organization events. "
    "Return ONLY a JSON object: {\"category\": \"<category>\"}\n"
    "Categories and when to use them:\n"
    "  fundraiser     – raising money for a cause or the org itself\n"
    "  exposure       – showcasing the org, culture night, demo day, networking mixer\n"
    "  volunteering   – community service, charity work, external volunteer opportunities\n"
    "  workshop       – hands-on skill-building session, hackathon, technical training\n"
    "  info session   – panel, talk, guest speaker, Q&A, info night\n"
    "  site tour      – visiting a company, facility, or campus location\n"
    "  recruiting     – career fair, internship/job fair, resume review, employer visit\n"
    "  general meeting – GBM, weekly/monthly org meeting, elections\n"
    "  social         – game night, hangout, party, icebreaker, casual event\n"
    "  conference     – multi-session academic or professional conference, summit\n"
    "  study support  – tutoring, study hall, exam prep, academic help\n"
    "  other          – does not fit any category above\n"
    f"Choose exactly one of: {', '.join(CATEGORIES)}."
)


def classify_category(event_name: str, caption: str) -> str:
    text = f"Event: {event_name}\nCaption: {(caption or '')[:400]}"
    for attempt in range(3):
        try:
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": text},
                ],
                max_tokens=30,
                temperature=0,
                response_format={"type": "json_object"},
            )
            val = json.loads(resp.choices[0].message.content).get("category", "other")
            return val if val in CATEGORIES else "other"
        except Exception as e:
            if "429" in str(e) and attempt < 2:
                time.sleep(2 ** attempt)
            else:
                return "other"
    return "other"


def run(reset: bool = False):
    db = SessionLocal()

    if reset:
        print("Resetting all event categories to NULL...")
        db.query(models.Event).update({"event_category": None})
        db.commit()
        print("Done. Re-classifying all events...\n")

    rows = (
        db.query(models.Event, models.EventPost.caption)
        .join(models.EventPost, models.EventPost.event_id == models.Event.event_id)
        .filter(models.Event.event_category == None)
        .filter(models.EventPost.caption != None)
        .all()
    )
    total = len(rows)
    print(f"Events to categorize: {total}")

    # Build plain list so threads only touch OpenAI — no DB access in workers
    work = [(e.event_id, e.event_name, caption) for e, caption in rows]

    def classify(item):
        event_id, event_name, caption = item
        return event_id, classify_category(event_name, caption)

    done = 0
    with ThreadPoolExecutor(max_workers=4) as pool:
        for event_id, category in pool.map(classify, work):
            # All DB writes happen here, in the main thread — no concurrent writes
            db.query(models.Event).filter(models.Event.event_id == event_id).update(
                {"event_category": category}
            )
            done += 1
            if done % 100 == 0:
                db.commit()
                print(f"  {done}/{total} done...")

    db.commit()
    db.close()
    print(f"Done. {done} events categorized.")


if __name__ == "__main__":
    reset = "--reset" in sys.argv
    run(reset=reset)
