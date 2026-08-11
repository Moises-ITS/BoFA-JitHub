/**
 * clubAcronyms.ts — acronym -> search-fragment hints, ported from
 * EDEN/backend/app/routers/sandbox.py:245-325.
 *
 * EDEN IS READ-ONLY. This file is a copy, not a link; if EDEN's table ever
 * changes (it will not — the service is retired) this one does not follow.
 *
 * SHAPE WARNING. These values are SEARCH FRAGMENTS, not canonical club names:
 * "acm" -> "Computing Machinery" is a case-insensitive substring hint to be
 * matched against clubs.name, not a name in its own right. That is why this is a
 * separate module from CLUB_METADATA in clubDirectory.ts, which maps a canonical
 * name to { display_name, aliases }. The two structures are not interchangeable
 * and the port is a transformation, not a paste. Resolution from hint to an
 * actual dedup group happens once per directory-cache fill in
 * organizationsService.ts, and an ambiguous hint is SKIPPED and logged rather
 * than guessed at.
 *
 * 73 unique keys. The Python source lists "asl" twice (lines 274 and 323) and
 * Python silently collapses the duplicate; a duplicate key here would be a
 * TypeScript error, so it appears once, in its first position.
 *
 * The section comments are preserved verbatim so a future reader can diff this
 * against the EDEN source line by line.
 */

export const CLUB_ACRONYM_HINTS: Readonly<Record<string, string>> = {
  // Engineering & professional orgs
  acm:      "Computing Machinery",
  ieee:     "Electrical and Electronics",
  shpe:     "Hispanic Professional Engineers",
  nsbe:     "Black Engineers",
  swe:      "Women Engineers",
  haccs:    "Hispanic Association of Computing",
  alpfa:    "Latino Professionals",
  asme:     "Mechanical Engineers",
  asce:     "Civil Engineers",
  aiche:    "Chemical Engineers",
  aiaa:     "Aeronautics",
  acs:      "American Chemical Society",
  ashrae:   "Heating, Refrigerating",
  awwa:     "Water Works",
  bmes:     "Biomedical Engineering Society",
  gbmes:    "Graduate Biomedical",
  nomas:    "Minority Architecture",
  iida:     "Interior Design Association",
  igda:     "Game Developers Association",
  grss:     "Geoscience and Remote Sensing",
  sigchi:   "Computer-Human Interaction",
  arema:    "Railway Engineering",
  ewb:      "Engineers Without Borders",
  fsae:     "FormulaSAE",
  eop:      "Educational Opportunity",
  aaees:    "Environmental Engineers",
  idsa:     "Industrial Designers",
  asl:      "American Sign Language",
  // Cultural & identity orgs
  ais:      "Indian Students",
  cusa:     "Chinese Undergraduate",
  ksa:      "Korean Students",
  jsa:      "Japanese Student",
  esa:      "Egyptian Student",
  bsu:      "Black Student Union",
  msa:      "Muslim Student",
  ica:      "Iranian Cultural",
  caribso:  "Caribbean Students",
  finest:   "Filipinos In Newark",
  nepsa:    "Nepali Student",
  colsa:    "Colombian Student",
  afsa:     "African Students",
  aaaea:    "Arab American",
  yuva:     "Hindu Youth",
  sanjit:   "Sikh Student",
  bgsa:     "Bangladeshi",
  // Greek orgs
  aka:      "Alpha Kappa Alpha",
  akpsi:    "Alpha Kappa Psi",
  apd:      "Alpha Phi Delta",
  apo:      "Alpha Phi Omega",
  ast:      "Alpha Sigma Tau",
  depsi:    "Delta Epsilon Psi",
  dphie:    "Delta Phi Epsilon",
  kphig:    "Kappa Phi Gamma",
  lul:      "Lambda Upsilon Lambda",
  ltphi:    "Lambda Theta Phi",
  sam:      "Sigma Alpha Mu",
  spk:      "Sigma Psi Kappa",
  apx:      "Alpha Rho Chi",
  iota:     "Iota Phi Theta",
  // Student government & campus orgs
  sac:      "Student Activities Council",
  gsa:      "Graduate Student Association",
  rha:      "Residence Hall Association",
  nrhh:     "National Residence Hall Honorary",
  hsc:      "Honors Student Council",
  hhc:      "Honors Hall Council",
  adhc:     "Albert Dorman Honors",
  // Other clubs
  fbla:     "Future Business Leaders",
  hosa:     "Health Occupations",
  gdsc:     "Google Developer",
  gdg:      "Google Developer",
  cds:      "Career Development",
  fssa:     "Forensic Science",
  wjtb:     "WJTB Radio",
}
