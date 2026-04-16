import os
import re
import json
import asyncio
from datetime import date, timedelta, datetime
from typing import Optional, AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, text as sa_text
from sqlalchemy.orm import Session
import anthropic
from anthropic import AsyncAnthropic
from dotenv import load_dotenv
import requests

from app.database import get_db
from app import models
from app.club_directory import (
    find_matching_club,
    get_club_aliases,
    normalize_club_text,
    resolve_canonical_club_name,
)

load_dotenv()
router = APIRouter(prefix="/sandbox", tags=["sandbox"])
client       = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"), timeout=30.0)
async_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"), timeout=30.0)
CHAT_MODEL = os.getenv("CLAUDE_MODEL", "claude-haiku-4-5-20251001")
AUTH_API_URL = os.getenv("AUTH_API_URL", "http://localhost:3001")
CLUB_POPULARITY_CACHE_TTL = timedelta(minutes=10)
_club_popularity_cache: dict[str, tuple[datetime, list[dict]]] = {}

# ── Pydantic models ────────────────────────────────────────────────────────────

class HistoryEntry(BaseModel):
    role: str
    content: str

class ProfileContext(BaseModel):
    user_id: Optional[str] = None
    name: str
    major: Optional[str] = None
    year: Optional[str] = None
    interests: Optional[list[str]] = []
    clubs: Optional[list[str]] = []
    skills: Optional[list[str]] = []
    looking_for: Optional[list[str]] = []
    graduation_year: Optional[int] = None
    chat_interests: Optional[list[str]] = []

class EventContext(BaseModel):
    event_id: Optional[int] = None
    event_name: Optional[str] = "Unnamed Event"
    event_category: Optional[str] = None
    date: Optional[str] = None
    club_name: Optional[str] = "Unknown Club"
    campus_location: Optional[str] = None
    has_free_food: Optional[bool] = False
    virtual: Optional[bool] = False

class RecommendationContext(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = "Unknown"
    major: Optional[str] = None
    year: Optional[str] = None
    score: Optional[int] = 0
    shared_clubs: Optional[list[str]] = []
    shared_interests: Optional[list[str]] = []
    shared_skills: Optional[list[str]] = []
    looking_for: Optional[list[str]] = []

class ContextPayload(BaseModel):
    upcoming_events: list[EventContext] = []
    trending_events: list[EventContext] = []
    recommendations: list[RecommendationContext] = []
    profile: ProfileContext

class ChatRequest(BaseModel):
    message: str
    history: list[HistoryEntry] = []
    context: ContextPayload

class ChatAction(BaseModel):
    type: str
    label: str
    event_id: Optional[int] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None

class ChatResponse(BaseModel):
    message: str
    actions: list[ChatAction] = []

# ── Tools ──────────────────────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "search_events",
        "description": (
            "Search the full NJIT event database by club name, event category, and/or keyword. "
            "Use this whenever asked about past events from a specific org, a specific type of event, or any event by name. "
            "Categories: social, exposure, info session, workshop, recruiting, conference, general meeting, volunteering, fundraiser, study support, site tour, hackathon, other. "
            "IMPORTANT: When asked about a specific club's events (e.g. 'what networking events has SHPE hosted'), "
            "search by club_name WITHOUT a category filter to get ALL their events — clubs may categorize events inconsistently. "
            "Only filter by category when searching across ALL clubs (e.g. 'what hackathons are happening on campus'). "
            "Use past_only=true when the user asks what a club 'has hosted' or about past events. "
            "For general networking: categories=['social','exposure','recruiting','conference']. "
            "For general career: categories=['info session','workshop','recruiting','conference','site tour']."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "club_name": {
                    "type": "string",
                    "description": "Club or org name to filter by (partial match). E.g. 'SHPE', 'ACM', 'IEEE'."
                },
                "categories": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "One or more event categories (OR logic). Pass multiple in one call instead of separate calls."
                },
                "keyword": {
                    "type": "string",
                    "description": "Keyword to search in event name. E.g. 'networking', 'internship', 'hackathon'."
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results to return. Default 10, max 20."
                },
                "past_only": {
                    "type": "boolean",
                    "description": "If true, only return events that have already happened (date <= today). Use when the user asks what a club 'has hosted' or about past events."
                }
            },
            "required": []
        }
    },
    {
        "name": "get_event_details",
        "description": "Get full details for a specific event by its event_id, including location, food, and caption.",
        "input_schema": {
            "type": "object",
            "properties": {
                "event_id": {
                    "type": "integer",
                    "description": "The numeric event ID."
                }
            },
            "required": ["event_id"]
        }
    },
    {
        "name": "get_club_info",
        "description": "Get background info about a specific NJIT club: bio/description, Instagram handle, and follower count. Use this when asked what a club is, what they do, or for general club info.",
        "input_schema": {
            "type": "object",
            "properties": {
                "club_name": {
                    "type": "string",
                    "description": "Club name to look up (partial match). E.g. 'ACM', 'SHPE', 'Robotics'."
                }
            },
            "required": ["club_name"]
        }
    },
    {
        "name": "find_club_members",
        "description": (
            "Find JitHub users who list membership in a specific club or organization. "
            "Use this when the user asks who is in a club, who in SHPE/ACM/etc could help, "
            "who they should connect with from a club, or asks for members from a specific org. "
            "Pass topic when the user wants help with a skill, subject, or type of problem so results can be ranked for relevance."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "club_name": {
                    "type": "string",
                    "description": "Club or org name to search memberships for. E.g. 'SHPE', 'HACCS', 'IEEE'."
                },
                "topic": {
                    "type": "string",
                    "description": "Optional topic or help area to rank members by, e.g. 'linked lists', 'interview prep', 'networking'."
                },
                "limit": {
                    "type": "integer",
                    "description": "Max members to return. Default 5, max 8."
                }
            },
            "required": ["club_name"]
        }
    }
]

# ── Tool execution ─────────────────────────────────────────────────────────────

CLUB_ACRONYMS = {
    # Engineering & professional orgs
    "acm":      "Computing Machinery",
    "ieee":     "Electrical and Electronics",
    "shpe":     "Hispanic Professional Engineers",
    "nsbe":     "Black Engineers",
    "swe":      "Women Engineers",
    "haccs":    "Hispanic Association of Computing",
    "alpfa":    "Latino Professionals",
    "asme":     "Mechanical Engineers",
    "asce":     "Civil Engineers",
    "aiche":    "Chemical Engineers",
    "aiaa":     "Aeronautics",
    "acs":      "American Chemical Society",
    "ashrae":   "Heating, Refrigerating",
    "awwa":     "Water Works",
    "bmes":     "Biomedical Engineering Society",
    "gbmes":    "Graduate Biomedical",
    "nomas":    "Minority Architecture",
    "iida":     "Interior Design Association",
    "igda":     "Game Developers Association",
    "grss":     "Geoscience and Remote Sensing",
    "sigchi":   "Computer-Human Interaction",
    "arema":    "Railway Engineering",
    "ewb":      "Engineers Without Borders",
    "fsae":     "FormulaSAE",
    "eop":      "Educational Opportunity",
    "aaees":    "Environmental Engineers",
    "idsa":     "Industrial Designers",
    "asl":      "American Sign Language",
    # Cultural & identity orgs
    "ais":      "Indian Students",
    "cusa":     "Chinese Undergraduate",
    "ksa":      "Korean Students",
    "jsa":      "Japanese Student",
    "esa":      "Egyptian Student",
    "bsu":      "Black Student Union",
    "msa":      "Muslim Student",
    "ica":      "Iranian Cultural",
    "caribso":  "Caribbean Students",
    "finest":   "Filipinos In Newark",
    "nepsa":    "Nepali Student",
    "colsa":    "Colombian Student",
    "afsa":     "African Students",
    "aaaea":    "Arab American",
    "yuva":     "Hindu Youth",
    "sanjit":   "Sikh Student",
    "bgsa":     "Bangladeshi",
    # Greek orgs
    "aka":      "Alpha Kappa Alpha",
    "akpsi":    "Alpha Kappa Psi",
    "apd":      "Alpha Phi Delta",
    "apo":      "Alpha Phi Omega",
    "ast":      "Alpha Sigma Tau",
    "depsi":    "Delta Epsilon Psi",
    "dphie":    "Delta Phi Epsilon",
    "kphig":    "Kappa Phi Gamma",
    "lul":      "Lambda Upsilon Lambda",
    "ltphi":    "Lambda Theta Phi",
    "sam":      "Sigma Alpha Mu",
    "spk":      "Sigma Psi Kappa",
    "apx":      "Alpha Rho Chi",
    "iota":     "Iota Phi Theta",
    # Student government & campus orgs
    "sac":      "Student Activities Council",
    "gsa":      "Graduate Student Association",
    "rha":      "Residence Hall Association",
    "nrhh":     "National Residence Hall Honorary",
    "hsc":      "Honors Student Council",
    "hhc":      "Honors Hall Council",
    "adhc":     "Albert Dorman Honors",
    # Other clubs
    "fbla":     "Future Business Leaders",
    "hosa":     "Health Occupations",
    "gdsc":     "Google Developer",
    "gdg":      "Google Developer",
    "cds":      "Career Development",
    "fssa":     "Forensic Science",
    "asl":      "American Sign Language",
    "wjtb":     "WJTB Radio",
}

def _resolve_club_name(club_name: str) -> str:
    """Expand known acronyms to searchable substrings."""
    return CLUB_ACRONYMS.get(club_name.lower().strip(), club_name)


def _candidate_club_search_terms(club_name: str) -> list[str]:
    raw = (club_name or "").strip()
    if not raw:
        return []

    terms: list[str] = [raw]
    direct = _resolve_club_name(raw)
    if direct and direct not in terms:
        terms.append(direct)

    for token in re.findall(r"[a-z0-9]+", raw.lower()):
        if len(token) < 2:
            continue
        if token not in terms:
            terms.append(token)
        expanded = CLUB_ACRONYMS.get(token)
        if expanded and expanded not in terms:
            terms.append(expanded)

    unique_terms: list[str] = []
    seen: set[str] = set()
    for term in terms:
        normalized = normalize_club_text(term)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        unique_terms.append(term)
    return unique_terms


def _resolve_club_filters(club_name: str, db: Session) -> tuple[list[models.Club], list[str]]:
    search_terms = _candidate_club_search_terms(club_name)
    if not search_terms:
        return [], []

    known_clubs = db.query(models.Club).all()
    matched: dict[int, models.Club] = {}
    alias_terms: list[str] = []

    for term in search_terms:
        club = find_matching_club(known_clubs, term)
        if club and club.club_id not in matched:
            matched[club.club_id] = club
            alias_terms.extend(get_club_aliases(club.name, club.instagram_handle))

    terms = search_terms + alias_terms
    unique_terms: list[str] = []
    seen: set[str] = set()
    for term in terms:
        normalized = normalize_club_text(term)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        unique_terms.append(term)

    return list(matched.values()), unique_terms


TOPIC_STOP_WORDS = {
    "a", "an", "and", "are", "be", "can", "could", "for", "from", "help",
    "helping", "how", "i", "in", "is", "it", "me", "my", "of", "on", "or",
    "someone", "something", "that", "the", "these", "those", "to", "want",
    "who", "with", "would", "you",
}


def _tokenize_topic(text: str | None) -> set[str]:
    if not text:
        return set()
    return {
        token
        for token in re.findall(r"[a-z0-9\+#]+", text.lower())
        if len(token) >= 3 and token not in TOPIC_STOP_WORDS
    }


def _member_matches_club(user_clubs: list[str], matched_clubs: list[models.Club], club_terms: list[str]) -> bool:
    if not user_clubs:
        return False

    normalized_terms = [normalize_club_text(term) for term in club_terms]
    for user_club in user_clubs:
        if matched_clubs and find_matching_club(matched_clubs, user_club):
            return True

        normalized_user_club = normalize_club_text(user_club)
        if not normalized_user_club:
            continue

        for normalized_term in normalized_terms:
            if not normalized_term:
                continue
            if (
                normalized_user_club == normalized_term
                or normalized_term in normalized_user_club
                or normalized_user_club in normalized_term
            ):
                return True

    return False


def _build_connection_status_map(current_user_id: str | None, db: Session) -> dict[str, dict[str, str]]:
    if not current_user_id:
        return {}

    rows = db.execute(sa_text("""
        SELECT from_user_id, to_user_id, status
        FROM connection_requests
        WHERE from_user_id = :current_user_id OR to_user_id = :current_user_id
    """), {"current_user_id": current_user_id}).fetchall()

    status_map: dict[str, dict[str, str]] = {}
    for row in rows:
        other_id = row.to_user_id if row.from_user_id == current_user_id else row.from_user_id
        direction = "sent" if row.from_user_id == current_user_id else "received"
        status_map[other_id] = {
            "status": row.status,
            "direction": direction,
        }
    return status_map


def _score_member_match(
    member: dict,
    topic_tokens: set[str],
    profile: ProfileContext | None,
    requested_club_name: str,
) -> tuple[int, list[str], list[str], list[str]]:
    score = 1
    reasons: list[str] = []

    skills = [skill for skill in (member.get("skills") or []) if isinstance(skill, str)]
    interests = [interest for interest in (member.get("interests") or []) if isinstance(interest, str)]
    clubs = [club for club in (member.get("clubs") or []) if isinstance(club, str)]
    looking_for = [item for item in (member.get("looking_for") or []) if isinstance(item, str)]

    skill_matches = [skill for skill in skills if _tokenize_topic(skill) & topic_tokens]
    interest_matches = [interest for interest in interests if _tokenize_topic(interest) & topic_tokens]
    looking_for_matches = [item for item in looking_for if _tokenize_topic(item) & topic_tokens]

    if skill_matches:
        score += 4 + min(len(skill_matches), 2)
        reasons.append(f"skills: {', '.join(skill_matches[:2])}")
    if interest_matches:
        score += 2 + min(len(interest_matches), 2)
        reasons.append(f"interests: {', '.join(interest_matches[:2])}")
    if looking_for_matches:
        score += 2
        reasons.append(f"also looking for: {', '.join(looking_for_matches[:2])}")

    if topic_tokens:
        searchable_chunks = [
            member.get("major") or "",
            member.get("bio") or "",
            member.get("year") or "",
        ]
        searchable_tokens = _tokenize_topic(" ".join(str(chunk) for chunk in searchable_chunks if chunk))
        topic_overlap = topic_tokens & searchable_tokens
        if topic_overlap:
            score += 2
            reasons.append(f"background overlap: {', '.join(sorted(topic_overlap)[:3])}")

    if profile:
        if profile.major and member.get("major") and profile.major.strip().lower() == str(member.get("major")).strip().lower():
            score += 2
            reasons.append(f"same major: {member.get('major')}")

        shared_interests = [interest for interest in interests if interest in (profile.interests or [])]
        if shared_interests:
            score += 2
            reasons.append(f"shared interests: {', '.join(shared_interests[:2])}")

        shared_skills = [skill for skill in skills if skill in (profile.skills or [])]
        if shared_skills:
            score += 2
            reasons.append(f"shared skills: {', '.join(shared_skills[:2])}")

        shared_other_clubs = [
            club for club in clubs
            if club in (profile.clubs or []) and normalize_club_text(club) != normalize_club_text(requested_club_name)
        ]
        if shared_other_clubs:
            score += 1
            reasons.append(f"shared clubs: {', '.join(shared_other_clubs[:2])}")

    return score, reasons, skill_matches, interest_matches

def _execute_tool(
    name: str,
    args: dict,
    db: Session,
    profile: ProfileContext | None = None,
    auth_header: str | None = None,
) -> dict:
    if name == "search_events":
        club_name  = args.get("club_name")
        categories = args.get("categories") or ([args["category"]] if args.get("category") else [])
        keyword    = args.get("keyword")
        limit      = min(int(args.get("limit", 10)), 20)
        past_only  = bool(args.get("past_only", False))
        today      = date.today()

        conditions, params = [], {}
        # Always exclude interest-gauging posts
        conditions.append("e.event_name NOT ILIKE '%interest%'")

        if club_name:
            matched_clubs, club_terms = _resolve_club_filters(club_name, db)
            club_parts: list[str] = []

            if matched_clubs:
                placeholders = []
                for index, club in enumerate(matched_clubs):
                    key = f"club_id_{index}"
                    params[key] = club.club_id
                    placeholders.append(f":{key}")
                club_parts.append(f"e.club_id IN ({', '.join(placeholders)})")

            if club_terms:
                name_filters = []
                collab_filters = []
                for index, term in enumerate(club_terms):
                    key = f"club_term_{index}"
                    params[key] = f"%{term}%"
                    name_filters.append(f"c.name ILIKE :{key}")
                    name_filters.append(f"c.instagram_handle ILIKE :{key}")
                    collab_filters.append(f"coll.partner_name ILIKE :{key}")

                club_parts.append("(" + " OR ".join(name_filters) + ")")
                club_parts.append(
                    "EXISTS (SELECT 1 FROM collaborations coll "
                    "WHERE coll.event_id = e.event_id AND (" + " OR ".join(collab_filters) + "))"
                )

            if club_parts:
                conditions.append("(" + " OR ".join(club_parts) + ")")

        if categories:
            category_parts = []
            for i, cat in enumerate(categories):
                params[f"cat{i}"] = f"%{cat}%"
                category_parts.append(f"e.event_category ILIKE :cat{i}")
            conditions.append("(" + " OR ".join(category_parts) + ")")
        if keyword:
            conditions.append("(e.event_name ILIKE :keyword OR ep.caption ILIKE :keyword)")
            params["keyword"] = f"%{keyword}%"
        if past_only:
            conditions.append("e.date <= CURRENT_DATE")

        where = "WHERE " + " AND ".join(conditions)

        rows = db.execute(sa_text(f"""
            SELECT *
            FROM (
                SELECT DISTINCT ON (e.event_id)
                    e.event_id, e.event_name, e.event_category, e.date,
                    c.name AS club_name, ep.caption, ep.engagement_score
                FROM events e
                JOIN clubs c ON e.club_id = c.club_id
                LEFT JOIN event_posts ep ON ep.event_id = e.event_id
                {where}
                ORDER BY e.event_id, ep.engagement_score DESC NULLS LAST
            ) deduped
        """), params).fetchall()

        def _sort_key(row):
            engagement = float(row.engagement_score) if row.engagement_score else 0.0
            if past_only:
                sort_date = row.date.toordinal() if row.date else date.min.toordinal()
                return (-sort_date, -engagement, row.event_name.lower())

            is_upcoming = row.date is not None and row.date >= today
            upcoming_rank = 0 if is_upcoming else 1
            if is_upcoming:
                sort_date = row.date.toordinal()
            else:
                sort_date = -(row.date.toordinal() if row.date else date.min.toordinal())
            return (upcoming_rank, sort_date, -engagement, row.event_name.lower())

        rows = sorted(rows, key=_sort_key)[:limit]

        return {
            "events": [
                {
                    "event_id":  r.event_id,
                    "name":      r.event_name,
                    "category":  r.event_category,
                    "date":      str(r.date) if r.date else None,
                    "club":      resolve_canonical_club_name(r.club_name) if r.club_name else r.club_name,
                    "description": (r.caption or "")[:120],
                }
                for r in rows
            ]
        }

    if name == "get_event_details":
        event_id = int(args["event_id"])
        row = db.execute(sa_text("""
            SELECT DISTINCT ON (e.event_id)
                e.event_id, e.event_name, e.event_category, e.date,
                e.campus_location, e.has_free_food, e.virtual,
                c.name AS club_name, ep.caption
            FROM events e
            JOIN clubs c ON e.club_id = c.club_id
            LEFT JOIN event_posts ep ON ep.event_id = e.event_id
            WHERE e.event_id = :event_id
            ORDER BY e.event_id, ep.engagement_score DESC NULLS LAST
        """), {"event_id": event_id}).fetchone()

        if not row:
            return {"error": f"Event {event_id} not found"}
        return {
            "event_id":   row.event_id,
            "name":       row.event_name,
            "category":   row.event_category,
            "date":       str(row.date) if row.date else None,
            "club":       row.club_name,
            "location":   row.campus_location,
            "free_food":  row.has_free_food,
            "virtual":    row.virtual,
            "description": (row.caption or "")[:200],
        }

    if name == "get_club_info":
        raw_club_name = args.get("club_name", "")
        matched_clubs, club_terms = _resolve_club_filters(raw_club_name, db)
        rows = []

        if matched_clubs:
            rows = [
                db.query(models.Club.name, models.Club.bio, models.Club.instagram_handle, models.Club.follower_count)
                .filter(models.Club.club_id == club.club_id)
                .first()
                for club in matched_clubs[:3]
            ]
        elif club_terms:
            conditions = []
            params = {}
            for index, term in enumerate(club_terms[:6]):
                key = f"club_term_{index}"
                params[key] = f"%{term}%"
                conditions.append(f"name ILIKE :{key}")
                conditions.append(f"instagram_handle ILIKE :{key}")
            rows = db.execute(sa_text(f"""
                SELECT name, bio, instagram_handle, follower_count
                FROM clubs
                WHERE {" OR ".join(conditions)}
                ORDER BY follower_count DESC NULLS LAST
                LIMIT 3
            """), params).fetchall()

        if not rows:
            return {"error": f"No club found matching '{raw_club_name}'"}
        return {
            "clubs": [
                {
                    "name":             resolve_canonical_club_name(r.name),
                    "bio":              (r.bio or "")[:300],
                    "instagram":        r.instagram_handle,
                    "follower_count":   r.follower_count,
                }
                for r in rows
            ]
        }

    if name == "find_club_members":
        raw_club_name = args.get("club_name", "")
        if not raw_club_name.strip():
            return {"error": "club_name is required"}

        limit = min(int(args.get("limit", 5)), 8)
        topic = (args.get("topic") or "").strip()
        matched_clubs, club_terms = _resolve_club_filters(raw_club_name, db)
        canonical_names = [resolve_canonical_club_name(club.name) for club in matched_clubs]

        if not auth_header:
            return {"error": "Authentication required to access member data"}

        try:
            response = requests.post(
                f"{AUTH_API_URL}/api/connections/club-members",
                headers={
                    "Authorization": auth_header,
                    "Content-Type": "application/json",
                },
                json={
                    "clubName": canonical_names[0] if canonical_names else raw_club_name,
                    "clubTerms": club_terms,
                    "topic": topic or None,
                    "limit": limit,
                },
                timeout=6,
            )
            payload = response.json()
            if response.status_code >= 400:
                return {"error": payload.get("error") or "Membership lookup failed"}
            payload.setdefault("matched_clubs", canonical_names)
            return payload
        except requests.RequestException as exc:
            return {"error": f"Membership lookup unavailable: {exc}"}

    return {"error": f"Unknown tool: {name}"}

# ── System prompt ──────────────────────────────────────────────────────────────

NJIT_BASE = """
You are JITI, the AI assistant built into JitHub — the student network app for NJIT (New Jersey Institute of Technology) in Newark, NJ.

NJIT FACTS:
- Public STEM-focused research university, ~12,000 students, diverse campus
- Semesters: Spring runs January–May; Fall runs September–December
- Campus buildings: Kupfrian Hall, GITC (info tech hub), Tiernan Hall, Fenster Hall, Central King Building (CKB), Campus Center, Weston Hall, Eberhardt Hall
- Common majors: Computer Science, Information Technology, Electrical Engineering, Mechanical Engineering, Civil Engineering, Computer Engineering, Business Administration, Architecture, Biomedical Engineering, Data Science, Applied Mathematics, Chemical Engineering
- Key programs: Albert Dorman Honors College, Ying Prize (innovation competition), co-op program, Career Development Services (CDS)
- Research centers: CIMIC (computing & info management), CAIT (transportation), MTECH (manufacturing), NJIT Data Science Center
- Campus events: Highlander Week (September), NJIT Career Fair (twice/year: October & February), Capstone Day (May), Greek Week (Spring)
- Newark location: NJ Transit accessible (Penn Station NY, ~20 min), near Branch Brook Park (largest cherry blossom park in US)
- Highlanders are the sports teams; strong Greek life and cultural organizations

DATA SCOPE:
- All event and engagement data starts from Fall 2023. You have no data before that.
- The limitation is NEVER a complete response on its own. Every response must include actual data.
- CORRECT: "I only have data from Fall 2023 — here are the top clubs: • SHPE • IEEE • ACM ..."
- WRONG: "I only have data from Fall 2023." (full stop, no data) — this is always wrong.
- WRONG: "I only have data from Fall 2023. What do you want to know?" — never ask, just answer.

EVENT CATEGORY GLOSSARY (these are the exact category values stored in the database):
- social: parties, game nights, mixers, casual hangouts
- exposure: involvement fairs, showcases, info tables, visibility events
- info session: panels, presentations, how-to talks, speaker events
- workshop: hands-on skill-building sessions, training
- recruiting: career fairs, industry panels, alumni networking, internship/resume events
- conference: multi-day or regional professional events
- general meeting: club GBMs (General Body Meetings)
- volunteering: community service, charity events
- fundraiser: bake sales, raffles, fundraising events
- study support: tutoring, exam prep, academic help
- site tour: facility or company visits
- hackathon: coding competitions

TOOLS AVAILABLE:
- search_events: query the full event database by club name, category, and/or keyword.
- get_event_details: get full details for a specific event by event_id.
- get_club_info: look up a club's description, Instagram, and follower count. Use this for "what is X club?" questions.
- find_club_members: look up JitHub users who list membership in a specific club, and use topic relevance when the user wants help with something.

MANDATORY TOOL USE:
- You MUST call search_events before answering ANY question about past events, specific clubs' event history, or types of events hosted on campus. You do NOT know this information from memory — the database is the only source of truth.
- You MUST call find_club_members before answering who is in a specific club, who from SHPE/HACCS/etc could help, who the user should connect with inside a club, or any membership-roster style question. The JitHub membership database is the source of truth for that.

RESPONSE RULES:
CRITICAL: Output ZERO markdown. No asterisks, no **bold**, no *italic*, no `backticks`, no headers, no underscores for emphasis. Plain text only. Every ** you write is an error.
1. Write your message as plain prose. Then on the VERY LAST LINE write ACTIONS:[...] with action objects (or ACTIONS:[] if none). Nothing comes after ACTIONS:[...]. No JSON envelope, no markdown fences.
   EXAMPLE: ACM hosted Game Night and Algorithm Workshop in Spring 2024.
   ACTIONS:[{"type":"view_event","label":"Game Night","event_id":123},{"type":"view_event","label":"Algorithm Workshop","event_id":456}]
2. Action objects: type ("view_event"|"connect"), label, and either event_id (int) OR user_id+user_name. Event IDs are numeric internal references — NEVER write them in message text. BAD: "Mentorship Social (#6350)". GOOD: "Mentorship Social" with a view_event action using event_id 6350.
3. Every event you name in the message MUST have its own view_event action. Never say "here's one of those events" — give an action for every event you mention.
4. When asked about past events from a specific org: call search_events ONCE with club_name and categories as an array. For networking pass categories=["social","exposure","recruiting","conference"] in a single call — do NOT make separate calls per category.
5. Be specific — tie recommendations to the user's major, interests, skills, or looking_for.
5a. If the user says "come again?", "again", "repeat that", "say that again", or similar — look at the conversation history, find the last real question, and answer it with actual data. Never respond with only a limitation statement.
6. Never invent event names or details. Only report what search_events actually returned. If a search returns 0 results, say so honestly.
7. NEVER attribute an event returned by search_events to a different club than the one in the result. Each result row includes the club it belongs to.
8. Keep message under 150 words. Use bullet points (• ) for listing events or people — one bullet per item, each 1-2 lines max. Lead with a 1-sentence intro, then bullets, then a 1-sentence closer if needed. No numbered lists, no headers, NO markdown (no **bold**, no *italic*, no backticks). Plain text only. BAD: "**IEEE** hosts workshops". GOOD: "IEEE hosts workshops".
9. Today's date is {today}. Current semester week: {week}. "This week" = {week_mon} through {week_sun}. Events on {week_mon_next} or later are next week.
10. For top/trending EVENT questions: use TOP EVENTS THIS SEMESTER. For top/popular CLUB questions: use TOP CLUBS BY POPULARITY. Do NOT volunteer rankings or numbers unless the user explicitly asks for stats. When recommending clubs unprompted, describe what they do — not where they rank. NEVER reference Instagram, engagement scores, follower counts, or internal ranking mechanics. DO acknowledge the Fall 2023 data cutoff when the user asks about "all time" or historical data — never silently substitute a different time frame. If asked "all time" and you only have since Fall 2023, say so and answer with that data. Do NOT add unsolicited personalized recommendations when the user asks a simple factual question.
11. "connect" actions are ONLY for individual students with a real user_id. Never emit connect for a club or org. If a member result already shows connection_status as accepted or pending, do not emit a connect action for that person.
12. Never emit duplicate actions. One action per unique event or person.
13. NEVER end a response with a question ("What would you like to know?", "Is there anything else?", "Let me know if..."). State your answer and stop.
14. NEVER pre-announce a count ("I found 5..."). List the items first, then optionally summarize after. Counts stated before the list are always wrong.
15. When answering club-member questions, be explicit that these are JitHub members who listed that club in their profile. If find_club_members returns no one, say you do not see any matching JitHub members for that club right now.
""".strip()

def _semester_week(today: date) -> str:
    spring_start = date(today.year, 1, 20)
    fall_start   = date(today.year, 9, 1)
    if spring_start <= today <= date(today.year, 5, 15):
        week = ((today - spring_start).days // 7) + 1
        return f"Spring week {week} of ~15"
    if fall_start <= today <= date(today.year, 12, 20):
        week = ((today - fall_start).days // 7) + 1
        return f"Fall week {week} of ~15"
    return "between semesters"

def _semester_label(d) -> str:
    if not d:
        return ""
    if 9 <= d.month <= 12:
        return f"Fall {d.year}"
    if 1 <= d.month <= 5:
        return f"Spring {d.year}"
    return f"Summer {d.year}"


def _needs_club_popularity(message: str) -> bool:
    text = (message or "").lower()
    return bool(re.search(r"\b(top|popular|popularity|trending|biggest|best known|most active|most popular)\b", text)) and (
        "club" in text or "org" in text or "organization" in text or "society" in text or "association" in text
    )


def _get_club_popularity(db: Session, today: date) -> list[dict]:
    month = today.month
    sem_start = date(today.year, 1, 1) if month <= 5 else date(today.year, 9, 1)
    cache_key = str(sem_start)
    now = datetime.utcnow()
    cached = _club_popularity_cache.get(cache_key)
    if cached and now - cached[0] < CLUB_POPULARITY_CACHE_TTL:
        return cached[1]

    pop_rows = (
        db.query(
            models.Club.name,
            models.Club.follower_count,
            func.sum(models.EventPost.engagement_score).label("engagement_total"),
            func.sum(func.coalesce(models.EventPost.engagement_score, 0))
                .filter(models.EventPost.post_datetime >= sem_start).label("semester_engagement"),
        )
        .outerjoin(models.Event, models.Event.club_id == models.Club.club_id)
        .outerjoin(models.EventPost, models.EventPost.event_id == models.Event.event_id)
        .group_by(models.Club.club_id, models.Club.name, models.Club.follower_count)
        .order_by(func.sum(func.coalesce(models.EventPost.engagement_score, 0))
                  .filter(models.EventPost.post_datetime >= sem_start).desc().nullslast())
        .limit(10)
        .all()
    )

    club_popularity = [
        {
            "name":               r.name,
            "followers":          r.follower_count,
            "engagement_total":   r.engagement_total,
            "semester_engagement": r.semester_engagement,
        }
        for r in pop_rows
    ]

    _club_popularity_cache.clear()
    _club_popularity_cache[cache_key] = (now, club_popularity)
    return club_popularity

def _build_system_prompt(context: ContextPayload, club_popularity: list[dict], today: date) -> str:
    week_mon      = today - timedelta(days=today.weekday())
    week_sun      = week_mon + timedelta(days=6)
    week_mon_next = week_mon + timedelta(days=7)
    base = (NJIT_BASE
            .replace("{today}", str(today))
            .replace("{week}", _semester_week(today))
            .replace("{week_mon}", str(week_mon))
            .replace("{week_sun}", str(week_sun))
            .replace("{week_mon_next}", str(week_mon_next)))

    # Club popularity ranking
    if club_popularity:
        lines = []
        for i, c in enumerate(club_popularity):
            followers = f"{c['followers']:,}" if c['followers'] else "N/A"
            sem_eng   = f"{float(c['semester_engagement']):.1f}" if c['semester_engagement'] else "0"
            lines.append(f"  #{i+1} | {c['name']} | {followers} followers | {sem_eng} semester engagement")
        base += "\n\nTOP CLUBS BY POPULARITY (ranked by this semester's engagement):\n" + "\n".join(lines)

    # User profile
    p = context.profile
    profile_lines = [
        f"\nUSER PROFILE:",
        f"  Name: {p.name}",
        f"  Major: {p.major or 'Not set'}",
        f"  Year: {p.year or 'Not set'}",
        f"  Interests: {', '.join(p.interests or []) or 'None'}",
        f"  Clubs: {', '.join(p.clubs or []) or 'None'}",
        f"  Skills: {', '.join(p.skills or []) or 'None'}",
        f"  Looking for: {', '.join(p.looking_for or []) or 'Not specified'}",
        f"  Graduation: {p.graduation_year or 'Unknown'}",
    ]
    if p.chat_interests:
        profile_lines.append(f"  Past chat interests: {', '.join(p.chat_interests)}")
    base += "\n" + "\n".join(profile_lines)

    # Upcoming events
    if context.upcoming_events:
        lines = []
        for e in context.upcoming_events[:12]:
            extras = []
            if e.has_free_food: extras.append("free food")
            if e.virtual: extras.append("virtual")
            if e.campus_location: extras.append(e.campus_location)
            extra = f" [{', '.join(extras)}]" if extras else ""
            lines.append(f"  eid:{e.event_id} | {e.event_name} | {e.club_name} | {e.event_category or 'general'} | {e.date or 'TBD'}{extra}")
        base += "\n\nUPCOMING EVENTS (eid = event_id for view_event actions):\n" + "\n".join(lines)

    # Trending events
    if context.trending_events:
        sem = _semester_label(today)
        lines = [f"  #{i+1} | eid:{e.event_id} | {e.event_name} | {e.club_name} | {e.event_category or 'general'}"
                 for i, e in enumerate(context.trending_events[:10])]
        base += f"\n\nTOP EVENTS THIS SEMESTER ({sem}) — ranked by student engagement:\n" + "\n".join(lines)

    # Connection recommendations
    if context.recommendations:
        lines = []
        for r in context.recommendations[:5]:
            shared = []
            if r.shared_clubs:     shared.append(f"clubs: {', '.join(r.shared_clubs)}")
            if r.shared_interests: shared.append(f"interests: {', '.join(r.shared_interests)}")
            if r.shared_skills:    shared.append(f"skills: {', '.join(r.shared_skills)}")
            if r.looking_for:      shared.append(f"also looking for: {', '.join(r.looking_for)}")
            shared_str = " | ".join(shared) if shared else "general match"
            lines.append(f"  user_id:{r.id} | {r.name} | {r.major or 'Unknown major'} | {r.year or ''} | score:{r.score} | {shared_str}")
        base += "\n\nCONNECTION RECOMMENDATIONS:\n" + "\n".join(lines)
    else:
        base += "\n\nCONNECTION RECOMMENDATIONS:\n  None available right now."

    return base

# ── Shared setup ───────────────────────────────────────────────────────────────

def _build_context(body: ChatRequest, db: Session, today: date):
    club_popularity = _get_club_popularity(db, today) if _needs_club_popularity(body.message) else []

    system_prompt = _build_system_prompt(body.context, club_popularity, today)

    messages = []
    for h in body.history[-6:]:
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": body.message})

    return system_prompt, messages


async def _async_tool_loop(
    system_prompt: str,
    messages: list,
    db: Session,
    profile: ProfileContext,
    auth_header: str | None = None,
):
    """
    Fully async tool loop.
    Returns (messages, direct_text):
      - If the model responded with text directly (no tools): (messages, text_string)
      - If tool calls were made: (messages_with_tool_results, None)
    """
    for _ in range(4):
        response = await async_client.messages.create(
            model=CHAT_MODEL,
            max_tokens=384,
            system=system_prompt,
            messages=messages,
            tools=TOOLS,
        )
        if response.stop_reason != "tool_use":
            text = next((b.text for b in response.content if hasattr(b, "text")), "")
            return messages, text

        messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = _execute_tool(block.name, block.input, db, profile, auth_header)
                tool_results.append({
                    "type":        "tool_result",
                    "tool_use_id": block.id,
                    "content":     json.dumps(result),
                })
        messages.append({"role": "user", "content": tool_results})

    return messages, None


# ── Streaming endpoint ─────────────────────────────────────────────────────────

@router.post("/chat/stream")
async def sandbox_chat_stream(request: Request, body: ChatRequest, db: Session = Depends(get_db)):
    import traceback as tb
    today = date.today()

    async def generate() -> AsyncGenerator[str, None]:
        try:
            print("[sandbox] request received")
            system_prompt, messages = _build_context(body, db, today)
            print("[sandbox] context built")

            # Async tool loop — fully non-blocking
            messages, direct_text = await _async_tool_loop(
                system_prompt,
                messages,
                db,
                body.context.profile,
                request.headers.get("authorization"),
            )
            print("[sandbox] tool loop done")

            MARKER = "ACTIONS:"
            mlen = len(MARKER)
            stream_buffer = ""
            intro_buffer = ""
            intro_processed = False
            actions_str = ""
            actions_started = False

            _COUNT_INTRO = re.compile(
                r'^(I found|Here are|There are|I\'ve found|I identified|I\'ve identified'
                r'|Below are|Check out these|These are)\s+\d+[^\n]*\n+(?=\s*[•\-])',
                re.IGNORECASE,
            )

            def _flush_visible_text(text: str, final: bool = False) -> list[str]:
                nonlocal intro_buffer, intro_processed
                cleaned = text.replace("**", "").replace("__", "")
                if not cleaned and not final:
                    return []

                if not intro_processed:
                    intro_buffer += cleaned
                    if not final and "\n" not in intro_buffer and len(intro_buffer) < 240:
                        return []
                    intro_processed = True
                    visible = _COUNT_INTRO.sub("", intro_buffer)
                    intro_buffer = ""
                    return [visible] if visible else []

                return [cleaned] if cleaned else []

            def _consume_stream_text(text: str, final: bool = False) -> list[str]:
                nonlocal stream_buffer, actions_str, actions_started
                if actions_started:
                    actions_str += text
                    return []

                stream_buffer += text
                marker_index = stream_buffer.find(MARKER)
                if marker_index != -1:
                    visible_text = stream_buffer[:marker_index].rstrip("\n")
                    actions_str += stream_buffer[marker_index + mlen:]
                    stream_buffer = ""
                    actions_started = True
                    return _flush_visible_text(visible_text, final=True)

                if final:
                    visible_text = stream_buffer
                    stream_buffer = ""
                    return _flush_visible_text(visible_text, final=True)

                if len(stream_buffer) <= mlen:
                    return []

                visible_text = stream_buffer[:-mlen]
                stream_buffer = stream_buffer[-mlen:]
                return _flush_visible_text(visible_text)

            if direct_text is not None:
                for visible_chunk in _consume_stream_text(direct_text, final=True):
                    yield f"data: {json.dumps({'type': 'text', 'text': visible_chunk})}\n\n"
            else:
                async with async_client.messages.stream(
                    model=CHAT_MODEL,
                    max_tokens=640,
                    system=system_prompt,
                    messages=messages,
                ) as stream:
                    async for chunk in stream.text_stream:
                        for visible_chunk in _consume_stream_text(chunk):
                            yield f"data: {json.dumps({'type': 'text', 'text': visible_chunk})}\n\n"

                for visible_chunk in _consume_stream_text("", final=True):
                    yield f"data: {json.dumps({'type': 'text', 'text': visible_chunk})}\n\n"

            # Parse and send actions
            try:
                actions = json.loads(actions_str.strip() or "[]")
            except Exception:
                actions = []

            yield f"data: {json.dumps({'type': 'done', 'actions': actions})}\n\n"

        except Exception as e:
            tb.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})
