import os, json
from playwright.sync_api import sync_playwright

COOKIES_FILE = os.path.abspath("ig_cookies.json")
with open(COOKIES_FILE) as f:
    raw_cookies = json.load(f)

handle = "njitshpe"
captured = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        viewport={"width": 1280, "height": 800},
    )
    context.add_cookies(raw_cookies)
    page = context.new_page()

    def on_response(response):
        url = response.url
        if "instagram.com" in url and response.status == 200:
            if any(x in url for x in ["/api/", "/graphql", "query"]):
                try:
                    body = response.json()
                    captured.append({"url": url, "body": body})
                    print(f"  CAPTURED: {url[:80]} -> status {response.status}")
                except Exception:
                    pass

    page.on("response", on_response)
    print(f"Navigating to @{handle}...")
    try:
        page.goto(f"https://www.instagram.com/{handle}/", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(4000)
    except Exception as e:
        print(f"  Nav error (continuing): {e}")
    finally:
        browser.close()

def find_posts(obj, path=""):
    """Recursively search for any list of dicts that look like IG posts."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("edges", "items") and isinstance(v, list) and len(v) > 0:
                first = v[0]
                node = first.get("node", first)
                if "shortcode" in node or "code" in node or "taken_at_timestamp" in node or "taken_at" in node:
                    print(f"  *** POSTS at path '{path}.{k}': {len(v)} items")
                    print(f"      First item keys: {list(node.keys())[:10]}")
            find_posts(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, item in enumerate(obj[:2]):
            find_posts(item, f"{path}[{i}]")

print(f"\nTotal API responses captured: {len(captured)}")
for i, item in enumerate(captured):
    print(f"\n--- Response {i+1}: {item['url'][:80]}")
    body = item["body"]
    if isinstance(body, dict):
        print(f"  Top-level keys: {list(body.keys())}")
        find_posts(body)
