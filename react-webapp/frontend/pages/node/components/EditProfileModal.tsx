import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/context/AuthContext"
import "./EditProfileModal.css"
import { NJIT_MAJORS } from "@/constants/majors"


const KNOWN_INTERESTS = [
  "Architecture", "Art", "Artificial Intelligence", "Automotive", "Biomedical Engineering",
  "Biomimicry", "Computer Systems", "Controls", "Cybersecurity", "Data Analytics", "Defense",
  "Design", "Energy Systems", "Engineering", "Environmental", "Environmental Studies", "Finance",
  "Financial Technology", "Fluid", "Fullstack", "Games", "Geological", "Hardware", "Innovation",
  "Investment Banking", "Machine Learning", "Mechanical Systems", "Nanotechnology", "Painting",
  "Photography", "Power Grids", "Power Systems", "Programming", "Project Management", "Robotics",
  "Signal Processing", "Software Development", "Startups", "Structural Design",
  "Structural Engineering", "Sustainability", "Technical Sales",
]

const KNOWN_SKILLS = [
  "C++", "CAD", "Data Analysis", "Excel", "Figma", "Java", "JavaScript",
  "Leadership", "MATLAB", "Photoshop", "Public Speaking", "Python",
  "React", "Research", "Rust", "SQL", "TypeScript", "Writing",
]

const LOOKING_FOR_OPTIONS = [
  "Co-op", "Hackathon Partner", "Internship", "Job",
  "Networking", "New Friends", "Research Opportunity", "Study Group",
]

const YEAR_OPTIONS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"]

const NJIT_CLUBS = [
  "American Institute of Aeronautics and Astronautics", "American Institute of Chemical Engineers",
  "American Chemical Society", "American Society of Civil Engineers",
  "American Society of Mechanical Engineers", "Alpha Phi Omega",
  "Association for Computing Machinery", "Biomedical Engineering Society",
  "Caribbean Student Association", "Chess Club", "Chinese Student Association",
  "Climbing Club", "Computer Science Honors Society", "Cooking Club",
  "Cyber Defense Organization", "Data Science Club", "Debate Club",
  "Engineering Without Borders", "Entrepreneurship Club", "ESports Club", "Film Club",
  "Finance Club", "Google Developer Student Club", "Hack@NJIT",
  "HACCS",
  "Indian Student Association", "Institute of Electrical and Electronics Engineers",
  "International Students Organization", "Investment Club", "Korean Student Association",
  "Latino American Student Organization", "Martial Arts Club", "Mathematics Club",
  "Mathematics Honor Society", "Model United Nations", "Muslim Student Association",
  "National Society of Black Engineers", "Pakistani Student Association", "Photography Club",
  "Physics Club", "Pre-Medical Society", "Robotics Club", "Rugby Club", "Soccer Club",
  "Society of Hispanic Professional Engineers", "Society of Women Engineers",
  "Software Engineering Club", "Step Team", "Student Government Association",
  "Table Tennis Club", "Tau Beta Pi", "Tennis Club", "Theatre Arts Group",
  "Turkish Student Association", "Vietnamese Student Association", "Volleyball Club",
  "Women in Computer Science", "Women in Engineering",
  "AIChE", "ASCE",
  "ASME", "ACM",
  "BMES", "Caribbean Student Association", "Chinese Student Association",
  "Cyber Defense Organization", "Data Science Club", "Entrepreneurship Club", "Finance Club",
  "GDSC", "Hack@NJIT", "HACCS",
  "IEEE", "Investment Club",
  "Korean Student Association", "LASO", "Mathematics Club",
  "MSA", "NSBE", "Physics Club",
  "Pre-Medical Society", "Robotics Club", "SHPE",
  "SWE", "Software Engineering Club", "SGA",
  "Theatre Arts Group", "Vietnamese Student Association", "WiCS",
]

interface Props {
  open: boolean
  onClose: () => void
}

type Tab = "academic" | "campus" | "about"

export default function EditProfileModal({ open, onClose }: Props) {
  const { user, updateProfile } = useAuth()

  const [tab, setTab]               = useState<Tab>("academic")
  const [major, setMajor]           = useState("")
  const [gpa, setGpa]               = useState("")
  const [gradYear, setGradYear]     = useState("")
  const [bio, setBio]               = useState("")
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [clubs, setClubs]           = useState<string[]>([])
  const [interests, setInterests]   = useState<string[]>([])
  const [companies, setCompanies]   = useState<string[]>([])
  const [companyInput, setCompanyInput] = useState("")
  const [skills, setSkills]           = useState<string[]>([])
  const [lookingFor, setLookingFor]   = useState<string[]>([])
  const [year, setYear]               = useState("")
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState("")
  const [success, setSuccess]       = useState(false)
  const companyInputRef             = useRef<HTMLInputElement>(null)

  // Seed form from current user whenever modal opens
  useEffect(() => {
    if (open && user) {
      setMajor(user.major ?? "")
      setGpa(user.gpa != null ? String(user.gpa) : "")
      setGradYear(String(user.graduationYear ?? ""))
      setBio(user.bio ?? "")
      setLinkedinUrl(user.linkedinUrl ?? "")
      setClubs(user.clubs ?? [])
      setInterests(user.interests ?? [])
      setCompanies(user.companies ?? [])
      setSkills(user.skills ?? [])
      setLookingFor(user.looking_for ?? [])
      setYear(user.year ?? "")
      setCompanyInput("")
      setError("")
      setSuccess(false)
      setTab("academic")
    }
  }, [open, user])

  function toggleItem(list: string[], item: string, setter: (v: string[]) => void) {
    setter(list.includes(item) ? list.filter(x => x !== item) : [...list, item])
  }

  function addCompany() {
    const val = companyInput.trim()
    if (!val || companies.includes(val)) return
    setCompanies([...companies, val])
    setCompanyInput("")
    companyInputRef.current?.focus()
  }

  function removeCompany(name: string) {
    setCompanies(companies.filter(c => c !== name))
  }

  async function handleSave() {
    setError("")
    setSuccess(false)
    const gpaNum = gpa === "" ? null : parseFloat(gpa)
    if (gpa !== "" && (isNaN(gpaNum!) || gpaNum! < 0 || gpaNum! > 4.0)) {
      setError("GPA must be between 0.0 and 4.0")
      return
    }
    if (!major) { setError("Please select a major"); return }
    const gradNum = parseInt(gradYear)
    if (!gradYear || isNaN(gradNum) || gradNum < 2020 || gradNum > 2035) {
      setError("Enter a valid graduation year (2020–2035)")
      return
    }
    setSaving(true)
    try {
      await updateProfile({ gpa: gpaNum, major, graduationYear: gradNum, bio, clubs, companies, interests, linkedinUrl: linkedinUrl.trim() || null, skills, looking_for: lookingFor, year: year || null })
      setSuccess(true)
      setTimeout(onClose, 900)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="epOverlay" onClick={onClose}>
      <div className="epDrawer" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="epHeader">
          <div className="epHeaderLeft">
            <div className="epAvatar">
              {user?.name?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <div>
              <div className="epName">{user?.name}</div>
              <div className="epEmail">{user?.email}</div>
            </div>
          </div>
          <button className="epClose" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Tabs */}
        <div className="epTabs">
          {(["academic", "campus", "about"] as Tab[]).map(t => (
            <button
              key={t}
              className={`epTab${tab === t ? " epTabActive" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "academic" ? "Academic" : t === "campus" ? "Campus Life" : "About"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="epBody">

          {tab === "academic" && (
            <div className="epSection">
              <label className="epLabel">Major</label>
              <select className="epSelect" value={major} onChange={e => setMajor(e.target.value)}>
                <option value="">Select major…</option>
                {NJIT_MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              <label className="epLabel">GPA</label>
              <input
                className="epInput"
                type="number"
                min="0" max="4.0" step="0.01"
                placeholder="e.g. 3.5"
                value={gpa}
                onChange={e => setGpa(e.target.value)}
              />

              <label className="epLabel">Graduation Year</label>
              <input
                className="epInput"
                type="number"
                min="2020" max="2035"
                placeholder="e.g. 2026"
                value={gradYear}
                onChange={e => setGradYear(e.target.value)}
              />

              <label className="epLabel">Year</label>
              <select className="epSelect" value={year} onChange={e => setYear(e.target.value)}>
                <option value="">Select year…</option>
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {tab === "campus" && (
            <div className="epSection">
              <label className="epLabel">Clubs</label>
              <div className="epChipGrid">
                {NJIT_CLUBS.map(c => (
                  <button
                    key={c}
                    className={`epChip${clubs.includes(c) ? " epChipOn" : ""}`}
                    onClick={() => toggleItem(clubs, c, setClubs)}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <label className="epLabel" style={{ marginTop: 20 }}>Interests</label>
              <div className="epChipGrid">
                {KNOWN_INTERESTS.map(i => (
                  <button
                    key={i}
                    className={`epChip${interests.includes(i) ? " epChipOn" : ""}`}
                    onClick={() => toggleItem(interests, i, setInterests)}
                  >
                    {i}
                  </button>
                ))}
              </div>

              <label className="epLabel" style={{ marginTop: 20 }}>Skills</label>
              <div className="epChipGrid">
                {KNOWN_SKILLS.map(s => (
                  <button
                    key={s}
                    className={`epChip${skills.includes(s) ? " epChipOn" : ""}`}
                    onClick={() => toggleItem(skills, s, setSkills)}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <label className="epLabel" style={{ marginTop: 20 }}>Looking for</label>
              <div className="epChipGrid">
                {LOOKING_FOR_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    className={`epChip${lookingFor.includes(opt) ? " epChipOn" : ""}`}
                    onClick={() => toggleItem(lookingFor, opt, setLookingFor)}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              <label className="epLabel" style={{ marginTop: 20 }}>Companies / Experience</label>
              <div className="epCompanyRow">
                <input
                  ref={companyInputRef}
                  className="epInput"
                  placeholder="Add a company…"
                  value={companyInput}
                  onChange={e => setCompanyInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCompany()}
                />
                <button className="epAddBtn" onClick={addCompany}>Add</button>
              </div>
              <div className="epChipGrid" style={{ marginTop: 8 }}>
                {companies.map(c => (
                  <button key={c} className="epChip epChipOn epChipRemovable" onClick={() => removeCompany(c)}>
                    {c} <span className="epChipX">×</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "about" && (
            <div className="epSection">
              <label className="epLabel">Bio</label>
              <textarea
                className="epTextarea"
                placeholder="Tell people about yourself…"
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={500}
              />
              <div className="epCharCount">{bio.length} / 500</div>

              <label className="epLabel" style={{ marginTop: 16 }}>LinkedIn URL</label>
              <input
                className="epInput"
                type="url"
                placeholder="https://linkedin.com/in/yourname"
                value={linkedinUrl}
                onChange={e => setLinkedinUrl(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="epFooter">
          {error   && <div className="epError">{error}</div>}
          {success && <div className="epSuccess">Saved!</div>}
          <div className="epFooterBtns">
            <button className="epCancelBtn" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="epSaveBtn" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
