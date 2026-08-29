# Gap Report

Audited against the repo as of this pass, before any product code changes. File references are
repo-relative.

## 1. Existing functionality (works today, keep)

- `src/screens/ProductFlow.tsx` — Measure / Drawing / Evidence / Validation / PDF / History tabs,
  product dropdown, add-on toggles, 10-day history recall, autosave with real "Saved HH:MM:SS"
  timestamp (`saveMeasurementSnapshot`, debounced, only shown after the snapshot actually lands).
- PDF export (`downloadPDF`, `ProductFlow.tsx:450`) clones the **live on-screen `<svg>` DOM**
  verbatim into a new window and calls `window.print()` — screen and PDF are structurally
  identical today already; this property must be preserved, not rebuilt.
- Kitchen (`src/rules/ruleEngine.ts`) has a real wall-based module distribution engine — modules
  are positioned left-to-right on each wall with filler/scale math, not placed randomly — plus
  validation (`ValidationIssue[]`) and a `completionPercent` score.
- Every product's `computeCutlist()` already produces real mm-driven cutlist rows (not random),
  and drawings scale from actual `dims`, not fixed pixel sizes.

## 2. Missing functionality

- No shared component/formula/geometry/dimension engine — every product's `DrawingComponent`
  (`src/products/productRegistry.tsx`) independently recomputes its own scale, dimension line
  placement, and label text with duplicated `DimH`/`DimV`/`CabLabel` helpers.
- No per-design component structure for Wardrobe. `WARDROBE_DESIGNS` in
  `src/screens/WardrobeDesignSelection.tsx` lists 25 named designs, but only **one** id
  (`wardrobe_openable_6door_loft_mixed_storage`) has a matching drawing
  (`MixedWardrobeDrawing`, `ProductFlow.tsx:27`); the other 24 render through the generic
  `OpenableWardrobeDrawing`/`SlidingWardrobeDrawing`, which only reads `shutters`/`verticals`/
  `shelves`/`drawers` — every design that isn't the mixed-storage one produces visually identical
  structure regardless of its stated name (e.g. "Hinged + Dressing Section" draws no mirror or
  open dressing zone; "Hinged + Loft" draws no loft).
- No `NOT_CONFIGURED` state anywhere — every product always renders *something*, even when no
  real structure backs the current selection.
- No dimension-collision avoidance — dimension labels are placed at fixed pixel offsets
  (`DimH`/`DimV` `off = above ? -14 : 14`, or `right ? 14 : -14`) with no check against nearby
  labels, which is exactly why labels stack/overlap when several dimension lines land close
  together (see Bug 1 below).
- No Drawing Inspector / formula traceability UI — component formulas exist only as literal
  arithmetic inline in each `computeCutlist()`, with no structured "source/formula" metadata
  attached to any component or dimension.
- No fabrication drawing-sheet composition (title block, multi-view layout, dimension/component
  table, drawing no./scale/revision footer) — the current PDF is just the raw on-screen SVGs
  concatenated with a plain header.

## 3. Incorrect / misleading functionality

- **`isFormulaVerified: true` is hardcoded** for Bed, Side Table, Openable Wardrobe, Sliding
  Wardrobe, Loft in `src/products/productRegistry.tsx`, and their `computeCutlist()` formulas do
  **not** match the real, historically-verified formulas in `Cutlist_Engine_NEW_SHEETS_ONLY.xlsx`
  (e.g. today's Bed cutlist computes `Left Side = L - sp` width / `H` height, `Top = W-sp` width /
  `L-sp` height — structurally different axis usage from the verified `CALC_BED` sheet). The
  green "✓ Formula Verified" badge the user sees is not actually backed by verification against
  real orders — this is precisely the "fake Formula Verified status" the spec calls out.

## 4. Hard-coded geometry / dimensions

- `MixedWardrobeDrawing` (`ProductFlow.tsx:27-449`) draws a fixed "6 doors + 6 loft boxes" layout
  regardless of the generic `shutters`/`verticals`/`shelves` fields still shown and editable in
  the left panel for that same product — those fields have **zero effect** on the drawing while
  this design is active, which is the exact disconnect visible in the user's screenshot (generic
  "Vertical Divisions: 2 / Total Shelves: 6" fields shown, but the drawing renders a hardcoded
  6-door/6-loft layout unrelated to those values).
- Room-scale composite drawings (Bedroom/1BHK/2BHK/3BHK) place fixed-shape furniture blocks
  inside floor plans rather than the products' own resolved geometry — explicitly out of scope
  for this pass per the user's direction, noted here for completeness only.

## 5. Generic box-only drawings

None of the current per-product `DrawingComponent`s are literally a single rectangle — each has
some internal structure (doors, shelves, drawers, headboard, etc.) — but that structure is driven
by generic counts (`verticals`, `shelves`, `drawers`, `boxes`), not by an explicit, named
component list per selected design. This is the gap this pass's engine closes for the LIVE
families (Bed, Side Table, Wardrobe ×2, Loft/Box family).

## 6. Formula inconsistencies

- Current `productRegistry.tsx` cutlist formulas for Bed/Side Table/Wardrobe/Loft diverge from
  the verified `CALC_*` sheets (see §3). These will be replaced with the verified formulas as
  each product is migrated (§6 of the implementation plan), not patched in place, since the
  divergence is structural (different deduction constants, different component set).
- Kitchen's `src/rules/defaultConfig.ts` constants are explicitly self-labeled "DEMO VALUE... do
  NOT treat as actual company standards" by the existing code itself — already honestly flagged,
  consistent with Kitchen's PENDING status in the real formula dataset.

## 7. Dimension collision problems

- **Confirmed bug (user screenshot)**: Bed's front-elevation dimension labels `1650` / `1200` /
  `450` render at fixed offsets on the right edge and visually overlap when the headboard height
  and frame height labels land close together (`BedDrawing`, `ProductFlow`-rendered via
  `product.DrawingComponent`, offsets hardcoded in `DimV` calls at `productRegistry.tsx:232-234`).
  Root cause: no collision engine — dimension line placement is static per call site.

## 8. Screen/PDF inconsistencies

None found structurally — `downloadPDF` clones the same SVG DOM shown on screen, so screen and
PDF are pixel-identical today. This property is preserved by keeping the same clone-based export
once the canonical SVG + drawing-sheet engine are in place; the sheet composition is added to the
same on-screen container, not a separate PDF-only render path.

## 9. Product-specific missing structures

- Wardrobe: no distinct construction between hinged and sliding beyond a `shutters` count; no
  loft, dressing/mirror, or niche zones actually drawn even when a design's name says so.
- Bed: no real side-table zone geometry — `BedWithSideTablesPlan`/`BedWithSideTablesFront`
  (`ProductFlow.tsx`) are separate one-off composite components bolted on, not part of Bed's own
  resolved component tree.
- TV Unit, Kitchen, Dining Table: real, working, non-random geometry already exists but has no
  verified formula source (§0 of the plan) — correctly should not claim "Formula Verified."

## 10. Confirmed screenshot bugs, restated for the test plan

1. Bed dimension label overlap (front elevation, right-side `H`/`headboardH` labels).
2. Openable Wardrobe measurement panel shows generic fields (`Vertical Divisions`, `Total
   Shelves`) whose values do not affect the drawing when a design with its own fixed layout
   (mixed-storage) is selected — the fields exist but are silently inert for that design.
