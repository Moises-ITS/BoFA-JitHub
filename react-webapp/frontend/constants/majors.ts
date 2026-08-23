/**
 * The canonical list of NJIT majors a student picks during onboarding.
 *
 * Single source of truth: onboarding (ProfileSetupPage), profile editing
 * (EditProfileModal) and the Opportunities "Major" filter all read this list,
 * so a student can never pick a major on one screen that the other screens do
 * not know about. Previously each screen carried its own copy and the
 * Opportunities filter carried none at all, which left its dropdown empty.
 */
export const NJIT_MAJORS = [
  "Accounting",
  "Actuarial Mathematics",
  "Applied Mathematics",
  "Applied Statistics",
  "Architecture",
  "Biomedical Engineering",
  "Biomedical Sciences",
  "Biology",
  "Business Administration",
  "Chemical Biology",
  "Chemical Engineering",
  "Chemistry",
  "Civil Engineering",
  "Communication Studies",
  "Computer Engineering",
  "Computer Science",
  "Construction Management",
  "Criminal Justice",
  "Data Science",
  "Digital Design",
  "Digital Marketing",
  "Electrical Engineering",
  "Engineering Science",
  "Engineering Technology",
  "Environmental Engineering",
  "Environmental Science",
  "Finance",
  "Health Informatics",
  "History",
  "Humanities",
  "Imaging Science",
  "Industrial Engineering",
  "Information Systems",
  "Information Technology",
  "Interior Design",
  "Liberal Studies",
  "Management",
  "Materials Science and Engineering",
  "Mathematics",
  "Mechanical Engineering",
  "Medical Informatics",
  "Music Technology",
  "Nursing",
  "Physics",
  "Pre-Medical Studies",
  "Professional and Technical Communication",
  "Real Estate Development",
  "Science Technology and Society",
  "Statistics",
  "Urban Systems",
] as const

export type NjitMajor = (typeof NJIT_MAJORS)[number]

/**
 * Normalizes a free-text major/department/tag into the slug form used as the
 * value of the Opportunities major filter (and of the ?district= URL param).
 * "Computer Science" and "computer science" both become "computer-science", so
 * a listing tagged in prose still matches the dropdown entry.
 */
export function majorSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** slug → display name, for every major in NJIT_MAJORS. */
export const MAJOR_SLUG_TO_LABEL: Record<string, string> = Object.fromEntries(
  NJIT_MAJORS.map((major) => [majorSlug(major), major as string]),
)

/** Every onboarding major as a filter slug, in the same order as NJIT_MAJORS. */
export const NJIT_MAJOR_SLUGS: string[] = NJIT_MAJORS.map(majorSlug)
