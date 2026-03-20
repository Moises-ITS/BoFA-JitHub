import os
import json
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from openai import OpenAI
from dotenv import load_dotenv

from app.database import get_db
from app import models

load_dotenv()
router = APIRouter(prefix="/sandbox", tags=["sandbox"])
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ── Pydantic models ────────────────────────────────────────────────────────────

class HistoryEntry(BaseModel):
    role: str
    content: str

class ProfileContext(BaseModel):
    name: str
    major: Optional[str] = None
    year: Optional[str] = None
    interests: Optional[list[str]] = []
    clubs: Optional[list[str]] = []
    skills: Optional[list[str]] = []
    looking_for: Optional[list[str]] = []
    graduation_year: Optional[int] = None

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

RESPONSE RULES:
1. ALWAYS respond with valid JSON: {"message": "...", "actions": [...]}
2. actions is a list — each item has: type ("view_event"|"connect"|"view_profile"), label (short text), and either event_id (int) or user_id+user_name (string)
3. Be specific — tie every recommendation to the user's actual major, interests, skills, or looking_for. Never say "you might want to check out" without a concrete reason.
4. Only draw genuine analogies. Social ≠ gardening. Community engagement ≠ gardening. Sustainability = gardening. AI + plant science = gardening + CS. If the connection requires two or more inferential leaps, do NOT make it — just say there's no match.
5. When recommending a club, say WHY it fits this specific user based on hard facts: shared major, shared interest keywords, or a real past event. "Community events might lead to gardening" is NOT acceptable reasoning.
6. If no upcoming event matches: scan CLUB HISTORY for the closest past event, name it explicitly, include a view_event action. Say "Nothing upcoming for X, but [Club] hosted [Event Name] ([semester]) — here's the card."
7. If nothing in history matches either: be honest ("I don't see anything on campus for X right now") and name only clubs whose mission is genuinely adjacent, with a specific reason.
8. Keep message under 180 words, plain text only (no markdown, no bullet points).
9. Never invent names or details not in the provided context. If a club has no events in CLUB HISTORY, say so — do NOT fabricate a past event or describe one as "specific past event not listed".
10. Today's date is {today}. Current semester week: {week}. This calendar week runs {week_mon} to {week_sun}. "This week" means dates {week_mon} through {week_sun} ONLY — events on {week_mon_next} or later are NEXT week, not this week.
11. When asked about "top", "best", or "most popular" events: use TOP EVENTS THIS SEMESTER — list #1, #2, #3 each on its own sentence with the event name and club. Include a separate view_event action for each. Do NOT say you lack rankings. Do NOT use CLUB HISTORY for current-semester top-event questions.
12. When asked "what's trending" or "what's happening on campus": list the top 3 events from TOP EVENTS THIS SEMESTER by name and club, one sentence each, and include a view_event action for every one. Do not summarize into a single event.
13. CLUB HISTORY contains past semesters only — use it when asked about past events or when nothing current matches. Events include a semester label like [Fall 2024] or [Spring 2025] — always state the semester when referencing them.
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
    """Return e.g. 'Fall 2024' or 'Spring 2025' from a date object or None."""
    if not d:
        return ""
    month = d.month
    year  = d.year
    if 9 <= month <= 12:
        return f"Fall {year}"
    if 1 <= month <= 5:
        return f"Spring {year}"
    return f"Summer {year}"

def _build_club_history(club_history: list[dict]) -> str:
    # Group events by club
    by_club: dict[str, list[dict]] = {}
    for row in club_history:
        club = row["club"]
        by_club.setdefault(club, []).append(row)
    lines = []
    for club, events in by_club.items():
        names = ", ".join(e["name"] for e in events[:5])
        lines.append(f"  {club}: {names}")
    return "\n".join(lines)

def _build_system_prompt(context: ContextPayload, club_bios: list[dict], club_history: list[dict], today: date) -> str:
    week_mon      = today - timedelta(days=today.weekday())          # Monday of current week
    week_sun      = week_mon + timedelta(days=6)                     # Sunday of current week
    week_mon_next = week_mon + timedelta(days=7)                     # Monday of next week
    base = (NJIT_BASE
            .replace("{today}", str(today))
            .replace("{week}", _semester_week(today))
            .replace("{week_mon}", str(week_mon))
            .replace("{week_sun}", str(week_sun))
            .replace("{week_mon_next}", str(week_mon_next)))

    # Club knowledge block
    if club_bios:
        bio_lines = [f"  {b['name']}: {b['bio']}" for b in club_bios if b.get("bio")]
        base += "\n\nCLUB KNOWLEDGE:\n" + "\n".join(bio_lines)

    # Club history — past events grouped by club (use event_id for view_event actions)
    if club_history:
        history_by_club: dict[str, list[dict]] = {}
        for row in club_history:
            history_by_club.setdefault(row["club"], []).append(row)
        history_lines = []
        for club, events in history_by_club.items():
            entries = []
            for e in events[:4]:  # max 4 events per club to control tokens
                sem  = f" [{_semester_label(e.get('date'))}]" if e.get("date") else ""
                desc = f" — {e['description']}" if e.get("description") else ""
                entries.append(f"{e['name']} (ID:{e['event_id']}){sem}{desc}")
            history_lines.append(f"  {club}:\n" + "\n".join(f"    - {en}" for en in entries))
        base += "\n\nCLUB HISTORY — past events (reference by event_id in view_event actions):\n" + "\n".join(history_lines)

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
    base += "\n" + "\n".join(profile_lines)

    # Upcoming events (compact one-liner per event)
    if context.upcoming_events:
        lines = []
        for e in context.upcoming_events[:12]:
            extras = []
            if e.has_free_food: extras.append("free food")
            if e.virtual: extras.append("virtual")
            if e.campus_location: extras.append(e.campus_location)
            extra = f" [{', '.join(extras)}]" if extras else ""
            lines.append(f"  ID:{e.event_id} | {e.event_name} | {e.club_name} | {e.event_category or 'general'} | {e.date or 'TBD'}{extra}")
        base += "\n\nUPCOMING EVENTS (use event_id for view_event actions):\n" + "\n".join(lines)

    # Trending events — ranked #1 to #5 by real student engagement score (current semester only)
    if context.trending_events:
        sem = _semester_label(today)
        lines = [f"  #{i+1} | ID:{e.event_id} | {e.event_name} | {e.club_name} | {e.event_category or 'general'}" for i, e in enumerate(context.trending_events[:5])]
        base += f"\n\nTOP EVENTS THIS SEMESTER ({sem}) — ranked by real student engagement, current semester only:\n" + "\n".join(lines)

    # Connection recommendations
    if context.recommendations:
        lines = []
        for r in context.recommendations[:5]:
            shared = []
            if r.shared_clubs: shared.append(f"clubs: {', '.join(r.shared_clubs)}")
            if r.shared_interests: shared.append(f"interests: {', '.join(r.shared_interests)}")
            if r.shared_skills: shared.append(f"skills: {', '.join(r.shared_skills)}")
            if r.looking_for: shared.append(f"also looking for: {', '.join(r.looking_for)}")
            shared_str = " | ".join(shared) if shared else "general match"
            lines.append(f"  user_id:{r.id} | {r.name} | {r.major or 'Unknown major'} | {r.year or ''} | score:{r.score} | {shared_str}")
        base += "\n\nCONNECTION RECOMMENDATIONS (use user_id+user_name for connect actions):\n" + "\n".join(lines)
    else:
        base += "\n\nCONNECTION RECOMMENDATIONS:\n  None available right now."

    return base

# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def sandbox_chat(body: ChatRequest, db: Session = Depends(get_db)):
    import traceback as tb
    today = date.today()

    try:
        # Fetch top 15 clubs with bios
        club_rows = (
            db.query(models.Club.name, models.Club.bio)
            .filter(models.Club.bio.isnot(None))
            .order_by(models.Club.follower_count.desc())
            .all()
        )
        club_bios = [{"name": r.name, "bio": r.bio} for r in club_rows]

        # Fetch top past events by engagement for club history (capped to control token use)
        history_rows = (
            db.query(
                models.Event.event_id,
                models.Event.event_name,
                models.Event.date,
                models.Club.name.label("club_name"),
                models.EventPost.caption,
                models.EventPost.engagement_score,
            )
            .join(models.Club, models.Event.club_id == models.Club.club_id)
            .join(models.EventPost, models.EventPost.event_id == models.Event.event_id)
            .order_by(models.EventPost.engagement_score.desc().nullslast())
            .limit(120)
            .all()
        )
        club_history = [
            {
                "event_id":   r.event_id,
                "name":       r.event_name,
                "club":       r.club_name,
                "date":       r.date,
                "description": (r.caption or "")[:80],
            }
            for r in history_rows
        ]

        system_prompt = _build_system_prompt(body.context, club_bios, club_history, today)

        messages = [{"role": "system", "content": system_prompt}]
        for h in body.history[-6:]:
            messages.append({"role": h.role, "content": h.content})
        messages.append({"role": "user", "content": body.message})

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=600,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        data = json.loads(raw)
        return ChatResponse(
            message=data.get("message", "Sorry, I couldn't process that."),
            actions=[ChatAction(**a) for a in data.get("actions", [])],
        )
    except Exception as e:
        tb.print_exc()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
