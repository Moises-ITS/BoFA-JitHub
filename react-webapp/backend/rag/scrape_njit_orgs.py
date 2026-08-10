"""
NJIT Highlander Hub (CampusLabs Engage) organization scraper.

CONFIRMED WORKING against njit.campuslabs.com (schema verified from a real
response -- 282 orgs total, Azure Cognitive Search index behind the scenes).

Strategy:
  1. Page through the search endpoint (skip/top) to collect every org's
     summary record: Id, Name, Summary, Description (HTML), CategoryNames,
     WebsiteKey, ProfilePicture.
  2. Strip HTML from descriptions so the text is clean for embedding.
  3. Write everything to a CSV matching our RAG schema:
     id, source_type, title, description, category, tags, metadata_json, url, last_updated

NOTE ON PRIVACY: this script intentionally does NOT pull the officer/roster
endpoint (org officer names + personal NJIT emails). That data is technically
public if you click into a club page, but embedding individual students'
names/emails into a chatbot's retrieval index is a different exposure than
someone browsing a club page -- it makes that info trivially surfaceable to
anyone who asks. If you want "who do I contact for X club" to work, store
just the role title + a link to the org's public contact form instead of
scraping personal emails. If you later decide you want officer data too,
get explicit opt-in from officers first, or at minimum keep it in a
non-embedded lookup table rather than in the vector store.

###Activate Virtual Environment from rag folder
.venv\\Scripts\\Activate.ps1

Run:  pip install requests beautifulsoup4
      python3 scrape_njit_orgs.py
"""

import csv
import json
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

BASE = "https://njit.campuslabs.com"
SEARCH_URL = f"{BASE}/engage/api/discovery/search/organizations"

HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; JitHubResearchBot/1.0; contact: your-email@njit.edu)",
}

PAGE_SIZE = 100          # matches the "take" size we saw work elsewhere on this API
REQUEST_DELAY = 0.5      # be polite -- don't hammer NJIT's servers
OUTPUT_CSV = "njit_orgs.csv"


def strip_html(raw_html):
    if not raw_html:
        return ""
    return BeautifulSoup(raw_html, "html.parser").get_text(separator=" ", strip=True)


def fetch_all_orgs():
    """Page through the search endpoint and collect every org record."""
    orgs = []
    skip = 0
    session = requests.Session()
    session.headers.update(HEADERS)

    while True:
        params = {
            "skip": skip,
            "top": PAGE_SIZE,
            "query": "",
        }
        resp = session.get(SEARCH_URL, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        batch = data.get("value", [])
        if not batch:
            break

        orgs.extend(batch)
        total = data.get("@odata.count", "?")
        print(f"  fetched {len(orgs)}/{total} orgs so far...")

        skip += PAGE_SIZE
        time.sleep(REQUEST_DELAY)

        if isinstance(total, int) and skip >= total:
            break

    return orgs


def normalize_row(org):
    """Map a raw Engage org record into our CSV schema."""
    org_id = org.get("Id")
    name = (org.get("Name") or "").strip()
    summary = strip_html(org.get("Summary"))
    description = strip_html(org.get("Description")) or summary
    category = ", ".join(org.get("CategoryNames") or [])

    metadata = {
        "short_name": org.get("ShortName"),
        "profile_picture": org.get("ProfilePicture"),
        "status": org.get("Status"),
        "summary": summary if summary != description else None,
    }
    metadata = {k: v for k, v in metadata.items() if v}

    return {
        "id": org_id,
        "source_type": "club",
        "title": name,
        "description": description,
        "category": category,
        "tags": category,
        "metadata_json": json.dumps(metadata),
        "url": f"{BASE}/engage/organization/{org.get('WebsiteKey', org_id)}",
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


def main():
    print("Fetching all NJIT orgs from Engage search API...")
    orgs = fetch_all_orgs()
    print(f"\nFound {len(orgs)} organizations. Normalizing...\n")

    rows = [normalize_row(o) for o in orgs if o.get("Status") == "Active"]

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "id", "source_type", "title", "description",
                "category", "tags", "metadata_json", "url", "last_updated",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"Done. Wrote {len(rows)} active orgs to {OUTPUT_CSV}")


if __name__ == "__main__":
    main()