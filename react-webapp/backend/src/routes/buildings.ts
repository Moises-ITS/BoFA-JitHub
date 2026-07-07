import { Router } from "express"
import { requireSafeId } from "../middleware/security.js"

export interface Building {
  id: string
  name: string
  abbreviation: string
  latitude: number
  longitude: number
  description: string
  floors: number
  departments: string[]
  imageUrl: string
}

const buildings: readonly Building[] = [
  {
    id: "ckb",
    name: "Central King Building",
    abbreviation: "CKB",
    latitude: 40.7423,
    longitude: -74.1788,
    description: "Home to the Ying Wu College of Computing. Houses computer labs, lecture halls, and faculty offices for CS and IT departments.",
    floors: 4,
    departments: ["Computer Science", "Information Technology"],
    imageUrl: "/images/ckb.jpg",
  },
  {
    id: "gitc",
    name: "Guttenberg Information Technologies Center",
    abbreviation: "GITC",
    latitude: 40.7420,
    longitude: -74.1793,
    description: "The main technology hub of NJIT featuring advanced computing labs, the makerspace, and the Office of Information Services & Technology.",
    floors: 5,
    departments: ["Information Systems", "Data Science", "OIST"],
    imageUrl: "/images/gitc.jpg",
  },
  {
    id: "wec",
    name: "Wellness and Events Center",
    abbreviation: "WEC",
    latitude: 40.7410,
    longitude: -74.1795,
    description: "NJIT's premier athletic and events facility. Features a competition pool, basketball courts, fitness center, and large event spaces.",
    floors: 3,
    departments: ["Athletics", "Student Life"],
    imageUrl: "/images/wec.jpg",
  },
  {
    id: "kupf",
    name: "Kupfrian Hall",
    abbreviation: "KUPF",
    latitude: 40.7428,
    longitude: -74.1785,
    description: "Engineering hub housing chemical, mechanical, and biomedical engineering departments. Contains specialized research labs and lecture halls.",
    floors: 4,
    departments: ["Chemical Engineering", "Mechanical Engineering", "Biomedical Engineering"],
    imageUrl: "/images/kupf.jpg",
  },
  {
    id: "tier",
    name: "Tiernan Hall",
    abbreviation: "TIER",
    latitude: 40.7425,
    longitude: -74.1780,
    description: "Houses the Department of Electrical and Computer Engineering with advanced signal processing and microelectronics labs.",
    floors: 5,
    departments: ["Electrical Engineering", "Computer Engineering"],
    imageUrl: "/images/tier.jpg",
  },
  {
    id: "cam",
    name: "Campus Center",
    abbreviation: "CC",
    latitude: 40.7415,
    longitude: -74.1790,
    description: "The social heart of NJIT. Features dining options, student organization offices, meeting rooms, and the campus bookstore.",
    floors: 3,
    departments: ["Student Senate", "Dining Services", "Student Activities"],
    imageUrl: "/images/cc.jpg",
  },
  {
    id: "fmh",
    name: "Faculty Memorial Hall",
    abbreviation: "FMH",
    latitude: 40.7430,
    longitude: -74.1792,
    description: "One of NJIT's original academic buildings. Contains classrooms, the honors college, and faculty offices for humanities and social sciences.",
    floors: 3,
    departments: ["Humanities", "Social Sciences", "Honors College"],
    imageUrl: "/images/fmh.jpg",
  },
  {
    id: "ecec",
    name: "ECE Center",
    abbreviation: "ECEC",
    latitude: 40.7418,
    longitude: -74.1782,
    description: "State-of-the-art facility for electrical and computer engineering research. Houses the cleanroom, VLSI lab, and advanced research centers.",
    floors: 4,
    departments: ["ECE Research", "VLSI Lab", "Cleanroom"],
    imageUrl: "/images/ecec.jpg",
  },
] as const

const router = Router()

router.get("/", (_req, res) => {
  res.json({ success: true, data: buildings })
})

router.get("/by-id/:id", (req, res) => {
  const safeId = requireSafeId(req.params.id)
  if (!safeId) {
    res.status(400).json({ success: false, error: "Invalid building id" })
    return
  }
  const building = buildings.find(b => b.id === safeId)
  if (!building) {
    res.status(404).json({ success: false, error: "Building not found" })
    return
  }
  res.json({ success: true, data: building })
})

export default router
