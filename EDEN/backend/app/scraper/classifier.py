import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """
You are an assistant that analyzes NJIT college club Instagram posts.
Given a caption and image, determine if the post is:
- "promo": announcing an upcoming event
- "recap": recapping a past event
- "neither": unrelated to any specific event

Only classify as promo or recap if the event involves current NJIT students. Alumni-only events, national chapter events not held at or near NJIT, or events clearly unrelated to the current NJIT student body should be classified as "neither".

If promo or recap, extract all available event details from the caption.
For event_name: always provide a short, specific title (3-6 words). If no explicit name exists, infer one from the caption (e.g. "Annual Fundraiser Gala", "Spring General Meeting").
Return ONLY a valid JSON object with no extra text.
"""

USER_PROMPT = """
Analyze this Instagram post and return a JSON object with these fields:
{
  "post_type": "promo" | "recap" | "neither",
  "event_name": string | null,
  "date": "YYYY-MM-DD" | null,
  "start_time": "HH:MM" | null,
  "end_time": "HH:MM" | null,
  "campus_location": string | null,
  "event_room": string | null,
  "has_free_food": boolean | null,
  "virtual": boolean | null,
  "is_external": boolean | null,
  "external_location_name": string | null,
  "event_link": string | null,
  "collaborators": list of club/org name strings | null,
  "sponsors": list of sponsor/company name strings | null,
  "is_open_to_public": boolean
}

For collaborators: look for "x", "X", "collab", "hosted with", "in partnership with", "presented with" patterns. Include the other org names.
For sponsors: look for "sponsored by", "brought to you by", "thank you to" patterns. Include the company/org names.
For is_open_to_public: false if the event is members-only, brothers/sisters-only, chapter meetings, or invite-only. true if open to all students or the general NJIT community.

Caption:
{caption}
"""

def classify_post(caption: str, image_url: str) -> dict | None:
    try:
        prompt = USER_PROMPT.replace("{caption}", caption or "(no caption)")
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            max_tokens=500,
            temperature=0,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content
        result = json.loads(raw)

        if result.get("post_type") == "neither":
            return None

        return result

    except Exception as e:
        print(f"  Classifier error: {e}")
        return None