# Drawing Requirements

## Views per product

| Product | Views | Notes |
|---|---|---|
| Bed | Front, Plan, Side | + Side Table zones shown in Plan/Front when selected |
| Side Table | Front, Plan, Side | |
| Openable Wardrobe | Front, Plan, Internal | + Side elevation once wardrobe engine matures |
| Sliding Wardrobe | Front, Plan, Internal | |
| Loft (Box family) | Front, Plan, Side | |
| TV Unit | Front, Plan | PARTIAL family — existing views kept |
| Kitchen | Plan, Elevation A, Elevation B, Section | existing `PlanView`/`ElevationA`/`ElevationB` kept, extended |
| Dining Table | Plan, Front, Side | PARTIAL family |

## Fabrication sheet layout (`drawingSheetEngine.ts`)

```
┌──────────────────────────────────────────────────────────┐
│ SmartMeasure CAD · <Product> — <Design name>              │  title block
│ Client / Project / Employee / Date / Drawing No. / Rev    │
├──────────────────────────────────────────────────────────┤
│                                                            │
│                 FRONT / ELEVATION VIEW                    │  large, primary
│           (dimension lines + component labels)            │
│                                                            │
├───────────────────────┬────────────────────────────────────┤
│        SIDE VIEW       │            PLAN VIEW              │  smaller, secondary
├───────────────────────┴────────────────────────────────────┤
│ Component table: name / width / height / qty / material   │
│ Validation status: PASS / issues listed                   │
│ Drawing No. | Scale | Unit: mm | Rev                       │
└──────────────────────────────────────────────────────────┘
```

Matches the density of the existing reference drawing in
`src/imports/Arc_.Rutuja_Joshi__compressed.pdf` (title block, multiple views, dimension chains,
page numbering) rather than a single demo box.

## Line-weight conventions

- Outer carcass boundary: heaviest stroke (`strokeWidth ≈ 1.5–2`).
- Internal panels/partitions: medium (`≈ 0.8–1.2`).
- Dimension + extension lines: thin (`≈ 0.4–0.8`), red/blue per today's existing convention
  (`#cc2200` primary, `#0055bb` secondary section dimensions) — kept from `productRegistry.tsx`.
- Hidden/dashed elements (mattress zone, hanging rail secondary line): dashed, per existing
  `strokeDasharray` usage already in the codebase.

## Dimension collision rule

Every dimension line is placed **outside** the bounding box of the component(s) it measures.
Same-edge dimension lines are grouped and stacked in offset tiers (tier 0 closest to the drawing,
each subsequent tier further out) so labels never overlap — this directly targets the Bed
screenshot bug (`1650`/`1200`/`450` overlapping on the right edge).

## Scale

1 SVG unit = 1 mm internally; a `viewBox`-based fit-to-viewport scale is applied for display only,
never distorting aspect ratio — this matches the existing `sc = Math.min(vw/W, vh/H)` pattern
already used throughout `productRegistry.tsx`, generalized into the shared engine.
