// ─────────────────────────────────────────────────────────────────────────────
// data/mockGraphData.ts
// Offline fallback — mirrors the shape returned by /api/graph/nodes and /links
// ─────────────────────────────────────────────────────────────────────────────

import type { GraphNode, GraphLink } from "../types/graphNodes";

export const mockNodes: GraphNode[] = [
  // ── Students ──────────────────────────────────────────────────────────────
  { id: "s1",  label: "Alejandro Rivera",  type: "student",  details: { major: "Computer Science",    year_grad: "2027", gpa: "3.8", bio: "Loves distributed systems & hackathons." } },
  { id: "s2",  label: "Priya Nair",        type: "student",  details: { major: "Computer Science",    year_grad: "2026", gpa: "3.9", bio: "AI/ML researcher and competitive coder." } },
  { id: "s3",  label: "Marcus Webb",       type: "student",  details: { major: "Electrical Eng.",     year_grad: "2027", gpa: "3.5", bio: "Robotics enthusiast." } },
  { id: "s4",  label: "Sofia Delgado",     type: "student",  details: { major: "Data Science",        year_grad: "2026", gpa: "3.7", bio: "NLP and data visualization projects." } },
  { id: "s5",  label: "James Park",        type: "student",  details: { major: "Computer Science",    year_grad: "2028", gpa: "3.4", bio: "Full-stack dev, looking for internships." } },
  { id: "s6",  label: "Aisha Thompson",    type: "student",  details: { major: "Cybersecurity",       year_grad: "2026", gpa: "3.6", bio: "CTF competitor and security researcher." } },
  { id: "s7",  label: "Luca Ferreira",     type: "student",  details: { major: "Information Systems", year_grad: "2027", gpa: "3.3", bio: "Product-minded builder." } },
  { id: "s8",  label: "Nina Patel",        type: "student",  details: { major: "Computer Science",    year_grad: "2025", gpa: "3.95", bio: "Graduating senior, SWE offer at Google." } },
  { id: "s9",  label: "Omar Hassan",       type: "student",  details: { major: "Data Science",        year_grad: "2027", gpa: "3.6", bio: "Graph theory and fintech." } },
  { id: "s10", label: "Rachel Kim",        type: "student",  details: { major: "Computer Science",    year_grad: "2026", gpa: "3.8", bio: "Open source contributor." } },

  // ── Clubs ─────────────────────────────────────────────────────────────────
  { id: "c1",  label: "ACM NJIT",          type: "club",     details: { members: "320", goal: "Advance computing knowledge and career readiness." } },
  { id: "c2",  label: "IEEE",              type: "club",     details: { members: "210", goal: "Engineering excellence and industry connections." } },
  { id: "c3",  label: "Entrepreneur Soc.", type: "club",     details: { members: "180", goal: "Build startups, pitch nights, and founder talks." } },
  { id: "c4",  label: "CS Society",        type: "club",     details: { members: "145", goal: "Casual CS community — workshops and social events." } },
  { id: "c5",  label: "Cyber Defense Club",type: "club",     details: { members: "95",  goal: "CTF competitions and security research." } },

  // ── Companies ─────────────────────────────────────────────────────────────
  { id: "co1", label: "Google",            type: "company",  details: { role: "SWE Intern", open_roles: "12" } },
  { id: "co2", label: "Microsoft",         type: "company",  details: { role: "Full-Stack Intern", open_roles: "8" } },
  { id: "co3", label: "Amazon",            type: "company",  details: { role: "Data Science Co-op", open_roles: "6" } },
  { id: "co4", label: "Meta",              type: "company",  details: { role: "PM Intern", open_roles: "4" } },
  { id: "co5", label: "Bloomberg",         type: "company",  details: { role: "Financial Systems SWE", open_roles: "3" } },

  // ── Professors ────────────────────────────────────────────────────────────
  { id: "p1",  label: "Prof. Chen",        type: "professor",details: { focus: "Machine Learning",    research: "Federated learning and privacy-preserving AI." } },
  { id: "p2",  label: "Prof. Martinez",    type: "professor",details: { focus: "Cybersecurity",       research: "Network intrusion detection and zero-trust." } },
  { id: "p3",  label: "Prof. Williams",    type: "professor",details: { focus: "Distributed Systems", research: "Consensus algorithms and cloud infrastructure." } },

  // ── Interests ─────────────────────────────────────────────────────────────
  { id: "i1",  label: "Machine Learning",  type: "interest", details: { focus: "AI, neural networks, and research." } },
  { id: "i2",  label: "Web Development",   type: "interest", details: { focus: "React, APIs, and full-stack projects." } },
  { id: "i3",  label: "Cybersecurity",     type: "interest", details: { focus: "CTFs, penetration testing, and secure design." } },
  { id: "i4",  label: "Open Source",       type: "interest", details: { focus: "Contributing to OSS projects on GitHub." } },
  { id: "i5",  label: "Entrepreneurship",  type: "interest", details: { focus: "Startups, product thinking, and fundraising." } },
];

export const mockLinks: GraphLink[] = [
  // ── Student ↔ Student (direct connections) ────────────────────────────────
  { source: "s1",  target: "s2",  rel: "CONNECTS_WITH", weight: 0.9, opacity: 1,   style: "direct" },
  { source: "s1",  target: "s5",  rel: "CONNECTS_WITH", weight: 0.8, opacity: 0.9, style: "direct" },
  { source: "s2",  target: "s4",  rel: "CONNECTS_WITH", weight: 0.85,opacity: 1,   style: "direct" },
  { source: "s2",  target: "s8",  rel: "CONNECTS_WITH", weight: 0.9, opacity: 1,   style: "direct" },
  { source: "s3",  target: "s7",  rel: "CONNECTS_WITH", weight: 0.7, opacity: 0.8, style: "direct" },
  { source: "s4",  target: "s9",  rel: "CONNECTS_WITH", weight: 0.8, opacity: 0.9, style: "direct" },
  { source: "s5",  target: "s10", rel: "CONNECTS_WITH", weight: 0.75,opacity: 0.85,style: "direct" },
  { source: "s6",  target: "s2",  rel: "CONNECTS_WITH", weight: 0.65,opacity: 0.8, style: "direct" },
  { source: "s8",  target: "s10", rel: "CONNECTS_WITH", weight: 0.9, opacity: 1,   style: "direct" },
  { source: "s9",  target: "s4",  rel: "CONNECTS_WITH", weight: 0.7, opacity: 0.8, style: "direct" },

  // ── Student → Club ────────────────────────────────────────────────────────
  { source: "s1",  target: "c1",  rel: "MEMBER_OF", weight: 0.8, opacity: 1,   style: "solid" },
  { source: "s1",  target: "c3",  rel: "MEMBER_OF", weight: 0.7, opacity: 0.9, style: "solid" },
  { source: "s2",  target: "c1",  rel: "MEMBER_OF", weight: 0.9, opacity: 1,   style: "solid" },
  { source: "s2",  target: "c4",  rel: "MEMBER_OF", weight: 0.7, opacity: 0.8, style: "solid" },
  { source: "s3",  target: "c2",  rel: "MEMBER_OF", weight: 0.85,opacity: 1,   style: "solid" },
  { source: "s4",  target: "c1",  rel: "MEMBER_OF", weight: 0.75,opacity: 0.9, style: "solid" },
  { source: "s5",  target: "c4",  rel: "MEMBER_OF", weight: 0.8, opacity: 1,   style: "solid" },
  { source: "s6",  target: "c5",  rel: "MEMBER_OF", weight: 0.95,opacity: 1,   style: "solid" },
  { source: "s7",  target: "c3",  rel: "MEMBER_OF", weight: 0.8, opacity: 0.9, style: "solid" },
  { source: "s8",  target: "c1",  rel: "MEMBER_OF", weight: 0.9, opacity: 1,   style: "solid" },
  { source: "s9",  target: "c1",  rel: "MEMBER_OF", weight: 0.7, opacity: 0.85,style: "solid" },
  { source: "s10", target: "c4",  rel: "MEMBER_OF", weight: 0.8, opacity: 0.9, style: "solid" },

  // ── Student → Company ─────────────────────────────────────────────────────
  { source: "s8",  target: "co1", rel: "INTERNED_AT", weight: 0.9, opacity: 1,   style: "solid" },
  { source: "s2",  target: "co1", rel: "APPLYING_TO", weight: 0.8, opacity: 0.8, style: "dashed" },
  { source: "s1",  target: "co1", rel: "APPLYING_TO", weight: 0.7, opacity: 0.7, style: "dashed" },
  { source: "s4",  target: "co3", rel: "APPLYING_TO", weight: 0.75,opacity: 0.75,style: "dashed" },
  { source: "s9",  target: "co5", rel: "APPLYING_TO", weight: 0.7, opacity: 0.7, style: "dashed" },
  { source: "s5",  target: "co2", rel: "APPLYING_TO", weight: 0.65,opacity: 0.7, style: "dashed" },
  { source: "s6",  target: "co2", rel: "APPLYING_TO", weight: 0.7, opacity: 0.75,style: "dashed" },
  { source: "s10", target: "co4", rel: "APPLYING_TO", weight: 0.6, opacity: 0.65,style: "dashed" },

  // ── Student → Professor ───────────────────────────────────────────────────
  { source: "s2",  target: "p1",  rel: "RESEARCHES_WITH", weight: 0.9, opacity: 1,   style: "solid" },
  { source: "s4",  target: "p1",  rel: "RESEARCHES_WITH", weight: 0.8, opacity: 0.9, style: "solid" },
  { source: "s6",  target: "p2",  rel: "RESEARCHES_WITH", weight: 0.85,opacity: 0.95,style: "solid" },
  { source: "s1",  target: "p3",  rel: "RESEARCHES_WITH", weight: 0.7, opacity: 0.8, style: "solid" },
  { source: "s10", target: "p3",  rel: "RESEARCHES_WITH", weight: 0.75,opacity: 0.85,style: "solid" },

  // ── Student → Interest ────────────────────────────────────────────────────
  { source: "s1",  target: "i1",  rel: "INTERESTED_IN", weight: 0.8, opacity: 0.9, style: "dashed" },
  { source: "s1",  target: "i2",  rel: "INTERESTED_IN", weight: 0.9, opacity: 1,   style: "dashed" },
  { source: "s2",  target: "i1",  rel: "INTERESTED_IN", weight: 0.95,opacity: 1,   style: "dashed" },
  { source: "s3",  target: "i2",  rel: "INTERESTED_IN", weight: 0.7, opacity: 0.8, style: "dashed" },
  { source: "s4",  target: "i1",  rel: "INTERESTED_IN", weight: 0.85,opacity: 0.9, style: "dashed" },
  { source: "s5",  target: "i2",  rel: "INTERESTED_IN", weight: 0.9, opacity: 1,   style: "dashed" },
  { source: "s5",  target: "i4",  rel: "INTERESTED_IN", weight: 0.75,opacity: 0.8, style: "dashed" },
  { source: "s6",  target: "i3",  rel: "INTERESTED_IN", weight: 0.95,opacity: 1,   style: "dashed" },
  { source: "s7",  target: "i5",  rel: "INTERESTED_IN", weight: 0.8, opacity: 0.9, style: "dashed" },
  { source: "s8",  target: "i2",  rel: "INTERESTED_IN", weight: 0.85,opacity: 0.9, style: "dashed" },
  { source: "s9",  target: "i1",  rel: "INTERESTED_IN", weight: 0.8, opacity: 0.85,style: "dashed" },
  { source: "s10", target: "i4",  rel: "INTERESTED_IN", weight: 0.9, opacity: 1,   style: "dashed" },
  { source: "s10", target: "i2",  rel: "INTERESTED_IN", weight: 0.8, opacity: 0.9, style: "dashed" },
];
