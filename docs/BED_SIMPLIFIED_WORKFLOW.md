# Bed — Simplified Site-Measurement Workflow

Replaces the CALC_BED-driven fabrication engine as the **live** Bed product
entry, per the user's explicit request (29 Aug 2026) with their own
hand-measured site sketch as reference. The detailed engine
(`bedFormulas.ts`, `bedGeometry.ts`, `BedTechnicalDrawing.tsx`) is untouched
and still works — it's just no longer wired into `productRegistry.tsx`'s
`bed` entry, kept available for a future "fabrication detail" mode.

## Why

A measurement person working at a client's site needs to capture a bed in
under a minute: three numbers, a headboard, maybe two side tables. The
previous Bed product asked for material thickness, side-panel depth, a
hydraulic-storage toggle, and drew a full panel/patti/platform/foot-rail
breakdown — real and formula-correct, but the wrong tool for this job.

## Data model

```
BedMeasurement:
  widthMm, lengthMm, heightMm, headboardHeightMm
  leftSideTable:  { enabled, depthMm, widthMm }   // heightMm always = bed height
  rightSideTable: { enabled, depthMm, widthMm }   // heightMm always = bed height
```

Implemented as `SimpleBedInputs` in `src/products/bed/simpleBedGeometry.ts`.

## Formulas (exact equalities, not approximations — nothing here needs

historical-order verification the way CALC_BED's clearance constants did):

| Value | Formula |
|---|---|
| Headboard Width | `= Bed Width` (auto, not independently entered) |
| Headboard Height | standard default 900mm, always editable |
| LST/RST Height | `= Bed Height` (auto-fetched, never independently entered) |
| LST position | `X = Bed.Left − LST.Width`, `Y = Bed.Top` (flush against the left corner) |
| RST position | `X = Bed.Right`, `Y = Bed.Top` (flush against the right corner) |

## Drawing

Redesigned 29 Aug 2026 to match the user's own two reference sketches
("Bed without side table" / "Bed with Side table") exactly, in
`resolveSimpleBedPlan`:

- **Headboard** is a separate, non-touching box (a real gap above the Bed,
  `HEADBOARD_GAP` = 60mm), captioned inline with its own size
  (`Headboard = 900 × 1830`) — no dimension arrows on it, since Headboard
  Width is always exactly Bed Width and a second arrow would just repeat
  the Bed Width dimension below.
- **Bed** is captioned `Bed - {L} × {W}`, with real W (bottom) and L (left
  edge) dimension arrows.
- **Bed Height (h)** has no natural edge to dimension in a plan view (it's
  the axis perpendicular to the page) — shown as a diagonal corner
  leader/callout (`AnnotationLine` with an optional `label`, added to the
  shared engine's `types.ts` and rendered in `CanonicalSvg.tsx`) anchored
  at the top-center of the Bed, in the headboard gap — matching the user's
  own hand-sketch convention, and positioned there specifically (not a
  corner) so it never collides with the LST/RST dimension cluster at
  either corner.
- **LST/RST**: flush at the two head-end corners. Depth gets a real
  vertical dimension arrow; Width gets a real horizontal one. Height —
  like Bed's own h — isn't a real plan-view span either (it's auto-fetched
  from Bed Height, not an independent footprint measurement), so it's a
  second diagonal leader from the table's outer-bottom corner rather than
  a second vertical arrow. Two same-origin, near-equal-length vertical
  dimensions (D ≈ 460mm, H ≈ 436mm in the worked example) were tried first
  and rejected: the collision engine's per-tier offset (`DIM_TIER_STEP_PX`
  = 18px) is far narrower than a rendered label box (~60px), so two
  dimensions sharing almost the same span midpoint still overlap even on
  different tiers — a leader avoids the collision entirely rather than
  trying to out-tune the shared tier system for one narrow case.

Title is built dynamically: `BED — PLAN VIEW`, `BED + LST — PLAN VIEW`,
`BED + RST — PLAN VIEW`, or `BED + LST + RST — PLAN VIEW`, and includes the
Bed Height as text (`(H = 436mm)`) in addition to the on-drawing leader.

Only real drawn components get dimension lines or leaders (Bed W/L/h,
Headboard's own inline caption, each enabled side table's D/W/H) — no
internal panels, drawers, shelves, or partitions are generated.

## Screen ↔ PDF

`simpleBedGeometry.ts`'s `resolveSimpleBedPlan` and `simpleBedCutlist` are
the single source of truth for both — `ProductFlow.tsx`'s
`renderMainDrawing` and `handleDownloadPDF` both call the same functions
with the same inputs, so the PDF can never show a component the screen
doesn't (or vice versa).

## UI

LST/RST use the existing "Add Extra Items" addon-card toggle (already built
for this exact reveal-on-toggle UX) with just Depth and Width as editable
fields; Height is shown as a read-only row reading "Auto-fetched from Bed
Height" rather than a field, since it's never independently entered.

## Verified (29 Aug 2026)

Live-tested against the user's own worked example (W=1830, L=1980, H=436):
- Base case: title `BED — PLAN VIEW — 1830×1980 mm (H = 436mm)`.
- LST enabled (D=460, W=560): title becomes `BED + LST — PLAN VIEW`, LST
  drawn flush at the top-left corner with its own D/W dimensions.
- Both LST + RST enabled: both corners attached, one connected composition,
  0 overlap.
- Bed Width changed 1830 → 2000: headboard and width dimension update live.
- Bed Height changed 436 → 450, Headboard Height changed 900 → 850
  independently: both tracked correctly, Validation tab confirms both.
- PDF downloaded and content-checked: exactly 4 component-table rows (Bed,
  Headboard, LST, RST), one "PLAN VIEW" page, values matching the screen
  exactly.
- `tsc --noEmit` and `npm run build` both clean, 0 console errors throughout.
