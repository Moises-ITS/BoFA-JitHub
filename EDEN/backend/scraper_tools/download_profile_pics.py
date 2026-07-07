"""
Download club profile pictures from Highlander Hub (Anthology Engage).
Matches by club name (fuzzy), skips clubs already downloaded.

Output: react-webapp/frontend/public/club_pics/<club_id>.jpg
Run from EDEN/backend with the venv active:
  python download_profile_pics.py
"""
import os
import sys
import re
import requests
from difflib import SequenceMatcher

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

from app.database import SessionLocal
from app import models

OUT_DIR = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "..", "..", "react-webapp", "frontend", "public", "club_pics"
))

ENGAGE_API = "https://njit.campuslabs.com/engage/api/discovery/search/organizations"
CDN = "https://se-images.campuslabs.com/clink/images"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
}


def _normalize(name: str) -> str:
    name = name.lower()
    name = re.sub(r"[^a-z0-9 ]", " ", name)
    name = re.sub(r"\b(the|of|at|njit|new jersey institute of technology)\b", " ", name)
    return re.sub(r"\s+", " ", name).strip()


def fetch_all_orgs() -> list[dict]:
    """Paginate through the Engage org list and return all orgs."""
    orgs = []
    skip = 0
    top = 100
    while True:
        resp = requests.get(
            ENGAGE_API,
            params={"orderBy[0]": "UpperName asc", "top": top, "skip": skip, "filter": "", "query": ""},
            headers=HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        items = resp.json().get("value", [])
        if not items:
            break
        orgs.extend(items)
        if len(items) < top:
            break
        skip += top
    return orgs


def build_pic_map(orgs: list[dict]) -> dict[str, str]:
    """Build name → CDN image URL from org list. Only include orgs with a picture."""
    result = {}
    for org in orgs:
        name = (org.get("Name") or "").strip()
        pic = org.get("ProfilePicture")
        if name and pic:
            result[name] = f"{CDN}/{pic}?preset=small-sq"
    return result


def best_match(club_name: str, pic_map: dict[str, str]) -> tuple[str, str] | None:
    """Return (matched_name, pic_url) for best fuzzy match, or None."""
    norm_club = _normalize(club_name)
    best_name, best_url, best_score = None, None, 0.0
    for org_name, url in pic_map.items():
        score = SequenceMatcher(None, norm_club, _normalize(org_name)).ratio()
        if score > best_score:
            best_score = score
            best_name = org_name
            best_url = url
    if best_score >= 0.55 and best_name:
        return best_name, best_url
    return None


def run():
    os.makedirs(OUT_DIR, exist_ok=True)

    db = SessionLocal()
    clubs = db.query(models.Club).order_by(models.Club.club_id).all()
    db.close()

    todo = [c for c in clubs if not os.path.exists(os.path.join(OUT_DIR, f"{c.club_id}.jpg"))]
    print(f"{len(todo)} clubs to download ({len(clubs) - len(todo)} already cached).")

    if not todo:
        print("All done.")
        return

    print("Fetching Highlander Hub org list...")
    orgs = fetch_all_orgs()
    pic_map = build_pic_map(orgs)
    print(f"  {len(orgs)} orgs fetched, {len(pic_map)} have a profile picture.\n")

    done, skipped, no_match = 0, 0, 0
    for i, club in enumerate(todo):
        match = best_match(club.name, pic_map)
        if not match:
            print(f"  [{i+1}/{len(todo)}] {club.name!r} — no match")
            no_match += 1
            continue

        matched_name, url = match
        try:
            resp = requests.get(url, headers=HEADERS, timeout=10, allow_redirects=True)
            resp.raise_for_status()
            ct = resp.headers.get("Content-Type", "")
            if "image" not in ct:
                print(f"  [{i+1}/{len(todo)}] {club.name!r} → {matched_name!r} — not an image ({ct})")
                skipped += 1
                continue
            with open(os.path.join(OUT_DIR, f"{club.club_id}.jpg"), "wb") as f:
                f.write(resp.content)
            done += 1
            print(f"  [{i+1}/{len(todo)}] {club.name!r} → {matched_name!r} ✓")
        except Exception as e:
            print(f"  [{i+1}/{len(todo)}] {club.name!r} download failed: {e}")
            skipped += 1

    print(f"\nDone. {done} downloaded, {skipped} skipped, {no_match} no match.")


if __name__ == "__main__":
    run()
