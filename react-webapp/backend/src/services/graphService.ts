import { driver } from "../config/neo4j.js"

interface StudentInput {
  id: string
  name: string
  major: string
  gpa: number | null
  graduationYear: number | null
  bio: string
  clubs: string[]
  companies: string[]
  interests: string[]
  linkedinUrl?: string | null
}

export interface ProfessorInput {
  id: string
  name: string
  department: string
  interests: string[]
  bio?: string | null
  linkedinUrl?: string | null
}

const PROFILE_REL_CAPS = {
  interests: 5,
  clubs: 3,
  companies: 4,
} as const

/**
 * Runs a graph write that must NOT be able to fail the request around it.
 *
 * WHY: Postgres is the source of truth for identity; Neo4j is a projection of
 * it used for discovery. Signup used to write Neo4j FIRST and Postgres second,
 * which made the graph a hard dependency of account creation — an unreachable
 * or paused Aura instance meant nobody could sign up at all. Worse, each retry
 * minted a fresh uuid, so a failing Postgres write left a NEW orphan node
 * behind every attempt instead of converging.
 *
 * Callers now write Postgres first and pass the graph write through here. A
 * failure is logged and surfaces as `null`, which leaves `users.graph_node_id`
 * NULL — the marker that scripts/reconcile-graph.mjs uses to find rows whose
 * projection still needs building. Losing a graph node is recoverable; losing
 * the account row is not.
 */
export async function safeGraphWrite<T>(
  context: { op: string; userId: string },
  write: () => Promise<T>
): Promise<T | null> {
  try {
    return await write()
  } catch (err) {
    console.error("[graph][deferred]", {
      ...context,
      message: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

const capOrderedUnique = (items: string[], cap: number): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of items) {
    const item = raw.trim()
    if (!item) continue
    const key = item.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
    if (out.length >= cap) break
  }
  return out
}

const withGraphCaps = (student: StudentInput): StudentInput => ({
  ...student,
  interests: capOrderedUnique(student.interests, PROFILE_REL_CAPS.interests),
  clubs: capOrderedUnique(student.clubs, PROFILE_REL_CAPS.clubs),
  companies: capOrderedUnique(student.companies, PROFILE_REL_CAPS.companies),
})

// Creates a Student node in Neo4j and links them to Club/Company nodes.
// If a club or company doesn't exist yet it is created automatically.
// Returns the node id (same as user id).
export async function createStudentNode(student: StudentInput): Promise<string> {
  const cappedStudent = withGraphCaps(student)
  const session = driver.session()
  try {
    await session.run(
      `MERGE (s:Student {id: $id})
       SET s.label          = $name,
           s.type           = 'student',
           s.name           = $name,
           s.major          = $major,
           s.gpa            = $gpa,
           s.graduationYear = $graduationYear,
           s.bio            = $bio,
           s.interests      = $interests,
           s.linkedinUrl    = $linkedinUrl`,
      { id: cappedStudent.id, name: cappedStudent.name, major: cappedStudent.major,
        gpa: cappedStudent.gpa, graduationYear: cappedStudent.graduationYear, bio: cappedStudent.bio,
        interests: cappedStudent.interests, linkedinUrl: cappedStudent.linkedinUrl ?? null }
    )

    for (const clubName of cappedStudent.clubs) {
      await session.run(
        `MATCH (s:Student {id: $studentId})
         MERGE (c:Club {type: 'club', label: $clubName})
           ON CREATE SET c.id = 'club-' + toLower(replace($clubName, ' ', '-'))
         MERGE (s)-[:MEMBER_OF]->(c)`,
        { studentId: cappedStudent.id, clubName }
      )
    }

    for (const companyName of cappedStudent.companies) {
      await session.run(
        `MATCH (s:Student {id: $studentId})
         MERGE (c:Company {type: 'company', normalizedName: toLower($companyName)})
           ON CREATE SET c.id    = 'company-' + toLower(replace($companyName, ' ', '-')),
                         c.label = $companyName
         MERGE (s)-[:WORKS_AT]->(c)`,
        { studentId: cappedStudent.id, companyName }
      )
    }

    // For each interest, check if any existing student shares it.
    // If so, create an Interest node and connect all matching students to it.
    for (const interest of cappedStudent.interests) {
      const result = await session.run(
        `MATCH (other:Student) WHERE other.id <> $id AND $interest IN other.interests
         RETURN other.id AS otherId`,
        { id: cappedStudent.id, interest }
      )

      if (result.records.length > 0) {
        await session.run(
          `MERGE (i:Interest {type: 'interest', label: $interest})
           ON CREATE SET i.id = 'interest-' + toLower(replace($interest, ' ', '-'))
           WITH i MATCH (s:Student {id: $id})
           MERGE (s)-[:INTERESTED_IN]->(i)`,
          { id: cappedStudent.id, interest }
        )
        for (const record of result.records) {
          const otherId = record.get("otherId")
          await session.run(
            `MATCH (s:Student {id: $otherId}), (i:Interest {label: $interest})
             MERGE (s)-[:INTERESTED_IN]->(i)`,
            { otherId, interest }
          )
        }
      }
    }

    return cappedStudent.id
  } finally {
    session.close()
  }
}

// Updates an existing Student node's properties and refreshes all relationships.
export async function updateStudentNode(student: StudentInput): Promise<void> {
  const cappedStudent = withGraphCaps(student)
  const session = driver.session()
  try {
    // MERGE, not MATCH: if the projection is missing — the graph was rebuilt,
    // an Aura outage dropped the signup-time write, the node was purged — a
    // MATCH silently updated nothing. Postgres changed, the graph did not, and
    // nothing reported it. MERGE recreates the node instead, which makes every
    // profile save a repair opportunity. `label`/`type`/`name` are set here too
    // so a node born from this path is complete rather than a bare id.
    await session.run(
      `MERGE (s:Student {id: $id})
       SET s.label          = $name,
           s.type           = 'student',
           s.name           = $name,
           s.major          = $major,
           s.gpa            = $gpa,
           s.graduationYear = $graduationYear,
           s.bio            = $bio,
           s.interests      = $interests,
           s.linkedinUrl    = $linkedinUrl`,
      { id: cappedStudent.id, name: cappedStudent.name, major: cappedStudent.major,
        gpa: cappedStudent.gpa,
        graduationYear: cappedStudent.graduationYear, bio: cappedStudent.bio,
        interests: cappedStudent.interests, linkedinUrl: cappedStudent.linkedinUrl ?? null }
    )

    // Remove stale club / company / interest relationships
    await session.run(
      `MATCH (s:Student {id: $id})-[r:MEMBER_OF|WORKS_AT|INTERESTED_IN]->() DELETE r`,
      { id: cappedStudent.id }
    )

    // Re-create MEMBER_OF relationships
    for (const clubName of cappedStudent.clubs) {
      await session.run(
        `MATCH (s:Student {id: $studentId})
         MERGE (c:Club {type: 'club', label: $clubName})
           ON CREATE SET c.id = 'club-' + toLower(replace($clubName, ' ', '-'))
         MERGE (s)-[:MEMBER_OF]->(c)`,
        { studentId: cappedStudent.id, clubName }
      )
    }

    // Re-create WORKS_AT relationships
    for (const companyName of cappedStudent.companies) {
      await session.run(
        `MATCH (s:Student {id: $studentId})
         MERGE (c:Company {type: 'company', normalizedName: toLower($companyName)})
           ON CREATE SET c.id    = 'company-' + toLower(replace($companyName, ' ', '-')),
                         c.label = $companyName
         MERGE (s)-[:WORKS_AT]->(c)`,
        { studentId: cappedStudent.id, companyName }
      )
    }

    // Re-create INTERESTED_IN relationships (shared-interest logic)
    for (const interest of cappedStudent.interests) {
      const result = await session.run(
        `MATCH (other:Student) WHERE other.id <> $id AND $interest IN other.interests
         RETURN other.id AS otherId`,
        { id: cappedStudent.id, interest }
      )
      if (result.records.length > 0) {
        await session.run(
          `MERGE (i:Interest {type: 'interest', label: $interest})
           ON CREATE SET i.id = 'interest-' + toLower(replace($interest, ' ', '-'))
           WITH i MATCH (s:Student {id: $id})
           MERGE (s)-[:INTERESTED_IN]->(i)`,
          { id: cappedStudent.id, interest }
        )
        for (const record of result.records) {
          const otherId = record.get("otherId")
          await session.run(
            `MATCH (s:Student {id: $otherId}), (i:Interest {label: $interest})
             MERGE (s)-[:INTERESTED_IN]->(i)`,
            { otherId, interest }
          )
        }
      }
    }
  } finally {
    session.close()
  }
}

// Removes the bidirectional CONNECTED_TO relationship between two student nodes.
export async function removeConnectionFromNeo4j(userId1: string, userId2: string): Promise<void> {
  const session = driver.session()
  try {
    await session.run(
      `MATCH (a {id: $userId1})-[r:CONNECTED_TO]-(b {id: $userId2}) DELETE r`,
      { userId1, userId2 }
    )
  } finally {
    session.close()
  }
}

// Creates a bidirectional CONNECTED_TO relationship between two student nodes.
export async function createConnectionInNeo4j(userId1: string, userId2: string): Promise<void> {
  const session = driver.session()
  try {
    await session.run(
      `MATCH (a {id: $userId1}), (b {id: $userId2})
       MERGE (a)-[:CONNECTED_TO]->(b)
       MERGE (b)-[:CONNECTED_TO]->(a)`,
      { userId1, userId2 }
    )
  } finally {
    session.close()
  }
}

// Permanently removes a graph node (student or professor) and every relationship attached to it.
export async function deleteStudentNode(userId: string): Promise<void> {
  const session = driver.session()
  try {
    await session.run(
      `MATCH (s {id: $userId})
       DETACH DELETE s`,
      { userId }
    )
  } finally {
    session.close()
  }
}

// Creates a Professor node in Neo4j and links them to Interest nodes.
export async function createProfessorNode(prof: ProfessorInput): Promise<string> {
  const session = driver.session()
  try {
    await session.run(
      `MERGE (p:Professor {id: $id})
       SET p.label       = $name,
           p.type        = 'professor',
           p.name        = $name,
           p.department  = $department,
           p.interests   = $interests,
           p.bio         = $bio,
           p.linkedinUrl = $linkedinUrl`,
      {
        id: prof.id,
        name: prof.name,
        department: prof.department,
        interests: prof.interests,
        bio: prof.bio || null,
        linkedinUrl: prof.linkedinUrl || null,
      }
    )

    for (const interest of prof.interests) {
      await session.run(
        `MERGE (i:Interest {type: 'interest', label: $interest})
         ON CREATE SET i.id = 'interest-' + toLower(replace($interest, ' ', '-'))
         WITH i MATCH (p:Professor {id: $id})
         MERGE (p)-[:INTERESTED_IN]->(i)`,
        { id: prof.id, interest }
      )
    }

    return prof.id
  } finally {
    session.close()
  }
}

// Updates an existing Professor node in Neo4j.
export async function updateProfessorNode(prof: ProfessorInput): Promise<void> {
  const session = driver.session()
  try {
    await session.run(
      `MATCH (p:Professor {id: $id})
       SET p.department  = $department,
           p.interests   = $interests,
           p.bio         = $bio,
           p.linkedinUrl = $linkedinUrl`,
      {
        id: prof.id,
        department: prof.department,
        interests: prof.interests,
        bio: prof.bio || null,
        linkedinUrl: prof.linkedinUrl || null,
      }
    )

    // Remove stale relationships
    await session.run(
      `MATCH (p:Professor {id: $id})-[r:INTERESTED_IN]->() DELETE r`,
      { id: prof.id }
    )

    // Re-create relationships
    for (const interest of prof.interests) {
      await session.run(
        `MERGE (i:Interest {type: 'interest', label: $interest})
         ON CREATE SET i.id = 'interest-' + toLower(replace($interest, ' ', '-'))
         WITH i MATCH (p:Professor {id: $id})
         MERGE (p)-[:INTERESTED_IN]->(i)`,
        { id: prof.id, interest }
      )
    }
  } finally {
    session.close()
  }
}

// Patches any existing nodes that are missing an id property.
// Safe to call on every startup — only touches nodes where id IS NULL.
export async function ensureNodeIds() {
  const session = driver.session()
  try {
    await session.run(
      `MATCH (n) WHERE n.id IS NULL AND n.label IS NOT NULL
       SET n.id = toLower(labels(n)[0]) + '-' + toLower(replace(n.label, ' ', '-'))`
    )
  } finally {
    session.close()
  }
}

/**
 * PRIVACY ALLOWLIST for the bulk graph payload.
 *
 * /api/graph/nodes returns EVERY node to EVERY signed-in student. It used to
 * ship `properties(n)` wholesale — meaning each student's GPA, bio, email,
 * and LinkedIn URL were downloadable in one request by any classmate (a
 * harvest risk), and the payload grew with every profile field ever added.
 *
 * These are exactly the fields the graph UI renders in hover cards, PER NODE
 * TYPE — the allowlist is type-keyed so a field that's public on one type
 * (a club's "goal" mission statement) doesn't accidentally expose the same-
 * named private field on another (a student's personal "goal"). Everything
 * else — especially email, gpa, bio, linkedinUrl, and internal ids — stays
 * out. A student's OWN full profile still comes from /api/auth/me.
 *
 * Adding a field to a hover card? Add it here deliberately — the default for
 * new profile data is private.
 */
const PUBLIC_DETAIL_FIELDS: Record<string, readonly string[]> = {
  // `graduationYear` is the property every writer actually sets — createStudentNode,
  // updateStudentNode and the reconcile script all use that name. `year_grad`
  // was allowlisted but never written by anything except mockGraphData, so the
  // hover card's "Class of …" line rendered against mock data and silently
  // disappeared against real data. Both are listed: the real key, plus the mock
  // key so the offline/fallback graph keeps rendering identically.
  student:   ["major", "graduationYear", "year_grad"],
  club:      ["members", "goal", "focus"],
  company:   ["role", "open_roles"],
  professor: ["focus", "research", "department", "interests"],
  interest:  ["focus"],
}

function toPublicDetails(
  type: unknown,
  props: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!props) return {}
  // Unknown node types share nothing — fail closed, not open.
  const allowed = PUBLIC_DETAIL_FIELDS[String(type)] ?? []
  const details: Record<string, unknown> = {}
  for (const field of allowed) {
    if (props[field] !== undefined && props[field] !== null) {
      details[field] = props[field]
    }
  }
  return details
}

export async function getNodes() {
  const session = driver.session()
  try {
    // Compute a fallback id for any node still missing one so D3 can place it
    const result = await session.run(
      `MATCH (n)
       RETURN
         COALESCE(n.id, toLower(labels(n)[0]) + '-' + toLower(replace(coalesce(n.label,''), ' ', '-'))) AS id,
         n.label   AS label,
         n.type    AS type,
         properties(n) AS details`
    )
    return result.records.map(record => ({
      id:      record.get("id"),
      label:   record.get("label"),
      type:    record.get("type"),
      details: toPublicDetails(record.get("type"), record.get("details")),
    }))
  } finally {
    session.close()
  }
}

export async function getShortestPath(fromId: string, toId: string): Promise<{ nodeIds: string[]; rels: string[] }> {
  const session = driver.session()
  try {
    // Restrict traversal to meaningful relationship types only:
    // WORKS_AT/WORKED_AT, MEMBER_OF, INTERESTED_IN, CONNECTED_TO
    // This prevents paths through arbitrary Neo4j relationships and keeps results meaningful
    const result = await session.run(
      `MATCH (a {id: $fromId}), (b {id: $toId})
       MATCH p = shortestPath((a)-[:WORKS_AT|WORKED_AT|MEMBER_OF|INTERESTED_IN|CONNECTED_TO*..10]-(b))
       RETURN [n IN nodes(p) | COALESCE(n.id, '')] AS nodeIds,
              [r IN relationships(p) | type(r)]     AS rels`,
      { fromId, toId }
    )
    if (!result.records.length) return { nodeIds: [], rels: [] }
    const rec = result.records[0]
    return {
      nodeIds: rec.get("nodeIds") as string[],
      rels:    rec.get("rels")    as string[],
    }
  } finally {
    session.close()
  }
}

interface Recommendation {
  id:              string
  name:            string
  /** A student's major, or a professor's department — whichever the node carries. */
  major:           string
  /** "student" | "professor" — lets the UI label a professor as such. */
  type:            string
  sharedClubs:     number
  sharedInterests: number
  sameMajor:       boolean
  score:           number
}

export async function getRecommendations(userId: string): Promise<Recommendation[]> {
  const session = driver.session()
  try {
    const result = await session.run(
      // Both sides match :Student OR :Professor. Previously both were pinned to
      // :Student, which made professors invisible in recommendations in BOTH
      // directions — they received none, and never appeared in anyone else's.
      //
      // Scoring notes for mixed pairs: professors have no MEMBER_OF edges, so
      // sharedClubs is naturally 0 for them without special-casing. sameMajor
      // now requires a non-empty major on both sides, so two professors (whose
      // major is null and whose field lives in `department`) are not scored as
      // "same major" on a pair of NULLs. Shared interests therefore carry the
      // student↔professor signal, which is the intended relationship anyway.
      `MATCH (me) WHERE (me:Student OR me:Professor) AND me.id = $userId
       MATCH (other) WHERE (other:Student OR other:Professor)
         AND other.id <> $userId
         AND NOT (me)-[:CONNECTED_TO]-(other)
       WITH me, other,
         size([(me)-[:MEMBER_OF]->(c)<-[:MEMBER_OF]-(other) | c])        AS sharedClubs,
         size([(me)-[:INTERESTED_IN]->(i)<-[:INTERESTED_IN]-(other) | i]) AS sharedInterests,
         CASE WHEN me.major IS NOT NULL AND me.major <> ''
                   AND me.major = other.major THEN 1 ELSE 0 END          AS sameMajor
       WITH other, sharedClubs, sharedInterests, sameMajor,
            sharedClubs * 3 + sharedInterests * 2 + sameMajor * 2 AS score
       WHERE score > 0
       RETURN other.id    AS id,
              other.label AS name,
              COALESCE(other.major, other.department, '') AS major,
              COALESCE(other.type, 'student')             AS type,
              sharedClubs, sharedInterests,
              toBoolean(sameMajor) AS sameMajor,
              score
       ORDER BY score DESC
       LIMIT 6`,
      { userId }
    )
    return result.records.map(r => ({
      id:              r.get("id")              as string,
      name:            r.get("name")            as string,
      major:           r.get("major")           as string,
      type:            r.get("type")            as string,
      sharedClubs:     Number(r.get("sharedClubs")),
      sharedInterests: Number(r.get("sharedInterests")),
      sameMajor:       r.get("sameMajor")       as boolean,
      score:           Number(r.get("score")),
    }))
  } finally {
    session.close()
  }
}

export async function getLinks() {
  const session = driver.session()
  try {
    const result = await session.run(
      `MATCH (a)-[r]->(b)
       WITH a, r, b, type(r) AS relType
       OPTIONAL MATCH (peer:Student)-[:INTERESTED_IN]->(b)
         WHERE relType = 'INTERESTED_IN'
       WITH a, r, b, relType, count(peer) AS sharedCount
       RETURN
         COALESCE(a.id, toLower(labels(a)[0]) + '-' + toLower(replace(coalesce(a.label,''), ' ', '-'))) AS source,
         COALESCE(b.id, toLower(labels(b)[0]) + '-' + toLower(replace(coalesce(b.label,''), ' ', '-'))) AS target,
         relType AS rel,
         CASE relType
           WHEN 'WORKS_AT'      THEN 0.85
           WHEN 'WORKED_AT'     THEN 0.85
           WHEN 'MEMBER_OF'     THEN 0.65
           WHEN 'CONNECTED_TO'  THEN 0.75
           WHEN 'INTERESTED_IN' THEN
             CASE
               WHEN sharedCount <= 2 THEN 0.80
               WHEN sharedCount = 3  THEN 0.65
               WHEN sharedCount = 4  THEN 0.50
               ELSE 0.35
             END
           ELSE 0.50
         END AS weight,
         CASE relType
           WHEN 'WORKS_AT'      THEN 0.90
           WHEN 'WORKED_AT'     THEN 0.90
           WHEN 'MEMBER_OF'     THEN 0.75
           WHEN 'CONNECTED_TO'  THEN 0.70
           WHEN 'INTERESTED_IN' THEN 0.50
           ELSE 0.60
         END AS opacity,
         CASE relType
           WHEN 'INTERESTED_IN' THEN 'dashed'
           WHEN 'CONNECTED_TO'  THEN 'direct'
           ELSE 'solid'
         END AS style`
    )
    return result.records
      .map(record => ({
        source:  record.get("source"),
        target:  record.get("target"),
        rel:     record.get("rel"),
        weight:  record.get("weight")  as number,
        opacity: record.get("opacity") as number,
        style:   record.get("style")   as "solid" | "dashed" | "direct",
      }))
      .filter(l => l.source != null && l.target != null)
  } finally {
    session.close()
  }
}
