// ─────────────────────────────────────────────────────────────────────────────
// types/graph.ts
// All TypeScript interfaces and types for the graph page
// Eventually move this to shared/ when backend is connected
// ─────────────────────────────────────────────────────────────────────────────

export interface NodeDetails {
  major?:       string;
  year?:        string;
  gpa?:         string;
  goal?:        string;
  company?:     string;
  role?:        string;
  // The real backend property (createStudentNode / updateStudentNode write it).
  // Numeric off Neo4j, string in the mock fixtures — hence the union.
  graduationYear?: string | number;
  // Legacy alias, still used by data/mockGraphData.ts. Read as a fallback only.
  year_grad?:   string;
  research?:    string;
  open_roles?:  string;
  focus?:       string;
  members?:     string;
  bio?:         string;
  linkedinUrl?: string;
  [key: string]: unknown;
}

// Union type — NodeType can ONLY be one of these exact strings
export type NodeType = "student" | "club" | "company" | "professor" | "interest";

export interface GraphNode {
  id:      string;
  label:   string;
  type:    NodeType;
  details: NodeDetails;
  // D3 adds these at runtime during simulation
  r?:  number;
  x?:  number;
  y?:  number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source:  string | GraphNode; // D3 replaces string IDs with node objects
  target:  string | GraphNode;
  rel:     string;
  weight:  number; // 0–1  relationship strength
  opacity: number; // 0–1  confidence / recency
  style:   "solid" | "dashed" | "direct"; // solid = structural, dashed = inferred, direct = student↔student
}

/** Interaction mode of the graph page: free exploration, locked onto a node, or tracing a path. */
export type GraphMode = "free" | "locked" | "path";
