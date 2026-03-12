import { useEffect, useRef, useState } from 'react';
import type { UserProfile } from '../types/opportunities';

interface Props {
  profile: UserProfile;
  onComplete: () => void;
}

interface TerminalLine {
  prompt: string;
  text: string;
  style: 'normal' | 'dim' | 'highlight' | 'warn';
  delay: number;
}

function buildScript(profile: UserProfile): TerminalLine[] {
  const major = profile.major || 'Computer Science';
  const year  = profile.year  || 'Junior';
  return [
    { prompt: '$', text: 'opportunity-ai init --profile njit',          style: 'normal',    delay: 0   },
    { prompt: '>', text: `Loading profile: ${profile.name || 'Student'}`, style: 'dim',    delay: 500 },
    { prompt: '>', text: `Major: ${major}  |  Year: ${year}`,            style: 'dim',      delay: 900 },
    { prompt: '$', text: 'scan --sources "njit,handshake,linkedin,nsf"', style: 'normal',   delay: 1400 },
    { prompt: '>', text: 'Connecting to NJIT Handshake API…',            style: 'dim',      delay: 1900 },
    { prompt: '✓', text: '127 listings indexed from Handshake',          style: 'highlight',delay: 2600 },
    { prompt: '>', text: 'Scanning NSF REU database…',                   style: 'dim',      delay: 3100 },
    { prompt: '✓', text: '43 research programs matched',                 style: 'highlight',delay: 3700 },
    { prompt: '>', text: 'Querying NJ employer network…',                style: 'dim',      delay: 4200 },
    { prompt: '✓', text: '89 local employer postings found',             style: 'highlight',delay: 4800 },
    { prompt: '$', text: `match --interests "${(profile.interests || []).join(', ') || 'CS, ML'}"`, style: 'normal', delay: 5400 },
    { prompt: '>', text: 'Running semantic similarity scoring…',         style: 'dim',      delay: 5900 },
    { prompt: '>', text: 'Applying GPA + major weighting…',              style: 'dim',      delay: 6600 },
    { prompt: '!', text: 'High-confidence matches: 8 opportunities',     style: 'warn',     delay: 7200 },
    { prompt: '✓', text: 'Scan complete — loading your feed',            style: 'highlight',delay: 7800 },
  ];
}

const STATS_FINAL = { scanned: 259, matches: 8, sources: 4 };
const SCAN_DURATION_MS = 8400;

export default function ApplicationTracker({ profile, onComplete }: Props) {
  const script = buildScript(profile);

  const [visibleLines, setVisibleLines] = useState<TerminalLine[]>([]);
  const [progress, setProgress]         = useState(0);
  const [stats, setStats]               = useState({ scanned: 0, matches: 0, sources: 0 });
  const [done, setDone]                 = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reveal terminal lines
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    script.forEach(line => {
      timers.push(setTimeout(() => {
        setVisibleLines(prev => [...prev, line]);
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, line.delay));
    });
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate progress bar
  useEffect(() => {
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const pct = Math.min(100, ((now - start) / SCAN_DURATION_MS) * 100);
      setProgress(pct);
      setStats({
        scanned: Math.floor((pct / 100) * STATS_FINAL.scanned),
        matches: Math.floor((pct / 100) * STATS_FINAL.matches),
        sources: Math.min(STATS_FINAL.sources, Math.floor((pct / 25) + 1)),
      });
      if (pct < 100) {
        raf = requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Auto-advance when done
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onComplete, 900);
    return () => clearTimeout(t);
  }, [done, onComplete]);

  return (
    <div className="scan-view">
      <div className="scan-card">
        {/* Header */}
        <div className="scan-header">
          <div className="scan-dot" />
          <span className="scan-title">OPPORTUNITY-AI &nbsp;·&nbsp; NJIT SCANNER v2.4</span>
        </div>

        {/* Terminal */}
        <div className="terminal" aria-live="polite" aria-label="AI scan terminal">
          {visibleLines.map((line, i) => (
            <div key={i} className="t-line">
              <span className={`t-prompt t-prompt--${line.style === 'highlight' ? 'green' : line.style === 'warn' ? 'warn' : 'default'}`}>
                {line.prompt}
              </span>
              <span className={`t-text t-text--${line.style}`}>{line.text}</span>
            </div>
          ))}
          {!done && <div className="t-line"><span className="t-prompt">›</span><span className="cursor" /></div>}
        </div>

        {/* Progress */}
        <div className="scan-progress">
          <div className="progress-label">
            <span>Scanning opportunities…</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Stats */}
        <div className="scan-stats">
          <div className="stat-box">
            <div className="stat-num">{stats.scanned}</div>
            <div className="stat-lbl">SCANNED</div>
          </div>
          <div className="stat-box">
            <div className="stat-num">{stats.matches}</div>
            <div className="stat-lbl">MATCHES</div>
          </div>
          <div className="stat-box">
            <div className="stat-num">{stats.sources}</div>
            <div className="stat-lbl">SOURCES</div>
          </div>
        </div>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
