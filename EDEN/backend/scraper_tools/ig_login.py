"""
One-time Instagram login helper.
Opens a real browser window so you can log in manually.
Saves session cookies to ig_cookies.json for the scraper to use.

Run once:
    python scraper_tools/ig_login.py
"""

import asyncio
import json
import os
from playwright.async_api import async_playwright

COOKIES_FILE = os.path.join(os.path.dirname(__file__), "..", "ig_cookies.json")


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        await page.goto("https://www.instagram.com/accounts/login/")
        print("A browser window has opened.")
        print("Log into Instagram there, then come back here and press Enter.")
        input()

        cookies = await context.cookies()
        ig_cookies = [c for c in cookies if "instagram.com" in c.get("domain", "")]

        with open(COOKIES_FILE, "w") as f:
            json.dump(ig_cookies, f, indent=2)

        print(f"Saved {len(ig_cookies)} cookies to ig_cookies.json")
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
