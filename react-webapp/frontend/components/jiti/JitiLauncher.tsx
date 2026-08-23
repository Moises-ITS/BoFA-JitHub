/**
 * JitiLauncher.tsx — the small circular bottom-right button that opens and
 * closes the Jiti chat panel.
 */
import "./JitiPanel.css"

interface JitiLauncherProps {
  readonly isOpen: boolean
  readonly onToggle: () => void
}

export default function JitiLauncher({ isOpen, onToggle }: JitiLauncherProps) {
  return (
    <button
      type="button"
      className="jiti-launcher"
      onClick={onToggle}
      aria-label={isOpen ? "Close Jiti chat" : "Ask Jiti about NJIT clubs"}
      aria-expanded={isOpen}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3C7.03 3 3 6.58 3 11c0 2.39 1.19 4.53 3.06 6.02-.1.99-.5 2.32-1.56 3.48a.5.5 0 00.45.82c2.02-.32 3.55-1.2 4.53-1.93A11.6 11.6 0 0012 19c4.97 0 9-3.58 9-8s-4.03-8-9-8z"
          fill="currentColor"
        />
      </svg>
    </button>
  )
}
