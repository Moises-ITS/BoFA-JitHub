export interface Hotspot {
  readonly id: string
  readonly name: string
  readonly abbreviation: string
  readonly description: string
  readonly departments: readonly string[]
  readonly position: readonly [number, number, number]
}

/**
 * Building hotspots with coordinates relative to the GLB model.
 *
 * To get real coordinates:
 * 1. Visit /inspect with your campus.glb loaded
 * 2. Click on each building rooftop
 * 3. Copy the coordinates and replace the placeholder values below
 */
export const HOTSPOTS: readonly Hotspot[] = [
  {
    id: "ckb",
    name: "Central King Building",
    abbreviation: "CKB",
    description: "Home to the Ying Wu College of Computing. Houses computer labs, lecture halls, and faculty offices.",
    departments: ["Computer Science", "Information Technology"],
    position: [0, 3, 0],       // ← replace with real coords from inspector
  },
  {
    id: "gitc",
    name: "Guttenberg Information Technologies Center",
    abbreviation: "GITC",
    description: "The main technology hub featuring advanced computing labs, the makerspace, and OIST.",
    departments: ["Information Systems", "Data Science", "OIST"],
    position: [-5, 3, 3],      // ← replace
  },
  {
    id: "wec",
    name: "Wellness and Events Center",
    abbreviation: "WEC",
    description: "Premier athletic and events facility with pool, basketball courts, fitness center, and event spaces.",
    departments: ["Athletics", "Student Life"],
    position: [5, 3, -4],      // ← replace
  },
  {
    id: "kupf",
    name: "Kupfrian Hall",
    abbreviation: "KUPF",
    description: "Engineering hub housing chemical, mechanical, and biomedical engineering with specialized research labs.",
    departments: ["Chemical Engineering", "Mechanical Engineering", "Biomedical Engineering"],
    position: [-3, 3, -5],     // ← replace
  },
  {
    id: "tier",
    name: "Tiernan Hall",
    abbreviation: "TIER",
    description: "Houses Electrical and Computer Engineering with advanced signal processing and microelectronics labs.",
    departments: ["Electrical Engineering", "Computer Engineering"],
    position: [4, 3, 5],       // ← replace
  },
  {
    id: "cc",
    name: "Campus Center",
    abbreviation: "CC",
    description: "The social heart of NJIT with dining, student organization offices, meeting rooms, and the bookstore.",
    departments: ["Student Senate", "Dining Services", "Student Activities"],
    position: [2, 3, -2],      // ← replace
  },
  {
    id: "fmh",
    name: "Faculty Memorial Hall",
    abbreviation: "FMH",
    description: "One of NJIT's original buildings. Contains classrooms, the honors college, and humanities offices.",
    departments: ["Humanities", "Social Sciences", "Honors College"],
    position: [-6, 3, -1],     // ← replace
  },
  {
    id: "ecec",
    name: "ECE Center",
    abbreviation: "ECEC",
    description: "State-of-the-art facility for ECE research. Houses the cleanroom, VLSI lab, and advanced research centers.",
    departments: ["ECE Research", "VLSI Lab", "Cleanroom"],
    position: [6, 3, 2],       // ← replace
  },
] as const
