// ─────────────────────────────────────────────────────────────────────────────
// components/SearchBar.tsx
// Search input — future home of Fuse.js autocomplete dropdown
// ─────────────────────────────────────────────────────────────────────────────

interface SearchBarProps {
  value:    string;
  onChange: (query: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="searchWrap">
      <span style={{ color: "#718096", fontSize: "0.9rem" }}>🔍</span>
      <input
        className="searchInput"
        placeholder="Search people, companies, clubs..."
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}