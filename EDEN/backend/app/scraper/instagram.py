import os
import json
from datetime import datetime, date
from playwright.sync_api import sync_playwright, Page

SCRAPE_FROM = date(2023, 9, 1)
COOKIES_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "ig_cookies.json")


def _load_cookies() -> list[dict]:
    path = os.path.abspath(COOKIES_FILE)
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return json.load(f)


def _parse_items(edges: list) -> list[dict]:
    """Parse posts from xdt_api__v1__feed__user_timeline_graphql_connection edges."""
    posts = []
    for edge in edges:
        item = edge.get("node", edge)  # edges wrap post in {node: ..., cursor: ...}
        ts = item.get("taken_at", 0)
        if not ts:
            continue
        post_dt = datetime.fromtimestamp(ts)
        if post_dt.date() < SCRAPE_FROM:
            continue
        shortcode = item.get("code", "")
        caption_obj = item.get("caption")
        caption = caption_obj.get("text", "") if isinstance(caption_obj, dict) else ""
        image_url = ""
        candidates = item.get("image_versions2", {}).get("candidates", [])
        if candidates:
            image_url = candidates[0].get("url", "")
        posts.append({
            "shortcode": shortcode,
            "caption": caption,
            "likes": item.get("like_count", 0),
            "comments": item.get("comment_count", 0),
            "timestamp": post_dt,
            "image_url": image_url,
            "post_url": f"https://www.instagram.com/p/{shortcode}/",
        })
    return posts


def _scrape_handle(page: Page, handle: str, target: int = 60) -> list[dict]:
    posts = []

    def on_response(response):
        if response.status != 200 or "graphql" not in response.url:
            return
        try:
            body = response.json()
            data = body.get("data", {})

            # Primary: profile-specific feed
            feed = data.get("xdt_api__v1__feed__user_timeline_graphql_connection", {})
            edges = feed.get("edges", [])
            if edges:
                posts.extend(_parse_items(edges))
                return

            # Fallback: home timeline (filter to target user only)
            feed = data.get("xdt_api__v1__feed__timeline__connection", {})
            edges = feed.get("edges", [])
            if edges:
                filtered = [
                    e for e in edges
                    if (e.get("node") or e).get("user", {}).get("username", "").lower() == handle.lower()
                ]
                if filtered:
                    posts.extend(_parse_items(filtered))
        except Exception:
            pass

    page.on("response", on_response)
    try:
        page.goto(
            f"https://www.instagram.com/{handle}/",
            wait_until="domcontentloaded",
            timeout=30000,
        )
        page.wait_for_timeout(4000)

        # Scroll to load more posts (each scroll yields ~12 more)
        max_scrolls = max(0, (target // 12) - 1)
        for _ in range(max_scrolls):
            if len(posts) >= target:
                break
            prev = len(posts)
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(2500)
            if len(posts) == prev:
                break  # no new posts loaded, stop early

    except Exception as e:
        print(f"  [PW] Error loading @{handle}: {e}")
    finally:
        page.remove_listener("response", on_response)

    return posts[:target]


def get_posts_batch(handles: list[str]) -> dict[str, list[dict]]:
    result: dict[str, list[dict]] = {h.lower(): [] for h in handles}
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

        for i, handle in enumerate(handles):
            h = handle.lower()
            print(f"  [PW] Scraping @{h} ({i + 1}/{len(handles)})...")
            posts = _scrape_handle(page, h)
            result[h] = posts
            print(f"    Found {len(posts)} posts")
            if i < len(handles) - 1:
                page.wait_for_timeout(1500 + (i % 5) * 300)

        browser.close()

    return result


def get_profile(handle: str) -> dict:
    return {"full_name": "", "follower_count": 0}


def get_posts(handle: str) -> list[dict]:
    return get_posts_batch([handle]).get(handle.lower(), [])
