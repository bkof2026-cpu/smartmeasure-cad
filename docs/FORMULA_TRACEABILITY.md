# Formula Traceability

How to prove, for any LIVE-family component, that its resolved dimension traces back to a real
verified formula — and the concrete proof already available for the BOX family.

## Chain

```
User measurement (W, H, D, Door/Drawer/Shelf/Vertical Qty, option flags)
        ↓
CLEARANCE_MASTER constant(s) named in this component's formula
        ↓
Component formula (from PRODUCT_STANDARDS.md, copied verbatim from CALC_<FAMILY>)
        ↓
Resolved width / height (mm)
        ↓
DimensionLine (records: componentId, formula string, constants used, resolved value)
        ↓
Drawing Inspector / "why this dimension?" click surfaces the full chain above
```

`src/engine/traceabilityEngine.ts` is the single place this chain is assembled — every resolved
`ComponentSpec` carries a `source: { formula: string; constants: string[] }` field set once, at
formula-evaluation time, never re-derived or re-typed by a renderer.

## Worked example (BOX family, cross-checked against real historical orders)

Order: client TAMBARAM PATEL, `W=2295, H=615, D=400`.

| Component | Formula | Calculation | Engine result | Historical order | Match |
|---|---|---|---|---|---|
| TOP width | `W − BOX_TB_DEDUCT(36)` | `2295 − 36` | 2259 | 2259 | ✓ |
| TOP height | `D` | `400` | 400 | 400 | ✓ |
| LEFT_SIDE width | `D` | `400` | 400 | 400 | ✓ |
| LEFT_SIDE height | `H` | `615` | 615 | 615 | ✓ |
| BACK width | `W − BOX_BACK_WH_DEDUCT(20)` | `2295 − 20` | 2275 | 2275 | ✓ |
| BACK height | `H − BOX_BACK_WH_DEDUCT(20)` | `615 − 20` | 595 | 595 | ✓ |
| VERTICAL width | `D − BOX_VERT_D_DEDUCT(30)` | `400 − 30` | 370 | 370 | ✓ |
| VERTICAL height | `H − BOX_VERT_H_DEDUCT(36)` | `615 − 36` | 579 | 579 | ✓ |

Second order confirmed the same way at `W=780, H=615, D=400` (TOP=744, BACK=760×595, etc. — see
`Cutlist_Engine_NEW_SHEETS_ONLY.xlsx!VALIDATION`). DOOR is intentionally excluded from this
proof — confirmed manual/custom in every real order checked.

**Verification step for this pass**: before wiring the Box/Loft engine into the UI, re-run this
exact table against the new TypeScript `formulaEngine.ts` output for both orders and confirm
exact-mm match, the same way the source workbook already proves it for Excel. Repeat the same
style of check for Bed/Side Table/Wardrobe once real order examples are available for them (the
workbook doesn't include a `VALIDATION`-tab-style table for those families — their component
formulas are individually documented in each `CALC_*` sheet's own notes column instead, which is
the traceability basis used until a table like BOX's exists).

## Worked example (BED family, axis-mapping proof)

`FORMULA.xlsx` sheets "BED" and "BED 2" each carry a literal header row `W | D | H` directly above
a real numeric example: BED = `1830 | 400 | 1980` (title cell "BED (1830X400X1980)"); BED 2 =
`1067 | 400 | 2033`. Tracing the `LEFT+RIGHT SIDE height = D2 − 100 − 18` formula against both:

| Sheet | `H` value | `LEFT+RIGHT SIDE height` per formula | Only consistent with |
|---|---|---|---|
| BED (1830×400×1980) | 1980 | `1980 − 100 − 18 = 1862` | sheet `H` = mattress length |
| BED 2 (1067×400×2033) | 2033 | `2033 − 100 − 18 = 1915` | sheet `H` = mattress length |

If sheet `H` instead meant frame height (~400mm, as originally implemented), the formula would
evaluate to a negative number in both examples — proof by contradiction that the original mapping
(this app's `H` field ← sheet `H`, this app's `D` field ← sheet `D`) was wrong. The corrected
mapping — this app's `H` field ← sheet `D`, this app's `L` field ← sheet `H` — was verified live
against the running engine on 29 Aug 2026 at `W=1800, L=2000, H=450, thk=18, headboardH=1200`:

| Component | Formula | Calculation | Engine result |
|---|---|---|---|
| BACK PANAL+FRNT width | `H` (Frame Height) | `450` | 450 |
| LEFT+RIGHT SIDE (400) width | `H` (Frame Height) | `450` | 450 |
| LEFT+RIGHT SIDE (400) height | `L − BED_H_CLR1(100) − BED_H_CLR2(18)` | `2000 − 118` | 1882 |
| FRNT height | `W − BED_W_CLR1(200)` | `1800 − 200` | 1600 |
| TOP height | `L / 2` | `2000 / 2` | 1000 |
| TOP PATTI (×2) height | `L` | `2000` | 2000 |

All six confirmed exact-match against the PDF's component table and the Drawing Inspector's
per-component formula display (see `src/products/bed/bedFormulas.ts` header comment for the full
before/after derivation).

## What "Formula Verified ✓" is allowed to mean in this app

A product may show "Formula Verified ✓" only when every one of its resolved components' formulas
comes from a LIVE `CALC_*` sheet (§ `PRODUCT_STANDARDS.md`). A product using this app's existing,
real-but-unverified geometry (TV Unit, Kitchen, Dining Table, etc.) must show "Formula Not
Verified — pending real order data" instead. This is enforced in `validationEngine.ts` by reading
each design definition's declared formula source, not toggled by hand per product.
