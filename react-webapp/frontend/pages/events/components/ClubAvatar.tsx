/**
 * ClubAvatar — a club's Instagram profile picture with a deterministic emoji
 * fallback when the image is missing or fails to load.
 *
 * THE ONE canonical implementation: this component used to exist THREE times
 * (inside EventDetailModal, plus a copy and a "trending" near-clone privately
 * re-declared in Home.tsx). Duplicate components drift — a fallback bugfix in
 * one copy never reaches the others — so both variants now live here.
 */
import { useState } from "react";
import { CLUB_EMOJIS } from "../utils/eventFormatting";

/** Standard 40px avatar used in event cards and the detail modal. */
export function ClubAvatar({ clubId, clubName, index }: { clubId?: number | null; clubName?: string; index: number }) {
  const [failed, setFailed] = useState(false);
  if (clubId != null && !failed)
    return <img src={`/club_pics/${clubId}.jpg`} alt={clubName} onError={() => setFailed(true)} className="w-10 h-10 rounded-lg object-cover shrink-0" />;
  return <div className="text-3xl shrink-0 w-10 h-10 flex items-center justify-center">{CLUB_EMOJIS[index % CLUB_EMOJIS.length]}</div>;
}

/**
 * Compact 32px variant for dense lists (trending clubs on Home). clubId is
 * optional here because trending data sometimes lacks one — it falls straight
 * through to the emoji.
 */
export function TrendingClubAvatar({ clubId, clubName, index }: { clubId?: number | null; clubName?: string; index: number }) {
  const [failed, setFailed] = useState(false);

  if (clubId && !failed) {
    return (
      <img
        src={`/club_pics/${clubId}.jpg`}
        alt={clubName}
        onError={() => setFailed(true)}
        className="w-8 h-8 rounded-lg object-cover shrink-0"
      />
    );
  }

  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
      style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
      aria-label={clubName}
    >
      {CLUB_EMOJIS[index % CLUB_EMOJIS.length]}
    </div>
  );
}
