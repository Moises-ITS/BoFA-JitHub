/**
 * OrgFilterBar — the search input and the three-way type dropdown.
 *
 * Controlled and stateless; OrganizationsPage owns both values. The debounce
 * between "user typed" and "request fired" also lives on the page, not here — a
 * component that debounces its own onChange makes its input feel laggy and hides
 * the timing from the thing that actually needs to reason about it.
 *
 * Styling mirrors the Events page's search + select pair so the two directories
 * look like the same product.
 */
import { Search } from "lucide-react"
import { ORG_TYPE_FILTERS, type OrgTypeFilter } from "../types/organizations"

export function OrgFilterBar({
  query,
  onQueryChange,
  typeFilter,
  onTypeFilterChange,
  resultCount,
}: {
  query: string
  onQueryChange: (value: string) => void
  typeFilter: OrgTypeFilter
  onTypeFilterChange: (value: OrgTypeFilter) => void
  /** Total matching the current search + filter, before pagination. */
  resultCount: number | null
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div style={{ position: "relative", flex: 1, minWidth: "min(100%, 240px)" }}>
        <Search
          className="h-4 w-4"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
          }}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search organizations"
          aria-label="Search organizations"
          className="rounded-lg py-2 pr-3 text-sm text-white focus:outline-none"
          style={{
            width: "100%",
            paddingLeft: "36px",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
          }}
        />
      </div>

      <select
        value={typeFilter}
        aria-label="Filter by type"
        onChange={(e) => onTypeFilterChange(e.target.value as OrgTypeFilter)}
        className="cursor-pointer rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
        style={{
          colorScheme: "dark",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
        }}
      >
        {ORG_TYPE_FILTERS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {resultCount !== null && (
        <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
          {resultCount} {resultCount === 1 ? "organization" : "organizations"}
        </span>
      )}
    </div>
  )
}
