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

const PROFILE_REL_CAPS = {
  interests: 5,
  clubs: 3,
  companies: 4,
} as const

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
    // Update core properties on the student node
    await session.run(
      `MATCH (s:Student {id: $id})
       SET s.major          = $major,
           s.gpa            = $gpa,
           s.graduationYear = $graduationYear,
           s.bio            = $bio,
           s.interests      = $interests,
           s.linkedinUrl    = $linkedinUrl`,
      { id: cappedStudent.id, major: cappedStudent.major, gpa: cappedStudent.gpa,
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
      details: record.get("details"),
    }))
  } finally {
    session.close()
  }
}

export async function getShortestPath(fromId: string, toId: string): Promise<{ nodeIds: string[]; rels: string[] }> {
  const session = driver.session()
  try {
    // Restrict traversal to meaningful relationship types only:
    // WORKS_AT, MEMBER_OF, INTERESTED_IN, CONNECTED_TO
    // This prevents paths through arbitrary Neo4j relationships and keeps results meaningful
    const result = await session.run(
      `MATCH (a {id: $fromId}), (b {id: $toId})
       MATCH p = shortestPath((a)-[:WORKS_AT|MEMBER_OF|INTERESTED_IN|CONNECTED_TO*..10]-(b))
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
  major:           string
  sharedClubs:     number
  sharedInterests: number
  sameMajor:       boolean
  score:           number
}

export async function getRecommendations(userId: string): Promise<Recommendation[]> {
  const session = driver.session()
  try {
    const result = await session.run(
      `MATCH (me:Student {id: $userId}), (other:Student)
       WHERE other.id <> $userId
         AND NOT (me)-[:CONNECTED_TO]-(other)
       WITH me, other,
         size([(me)-[:MEMBER_OF]->(c)<-[:MEMBER_OF]-(other) | c])        AS sharedClubs,
         size([(me)-[:INTERESTED_IN]->(i)<-[:INTERESTED_IN]-(other) | i]) AS sharedInterests,
         CASE WHEN me.major = other.major THEN 1 ELSE 0 END               AS sameMajor
       WITH other, sharedClubs, sharedInterests, sameMajor,
            sharedClubs * 3 + sharedInterests * 2 + sameMajor * 2 AS score
       WHERE score > 0
       RETURN other.id    AS id,
              other.label AS name,
              other.major AS major,
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
