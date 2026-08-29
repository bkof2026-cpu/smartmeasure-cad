# Product Standards

Authoritative source: `C:\Users\HP\Downloads\Cutlist_Engine_NEW_SHEETS_ONLY.xlsx`, cross-checked
by the user against real completed historical orders (see that workbook's own `VALIDATION` tab).
Cross-referenced against `C:\Users\HP\Downloads\FORMULA.xlsx` (the original per-product template
workbook it was verified from). **Every constant and formula below is copied from those sheets,
not invented.** Where the source data itself is ambiguous or flags a caveat, that is stated
explicitly rather than resolved by guessing — see "Open questions" at the end of each family.

All dimensions in mm. `W` / `H` / `D` below are the three fields entered on the MASTER sheet —
**their real-world meaning (which physical axis each represents) is reused loosely across
product families in the source workbook and is not always the same axis** — see per-family notes.

## Constants (`CLEARANCE_MASTER`)

| Constant | Value | Used in | Used for |
|---|---|---|---|
| `BOARD_18` | 18 | ALL | Standard board thickness |
| `BOARD_9` | 9 | BOX / WARDROBE | Thin back-panel board |
| `BOX_TB_DEDUCT` | 36 | BOX | TOP & BOTTOM width = W − this |
| `BOX_BACK_WH_DEDUCT` | 20 | BOX | BACK width/height = W/H − this |
| `BOX_VERT_H_DEDUCT` | 36 | BOX | VERTICAL height = H − this |
| `BOX_VERT_D_DEDUCT` | 30 | BOX | VERTICAL depth = D − this |
| `WARD_TB_DEDUCT` | 36 | WARDROBE | TOP/BOTTOM/SKIRTING width = W − this |
| `WARD_VERT_H_DEDUCT` | 106 | WARDROBE | VERTICAL height = H − this |
| `WARD_OPEN_VERT_D_DEDUCT` | 30 | Openable Wardrobe | VERTICAL depth = D − this |
| `WARD_SLIDE_VERT_D_DEDUCT` | 120 | Sliding Wardrobe | VERTICAL depth = D − this |
| `WARD_SELF_W_DEDUCT` | 54 | WARDROBE | SELF TOP height = (W − this) / 2 |
| `WARD_SMALLSELF_H_DEDUCT` | 18 | WARDROBE | SMALL SELF height = ([SELF TOP]−this)/2 |
| `WARD_OPEN_DEPTH_A` | 80 | Openable Wardrobe | SELF TOP/SMALL SELF/SMALL VERTICAL/CHANNEL PATTA depth = D − this |
| `WARD_OPEN_DEPTH_B` | 110 | Openable Wardrobe | CENTER VERTICAL/DRAWER LHS/RHS depth = D − this |
| `WARD_SLIDE_DEPTH_A` | 120 | Sliding Wardrobe | SELF TOP/SMALL SELF/SMALL VERTICAL depth = D − this |
| `WARD_SLIDE_DEPTH_B` | 150 | Sliding Wardrobe | CENTER VERTICAL/DRAWER LHS/RHS depth = D − this |
| `WARD_DR_OFFSET` | 61 | WARDROBE | DR FRNT/BACK width = ([SELF TOP]−90)/2 − this |
| `WARD_BACKPANEL_H_DEDUCT` | 90 | WARDROBE | BACK PANAL width = H − this |
| `WARD_BACKPANEL_W_DEDUCT` | 20 | WARDROBE | BACK PANAL height = (W − this) / 2 |
| `WARD_OPEN_DOOR_W_DEDUCT` | 6 | Openable Wardrobe | DOOR width = (W − this) / DoorQty — **VERIFY**: source qty column showed 2, formula divides by 4 |
| `WARD_OPEN_DOOR_H_DEDUCT` | 134 | Openable Wardrobe | DOOR height = H − this |
| `WARD_SLIDE_DOOR_H_DEDUCT` | 136 | Sliding Wardrobe | DOOR height = H − this |
| `BED_W_CLR1` | 200 | BED | BACK PANAL+FRNT / FRNT height = W − this |
| `BED_W_CLR2` | 72 | BED | BACK PANAL+FRNT height = W − CLR1 − this |
| `BED_H_CLR1` | 100 | BED | LEFT+RIGHT SIDE height = H − this − CLR2 |
| `BED_H_CLR2` | 18 | BED | LEFT+RIGHT SIDE height = H − CLR1 − this |
| `BED_BOTTOM_H_DEDUCT` | 36 | BED | BOTTAM height = ([L/R SIDE 400 height] − this) / 2 |
| `SIDE_TBL_BOT_D_DEDUCT` | 30 | SIDE TABLE | BOTTOM/LHS/RHS width = D − this |
| `SIDE_TBL_BOT_W_DEDUCT` | 36 | SIDE TABLE | BOTTOM height = W − this / LHS,RHS height = H − this |
| `SIDE_TBL_DRAWER_W_DEDUCT` | 97 | SIDE TABLE | DRAWER BACK/FRNT SIDE width = W − this |
| `SIDE_TBL_FACIA_H_DEDUCT` | 110 | SIDE TABLE | DRAWER FACIA height = (H − this) / 2 |

## Family status (`FORMULA_MASTER`)

| Family | Status | Calc sheet |
|---|---|---|
| Loft Box / Cabinet Box / Storage Box / Open Box / Service Box | **LIVE** | `CALC_BOX` |
| Bed | **LIVE** | `CALC_BED` |
| Side Table | **LIVE** | `CALC_SIDE_TABLE` |
| Openable Wardrobe | **LIVE** | `CALC_OPEN_WARDROBE` |
| Sliding Wardrobe | **LIVE** | `CALC_SLIDE_WARDROBE` |
| Kitchen, Dressing, Study Table, Dining Table, TV Unit, Rolling Shutter Box, Kadappa Rack | **PENDING** — not enough consistent historical orders yet | none |

## BOX family (Loft Box / Cabinet Box / Storage Box / Open Box / Service Box)

Inputs: `W`, `H`, `D` (overall width/height/depth of the box carcass).

| Component | Width | Height | Qty | Notes |
|---|---|---|---|---|
| TOP | `W − BOX_TB_DEDUCT` | `D` | 1 | |
| BOTTOM | `W − BOX_TB_DEDUCT` | `D` | 1 | |
| LEFT_SIDE (LHS) | `D` | `H` | 1 | |
| RIGHT_SIDE (RHS) | `D` | `H` | 1 | |
| BACK (9mm) | `W − BOX_BACK_WH_DEDUCT` | `H − BOX_BACK_WH_DEDUCT` | 1 | qty 0 if Back Panel = No |
| VERTICAL | `D − BOX_VERT_D_DEDUCT` | `H − BOX_VERT_H_DEDUCT` | Vertical Qty | |
| SHELF | `W − BOX_TB_DEDUCT` | `D − BOX_VERT_D_DEDUCT` | Shelf Qty | not cross-checked against a real Shelf order yet — flag as unverified pattern |
| DOOR | — | — | Door Qty | **not formula-driven** — confirmed manual in every historical order; enter per order |

Verified exactly against 2 real historical orders (client TAMBARAM PATEL, W2295×H615×D400 and
W780×H615×D400) — see `FORMULA_TRACEABILITY.md`.

## BED

Inputs (sheet-native names): `W`, `D`, `H`. **Axis mapping is now definitively resolved** —
re-derived directly from `FORMULA.xlsx` sheets "BED" and "BED 2", which both carry an explicit
header row `W | D | H` directly above a real numeric example (BED: `1830 | 400 | 1980`, title cell
literally "BED (1830X400X1980)"; BED 2: `1067 | 400 | 2033`, cross-validated independently).
Tracing every formula against both examples confirms:

- sheet `W` = overall / mattress **width** → this app's `W` field (unchanged)
- sheet `D` = **frame/box height** (~400mm) → this app's `H` field ("Frame Height")
- sheet `H` = **mattress length** (~1980–2033mm) → this app's `L` field ("Overall Length")

e.g. `LEFT+RIGHT SIDE height = D2−100−18` evaluates to 1862 in the BED example (1980−118) and 1915
in BED 2 (2033−118) — only consistent with sheet `H` meaning mattress length, not frame height.
This also resolves the workbook's own README caveat ("Bed: Depth is never used in any Bed
formula") — correct as stated: this app's own dedicated `D` / "Side Panel Depth" field has no
matching parameter in the verified 3-input sheet at all, and is intentionally unused by every
formula below.

| Component | Width (sheet formula) | Height (sheet formula) | Qty | Notes |
|---|---|---|---|---|
| HEAD BOARD 36MM | 900 (fixed) | `W` | 1 | only if Headboard = Yes |
| BACK PANAL + FRNT | `D` → app `H` (Frame Height) | `W − BED_W_CLR1 − BED_W_CLR2` | 2 | |
| LEFT+RIGHT SIDE (400) | `D` → app `H` (Frame Height) | `H` → app `L` (Mattress Length) `− BED_H_CLR1 − BED_H_CLR2` | 2 | |
| LEFT+RIGHT SIDE (330) | 330 (fixed) | `H` → app `L` (Mattress Length) `− BED_H_CLR1 − BED_H_CLR2` | 2 | |
| FRNT | 330 (fixed) | `W − BED_W_CLR1` | 1 | |
| TOP | `W` | `H` → app `L` (Mattress Length) `/ 2` | 2 | |
| BOTTAM | `[BACK PANAL+FRNT height]` | `([L/R SIDE 400 height] − BED_BOTTOM_H_DEDUCT) / 2` | 2 | |
| TOP PATTI | 50 (fixed) | `W` | 1 | |
| TOP PATTI | 50 (fixed) | `H` → app `L` (Mattress Length) | 2 | |
| H PANAL SELF | 250×750 (fixed) | | 2 | **not derived from W/H/D** in source data |
| H PANAL SELF | 200×1000 (fixed) | | 2 | **not derived from W/H/D** in source data |
| HYDRAULIC MECHANISM | — | — | 0/1 flag | hardware only, adds no cut panel |

Side table(s) attached to a bed use the **Side Table** family's own component set, positioned as
a zone beside the headboard end — entered historically as a separate order line, not folded into
Bed's cutlist.

Implemented in `src/products/bed/bedFormulas.ts` (`computeBedCutlist`), with every drawn front-
elevation component (side panel thickness, top patti, foot rail) and plan-view component
(Platform A/B) individually dimensioned on-screen and in the PDF — not just listed in the
component table. Resolved 29 Aug 2026; previously shipped with `D`↔`H` swapped (flagged
`needsVerification` at the time) — see `FORMULA_TRACEABILITY.md` for the full before/after proof.

## SIDE TABLE

Inputs: `W`, `H`, `D`.

| Component | Width | Height | Qty | Notes |
|---|---|---|---|---|
| TOP | `D` | `W` | 2 | |
| BOTTOM | `D − SIDE_TBL_BOT_D_DEDUCT` | `W − SIDE_TBL_BOT_W_DEDUCT` | 2 | |
| LHS | `D − SIDE_TBL_BOT_D_DEDUCT` | `H − SIDE_TBL_BOT_W_DEDUCT` | 2 | |
| RHS | `D − SIDE_TBL_BOT_D_DEDUCT` | `H − SIDE_TBL_BOT_W_DEDUCT` | 2 | |
| BACK PANAL | 440×420 (fixed) | | 2 | only if Back Panel = Yes; not tied to W/H/D |
| DRAWER CHANNEL | 420×120 (fixed) | | 8 | only if Drawer = Yes, ×4 per drawer |
| DRAWER BACK SIDE | `W − SIDE_TBL_DRAWER_W_DEDUCT` | 120 (fixed) | 4 | only if Drawer = Yes |
| DRAWER FRNT SIDE | `W − SIDE_TBL_DRAWER_W_DEDUCT` | 70 (fixed) | 4 | only if Drawer = Yes |
| DRAWER BACK | 380 (fixed) | `[DRAWER CHANNEL width] − 20` | 4 | only if Drawer = Yes |
| DRAWER FACIA | 424 (fixed) | `(H − SIDE_TBL_FACIA_H_DEDUCT) / 2` | 4 | only if Drawer = Yes |
| SCRETING (Skirting) | 70×400 (fixed) | | 4 | only if Skirting = Yes |

## OPENABLE WARDROBE

Inputs: `W`, `H`, `D`, Door Qty (default 4).

| Component | Width | Height | Qty |
|---|---|---|---|
| TOP | `W − WARD_TB_DEDUCT` | `D` | 1 |
| BOTTOM | `W − WARD_TB_DEDUCT` | `D` | 1 |
| SIDE LHS | `D` | `H` | 1 |
| SIDE RHS | `D` | `H` | 1 |
| VERTICAL | `D − WARD_OPEN_VERT_D_DEDUCT` | `H − WARD_VERT_H_DEDUCT` | Vertical Qty |
| SELF TOP | `D − WARD_OPEN_DEPTH_A` | `(W − WARD_SELF_W_DEDUCT) / 2` | Shelf Qty ×4 |
| SMALL SELF | `D − WARD_OPEN_DEPTH_A` | `([SELF TOP height] − WARD_SMALLSELF_H_DEDUCT) / 2` | 2 |
| SMALL VERTICAL | `D − WARD_OPEN_DEPTH_A` | 1100 (fixed) | 1 |
| CHANNEL PATTA | `D − WARD_OPEN_DEPTH_A` | 150 (fixed) | 8 |
| CENTER VERTICAL | `D − WARD_OPEN_DEPTH_B` | 150 (fixed) | 2 |
| DRAWER LHS | `D − WARD_OPEN_DEPTH_B` | 120 (fixed) | Drawer Qty ×4 |
| DRAWER RHS | `D − WARD_OPEN_DEPTH_B` | 120 (fixed) | Drawer Qty ×4 |
| DR FRNT | `([SELF TOP height]−90)/2 − WARD_DR_OFFSET` | 70 (fixed) | 4 |
| BACK | `([SELF TOP height]−90)/2 − WARD_DR_OFFSET` | 120 (fixed) | 4 |
| DR FACIA | `([SELF TOP height]−80)/2` | 148 (fixed) | 4 |
| WARDROBE SCRTING | `W − WARD_TB_DEDUCT` | 70 (fixed) | 2 |
| WARDROBE BACK PANAL | `H − WARD_BACKPANEL_H_DEDUCT` | `(W − WARD_BACKPANEL_W_DEDUCT) / 2` | 2 |
| DR BACK PANAL | `[DRAWER RHS width] − 20` | `[DR FRNT width] + 20` | 4 |
| WARDROBE DOOR | `(W − WARD_OPEN_DOOR_W_DEDUCT) / DoorQty` | `H − WARD_OPEN_DOOR_H_DEDUCT` | Door Qty |

**Open question**: door quantity default is 4 in the formula but historical order QTY column
showed 2 — must be confirmed with the shop floor before treating door count as settled.

## SLIDING WARDROBE

Same skeleton as Openable, with sliding-specific deductions (`WARD_SLIDE_DEPTH_A/B`,
`WARD_SLIDE_VERT_D_DEDUCT`, `WARD_SLIDE_DOOR_H_DEDUCT`) and:

| Component | Width | Height | Qty |
|---|---|---|---|
| BORDER PATTI | 2400×35 (fixed) | | 4 | edge-trim strip, not scaled with size |
| WARDROBE DOOR | `W / 2` | `H − WARD_SLIDE_DOOR_H_DEDUCT` | 2 | 2 sliding doors, each half the wardrobe width |

All other components (TOP/BOTTOM/SIDE/VERTICAL/SELF TOP/SMALL SELF/SMALL VERTICAL/CHANNEL
PATTA/CENTER VERTICAL/DRAWER LHS,RHS/DR FRNT,BACK,FACIA/SCRTING/BACK PANAL/DR BACK PANAL) follow
the same formulas as Openable, substituting the sliding-specific depth constants.

## Products with no verified formula (PENDING)

Kitchen, TV Unit, Dining Table, Dressing, Study Table, Rolling Shutter Box, Kadappa Rack. This
app's *existing* geometry code for these (already real, mm-driven, not random) continues to be
used, but their "Formula Verified" badge must read **"Not Verified — pending real order data"**,
not a green checkmark, per the golden rule of not inventing standards. Kitchen's existing
`src/rules/defaultConfig.ts` explicitly self-labels every constant "DEMO VALUE... do NOT treat as
actual company standards" — this app already agrees with that classification.
