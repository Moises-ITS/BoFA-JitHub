import { memo } from "react";

interface SearchBarProps {
  value: string;
  onChange: (query: string) => void;
  onEnter?: (query: string) => void;
  message?: string;
}

const SearchBar = memo(function SearchBar({ value, onChange, onEnter, message }: SearchBarProps) {
  return (
    <div className="searchWrap">
      <span style={{ color: "#718096", fontSize: "0.9rem" }}>🔍</span>
      <input
        className={`searchInput${message ? " searchInput--message" : ""}`}
        placeholder="Search people, companies, clubs..."
        value={message || value}
        readOnly={Boolean(message)}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onEnter?.(value);
        }}
      />
    </div>
  );
});

export default SearchBar;
