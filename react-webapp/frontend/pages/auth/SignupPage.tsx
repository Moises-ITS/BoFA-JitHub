import { useState, useEffect, FormEvent } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import type { SignupData } from "../../context/AuthContext"
import "./auth.css"

const API = import.meta.env.VITE_API_URL ?? ""

const STEPS = ["Account", "Academic", "Campus Life", "Profile"] as const
type Step = 0 | 1 | 2 | 3

const NJIT_MAJORS = [
  "Actuarial Mathematics",
  "Applied Mathematics",
  "Applied Statistics",
  "Architecture",
  "Biomedical Engineering",
  "Biology",
  "Business Administration",
  "Chemical Engineering",
  "Chemistry",
  "Civil Engineering",
  "Communication Studies",
  "Computer Engineering",
  "Computer Science",
  "Construction Management",
  "Data Science",
  "Digital Marketing",
  "Electrical Engineering",
  "Environmental Engineering",
  "Environmental Science",
  "Finance",
  "History",
  "Humanities",
  "Industrial Engineering",
  "Information Technology",
  "Management",
  "Mechanical Engineering",
  "Music Technology",
  "Physics",
  "Pre-Medical Studies",
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
  "American Institute of Chemical Engineers",
  "American Society of Civil Engineers",
  "American Society of Mechanical Engineers",
  "Association for Computing Machinery",
  "Biomedical Engineering Society",
  "Caribbean Student Association",
  "Chinese Student Association",
  "Cyber Defense Organization",
  "Data Science Club",
  "Entrepreneurship Club",
  "Finance Club",
  "Google Developer Student Club",
  "Hack@NJIT",
  "Institute of Electrical and Electronics Engineers",
  "Investment Club",
  "Korean Student Association",
  "Latino American Student Organization",
  "Mathematics Club",
  "Muslim Student Association",
  "National Society of Black Engineers",
  "Physics Club",
  "Pre-Medical Society",
  "Robotics Club",
  "Society of Hispanic Professional Engineers",
  "Society of Women Engineers",
  "Software Engineering Club",
  "Student Government Association",
  "Theatre Arts Group",
  "Vietnamese Student Association",
  "Women in Computer Science",
]

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    // Eye open — Feather-style stroke icon
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    // Eye closed — slash through it
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function toTitleCase(s: string) {
  return s.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

export default function SignupPage() {
  const { signup } = useAuth()
  const navigate    = useNavigate()

  const [step, setStep] = useState<Step>(0)
  const [error, setError]     = useState("")
  const [loading, setLoading] = useState(false)

  // Step 0 — Account
  const [name, setName]               = useState("")
  const [email, setEmail]             = useState("")
  const [password, setPassword]       = useState("")
  const [confirm, setConfirm]         = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)

  // Step 1 — Academic
  const [major, setMajor]             = useState("")
  const [gpa, setGpa]                 = useState("")
  const [graduationYear, setGradYear] = useState("")

  // Step 2 — Campus Life
  const [clubInput, setClubInput]             = useState("")
  const [clubs, setClubs]                     = useState<string[]>([])
  const [companyInput, setCompanyInput]       = useState("")
  const [companies, setCompanies]             = useState<string[]>([])
  const [interestInput, setInterestInput]     = useState("")
  const [interests, setInterests]             = useState<string[]>([])
  const [customInterest, setCustomInterest]   = useState("")
  const [availableInterests, setAvailableInterests] = useState<string[]>(KNOWN_INTERESTS)

  // Merge hardcoded baseline with any custom interests added by previous users
  useEffect(() => {
    fetch(`${API}/api/auth/interests`)
      .then(r => r.ok ? r.json() : [])
      .then((fetched: string[]) => {
        const merged = Array.from(new Set([...KNOWN_INTERESTS, ...fetched])).sort()
        setAvailableInterests(merged)
      })
      .catch(() => {/* keep baseline on failure */})
  }, [])

  // Step 3 — Profile
  const [bio, setBio]               = useState("")
  const [linkedinUrl, setLinkedinUrl] = useState("")

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
      if (!name.trim())    return "Name is required"
      if (!email.trim())   return "Email is required"
      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRx.test(email.trim())) return "Please enter a valid email address"
      if (!email.trim().toLowerCase().endsWith("@njit.edu")) return "Only @njit.edu email addresses are allowed"
      if (password.length < 8) return "Password must be at least 8 characters"
      if (password !== confirm)  return "Passwords do not match"
    }
    if (step === 1) {
      if (!major.trim())          return "Major is required"
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
    setLoading(true)

    const data: SignupData = {
      name:           name.trim(),
      email:          email.trim(),
      password,
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
      await signup(data)
      navigate("/home")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--wide">
        <h1 className="auth-title">Create your account</h1>

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

        <form onSubmit={step === 3 ? handleSubmit : e => { e.preventDefault(); handleNext() }} className="auth-form">

          {/* ── Step 0: Account ── */}
          {step === 0 && (
            <>
              <label>
                Full name
                <input value={name} onChange={e => setName(e.target.value)} required autoFocus />
              </label>
              <label>
                Email
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </label>
              <label>
                Password <span className="auth-hint">(min 8 characters)</span>
                <div className="auth-pw-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" className="auth-pw-eye" onClick={() => setShowPassword(p => !p)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </label>
              <label>
                Confirm password
                <div className="auth-pw-wrap">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                  />
                  <button type="button" className="auth-pw-eye" onClick={() => setShowConfirm(p => !p)} aria-label={showConfirm ? "Hide password" : "Show password"}>
                    <EyeIcon open={showConfirm} />
                  </button>
                </div>
              </label>
            </>
          )}

          {/* ── Step 1: Academic ── */}
          {step === 1 && (
            <>
              <label>
                Major
                <select value={major} onChange={e => setMajor(e.target.value)} required autoFocus>
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

          {/* ── Step 2: Campus Life ── */}
          {step === 2 && (
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

          {/* ── Step 3: Profile ── */}
          {step === 3 && (
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
            <button type="submit" className="auth-btn-primary" disabled={loading}>
              {step === 3 ? (loading ? "Creating account…" : "Create account") : "Next"}
            </button>
          </div>
        </form>

        {step === 0 && (
          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        )}
      </div>
    </div>
  )
}
