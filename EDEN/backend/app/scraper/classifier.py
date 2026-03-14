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

If promo or recap, extract all available event details from the caption and image.
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
  "event_link": string | null
}

Caption:
{caption}
"""

def classify_post(caption: str, image_url: str) -> dict | None:
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": USER_PROMPT.format(caption=caption or "(no caption)")
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": image_url, "detail": "low"}
                        }
                    ]
                }
            ],
            max_tokens=500,
            temperature=0,
        )

        raw = response.choices[0].message.content.strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        result = json.loads(raw)

        if result.get("post_type") == "neither":
            return None

        return result

    except Exception as e:
        print(f"  Classifier error: {e}")
        return None