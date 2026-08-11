from datetime import date, datetime, time, timezone

SEMESTER_START = date(2026, 1, 1)
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.realtime import event_socket_manager
from app import models
from app.club_directory import (
    find_matching_club,
    get_club_aliases,
    get_club_display_name,
    normalize_club_text,
    resolve_canonical_club_name,
)

router = APIRouter(prefix="/events", tags=["events"])


@router.websocket("/ws")
async def events_ws(websocket: WebSocket):
    """Live events feed. The client never needs to send anything — the
    receive_text() loop exists purely to observe the disconnect."""
    await event_socket_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        # `finally`, not just `except WebSocketDisconnect`: any other error in
        # the loop (a proxy severing the connection, a cancelled task on
        # shutdown) would otherwise leave a dead socket in the broadcast set
        # forever, and every future broadcast pays to discover it is dead.
        event_socket_manager.disconnect(websocket)


def _format_event(event, post, club):
    days_until = None
    if event.date:
        days_until = (event.date - date.today()).days
    event_categories = _parse_event_categories(event.event_category)
    canonical_club_name = resolve_canonical_club_name(club.name)
    return {
        "event_id": event.event_id,
        "event_name": event.event_name,
        "event_type": event.event_type,
        "event_category": event_categories[0] if event_categories else None,
        "event_categories": event_categories,
        "date": str(event.date) if event.date else None,
        "days_until": days_until,
        "start_time": str(event.start_time) if event.start_time else None,
        "end_time": str(event.end_time) if event.end_time else None,
        "campus_location": event.campus_location,
        "event_room": event.event_room,
        "has_free_food": event.has_free_food,
        "virtual": event.virtual,
        "is_external": event.is_external,
        "is_open_to_public": event.is_open_to_public,
        "event_link": event.event_link,
        "club_id": club.club_id,
        "club_name": get_club_display_name(canonical_club_name),
        "club_full_name": canonical_club_name,
        "club_aliases": get_club_aliases(canonical_club_name, club.instagram_handle),
        "likes": post.likes if post else None,
        "comments": post.comments if post else None,
        "engagement_score": float(post.engagement_score) if post and post.engagement_score else None,
        "post_url": post.post_url if post else None,
        "caption": post.caption if post else None,
    }


class CommunityEventBody(BaseModel):
    club_name: str
    event_name: str
    event_category: str | None = None
    event_categories: list[str] | None = None
    collaborators: list[str] | None = None
    corporate_partners: list[str] | None = None
    date: date
    start_time: str
    end_time: str | None = None
    campus_location: str | None = None
    event_room: str | None = None
    virtual: bool = False
    has_free_food: bool = False
    is_open_to_public: bool = True
    event_link: str | None = None
    description: str | None = None


def _parse_time_string(value: str | None) -> time | None:
    if value is None:
        return None
    try:
        return time.fromisoformat(value.strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM.") from exc


def _parse_event_categories(value: str | None) -> list[str]:
    if not value:
        return []
    categories: list[str] = []
    for raw in value.split(","):
        cleaned = raw.strip().lower()
        if cleaned and cleaned not in categories:
            categories.append(cleaned)
    return categories


def _normalize_requested_categories(body: CommunityEventBody) -> list[str]:
    values = body.event_categories or ([] if body.event_category is None else [body.event_category])
    categories: list[str] = []
    for value in values:
        cleaned = (value or "").strip().lower()
        if cleaned and cleaned not in categories:
            categories.append(cleaned)
    return categories


def _unique_partner_names(values: list[str] | None) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for value in values or []:
        cleaned = " ".join((value or "").strip().split())
        normalized = normalize_club_text(cleaned)
        if not cleaned or not normalized or normalized in seen:
            continue
        seen.add(normalized)
        unique.append(cleaned)
    return unique


def _normalize_event_name(value: str) -> str:
    return " ".join(value.lower().split())


def _resolve_known_partner_names(clubs: list[models.Club], names: list[str]) -> list[str]:
    resolved: list[str] = []
    seen: set[str] = set()
    for name in names:
        match = find_matching_club(clubs, name)
        canonical_name = resolve_canonical_club_name(match.name if match else name)
        normalized = normalize_club_text(canonical_name)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        resolved.append(canonical_name)
    return resolved


def _get_event_participant_names(event: models.Event, club: models.Club, collabs: list[models.Collaboration]) -> set[str]:
    participant_names = {
        resolve_canonical_club_name(club.name),
        *(
            resolve_canonical_club_name(collab.partner_name)
            for collab in collabs
            if (collab.partner_name or "").strip()
        ),
    }
    return {
        normalize_club_text(name)
        for name in participant_names
        if normalize_club_text(name)
    }


def _base_query(db):
    return (
        db.query(models.Event, models.EventPost, models.Club)
        .join(models.EventPost, models.EventPost.event_id == models.Event.event_id)
        .join(models.Club, models.Club.club_id == models.Event.club_id)
    )


def _apply_filters(q, public_only, event_type):
    if public_only:
        q = q.filter(models.Event.is_open_to_public == True)
    if event_type:
        q = q.filter(models.Event.event_type == event_type)
    return q


@router.post("/community", status_code=201)
async def create_community_event(body: CommunityEventBody, db: Session = Depends(get_db)):
    club_name = body.club_name.strip()
    event_name = body.event_name.strip()
    event_categories = _normalize_requested_categories(body)
    requested_collaborators = _unique_partner_names(body.collaborators)
    requested_corporate_partners = _unique_partner_names(body.corporate_partners)
    campus_location = (body.campus_location or "").strip()
    event_room = (body.event_room or "").strip()
    event_link = (body.event_link or "").strip()
    description = (body.description or "").strip()

    if not club_name or not event_name or not event_categories:
        raise HTTPException(status_code=400, detail="Missing required fields")

    if not body.virtual and not campus_location:
        raise HTTPException(status_code=400, detail="Campus location is required for in-person events")

    start_at = _parse_time_string(body.start_time)
    end_at = _parse_time_string(body.end_time)

    if start_at is None:
        raise HTTPException(status_code=400, detail="Start time is required")

    known_clubs = db.query(models.Club).all()
    club = find_matching_club(known_clubs, club_name)
    resolved_primary_club_name = resolve_canonical_club_name(club.name if club else club_name)
    collaborator_names = _resolve_known_partner_names(known_clubs, requested_collaborators)
    collaborator_names = [
        name for name in collaborator_names
        if normalize_club_text(name) != normalize_club_text(resolved_primary_club_name)
    ]
    requested_participants = {
        normalize_club_text(resolved_primary_club_name),
        *(normalize_club_text(name) for name in collaborator_names),
    }

    candidate_events = (
        db.query(models.Event)
        .filter(models.Event.date == body.date)
        .filter(models.Event.start_time == start_at)
        .all()
    )

    normalized_event_name = _normalize_event_name(event_name)
    event_ids = [event.event_id for event in candidate_events]
    collabs_by_event: dict[int, list[models.Collaboration]] = {event_id: [] for event_id in event_ids}
    if event_ids:
        existing_collabs = (
            db.query(models.Collaboration)
            .filter(models.Collaboration.event_id.in_(event_ids))
            .all()
        )
        for collab in existing_collabs:
            collabs_by_event.setdefault(collab.event_id, []).append(collab)

    for existing_event in candidate_events:
        if _normalize_event_name(existing_event.event_name) != normalized_event_name:
            continue

        existing_club = next(
            (known_club for known_club in known_clubs if known_club.club_id == existing_event.club_id),
            None,
        )
        if existing_club is None:
            continue

        existing_participants = _get_event_participant_names(
            existing_event,
            existing_club,
            collabs_by_event.get(existing_event.event_id, []),
        )
        if existing_participants & requested_participants:
            raise HTTPException(
                status_code=409,
                detail="An event with the same title, date, and time already exists for one of the participating clubs.",
            )

    if club is None:
        club = models.Club(name=club_name, is_active=True)
        db.add(club)
        db.flush()

    event = models.Event(
        club_id=club.club_id,
        event_name=event_name,
        event_type="promo",
        date=body.date,
        day_of_week=body.date.strftime("%A"),
        start_time=start_at,
        end_time=end_at,
        virtual=body.virtual,
        is_external=False,
        campus_location=campus_location or None,
        event_room=event_room or None,
        has_free_food=body.has_free_food,
        is_open_to_public=body.is_open_to_public,
        event_link=event_link or None,
        promo_link=event_link or None,
        event_category=", ".join(event_categories),
    )
    db.add(event)
    db.flush()

    post = models.EventPost(
        event_id=event.event_id,
        post_type="promo",
        post_datetime=datetime.now(timezone.utc),
        likes=0,
        likes_estimated=False,
        comments=0,
        engagement_score=0,
        post_url=event_link or None,
        caption=description or None,
    )
    db.add(post)

    for collaborator_name in collaborator_names:
        db.add(models.Collaboration(event_id=event.event_id, partner_name=collaborator_name))

    for sponsor_name in requested_corporate_partners:
        db.add(models.Sponsor(event_id=event.event_id, sponsor_name=sponsor_name))

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        print("community event insert failed:", exc)
        raise HTTPException(status_code=500, detail="Could not create event") from exc

    db.refresh(event)
    db.refresh(post)
    db.refresh(club)
    response = _format_event(event, post, club)
    response["collaborators"] = collaborator_names
    response["sponsors"] = requested_corporate_partners
    await event_socket_manager.broadcast({"type": "event.created", "event": response})
    return response


from difflib import SequenceMatcher

_IGNORE_WORDS = {"event", "njit", "night", "annual", "first", "about", "your", "with", "week", "fall", "spring", "summer", "winter"}

def _names_are_dupes(a: str, b: str) -> bool:
    """True if two event names likely refer to the same event."""
    if SequenceMatcher(None, a, b).ratio() >= 0.75:
        return True
    # Also match if they share a significant word (>=5 chars, not a common filler word)
    words_a = {w for w in a.split() if len(w) >= 5 and w not in _IGNORE_WORDS}
    words_b = {w for w in b.split() if len(w) >= 5 and w not in _IGNORE_WORDS}
    return bool(words_a and words_b and words_a & words_b)


def _fuzzy_dedup_slots(events: list[dict]) -> list[dict]:
    """Deduplicate a flat list of heatmap slot dicts by fuzzy name match (≥75%)."""
    kept = []
    used: set[int] = set()
    for i, ev_i in enumerate(events):
        if i in used:
            continue
        name_i = ev_i["event_name"].strip().lower()
        best = ev_i
        for j, ev_j in enumerate(events):
            if j <= i or j in used:
                continue
            name_j = ev_j["event_name"].strip().lower()
            if _names_are_dupes(name_i, name_j):
                used.add(j)
                # Prefer the entry that has a post_url
                if not best.get("post_url") and ev_j.get("post_url"):
                    best = ev_j
        kept.append(best)
    return kept


def _deduplicate(results):
    """Deduplicate events: exact name first, then fuzzy match within the same date."""
    # Pass 1: exact name dedup — keep highest engagement per name
    seen: dict[str, tuple] = {}
    for row in results:
        event, post, club = row
        name = event.event_name.strip().lower()
        score = float(post.engagement_score) if post.engagement_score else 0
        if name not in seen or score > seen[name][1]:
            seen[name] = (row, score)

    candidates = list(seen.values())

    # Pass 2: fuzzy dedup — merge similar names on the same date (keep highest engagement)
    kept = []
    used: set[int] = set()
    for i, (row_i, score_i) in enumerate(candidates):
        if i in used:
            continue
        event_i = row_i[0]
        name_i = event_i.event_name.strip().lower()
        best_row, best_score = row_i, score_i
        for j, (row_j, score_j) in enumerate(candidates):
            if j <= i or j in used:
                continue
            event_j = row_j[0]
            if event_i.date != event_j.date:
                continue
            name_j = event_j.event_name.strip().lower()
            if _names_are_dupes(name_i, name_j):
                used.add(j)
                if score_j > best_score:
                    best_row, best_score = row_j, score_j
        kept.append(best_row)
    return kept


@router.get("/trending")
def get_trending(
    public_only: bool = Query(False),
    event_type: str = Query(None, description="promo or recap"),
    upcoming_only: bool = Query(False),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    """Upcoming events sorted by club trending rank, then event engagement."""
    # Build club → total likes map for the semester
    club_likes = dict(
        db.query(models.Club.club_id, func.sum(models.EventPost.likes))
        .join(models.Event, models.Event.club_id == models.Club.club_id)
        .join(models.EventPost, models.EventPost.event_id == models.Event.event_id)
        .filter(models.EventPost.post_datetime >= SEMESTER_START)
        .group_by(models.Club.club_id)
        .all()
    )

    q = _apply_filters(_base_query(db), public_only, event_type)
    q = q.filter(models.EventPost.post_datetime >= SEMESTER_START)
    if upcoming_only:
        today = date.today()
        q = q.filter(models.Event.date != None, models.Event.date >= today, models.Event.date <= SEMESTER_END)

    results = q.limit(limit * 5).all()
    deduped = _deduplicate(results)

    # Sort: club total likes (desc) primary, event engagement (desc) secondary
    def _sort_key(row):
        event, post, club = row
        club_total = club_likes.get(club.club_id, 0) or 0
        event_eng = float(post.engagement_score) if post and post.engagement_score else 0
        return (club_total, event_eng)

    deduped.sort(key=_sort_key, reverse=True)
    return [_format_event(e, p, c) for e, p, c in deduped[:limit]]


@router.get("/top-risers")
def get_top_risers(
    public_only: bool = Query(False),
    event_type: str = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    """Top events by engagement score this semester."""
    q = _apply_filters(_base_query(db), public_only, event_type)
    q = q.filter(models.EventPost.engagement_score != None)
    q = q.filter(models.EventPost.post_datetime >= SEMESTER_START)
    results = q.order_by(models.EventPost.engagement_score.desc()).offset(offset).limit(limit * 3).all()
    return [_format_event(e, p, c) for e, p, c in _deduplicate(results)][:limit]


@router.get("/upcoming")
def get_upcoming(
    public_only: bool = Query(False),
    category: str = Query(None, description="Filter by event_category"),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    """Upcoming promo events sorted by date, capped at semester end."""
    today = date.today()
    q = _apply_filters(_base_query(db), public_only, event_type=None)
    q = q.filter(
        models.Event.event_type == "promo",
        models.Event.date != None,
        models.Event.date >= today,
        models.Event.date <= SEMESTER_END,
    )
    if category:
        q = q.filter(models.Event.event_category.ilike(f"%{category}%"))
    results = q.order_by(models.Event.date.asc()).offset(offset).limit(limit * 3).all()
    return [_format_event(e, p, c) for e, p, c in _deduplicate(results)][:limit]


def _monday_of(d: date) -> date:
    """Return the Monday of the week containing d."""
    from datetime import timedelta
    return d - timedelta(days=d.weekday())


SEMESTER_END = date(2026, 5, 25)
HEATMAP_HOURS = [8, 10, 12, 14, 16, 18, 20, 22]


def _bucket_heatmap_hour(start_at: time | None) -> int:
    """Map an event start time to the nearest visible 2-hour heatmap row."""
    if start_at is None:
        return 12

    event_minutes = (start_at.hour * 60) + start_at.minute
    return min(
        HEATMAP_HOURS,
        key=lambda slot_hour: abs((slot_hour * 60) - event_minutes),
    )


@router.get("/heatmap/weeks")
def get_heatmap_weeks():
    """Returns every Monday from the current week through the semester-end week (May 25, 2026)."""
    from datetime import timedelta
    monday = _monday_of(date.today())
    end_monday = _monday_of(SEMESTER_END)
    weeks = []
    while monday <= end_monday:
        weeks.append(str(monday))
        monday += timedelta(days=7)
    return weeks


@router.get("/heatmap/week")
def get_heatmap(week_start: str = None, db: Session = Depends(get_db)):
    """Returns promo events grouped by day/hour for the Mon–Sun week of week_start."""
    from datetime import timedelta
    today = date.today()
    monday = date.fromisoformat(week_start) if week_start else _monday_of(today)
    sunday = monday + timedelta(days=6)
    results = (
        db.query(models.Event, models.Club.name, models.EventPost.post_url)
        .join(models.Club, models.Club.club_id == models.Event.club_id)
        .outerjoin(models.EventPost, models.EventPost.event_id == models.Event.event_id)
        .filter(
            models.Event.event_type == "promo",
            models.Event.date >= monday,
            models.Event.date <= min(sunday, SEMESTER_END),
        )
        .all()
    )
    grid: dict[str, list] = {}
    seen = set()
    for e, club_name, post_url in results:
        if e.event_id in seen:
            continue
        seen.add(e.event_id)
        day = e.date.strftime("%a")
        hour = _bucket_heatmap_hour(e.start_time)
        key = f"{day}:{hour}"
        if key not in grid:
            grid[key] = []
        grid[key].append({
            "event_id": e.event_id,
            "event_name": e.event_name,
            "club_name": club_name,
            "start_time": str(e.start_time)[:5] if e.start_time else None,
            "post_url": post_url,
        })
    # Fuzzy-dedup each slot so similar events (e.g. "Spring Concert" × 6) collapse to one
    return {key: _fuzzy_dedup_slots(evts) for key, evts in grid.items()}


@router.get("/top-clubs/semester")
def get_top_clubs(limit: int = Query(5, le=20), db: Session = Depends(get_db)):
    """Top clubs by average engagement score this semester."""
    results = (
        db.query(models.Club.name, func.avg(models.EventPost.engagement_score).label("avg_score"), func.count(models.EventPost.post_id).label("event_count"))
        .join(models.Event, models.Event.club_id == models.Club.club_id)
        .join(models.EventPost, models.EventPost.event_id == models.Event.event_id)
        .filter(models.EventPost.engagement_score != None)
        .group_by(models.Club.club_id, models.Club.name)
        .order_by(func.avg(models.EventPost.engagement_score).desc())
        .limit(limit)
        .all()
    )
    return [{"club_name": r.name, "avg_score": round(float(r.avg_score), 2), "event_count": r.event_count} for r in results]


@router.get("/clubs/trending")
def get_clubs_trending(limit: int = Query(5, le=20), db: Session = Depends(get_db)):
    """Top clubs by total likes this semester."""
    results = (
        db.query(
            models.Club.club_id,
            models.Club.name,
            func.sum(models.EventPost.likes).label("total_likes"),
            func.count(models.EventPost.post_id).label("event_count"),
        )
        .join(models.Event, models.Event.club_id == models.Club.club_id)
        .join(models.EventPost, models.EventPost.event_id == models.Event.event_id)
        .filter(models.EventPost.post_datetime >= SEMESTER_START)
        .group_by(models.Club.club_id, models.Club.name)
        .order_by(func.sum(models.EventPost.likes).desc())
        .limit(limit)
        .all()
    )
    # change_pct reserved for future weekly-snapshot comparison; None until historical data is tracked
    return [{
        "rank": i + 1,
        "club_id": r.club_id,
        "club_name": get_club_display_name(r.name),
        "total_likes": r.total_likes,
        "event_count": r.event_count,
        "change_pct": None,
    } for i, r in enumerate(results)]


@router.get("/clubs/top-risers")
def get_clubs_top_risers(limit: int = Query(5, le=20), db: Session = Depends(get_db)):
    """Top clubs by avg engagement score this semester."""
    results = (
        db.query(
            models.Club.club_id,
            models.Club.name,
            func.avg(models.EventPost.engagement_score).label("avg_score"),
            func.count(models.EventPost.post_id).label("event_count"),
        )
        .join(models.Event, models.Event.club_id == models.Club.club_id)
        .join(models.EventPost, models.EventPost.event_id == models.Event.event_id)
        .filter(models.EventPost.engagement_score != None)
        .filter(models.EventPost.post_datetime >= SEMESTER_START)
        .group_by(models.Club.club_id, models.Club.name)
        .order_by(func.avg(models.EventPost.engagement_score).desc())
        .limit(limit)
        .all()
    )
    return [{
        "rank": i + 1,
        "club_id": r.club_id,
        "club_name": get_club_display_name(r.name),
        "avg_score": round(float(r.avg_score), 2),
        "event_count": r.event_count,
    } for i, r in enumerate(results)]


# `:int` matters for diagnosis, not just tidiness. Without it this catch-all
# also matches literal paths like /events/ws, so when the WebSocket upgrade
# fails and the request falls through to the HTTP router, the client gets a
# 422 "ws is not a valid integer" instead of an honest 404 — which is exactly
# how the broken realtime feed disguised itself.
@router.get("/{event_id:int}")
def get_event(event_id: int, db: Session = Depends(get_db)):
    """Full detail for a single event including collaborators and sponsors."""
    result = (
        _base_query(db)
        .filter(models.Event.event_id == event_id)
        .first()
    )
    if not result:
        return {"error": "Not found"}
    event, post, club = result
    data = _format_event(event, post, club)

    collabs = db.query(models.Collaboration).filter(models.Collaboration.event_id == event_id).all()
    sponsors = db.query(models.Sponsor).filter(models.Sponsor.event_id == event_id).all()
    data["collaborators"] = [c.partner_name for c in collabs]
    data["sponsors"] = [s.sponsor_name for s in sponsors]

    return data
