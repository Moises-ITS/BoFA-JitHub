import asyncio
import csv
import re
import os
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

# ------------------------------------------------------------
# NJIT Highlander Hub scraper
# Scrapes all org names + Instagram handles from Highlander Hub
# Outputs to njit_orgs_instagram.csv
# ------------------------------------------------------------

START_URL = "https://njit.campuslabs.com/engage/organizations"
OUTPUT_CSV = os.path.join(os.path.dirname(__file__), "njit_orgs_instagram.csv")
HEADLESS = True
SLOW_MO = 0
MAX_ORGS = None  # set to an int like 20 for testing

INSTAGRAM_URL_RE = re.compile(r"https?://(?:www\.)?instagram\.com/([A-Za-z0-9._]+)/?", re.I)
INSTAGRAM_TEXT_RE = re.compile(r"@([A-Za-z0-9._]+)")
EMAIL_DOMAIN_RE = re.compile(r"\.(com|edu|org|net|io|gov|co|us)$", re.I)


def extract_handle(value: str) -> str:
    """Extract a raw Instagram handle (no @) from a URL or @mention string."""
    if not value:
        return ""
    value = value.strip()

    url_match = INSTAGRAM_URL_RE.search(value)
    if url_match:
        handle = url_match.group(1)
        # Filter out common non-handle paths
        if handle.lower() in ("explore", "p", "reel", "stories", "share"):
            return ""
        return handle

    text_match = INSTAGRAM_TEXT_RE.search(value)
    if text_match:
        handle = text_match.group(1)
        # Reject email domains (gmail, yahoo, njit, etc.)
        if EMAIL_DOMAIN_RE.search(handle):
            return ""
        return handle

    return ""


async def load_all_orgs(page):
    """Click the 'Load More' button repeatedly until it disappears."""
    clicks = 0
    while True:
        try:
            button = page.get_by_text("Load More", exact=True).first
            if await button.count() == 0:
                break
            await button.scroll_into_view_if_needed()
            await button.click()
            clicks += 1
            print(f"  Clicked Load More ({clicks}x)...")
            await page.wait_for_timeout(1500)
        except Exception:
            break
    print(f"  All orgs loaded after {clicks} clicks.")


async def collect_org_links(page) -> list[dict]:
    """Collect all org name + detail page URL pairs from the listing page."""
    selectors = [
        'a[href*="/engage/organization/"]',
        'a[href*="/organization/"]',
        'a[href*="/organizations/"]',
    ]

    seen = {}

    for selector in selectors:
        links = await page.locator(selector).evaluate_all(
            """
            els => els.map(a => ({
                href: a.href,
                text: (a.innerText || a.textContent || '').trim()
            }))
            """
        )
        for item in links:
            href = (item.get("href") or "").strip()
            text = (item.get("text") or "").strip()
            if not href or not text:
                continue
            if "/organization/" not in href and "/organizations/" not in href:
                continue
            seen[href] = {
                "name": " ".join(text.split()),
                "url": href,
            }

    return list(seen.values())


async def get_org_name(page) -> str:
    """Extract the org name from the detail page heading."""
    for selector in ["h1", "main h1", '[data-testid="page-title"]']:
        locator = page.locator(selector).first
        if await locator.count() > 0:
            text = (await locator.inner_text()).strip()
            if text:
                return " ".join(text.split())
    return (await page.title()).strip()


async def extract_instagram(page) -> str:
    """
    Look for Instagram handle on an org detail page.
    Only checks anchor hrefs for instagram.com URLs.
    Returns a raw handle with no @ prefix, or empty string.
    """
    # 1. Check all anchor hrefs only (not text — too many false positives)
    hrefs = await page.locator("a").evaluate_all(
        "els => els.map(a => a.href || '')"
    )
    for href in hrefs:
        handle = extract_handle(href)
        if handle:
            return handle

    # 2. Fall back to full body text
    body_text = await page.locator("body").inner_text()

    url_match = INSTAGRAM_URL_RE.search(body_text)
    if url_match:
        handle = url_match.group(1)
        if handle.lower() not in ("explore", "p", "reel", "stories", "share"):
            return handle

    return ""


async def scrape_highlander_hub():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=HEADLESS, slow_mo=SLOW_MO)
        context = await browser.new_context()
        page = await context.new_page()

        print(f"Opening {START_URL} ...")
        await page.goto(START_URL, wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)

        print("Loading all org cards...")
        await load_all_orgs(page)

        orgs = await collect_org_links(page)
        if MAX_ORGS:
            orgs = orgs[:MAX_ORGS]

        print(f"Found {len(orgs)} organizations. Scraping concurrently (10 at a time)...")

        semaphore = asyncio.Semaphore(10)

        async def scrape_org(i, org):
            async with semaphore:
                url = org["url"]
                fallback_name = org["name"]
                detail = await context.new_page()
                try:
                    await detail.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await detail.wait_for_timeout(800)
                    name = await get_org_name(detail) or fallback_name
                    instagram = await extract_instagram(detail)
                    print(f"  [{i}/{len(orgs)}] {name} -> {instagram or 'no IG'}")
                    return {
                        "organization_name": name,
                        "instagram_handle": instagram,
                        "organization_url": url,
                    }
                except PlaywrightTimeoutError:
                    print(f"  [{i}/{len(orgs)}] {fallback_name} -> timeout")
                    return {
                        "organization_name": fallback_name,
                        "instagram_handle": "",
                        "organization_url": url,
                    }
                finally:
                    await detail.close()

        tasks = [scrape_org(i, org) for i, org in enumerate(orgs, start=1)]
        rows = await asyncio.gather(*tasks)

        await browser.close()

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["organization_name", "instagram_handle", "organization_url"]
        )
        writer.writeheader()
        writer.writerows(rows)

    with_ig = sum(1 for r in rows if r["instagram_handle"])
    print(f"\nDone. {len(rows)} orgs scraped, {with_ig} have Instagram handles.")
    print(f"Saved to: {OUTPUT_CSV}")


if __name__ == "__main__":
    asyncio.run(scrape_highlander_hub())
