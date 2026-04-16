from __future__ import annotations

import re
from collections.abc import Iterable
from pathlib import Path

from app import models

_CLUB_METADATA: dict[str, dict[str, list[str] | str]] = {
    "Association for Computing Machinery": {
        "display_name": "ACM",
        "aliases": ["ACM"],
    },
    "Institute of Electrical and Electronics Engineers": {
        "display_name": "IEEE",
        "aliases": ["IEEE"],
    },
    "Society of Hispanic Professional Engineers": {
        "display_name": "SHPE",
        "aliases": ["SHPE"],
    },
    "Society of Women Engineers": {
        "display_name": "SWE",
        "aliases": ["SWE"],
    },
    "National Society of Black Engineers": {
        "display_name": "NSBE",
        "aliases": ["NSBE"],
    },
    "American Society of Civil Engineers": {
        "display_name": "ASCE",
        "aliases": ["ASCE"],
    },
    "American Society of Mechanical Engineers": {
        "display_name": "ASME",
        "aliases": ["ASME"],
    },
    "American Institute of Chemical Engineers": {
        "display_name": "AIChE",
        "aliases": ["AIChE"],
    },
    "Biomedical Engineering Society": {
        "display_name": "BMES",
        "aliases": ["BMES"],
    },
    "Google Developer Student Club": {
        "display_name": "GDSC",
        "aliases": ["GDSC", "Google Student Developer Club"],
    },
    "Student Government Association": {
        "display_name": "SGA",
        "aliases": ["SGA"],
    },
    "Latino American Student Organization": {
        "display_name": "LASO",
        "aliases": ["LASO"],
    },
    "Muslim Student Association": {
        "display_name": "MSA",
        "aliases": ["MSA"],
    },
    "Women in Computer Science": {
        "display_name": "WiCS",
        "aliases": ["WiCS"],
    },
    "Hispanic Association of Computing College Students": {
        "display_name": "HACCS",
        "aliases": [
            "HACCS",
            "Hispanic and Latine Association of Computing College Students",
        ],
    },
}

_CLUB_PICS_DIR = Path(__file__).resolve().parents[3] / "react-webapp" / "frontend" / "public" / "club_pics"


def normalize_club_text(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


_ALIAS_TO_CANONICAL: dict[str, str] = {}

for canonical_name, metadata in _CLUB_METADATA.items():
    terms = [canonical_name, metadata.get("display_name", ""), *metadata.get("aliases", [])]
    for term in terms:
        normalized = normalize_club_text(str(term))
        if normalized:
            _ALIAS_TO_CANONICAL[normalized] = canonical_name


def _unique_strings(values: Iterable[str | None]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for value in values:
        cleaned = (value or "").strip()
        if not cleaned:
            continue
        norm = normalize_club_text(cleaned)
        if not norm or norm in seen:
            continue
        seen.add(norm)
        unique.append(cleaned)
    return unique


def get_club_display_name(full_name: str) -> str:
    canonical_name = resolve_canonical_club_name(full_name)
    meta = _CLUB_METADATA.get(canonical_name)
    if not meta:
        return full_name
    display_name = meta.get("display_name")
    return str(display_name) if display_name else canonical_name


def resolve_canonical_club_name(full_name: str) -> str:
    normalized = normalize_club_text(full_name)
    return _ALIAS_TO_CANONICAL.get(normalized, full_name)


def get_club_aliases(
    full_name: str,
    instagram_handle: str | None = None,
    extra_aliases: Iterable[str | None] = (),
) -> list[str]:
    canonical_name = resolve_canonical_club_name(full_name)
    meta = _CLUB_METADATA.get(canonical_name, {})
    aliases = [full_name, canonical_name, get_club_display_name(full_name)]
    aliases.extend(meta.get("aliases", []))
    aliases.extend(extra_aliases)

    handle = (instagram_handle or "").strip().lstrip("@")
    if handle:
        aliases.extend([handle, f"@{handle}"])

    return _unique_strings(aliases)


def _club_has_logo(club: models.Club) -> bool:
    return (_CLUB_PICS_DIR / f"{club.club_id}.jpg").exists()


def _club_preference_key(club: models.Club) -> tuple[int, int, int, int, int, int, int]:
    canonical_name = resolve_canonical_club_name(club.name)
    return (
        1 if club.name == canonical_name else 0,
        1 if _club_has_logo(club) else 0,
        1 if bool((club.instagram_handle or "").strip()) else 0,
        1 if bool((club.bio or "").strip()) else 0,
        int(club.follower_count or 0),
        len(club.name or ""),
        -int(club.club_id or 0),
    )


def serialize_club(club: models.Club, extra_aliases: Iterable[str | None] = ()) -> dict[str, object]:
    canonical_name = resolve_canonical_club_name(club.name)
    return {
        "club_id": club.club_id,
        "name": canonical_name,
        "display_name": get_club_display_name(canonical_name),
        "aliases": get_club_aliases(canonical_name, club.instagram_handle, extra_aliases=extra_aliases),
        "instagram_handle": club.instagram_handle,
        "logo_url": f"/club_pics/{club.club_id}.jpg",
    }


def serialize_club_collection(clubs: Iterable[models.Club]) -> list[dict[str, object]]:
    grouped: dict[str, list[models.Club]] = {}
    for club in clubs:
        canonical_key = normalize_club_text(resolve_canonical_club_name(club.name))
        grouped.setdefault(canonical_key, []).append(club)

    serialized: list[dict[str, object]] = []
    for group in grouped.values():
        preferred = max(group, key=_club_preference_key)
        extra_aliases: list[str] = []
        for club in group:
            extra_aliases.extend(get_club_aliases(club.name, club.instagram_handle))
        serialized.append(serialize_club(preferred, extra_aliases=extra_aliases))

    serialized.sort(key=lambda club: str(club["name"]).lower())
    return serialized


def find_matching_club(clubs: Iterable[models.Club], query: str) -> models.Club | None:
    normalized_query = normalize_club_text(query)
    if not normalized_query:
        return None

    exact_matches: list[models.Club] = []
    partial_matches: list[models.Club] = []

    for club in clubs:
        normalized_terms = {
            normalize_club_text(term)
            for term in get_club_aliases(club.name, club.instagram_handle)
        }
        normalized_terms.discard("")

        if normalized_query in normalized_terms:
            exact_matches.append(club)
            continue

        if any(
            normalized_query in term or term in normalized_query
            for term in normalized_terms
        ):
            partial_matches.append(club)

    if exact_matches:
        return max(exact_matches, key=_club_preference_key)
    if len(partial_matches) == 1:
        return partial_matches[0]
    if partial_matches:
        return max(partial_matches, key=_club_preference_key)
    return None
