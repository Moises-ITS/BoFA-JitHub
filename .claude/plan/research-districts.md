# Implementation Plan: Research Districts

## Task Type
- [x] Frontend (CSS 2.5D + Motion animations)
- [ ] Backend
- [ ] Fullstack

## Technical Solution

Replace the placeholder ResearchPage with a full-screen immersive "Research Districts" experience. Each research field is a styled, positioned "district" on a 2.5D map-like canvas. Uses CSS transforms (perspective, rotateX) for depth, `motion` (framer-motion v12) for smooth interactions, and Tailwind CSS for styling. No 3D engines.

### Architecture Decision: Full-screen route

The `/research` route currently sits inside `<Layout />` (sidebar + topbar). Two options:

- **Option A**: Move `/research` outside Layout for full-screen immersion (like `/map`, `/campus`)
- **Option B**: Keep inside Layout, make districts fill the content area

**Recommended: Option A** — the "explorable neighborhood" metaphor requires full viewport. Add a back button to return to the app shell.

## Data Model

```typescript
// pages/districts/data/districts.ts

interface Opportunity {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly difficulty: "Beginner" | "Intermediate" | "Advanced"
}

interface District {
  readonly id: string
  readonly name: string
  readonly icon: string
  readonly color: string        // primary color (hex)
  readonly glowColor: string    // glow/accent (hex with alpha)
  readonly description: string
  readonly opportunities: readonly Opportunity[]
  readonly position: { x: number; y: number }  // % offset from center
  readonly size: { w: number; h: number }       // relative sizing
  readonly rotation: number                      // slight CSS rotate for organic feel
}
```

### Six Districts (map-like layout):

| District | Color | Position (x%, y%) | Size (w, h) | Rotation |
|----------|-------|--------------------|--------------|----------|
| AI       | #8B5CF6 (violet) | -30%, -25% | 220, 180 | -2deg |
| Bio      | #10B981 (emerald) | 25%, -20% | 200, 160 | 3deg |
| Engineering | #F59E0B (amber) | -35%, 20% | 240, 170 | 1deg |
| Finance  | #3B82F6 (blue) | 30%, 15% | 190, 150 | -3deg |
| Materials | #EC4899 (pink) | -5%, 30% | 210, 160 | 2deg |
| Physics  | #6366F1 (indigo) | 5%, -35% | 230, 175 | -1deg |

Each district gets 3-4 mock research opportunities with varied difficulties.

## Component Structure

```
pages/districts/
  ResearchDistricts.tsx          # Main page: 2.5D canvas + state management
  components/
    DistrictCard.tsx             # Individual district "zone" with hover/click
    DistrictDetailView.tsx       # Expanded overlay when district is selected
  data/
    districts.ts                 # District type + mock data array
```

## Implementation Steps

### Step 1: Create district data model and mock data
- **File**: `pages/districts/data/districts.ts`
- **Operation**: Create new
- **Deliverable**: District interface + DISTRICTS array with 6 districts, each with 3-4 opportunities

### Step 2: Create DistrictCard component
- **File**: `pages/districts/components/DistrictCard.tsx`
- **Operation**: Create new
- **Deliverable**: Individual district "zone" component

Visual design per card:
- Rounded polygon-like shape (clip-path or large border-radius with asymmetry)
- Background: radial gradient from district color to dark
- Border: 1px district color at 20% opacity
- Box-shadow: soft district-colored glow
- Inner content: icon (emoji), name, brief tagline
- Subtle "building" shapes or patterns inside (CSS pseudo-elements)

Interactions:
- **Hover**: `motion` — translateY(-8px), scale(1.05), glow intensifies, elevation shadow grows
- **Click**: triggers `onSelect(district)` callback
- Cursor changes to pointer on hover

### Step 3: Create DistrictDetailView component
- **File**: `pages/districts/components/DistrictDetailView.tsx`
- **Operation**: Create new
- **Deliverable**: Full-screen overlay showing district details + opportunities

Layout:
- AnimatePresence for smooth mount/unmount
- Background: dark scrim (bg-black/60 backdrop-blur)
- Panel: slides up from bottom or scales in from center
- Header: district name + icon + color accent bar
- Body: grid of opportunity cards
- Each opportunity card: title, description, difficulty badge (color-coded), "Apply" button
- Close button (X) top-right + click scrim to close

### Step 4: Create ResearchDistricts main page
- **File**: `pages/districts/ResearchDistricts.tsx`
- **Operation**: Create new
- **Deliverable**: Full-screen explorable district map

Layout:
- `perspective: 1200px` on the container
- `rotateX(15deg)` on the inner map for 2.5D tilt effect
- Districts absolutely positioned using their `position` offsets
- Background: dark (#0f1117) with subtle radial gradient or grid pattern
- Title overlay: "Research Districts" top-left
- State: `selectedDistrict` and `hoveredDistrict`

Canvas feel:
- CSS Grid or absolute positioning within a centered container
- `transform-style: preserve-3d` for depth
- Subtle animated "connection lines" between districts (SVG or pseudo-elements)
- Ambient particle effect or subtle animated gradient

### Step 5: Wire into App.tsx routing
- **File**: `App.tsx`
- **Operation**: Modify
- **Changes**:
  1. Add lazy import: `const ResearchDistricts = lazy(() => import("./pages/districts/ResearchDistricts"))`
  2. Move `/research` route OUTSIDE the `<Layout />` group
  3. Wrap with ErrorBoundary + Suspense (same pattern as /map, /campus)

### Step 6: Add navigation link
- **File**: `pages/home/sidebar.tsx` (if it has a research link)
- **Operation**: Modify (if needed)
- **Changes**: Ensure sidebar link to `/research` still works

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `pages/districts/data/districts.ts` | Create | District types + 6 mock districts with opportunities |
| `pages/districts/components/DistrictCard.tsx` | Create | 2.5D district zone with hover/click animations |
| `pages/districts/components/DistrictDetailView.tsx` | Create | Overlay panel with opportunity cards |
| `pages/districts/ResearchDistricts.tsx` | Create | Main page: perspective canvas + state |
| `App.tsx:17-19` | Modify | Add lazy import, move route outside Layout |
| `pages/research/ResearchPage.tsx` | Keep | Can redirect to /districts or keep as secondary view |

## Visual Design Pseudo-code

### 2.5D Canvas Effect
```css
.district-canvas {
  perspective: 1200px;
  perspective-origin: 50% 40%;
}
.district-map {
  transform: rotateX(12deg) rotateZ(-1deg);
  transform-style: preserve-3d;
}
```

### District Zone Shape
```css
.district-zone {
  background: radial-gradient(ellipse at 30% 30%, {color}33, {color}0a);
  border: 1px solid {color}33;
  box-shadow: 0 0 30px {color}15, 0 8px 32px rgba(0,0,0,0.4);
  border-radius: 20px 30px 25px 35px; /* organic asymmetric */
  clip-path: polygon(5% 0%, 95% 3%, 100% 92%, 3% 100%); /* slight irregular */
}
.district-zone:hover {
  transform: translateY(-8px) scale(1.05);
  box-shadow: 0 0 50px {color}30, 0 16px 48px rgba(0,0,0,0.5);
}
```

### Difficulty Badges
```
Beginner    → green (#10B981) pill
Intermediate → yellow (#F59E0B) pill
Advanced    → red (#EF4444) pill
```

## Animation Specifications (motion v12)

| Element | Trigger | Animation |
|---------|---------|-----------|
| District card | hover | `y: -8, scale: 1.05` over 200ms spring |
| District card | click | `scale: 0.95` then springs back |
| Detail overlay | mount | `opacity: 0→1`, panel `y: 50→0` over 400ms |
| Detail overlay | unmount | reverse, 300ms |
| Background scrim | mount | `opacity: 0→1` over 300ms |
| Opportunity cards | mount | staggered `y: 20→0, opacity: 0→1` (50ms stagger) |

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Districts overlap on small screens | Use responsive scaling; clamp container min-width |
| Perspective tilt breaks on mobile | Reduce rotateX on mobile; media query fallback |
| Motion perf on low-end devices | Use `will-change: transform`; keep animations GPU-composited |
| Route change breaks sidebar navigation | Keep `/research` as redirect or alias to `/districts` |

## Dependencies
All already installed:
- `motion` v12.36.0 (framer-motion)
- `tailwindcss` v4.2.1
- `lucide-react` v0.577.0
- `react` v19.2.0

No new packages needed.

## SESSION_ID
- CODEX_SESSION: N/A (ccg prompts not available)
- GEMINI_SESSION: N/A (ccg prompts not available)
