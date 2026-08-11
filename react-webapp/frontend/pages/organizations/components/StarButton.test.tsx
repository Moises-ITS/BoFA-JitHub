// ─────────────────────────────────────────────────────────────────────────────
// StarButton.test.tsx
//
// Proves:
//  - lit vs unlit is exposed as aria-pressed, not as a CSS class (AC 19)
//  - the count renders and comes entirely from props (the button holds no state)
//  - a click calls onToggle exactly once
//  - `disabled` suppresses the click, which is what keeps a double-tap from
//    burning two writes against the rate limit
//  - the click does not bubble to an enclosing card (AC 20 — starring must not
//    navigate away)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { StarButton } from "./StarButton"

describe("StarButton", () => {
  it("reports the lit state through aria-pressed when starred", () => {
    render(<StarButton starred count={7} onToggle={() => {}} label="Chess Club" />)
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true")
  })

  it("reports the unlit state through aria-pressed when not starred", () => {
    render(<StarButton starred={false} count={7} onToggle={() => {}} label="Chess Club" />)
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false")
  })

  it("renders the count it is given", () => {
    render(<StarButton starred={false} count={42} onToggle={() => {}} />)
    expect(screen.getByText("42")).toBeInTheDocument()
  })

  it("calls onToggle exactly once per click", () => {
    const onToggle = vi.fn()
    render(<StarButton starred={false} count={0} onToggle={onToggle} />)

    fireEvent.click(screen.getByRole("button"))

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it("does not call onToggle while a write for this org is pending", () => {
    const onToggle = vi.fn()
    render(<StarButton starred={false} count={0} onToggle={onToggle} disabled />)

    fireEvent.click(screen.getByRole("button"))

    expect(onToggle).not.toHaveBeenCalled()
  })

  it("stops the click from reaching an enclosing card (AC 20)", () => {
    const onCardClick = vi.fn()
    const onToggle = vi.fn()
    render(
      <div onClick={onCardClick}>
        <StarButton starred={false} count={1} onToggle={onToggle} />
      </div>
    )

    fireEvent.click(screen.getByRole("button"))

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onCardClick).not.toHaveBeenCalled()
  })
})
