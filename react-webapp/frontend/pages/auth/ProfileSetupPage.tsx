import { useState, useEffect, FormEvent } from "react"
import { useNavigate, Navigate } from "react-router-dom"
import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react"
import { useAuth } from "../../context/AuthContext"
import type { SyncData } from "../../context/AuthContext"
import "./auth.css"

const API = import.meta.env.VITE_API_URL ?? ""

const STEPS = ["Academic", "Campus Life", "Profile"] as const
type Step = 0 | 1 | 2

const NJIT_MAJORS = [
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
]

const KNOWN_INTERESTS = [
  "Architecture",
  "Art",
  "Artificial Intelligence",
  "Automotive",
  "Biomedical Engineering",
  "Biomimicry",
  "Computer Systems",
  "Controls",
  "Cybersecurity",
  "Data Analytics",
  "Defense",
  "Design",
  "Energy Systems",
  "Engineering",
  "Environmental",
  "Environmental Studies",
  "Finance",
  "Financial Technology",
  "Fluid",
  "Fullstack",
  "Games",
  "Geological",
  "Hardware",
  "Innovation",
  "Investment Banking",
  "Machine Learning",
  "Mechanical Systems",
  "Nanotechnology",
  "Painting",
  "Photography",
  "Power Grids",
  "Power Systems",
  "Programming",
  "Project Management",
  "Robotics",
  "Signal Processing",
  "Software Development",
  "Startups",
  "Structural Design",
  "Structural Engineering",
  "Sustainability",
  "Technical Sales",
]

const NJIT_CLUBS = [
  "American Institute of Aeronautics and Astronautics",
  "American Institute of Chemical Engineers",
  "American Chemical Society",
  "American Society of Civil Engineers",
  "American Society of Mechanical Engineers",
  "Alpha Phi Omega",
  "Association for Computing Machinery",
  "Biomedical Engineering Society",
  "Caribbean Student Association",
  "Chess Club",
  "Chinese Student Association",
  "Climbing Club",
  "Computer Science Honors Society",
  "Cooking Club",
  "Cyber Defense Organization",
  "Data Science Club",
  "Debate Club",
  "Engineering Without Borders",
  "Entrepreneurship Club",
  "ESports Club",
  "Film Club",
  "Finance Club",
  "Google Developer Student Club",
  "Hack@NJIT",
  "HACCS",
  "Indian Student Association",
  "Institute of Electrical and Electronics Engineers",
  "International Students Organization",
  "Investment Club",
  "Korean Student Association",
  "Latino American Student Organization",
  "Martial Arts Club",
  "Mathematics Club",
  "Mathematics Honor Society",
  "Model United Nations",
  "Muslim Student Association",
  "National Society of Black Engineers",
  "Pakistani Student Association",
  "Photography Club",
  "Physics Club",
  "Pre-Medical Society",
  "Robotics Club",
  "Rugby Club",
  "Soccer Club",
  "Society of Hispanic Professional Engineers",
  "Society of Women Engineers",
  "Software Engineering Club",
  "Step Team",
  "Student Government Association",
  "Table Tennis Club",
  "Tau Beta Pi",
  "Tennis Club",
  "Theatre Arts Group",
  "Turkish Student Association",
  "Vietnamese Student Association",
  "Volleyball Club",
  "Women in Computer Science",
  "Women in Engineering",
]

function toTitleCase(s: string) {
  return s.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

export default function ProfileSetupPage() {
  const { syncProfile, user: appUser, token, loading: authLoading } = useAuth()
  const { isSignedIn, isLoaded } = useClerkAuth()
  const { user: clerkUser } = useUser()
  const navigate = useNavigate()

  const [step, setStep]     = useState<Step>(0)
  const [error, setError]   = useState("")
  const [loading, setLoading] = useState(false)

  // Pre-fill name from Clerk
  const [name, setName] = useState(clerkUser?.fullName ?? "")

  // Step 0 — Academic
  const [major, setMajor]             = useState("")
  const [gpa, setGpa]                 = useState("")
  const [graduationYear, setGradYear] = useState("")

  // Step 1 — Campus Life
  const [clubInput, setClubInput]           = useState("")
  const [clubs, setClubs]                   = useState<string[]>([])
  const [companyInput, setCompanyInput]     = useState("")
  const [companies, setCompanies]           = useState<string[]>([])
  const [interestInput, setInterestInput]   = useState("")
  const [interests, setInterests]           = useState<string[]>([])
  const [customInterest, setCustomInterest] = useState("")
  const [availableInterests, setAvailableInterests] = useState<string[]>(KNOWN_INTERESTS)

  // Merge hardcoded baseline with any custom interests from other users
  useEffect(() => {
    if (!token) return
    fetch(`${API}/api/auth/interests`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then((fetched: string[]) => {
        const merged = Array.from(new Set([...KNOWN_INTERESTS, ...fetched])).sort()
        setAvailableInterests(merged)
      })
      .catch(() => {/* keep baseline on failure */})
  }, [token])

  // Sync name if Clerk loads after mount
  useEffect(() => {
    if (clerkUser?.fullName && !name) setName(clerkUser.fullName)
  }, [clerkUser?.fullName]) // eslint-disable-line

  // Step 2 — Profile
  const [bio, setBio]               = useState("")
  const [linkedinUrl, setLinkedinUrl] = useState("")

  // Already has a profile — skip setup (all hooks must be called before this)
  if (!authLoading && appUser) return <Navigate to="/home" replace />
  // Not signed in with Clerk at all — go to login
  if (isLoaded && !isSignedIn) return <Navigate to="/login" replace />

  function addItem(
    input: string,
    list: string[],
    setList: (v: string[]) => void,
    setInput: (v: string) => void
  ) {
    const val = input.trim()
    if (val && !list.some(x => x.toLowerCase() === val.toLowerCase())) setList([...list, val])
    setInput("")
  }

  function removeItem(val: string, list: string[], setList: (v: string[]) => void) {
    setList(list.filter(x => x !== val))
  }

  function validateStep(): string {
    if (step === 0) {
      if (!name.trim())          return "Name is required"
      if (!major.trim())         return "Major is required"
      if (!graduationYear.trim()) return "Graduation year is required"
      if (gpa && (parseFloat(gpa) < 0 || parseFloat(gpa) > 4.0)) return "GPA must be between 0.0 and 4.0"
    }
    return ""
  }

  function handleNext() {
    const err = validateStep()
    if (err) { setError(err); return }
    setError("")
    setStep((step + 1) as Step)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")

    const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? ""
    if (!clerkEmail) {
      setError("Your account email hasn't loaded yet — please wait a moment and try again.")
      return
    }

    setLoading(true)

    const data: SyncData = {
      email:          clerkEmail,
      name:           name.trim(),
      major:          major.trim(),
      gpa:            gpa ? parseFloat(gpa) : null,
      graduationYear: parseInt(graduationYear),
      bio:            bio.trim(),
      clubs,
      companies,
      interests,
      linkedinUrl:    linkedinUrl.trim() || null,
    }

    try {
      await syncProfile(data)
      navigate("/home")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Setup failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--wide">
        <h1 className="auth-title">One-time profile setup</h1>
        <p style={{ textAlign: "center", color: "#6B7280", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
          Welcome, {clerkUser?.firstName ?? ""}! Fill in your academic info once to unlock JitHub.
        </p>

        {/* Step indicator */}
        <div className="auth-steps">
          {STEPS.map((label, i) => (
            <div key={label} className={`auth-step ${i === step ? "active" : i < step ? "done" : ""}`}>
              <span className="auth-step-num">{i < step ? "✓" : i + 1}</span>
              <span className="auth-step-label">{label}</span>
            </div>
          ))}
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={step === 2 ? handleSubmit : e => { e.preventDefault(); handleNext() }} className="auth-form">

          {/* ── Step 0: Academic ── */}
          {step === 0 && (
            <>
              <label>
                Full name
                <input value={name} onChange={e => setName(e.target.value)} required autoFocus />
              </label>
              <label>
                Major
                <select value={major} onChange={e => setMajor(e.target.value)} required>
                  <option value="">Select your major…</option>
                  {NJIT_MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label>
                GPA <span className="auth-hint">(optional, 0.0 – 4.0)</span>
                <input
                  type="number" step="0.01" min="0" max="4.0"
                  value={gpa} onChange={e => setGpa(e.target.value)}
                  placeholder="e.g. 3.5"
                />
              </label>
              <label>
                Graduation year
                <input
                  type="number" min="2024" max="2035"
                  value={graduationYear} onChange={e => setGradYear(e.target.value)}
                  required placeholder="e.g. 2027"
                />
              </label>
            </>
          )}

          {/* ── Step 1: Campus Life ── */}
          {step === 1 && (
            <>
              <fieldset className="auth-fieldset">
                <legend>Clubs / Organizations <span className="auth-hint">(optional)</span></legend>
                <div className="auth-tag-input">
                  <select value={clubInput} onChange={e => setClubInput(e.target.value)}>
                    <option value="">Select a club…</option>
                    {NJIT_CLUBS.filter(c => !clubs.includes(c)).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => addItem(clubInput, clubs, setClubs, setClubInput)}>Add</button>
                </div>
                <div className="auth-tags">
                  {clubs.map(c => (
                    <span key={c} className="auth-tag">
                      {c} <button type="button" onClick={() => removeItem(c, clubs, setClubs)}>×</button>
                    </span>
                  ))}
                </div>
              </fieldset>

              <fieldset className="auth-fieldset">
                <legend>Companies / Internships <span className="auth-hint">(optional)</span></legend>
                <div className="auth-tag-input">
                  <input
                    value={companyInput}
                    onChange={e => setCompanyInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addItem(toTitleCase(companyInput), companies, setCompanies, setCompanyInput)
                      }
                    }}
                    placeholder="Type a company name and press Enter"
                  />
                  <button
                    type="button"
                    onClick={() => addItem(toTitleCase(companyInput), companies, setCompanies, setCompanyInput)}
                  >
                    Add
                  </button>
                </div>
                <div className="auth-tags">
                  {companies.map(c => (
                    <span key={c} className="auth-tag">
                      {c} <button type="button" onClick={() => removeItem(c, companies, setCompanies)}>×</button>
                    </span>
                  ))}
                </div>
              </fieldset>

              <fieldset className="auth-fieldset">
                <legend>Interests <span className="auth-hint">(optional)</span></legend>
                <div className="auth-tag-input">
                  <select
                    value={interestInput}
                    onChange={e => {
                      setInterestInput(e.target.value)
                      setCustomInterest("")
                    }}
                  >
                    <option value="">Select an interest…</option>
                    {availableInterests.filter(i => !interests.includes(i)).map(i => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                    <option value="custom">Custom interest…</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (interestInput === "custom") {
                        addItem(toTitleCase(customInterest), interests, setInterests, setCustomInterest)
                      } else {
                        addItem(interestInput, interests, setInterests, setInterestInput)
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
                {interestInput === "custom" && (
                  <div className="auth-tag-input" style={{ marginTop: "0.5rem" }}>
                    <input
                      value={customInterest}
                      onChange={e => setCustomInterest(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addItem(toTitleCase(customInterest), interests, setInterests, setCustomInterest)
                        }
                      }}
                      placeholder="Type your interest and press Enter"
                      autoFocus
                    />
                  </div>
                )}
                <div className="auth-tags">
                  {interests.map(i => (
                    <span key={i} className="auth-tag">
                      {i} <button type="button" onClick={() => removeItem(i, interests, setInterests)}>×</button>
                    </span>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {/* ── Step 2: Profile ── */}
          {step === 2 && (
            <>
              <label>
                Bio <span className="auth-hint">(optional)</span>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={4}
                  placeholder="Tell people a bit about yourself…"
                  autoFocus
                />
              </label>
              <label>
                LinkedIn URL <span className="auth-hint">(optional)</span>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={e => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/yourname"
                />
              </label>
            </>
          )}

          {/* Navigation buttons */}
          <div className="auth-nav">
            {step > 0 && (
              <button type="button" className="auth-btn-secondary" onClick={() => { setError(""); setStep((step - 1) as Step) }}>
                Back
              </button>
            )}
            <button type="submit" className="auth-btn-primary" disabled={loading || (step === 2 && !clerkUser)}>
              {step === 2 ? (loading ? "Setting up…" : "Finish setup") : "Next"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
