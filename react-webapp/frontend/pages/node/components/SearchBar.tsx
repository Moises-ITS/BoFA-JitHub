import { memo } from "react";

interface SearchBarProps {
  value: string;
  onChange: (query: string) => void;
  onEnter?: () => void;
}

const SearchBar = memo(function SearchBar({ value, onChange, onEnter }: SearchBarProps) {
  return (
    <div className="searchWrap">
      <span style={{ color: "#718096", fontSize: "0.9rem" }}>🔍</span>
      <input
        className="searchInput"
        placeholder="Search people, companies, clubs..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onEnter?.();
        }}
      />
    </div>
  );
});

export default SearchBar;
