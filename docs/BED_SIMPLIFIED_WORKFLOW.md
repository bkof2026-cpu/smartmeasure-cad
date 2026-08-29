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

One combined "site sketch" style Plan view (`resolveSimpleBedPlan`) — not a
strict single orthographic projection: the headboard band is drawn at its
real height directly above the bed's own W×L footprint, matching the user's
own hand-measured reference sketch exactly. LST/RST sit flush at the two
head-end corners, forming one connected composition. Title is built
dynamically: `BED — PLAN VIEW`, `BED + LST — PLAN VIEW`,
`BED + RST — PLAN VIEW`, or `BED + LST + RST — PLAN VIEW`, and includes the
Bed Height as text (`(H = 436mm)`) since height isn't a plan-view dimension
but the user's sketch still wants it visible.

Only real drawn components get dimension lines (Bed W/L, Headboard H, each
enabled side table's D/W) — no internal panels, drawers, shelves, or
partitions are generated.

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
