import csv
import os
import sys

# Allow imports from EDEN/backend/
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal
from app.models import Club

CSV_PATH = os.path.join(os.path.dirname(__file__), "njit_orgs_instagram.csv")


def import_clubs():
    if not os.path.exists(CSV_PATH):
        print(f"CSV not found at {CSV_PATH}")
        print("Run hub_scraper.py first.")
        return

    db = SessionLocal()
    inserted = 0
    updated = 0
    skipped = 0

    try:
        with open(CSV_PATH, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = row.get("organization_name", "").strip()
                handle = row.get("instagram_handle", "").strip().lstrip("@")

                # Skip rows with no Instagram handle
                if not handle:
                    skipped += 1
                    continue

                # Skip obviously bad handles
                if len(handle) < 2 or " " in handle:
                    skipped += 1
                    continue

                # Check if club already exists by handle
                existing = db.query(Club).filter(Club.instagram_handle == handle).first()

                description = row.get("description", "").strip() or None

                if existing:
                    existing.name = name
                    if description:
                        existing.bio = description
                    updated += 1
                else:
                    club = Club(
                        name=name,
                        instagram_handle=handle,
                        follower_count=None,
                        is_active=True,
                        bio=description,
                    )
                    db.add(club)
                    inserted += 1

        db.commit()
        with_bio = db.query(Club).filter(Club.bio.isnot(None)).count()
        print(f"\nImport complete:")
        print(f"  Inserted : {inserted}")
        print(f"  Updated  : {updated}")
        print(f"  Skipped  : {skipped} (no Instagram handle)")
        print(f"  Total clubs with bio: {with_bio}")

    except Exception as e:
        db.rollback()
        print(f"Error during import: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import_clubs()
