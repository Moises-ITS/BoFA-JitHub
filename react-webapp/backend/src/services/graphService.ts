import { driver } from "../config/neo4j"

interface StudentInput {
  id: string
  name: string
  major: string
  gpa: number | null
  graduationYear: number
  bio: string
  clubs: string[]
  companies: string[]
}

// Creates a Student node in Neo4j and links them to Club/Company nodes.
// If a club or company doesn't exist yet it is created automatically.
// Returns the node id (same as user id).
export async function createStudentNode(student: StudentInput): Promise<string> {
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
           s.bio            = $bio`,
      { id: student.id, name: student.name, major: student.major,
        gpa: student.gpa, graduationYear: student.graduationYear, bio: student.bio }
    )

    for (const clubName of student.clubs) {
      await session.run(
        `MATCH (s:Student {id: $studentId})
         MERGE (c:Club {type: 'club', label: $clubName})
           ON CREATE SET c.id = 'club-' + toLower(replace($clubName, ' ', '-'))
         MERGE (s)-[:MEMBER_OF]->(c)`,
        { studentId: student.id, clubName }
      )
    }

    for (const companyName of student.companies) {
      await session.run(
        `MATCH (s:Student {id: $studentId})
         MERGE (c:Company {type: 'company', label: $companyName})
           ON CREATE SET c.id = 'company-' + toLower(replace($companyName, ' ', '-'))
         MERGE (s)-[:WORKS_AT]->(c)`,
        { studentId: student.id, companyName }
      )
    }

    return student.id
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

export async function getNodes() {
  const session = driver.session()
  try {
    const result = await session.run("MATCH (n) RETURN (n) AS props")
    return result.records.map(record => {
      const n = record.get("props")
      return {
        id:      n.properties.id,
        label:   n.properties.label,
        type:    n.properties.type,
        details: n.properties,
      }
    })
  } finally {
    session.close()
  }
}

export async function getLinks() {
  const session = driver.session()
  try {
    const result = await session.run(
      "MATCH (a)-[r]->(b) RETURN a.id AS source, b.id AS target, type(r) AS rel"
    )
    return result.records.map(record => ({
      source: record.get("source"),
      target: record.get("target"),
      rel:    record.get("rel"),
    }))
  } finally {
    session.close()
  }
}
