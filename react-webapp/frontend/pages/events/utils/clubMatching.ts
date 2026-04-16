export interface ClubDirectoryEntry {
  club_id: number;
  name: string;
  display_name: string;
  aliases: string[];
  instagram_handle?: string | null;
  logo_url?: string | null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  values.forEach((value) => {
    const cleaned = (value ?? "").trim();
    const normalized = normalizeClubText(cleaned);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    unique.push(cleaned);
  });

  return unique;
}

export function normalizeClubText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function clubNamesEquivalent(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftNorm = normalizeClubText(left);
  const rightNorm = normalizeClubText(right);
  return Boolean(leftNorm && rightNorm && leftNorm === rightNorm);
}

export function getClubOptionLabel(club: ClubDirectoryEntry): string {
  return club.display_name && !clubNamesEquivalent(club.display_name, club.name)
    ? `${club.display_name} - ${club.name}`
    : club.name;
}

export function getClubTermsFromDirectory(club: ClubDirectoryEntry | null | undefined): string[] {
  if (!club) {
    return [];
  }
  return uniqueStrings([club.name, club.display_name, ...(club.aliases ?? [])]);
}

export function getClubTermsFromEvent(event: any): string[] {
  return uniqueStrings([
    event?.club_full_name,
    event?.club_name,
    ...(Array.isArray(event?.club_aliases) ? event.club_aliases : []),
  ]);
}

export function textMatchesQuery(value: string | null | undefined, query: string): boolean {
  const normalizedValue = normalizeClubText(value);
  const normalizedQuery = normalizeClubText(query);
  if (!normalizedValue || !normalizedQuery) {
    return false;
  }
  return normalizedValue.includes(normalizedQuery) || normalizedQuery.includes(normalizedValue);
}

export function eventMatchesQuery(event: any, query: string): boolean {
  const normalizedQuery = normalizeClubText(query);
  if (!normalizedQuery) {
    return true;
  }

  const searchFields = [
    event?.event_name,
    event?.caption,
    event?.campus_location,
    event?.event_room,
    ...getClubTermsFromEvent(event),
  ];

  return searchFields.some((field) => textMatchesQuery(field, normalizedQuery));
}
