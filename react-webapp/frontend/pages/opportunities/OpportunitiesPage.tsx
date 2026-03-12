import { FormEvent, useState } from 'react';
import { useNavigate }          from 'react-router-dom';
import { useAuth }              from '../../context/AuthContext';
import { useOpportunities }     from './hooks/useOpportunities';
import ApplicationTracker       from './components/ApplicationTracker';
import SmartFeed                from './components/SmartFeed';
import { INTEREST_OPTIONS, MAJOR_OPTIONS, type UserProfile } from './types/opportunities';
import './Opportunities.css';

// ── Step metadata ──────────────────────────────────────────────────────────────
const STEPS = [
  { key: 'profile', label: 'Build Profile' },
  { key: 'scan',    label: 'AI Scan'       },
  { key: 'feed',    label: 'Opportunities' },
] as const;

// ── Profile Wizard ─────────────────────────────────────────────────────────────
function ProfileWizard({ onSubmit }: { onSubmit: (p: UserProfile) => void }) {
  const { user } = useAuth();

  const [name,      setName]      = useState(user?.name  ?? '');
  const [major,     setMajor]     = useState(user?.major ?? '');
  const [year,      setYear]      = useState(
    user?.graduationYear ? String(user.graduationYear) : ''
  );
  const [gpa,       setGpa]       = useState(user?.gpa != null ? String(user.gpa) : '');
  const [interests, setInterests] = useState<string[]>([]);

  function toggleInterest(interest: string) {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ name, major, year, gpa, interests });
  }

  return (
    <div className="wizard-view">
      <div className="wizard-card">
        <h2>Build Your Profile</h2>
        <p className="wizard-sub">
          Tell us about yourself so our AI can surface the best matches.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="row2">
            <div className="field">
              <label htmlFor="opp-name">Full Name</label>
              <input
                id="opp-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane Smith"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="opp-gpa">GPA</label>
              <input
                id="opp-gpa"
                type="text"
                value={gpa}
                onChange={e => setGpa(e.target.value)}
                placeholder="3.8"
              />
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label htmlFor="opp-major">Major</label>
              <select
                id="opp-major"
                value={major}
                onChange={e => setMajor(e.target.value)}
                required
              >
                <option value="">Select major…</option>
                {MAJOR_OPTIONS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="opp-year">Graduation Year</label>
              <select
                id="opp-year"
                value={year}
                onChange={e => setYear(e.target.value)}
                required
              >
                <option value="">Select year…</option>
                {['2025', '2026', '2027', '2028', '2029'].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Interests &amp; Skills</label>
            <div className="checkbox-grid">
              {INTEREST_OPTIONS.map(interest => (
                <button
                  key={interest}
                  type="button"
                  className={`checkbox-item ${interests.includes(interest) ? 'checkbox-item--checked' : ''}`}
                  onClick={() => toggleInterest(interest)}
                  aria-pressed={interests.includes(interest)}
                >
                  <span className="checkbox-dot" aria-hidden />
                  {interest}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary">
            Scan for Opportunities →
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function OpportunitiesPage() {
  const { user, logout }  = useAuth();
  const navigate           = useNavigate();
  const {
    step,
    profile,
    submitProfile,
    finishScan,
    goToStep,
    opportunities,
    allOpportunities,
    typeCounts,
    filters,
    toggleType,
    setMinMatch,
    toggleApplied,
    toggleSaved,
  } = useOpportunities();

  const initials = user?.name
    ? user.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
    : 'NJ';

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="opp-root">
      {/* ── Navbar ── */}
      <nav className="opp-navbar" aria-label="Main navigation">
        <div className="nav-logo">
          <span role="img" aria-label="rocket">🚀</span>
          <div>
            <div>OpportunityAI</div>
            <div className="nav-tagline">NJIT Campus Opportunity Engine</div>
          </div>
        </div>
        <div className="nav-right">
          <span className="nav-chip">NJIT</span>
          <button
            className="nav-avatar"
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
          >
            {initials}
          </button>
        </div>
      </nav>

      {/* ── Step bar ── */}
      <div className="step-bar" role="tablist" aria-label="Wizard steps">
        {STEPS.map((s, i) => {
          const stepIdx  = STEPS.findIndex(x => x.key === step);
          const isDone   = i < stepIdx;
          const isActive = s.key === step;
          return (
            <div key={s.key} className="step-wrapper">
              <button
                role="tab"
                aria-selected={isActive}
                aria-label={s.label}
                className={`step ${isActive ? 'step--active' : ''} ${isDone ? 'step--done' : ''}`}
                onClick={() => isDone ? goToStep(s.key) : undefined}
                disabled={!isDone && !isActive}
              >
                <span className="step-num">
                  {isDone ? '✓' : i + 1}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <span className="step-arrow" aria-hidden>›</span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Views ── */}
      <div className="opp-content">
        {step === 'profile' && (
          <ProfileWizard onSubmit={submitProfile} />
        )}

        {step === 'scan' && (
          <ApplicationTracker profile={profile} onComplete={finishScan} />
        )}

        {step === 'feed' && (
          <SmartFeed
            opportunities={opportunities}
            allOpportunities={allOpportunities}
            typeCounts={typeCounts}
            filters={filters}
            profile={profile}
            onToggleType={toggleType}
            onSetMinMatch={setMinMatch}
            onToggleApplied={toggleApplied}
            onToggleSaved={toggleSaved}
          />
        )}
      </div>
    </div>
  );
}
