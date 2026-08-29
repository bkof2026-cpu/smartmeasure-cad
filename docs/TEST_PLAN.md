# Test Plan

Executed per product, in the sequential order from `IMPLEMENTATION_STATUS.md`. A product is not
marked PASS until every row below is actually run against the live app (`browser-automation`
skill) — not inferred from TypeScript compiling.

## Engine-level (before any product UI wiring)

- Re-derive the BOX family's two real historical orders (2295×615×400 and 780×615×400) through
  `formulaEngine.ts` and confirm exact-mm match against `FORMULA_TRACEABILITY.md`'s table.
- Collision engine: construct a synthetic case with 3 same-edge dimension lines closer together
  than their label width; confirm they resolve into separate offset tiers with no overlap.

## Per-product matrix

| # | Case | What to check |
|---|---|---|
| 1 | Minimum dimensions (field `min` values) | No negative/NaN geometry, no crash |
| 2 | Normal/demo dimensions | Component list matches `PRODUCT_STANDARDS.md` table exactly |
| 3 | Large dimensions (field `max` values) | Geometry scales correctly, no overflow outside bounds |
| 4 | Invalid dimensions (below min / above max / non-numeric) | Validation blocks PDF with a stated CRITICAL reason, not silently clamped |
| 5 | Optional component toggle on/off | Component appears/disappears with correct geometry, not just a label |
| 6 | View switch (Front/Plan/Side/Internal) | Each view renders its own correct projection, no stale state |
| 7 | Edit a measurement after first render | Live re-generation — geometry, dimensions, validation all update, nothing stale/cached |
| 8 | Dimension collision | No overlapping labels visually, verified by screenshot |
| 9 | PDF download | Opens with identical structure/values to the on-screen drawing |
| 10 | Drawing Inspector / "why this dimension?" | Clicking a component/dimension shows its real formula + constants, matching `PRODUCT_STANDARDS.md` |

## Product-specific scenarios (from the user's own examples)

- **Bed**: 1820×890×400, then change width to 1900 — confirm every dependent panel/dimension
  updates. Add Side Table Left, Right, then Both — confirm correct position beside headboard end,
  never overlapping/below the bed, each with its own resolved dimensions.
- **Wardrobe**: verify at least 3 structurally distinct designs (e.g. a plain N-door openable, the
  6-door Loft + Mixed Storage design, and a Sliding + Dressing design) actually draw different
  component structures, not the same generic layout with a different door count. Re-test the
  screenshotted measurement-fields-vs-drawing mismatch is gone.
- **Kitchen**: L-shaped with Wall A + Wall B populated — confirm corner geometry doesn't double-
  count width or overlap, once Kitchen's corner logic is implemented (later stage).
- **Regression**: re-test the exact two screenshotted bugs (Bed dimension overlap; Wardrobe
  measurement-fields-vs-drawing mismatch) after each relevant product's migration, confirm fixed.

## Browser console

Checked clean (no errors/warnings introduced) on every product screen touched, per verification
step in the approved plan.
