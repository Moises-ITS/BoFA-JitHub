import os
import json
import instaloader
import browser_cookie3
import re
import webbrowser
from datetime import date
from dotenv import load_dotenv
from urllib.parse import urljoin

load_dotenv()

SESSION_FILE = os.path.join(os.path.dirname(__file__), "ig_session")
COOKIES_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "ig_cookies.json")
SCRAPE_FROM = date(2023, 9, 1)
INSTAGRAM_BASE_URL = "https://www.instagram.com/"
CHECKPOINT_URL_RE = re.compile(r"Point your browser to (\S+?)(?:\s+-|$)")

_loader = None


def _make_instaloader() -> instaloader.Instaloader:
    return instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        quiet=True,
    )


def _load_from_cookie_file(L: instaloader.Instaloader, username: str) -> bool:
    """Load cookies saved by scraper_tools/ig_login.py. Returns True on success."""
    cookie_path = os.path.abspath(COOKIES_FILE)
    if not os.path.exists(cookie_path):
        return False
    try:
        with open(cookie_path) as f:
            cookies = json.load(f)
        for c in cookies:
            L.context._session.cookies.set(
                c["name"], c["value"], domain=c.get("domain", ".instagram.com")
            )
        L.context.username = username
        instaloader.Profile.from_username(L.context, username)
        print("Loaded Instagram session from ig_cookies.json")
        return True
    except Exception as e:
        print(f"Cookie file load failed: {e}")
        return False


def _load_from_browser(L: instaloader.Instaloader, username: str) -> bool:
    """Try to import cookies from Chrome or Firefox. Returns True on success."""
    for loader_fn, browser_name in [
        (browser_cookie3.edge, "Edge"),
        (browser_cookie3.chrome, "Chrome"),
        (browser_cookie3.firefox, "Firefox"),
    ]:
        try:
            cookies = loader_fn(domain_name=".instagram.com")
            L.context._session.cookies.update(cookies)
            L.context.username = username
            # Quick sanity check — fetching own profile confirms auth worked
            instaloader.Profile.from_username(L.context, username)
            print(f"Loaded Instagram session from {browser_name} cookies.")
            return True
        except Exception:
            continue
    return False


def _extract_checkpoint_url(error_message: str) -> str | None:
    match = CHECKPOINT_URL_RE.search(error_message)
    if match is None:
        return None
    return urljoin(INSTAGRAM_BASE_URL, match.group(1))


def _login_with_password(L: instaloader.Instaloader, username: str, password: str) -> None:
    try:
        L.login(username, password)
    except instaloader.exceptions.TwoFactorAuthRequiredException:
        code = input("Instagram 2FA code: ").strip()
        L.two_factor_login(code)
        print("Two-factor authentication complete.")
    except instaloader.exceptions.LoginException as exc:
        checkpoint_url = _extract_checkpoint_url(str(exc))
        if checkpoint_url is None:
            raise

        print(f"Instagram checkpoint required: {checkpoint_url}")
        try:
            opened = webbrowser.open(checkpoint_url)
        except Exception:
            opened = False

        if not opened:
            print(f"Could not auto-open browser. Manually go to: {checkpoint_url}")

        input("\nComplete the Instagram challenge in your browser, then press Enter here to continue...")

        # Retry login after checkpoint approval
        L.login(username, password)


def get_loader() -> instaloader.Instaloader:
    global _loader
    if _loader is not None:
        return _loader

    username = os.getenv("IG_USERNAME")
    password = os.getenv("IG_PASSWORD")
    if not username or not password:
        raise RuntimeError("Set IG_USERNAME and IG_PASSWORD in EDEN/backend/.env before running the scraper.")

    L = _make_instaloader()

    # 1. Try saved session file
    try:
        L.load_session_from_file(username, SESSION_FILE)
        print(f"Loaded existing Instagram session for {username}")
        _loader = L
        return _loader
    except FileNotFoundError:
        pass

    # 2. Try saved cookies from ig_login.py (most reliable)
    if _load_from_cookie_file(L, username):
        L.save_session_to_file(SESSION_FILE)
        _loader = L
        return _loader

    # 3. Try browser cookies (avoids checkpoint errors)
    if _load_from_browser(L, username):
        L.save_session_to_file(SESSION_FILE)
        _loader = L
        return _loader

    # 3. Fall back to username/password
    print(f"Logging in as {username} with password...")
    _login_with_password(L, username, password)
    L.save_session_to_file(SESSION_FILE)
    print("Session saved.")
    _loader = L
    return _loader


def get_profile(handle: str) -> dict:
    loader = get_loader()
    profile = instaloader.Profile.from_username(loader.context, handle)
    return {
        "full_name": profile.full_name,
        "follower_count": profile.followers,
    }


def get_posts(handle: str) -> list[dict]:
    loader = get_loader()
    profile = instaloader.Profile.from_username(loader.context, handle)
    posts = []

    for post in profile.get_posts():
        if post.date.date() < SCRAPE_FROM:
            break

        posts.append({
            "shortcode": post.shortcode,
            "caption": post.caption or "",
            "likes": post.likes,
            "comments": post.comments,
            "timestamp": post.date,
            "image_url": post.url,
            "post_url": f"https://www.instagram.com/p/{post.shortcode}/",
        })

    return posts
