import { CLEARANCE_MASTER } from '../../engine/constants';
import type { ComponentSource } from '../../engine/types';

// ─────────────────────────────────────────────────────────────────────────────
// Real, verified Bed cutlist — copied from Cutlist_Engine_NEW_SHEETS_ONLY.xlsx
// sheet CALC_BED (see docs/PRODUCT_STANDARDS.md "BED"). Every width/height
// below is exactly that sheet's documented formula, evaluated against this
// session's real measurements — never a hand-typed or approximated number.
//
// AXIS MAPPING — now definitively resolved (previously flagged as an open
// question; re-derived directly from the ORIGINAL source workbook
// FORMULA.xlsx, sheets "BED" and "BED 2", which is what CALC_BED was
// generalized from):
//
//   Both source sheets have an explicit header row "W | D | H" directly
//   above the real example values (BED: 1830 | 400 | 1980 — title cell
//   literally reads "BED (1830X400X1980)"; BED 2: 1067 | 400 | 2033).
//   Tracing every formula against both examples independently confirms:
//     sheet "W" = overall / mattress WIDTH        -> this app's W (unchanged)
//     sheet "D" = FRAME HEIGHT (~400mm)            -> this app's H (Frame Height)
//     sheet "H" = MATTRESS LENGTH (~1980-2033mm)   -> this app's L (Overall Length)
//   e.g. LEFT+RIGHT SIDE height = "=D2-100-18" evaluates to 1862 in the BED
//   example (1980-118) and 1915 in BED 2 (2033-118) — only consistent with
//   sheet "H" meaning mattress length, not frame height.
//
//   This also resolves the workbook's own README caveat ("Bed: Depth is
//   never used in any Bed formula") — it's correct as stated: this app's own
//   dedicated "D" / Side Panel Depth field has no corresponding parameter in
//   the verified 3-input sheet at all (a rectangular bed frame has no
//   independent depth axis distinct from its length) and is intentionally
//   not read by any formula below.
// ─────────────────────────────────────────────────────────────────────────────

export interface BedInputs {
  W: number; // overall / mattress width
  L: number; // mattress length — this is sheet "H" (verified above)
  H: number; // frame/box height — this is sheet "D" (verified above)
  D: number; // "Side Panel Depth" field — genuinely unused by any verified formula (see mapping note)
  headboardH: number; // this app keeps headboard height user-adjustable — see docs
  thk: number;
  skirtingH: number; // base trim/plinth band height — user-adjustable, see SKIRTING note below
  includeHeadboard: boolean;
  includeHydraulic: boolean;
}

export interface BedCutRow {
  id: string;
  type: string;
  label: string;
  cutWidth: number;
  cutHeight: number;
  qty: number;
  /** Material thickness for this specific panel, mm. Defaults to the bed's
   * general `thk` field everywhere except the Top (Platform) boards, which
   * are cut from thinner 16mm stock — every other panel (sides, headboard,
   * foot rail, patti, skirting) uses the general thickness. */
  thk: number;
  source: ComponentSource;
}

const C = CLEARANCE_MASTER;
const TOP_PLATFORM_THK = 16; // Platform (Top) boards are always cut from 16mm stock, regardless of the general thk field

export function computeBedCutlist(inp: BedInputs): BedCutRow[] {
  const { W, L, H, headboardH, thk, skirtingH, includeHeadboard, includeHydraulic } = inp;
  const rows: BedCutRow[] = [];

  if (includeHeadboard) {
    rows.push({
      id: 'HEAD_BOARD', type: 'HEAD_BOARD', label: 'Head Board 36mm', cutWidth: 900, cutHeight: W, qty: 1, thk,
      source: { formula: 'Width = 900 (fixed) | Height = W', constants: [], fixed: true, note: 'Cut width fixed in verified source data.' },
    });
  }
  const backFront = W - C.BED_W_CLR1 - C.BED_W_CLR2;
  rows.push({
    id: 'BACK_PANEL_FRONT', type: 'BACK_PANEL_FRONT', label: 'Back Panel + Front', cutWidth: H, cutHeight: backFront, qty: 2, thk,
    source: { formula: `Width = H (Frame Height) | Height = W - BED_W_CLR1(${C.BED_W_CLR1}) - BED_W_CLR2(${C.BED_W_CLR2})`, constants: ['BED_W_CLR1', 'BED_W_CLR2'] },
  });
  const sideH = L - C.BED_H_CLR1 - C.BED_H_CLR2;
  rows.push({
    id: 'SIDE_400', type: 'SIDE_PANEL', label: 'Left+Right Side (400)', cutWidth: H, cutHeight: sideH, qty: 2, thk,
    source: { formula: `Width = H (Frame Height) | Height = L (Mattress Length) - BED_H_CLR1(${C.BED_H_CLR1}) - BED_H_CLR2(${C.BED_H_CLR2})`, constants: ['BED_H_CLR1', 'BED_H_CLR2'] },
  });
  rows.push({
    id: 'SIDE_330', type: 'SIDE_PANEL', label: 'Left+Right Side (330)', cutWidth: 330, cutHeight: sideH, qty: 2, thk,
    source: { formula: `Width = 330 (fixed) | Height = L (Mattress Length) - BED_H_CLR1 - BED_H_CLR2`, constants: ['BED_H_CLR1', 'BED_H_CLR2'], fixed: true },
  });
  rows.push({
    id: 'FRNT', type: 'FOOT_RAIL', label: 'Front (Foot Rail)', cutWidth: 330, cutHeight: W - C.BED_W_CLR1, qty: 1, thk,
    source: { formula: `Width = 330 (fixed) | Height = W - BED_W_CLR1(${C.BED_W_CLR1})`, constants: ['BED_W_CLR1'], fixed: true },
  });
  rows.push({
    id: 'TOP', type: 'PLATFORM_TOP', label: 'Top (Platform)', cutWidth: W, cutHeight: L / 2, qty: 2, thk: TOP_PLATFORM_THK,
    source: { formula: 'Width = W | Height = L (Mattress Length) / 2', constants: [], note: `Cut from ${TOP_PLATFORM_THK}mm stock (thinner than the general ${thk}mm carcass thickness).` },
  });
  rows.push({
    id: 'BOTTOM', type: 'PLATFORM_BOTTOM', label: 'Bottom', cutWidth: backFront, cutHeight: (sideH - C.BED_BOTTOM_H_DEDUCT) / 2, qty: 2, thk,
    source: { formula: `Width = [BACK PANAL+FRNT height] | Height = ([SIDE 400 height] - BED_BOTTOM_H_DEDUCT(${C.BED_BOTTOM_H_DEDUCT})) / 2`, constants: ['BED_BOTTOM_H_DEDUCT'] },
  });
  rows.push({
    id: 'PATTI_W', type: 'TRIM_PATTI', label: 'Top Patti', cutWidth: 50, cutHeight: W, qty: 1, thk,
    source: { formula: 'Width = 50 (fixed) | Height = W', constants: [], fixed: true },
  });
  rows.push({
    id: 'PATTI_H', type: 'TRIM_PATTI', label: 'Top Patti', cutWidth: 50, cutHeight: L, qty: 2, thk,
    source: { formula: 'Width = 50 (fixed) | Height = L (Mattress Length)', constants: [], fixed: true },
  });
  rows.push({
    id: 'H_SELF_A', type: 'SHELF', label: 'H Panal Self', cutWidth: 250, cutHeight: 750, qty: 2, thk,
    source: { formula: 'Fixed 250 x 750 — not derived from W/H/D in source data', constants: [], fixed: true, needsVerification: true, note: 'Confirm if this should scale with bed size.' },
  });
  rows.push({
    id: 'H_SELF_B', type: 'SHELF', label: 'H Panal Self', cutWidth: 200, cutHeight: 1000, qty: 2, thk,
    source: { formula: 'Fixed 200 x 1000 — not derived from W/H/D in source data', constants: [], fixed: true, needsVerification: true, note: 'Confirm if this should scale with bed size.' },
  });
  // Skirting (base trim/plinth band) — visible in real assembled beds as a
  // distinct band wrapping the base below the box, not present in the
  // verified CALC_BED sheet (no source formula exists for it), so it's a
  // real, user-adjustable measurement like Headboard Height rather than an
  // invented formula. Two long runs (front/back, along W) + two short runs
  // (sides, along L), each cut with its entered height as the fixed board
  // width, matching the same "cutWidth = fixed = installed height"
  // convention used for the Top Patti and Foot Rail above.
  rows.push({
    id: 'SKIRTING_WLEN', type: 'SKIRTING', label: 'Skirting (Front/Back)', cutWidth: skirtingH, cutHeight: W, qty: 2, thk,
    source: { formula: `Width = Skirting Height (user-entered, ${skirtingH}mm) | Height = W`, constants: [], needsVerification: true, note: 'No verified CALC_BED row for skirting — user-entered per real reference photos, not a source-sheet formula.' },
  });
  rows.push({
    id: 'SKIRTING_LLEN', type: 'SKIRTING', label: 'Skirting (Sides)', cutWidth: skirtingH, cutHeight: L, qty: 2, thk,
    source: { formula: `Width = Skirting Height (user-entered, ${skirtingH}mm) | Height = L (Mattress Length)`, constants: [], needsVerification: true, note: 'No verified CALC_BED row for skirting — user-entered per real reference photos, not a source-sheet formula.' },
  });
  if (includeHydraulic) {
    rows.push({
      id: 'HYDRAULIC', type: 'HARDWARE', label: 'Hydraulic Mechanism', cutWidth: 0, cutHeight: 0, qty: 1, thk: 0,
      source: { formula: 'Bought-out hardware fitting — adds no cut panel', constants: [], fixed: true, note: 'BOM/hardware flag only.' },
    });
  }
  void headboardH;
  return rows;
}
