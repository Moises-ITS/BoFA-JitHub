import { useState, FormEvent } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth, SignupData } from "../../context/AuthContext"
import "./auth.css"

const STEPS = ["Account", "Academic", "Campus Life", "Profile"] as const
type Step = 0 | 1 | 2 | 3

export default function SignupPage() {
  const { signup } = useAuth()
  const navigate    = useNavigate()

  const [step, setStep] = useState<Step>(0)
  const [error, setError]     = useState("")
  const [loading, setLoading] = useState(false)

  // Step 0 — Account
  const [name, setName]         = useState("")
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm]   = useState("")

  // Step 1 — Academic
  const [major, setMajor]               = useState("")
  const [gpa, setGpa]                   = useState("")
  const [graduationYear, setGradYear]   = useState("")

  // Step 2 — Campus Life
  const [clubInput, setClubInput]         = useState("")
  const [clubs, setClubs]                 = useState<string[]>([])
  const [companyInput, setCompanyInput]   = useState("")
  const [companies, setCompanies]         = useState<string[]>([])

  // Step 3 — Profile
  const [bio, setBio] = useState("")

  function addItem(
    input: string,
    list: string[],
    setList: (v: string[]) => void,
    setInput: (v: string) => void
  ) {
    const val = input.trim()
    if (val && !list.includes(val)) setList([...list, val])
    setInput("")
  }

  function removeItem(val: string, list: string[], setList: (v: string[]) => void) {
    setList(list.filter(x => x !== val))
  }

  function validateStep(): string {
    if (step === 0) {
      if (!name.trim())    return "Name is required"
      if (!email.trim())   return "Email is required"
      if (password.length < 8) return "Password must be at least 8 characters"
      if (password !== confirm)  return "Passwords do not match"
    }
    if (step === 1) {
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
    }

    try {
      await signup(data)
      navigate("/")
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
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
              </label>
              <label>
                Confirm password
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
              </label>
            </>
          )}

          {/* ── Step 1: Academic ── */}
          {step === 1 && (
            <>
              <label>
                Major
                <input value={major} onChange={e => setMajor(e.target.value)} required autoFocus placeholder="e.g. Computer Science" />
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
                  <input
                    value={clubInput}
                    onChange={e => setClubInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(clubInput, clubs, setClubs, setClubInput) }}}
                    placeholder="Type a club name and press Enter"
                  />
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
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(companyInput, companies, setCompanies, setCompanyInput) }}}
                    placeholder="Type a company name and press Enter"
                  />
                  <button type="button" onClick={() => addItem(companyInput, companies, setCompanies, setCompanyInput)}>Add</button>
                </div>
                <div className="auth-tags">
                  {companies.map(c => (
                    <span key={c} className="auth-tag">
                      {c} <button type="button" onClick={() => removeItem(c, companies, setCompanies)}>×</button>
                    </span>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {/* ── Step 3: Profile ── */}
          {step === 3 && (
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
