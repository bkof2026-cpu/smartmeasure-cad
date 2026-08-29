import { CLEARANCE_MASTER } from '../../engine/constants';
import type { ComponentSource } from '../../engine/types';

// ─────────────────────────────────────────────────────────────────────────────
// Real, verified Bed cutlist — copied from Cutlist_Engine_NEW_SHEETS_ONLY.xlsx
// sheet CALC_BED (see docs/PRODUCT_STANDARDS.md "BED"). Every width/height
// below is exactly that sheet's documented formula, evaluated against this
// session's real measurements — never a hand-typed or approximated number.
//
// MAPPING DECISION (the source sheet reuses generic W/H/D column names across
// every product family, and Bed's own README flags an internal
// inconsistency — see docs/PRODUCT_STANDARDS.md "Open questions"):
//   CALC_BED "W" -> this app's W (overall / mattress width) — anchored by
//     HEAD BOARD height = W, and a headboard's installed span is the bed's width.
//   CALC_BED "H" -> this app's H (frame / box height) — anchored by
//     LEFT+RIGHT SIDE height = H - clearances, a side rail's vertical height.
//   CALC_BED "D" -> this app's D (Side Panel Depth field, literal name match)
//     — used only by BACK PANAL+FRNT. Flagged for shop-floor confirmation.
// Mattress LENGTH (this app's "L") is not an input to any verified CALC_BED
// formula — it is used only to draw the real mattress footprint in Plan/Side
// views, which needs no formula (it's just the mattress's own stated size).
// ─────────────────────────────────────────────────────────────────────────────

export interface BedInputs {
  W: number; // overall / mattress width
  L: number; // mattress length (not a CALC_BED formula input — see note above)
  H: number; // frame/box height
  D: number; // "Side Panel Depth" field — the one formula that reads CALC_BED's D
  headboardH: number; // this app keeps headboard height user-adjustable — see docs
  thk: number;
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
  source: ComponentSource;
}

const C = CLEARANCE_MASTER;

export function computeBedCutlist(inp: BedInputs): BedCutRow[] {
  const { W, H, D, headboardH, includeHeadboard, includeHydraulic } = inp;
  const rows: BedCutRow[] = [];

  if (includeHeadboard) {
    rows.push({
      id: 'HEAD_BOARD', type: 'HEAD_BOARD', label: 'Head Board 36mm', cutWidth: 900, cutHeight: W, qty: 1,
      source: { formula: 'Width = 900 (fixed) | Height = W', constants: [], fixed: true, note: 'Cut width fixed in verified source data.' },
    });
  }
  const backFront = W - C.BED_W_CLR1 - C.BED_W_CLR2;
  rows.push({
    id: 'BACK_PANEL_FRONT', type: 'BACK_PANEL_FRONT', label: 'Back Panel + Front', cutWidth: D, cutHeight: backFront, qty: 2,
    source: { formula: `Width = D | Height = W - BED_W_CLR1(${C.BED_W_CLR1}) - BED_W_CLR2(${C.BED_W_CLR2})`, constants: ['BED_W_CLR1', 'BED_W_CLR2'], needsVerification: true, note: 'D-mapping flagged in docs/PRODUCT_STANDARDS.md — confirm with shop floor.' },
  });
  const sideH = H - C.BED_H_CLR1 - C.BED_H_CLR2;
  rows.push({
    id: 'SIDE_400', type: 'SIDE_PANEL', label: 'Left+Right Side (400)', cutWidth: D, cutHeight: sideH, qty: 2,
    source: { formula: `Width = D | Height = H - BED_H_CLR1(${C.BED_H_CLR1}) - BED_H_CLR2(${C.BED_H_CLR2})`, constants: ['BED_H_CLR1', 'BED_H_CLR2'] },
  });
  rows.push({
    id: 'SIDE_330', type: 'SIDE_PANEL', label: 'Left+Right Side (330)', cutWidth: 330, cutHeight: sideH, qty: 2,
    source: { formula: `Width = 330 (fixed) | Height = H - BED_H_CLR1 - BED_H_CLR2`, constants: ['BED_H_CLR1', 'BED_H_CLR2'], fixed: true },
  });
  rows.push({
    id: 'FRNT', type: 'FOOT_RAIL', label: 'Front (Foot Rail)', cutWidth: 330, cutHeight: W - C.BED_W_CLR1, qty: 1,
    source: { formula: `Width = 330 (fixed) | Height = W - BED_W_CLR1(${C.BED_W_CLR1})`, constants: ['BED_W_CLR1'], fixed: true },
  });
  rows.push({
    id: 'TOP', type: 'PLATFORM_TOP', label: 'Top (Platform)', cutWidth: W, cutHeight: H / 2, qty: 2,
    source: { formula: 'Width = W | Height = H / 2', constants: [] },
  });
  rows.push({
    id: 'BOTTOM', type: 'PLATFORM_BOTTOM', label: 'Bottom', cutWidth: backFront, cutHeight: (sideH - C.BED_BOTTOM_H_DEDUCT) / 2, qty: 2,
    source: { formula: `Width = [BACK PANAL+FRNT height] | Height = ([SIDE 400 height] - BED_BOTTOM_H_DEDUCT(${C.BED_BOTTOM_H_DEDUCT})) / 2`, constants: ['BED_BOTTOM_H_DEDUCT'] },
  });
  rows.push({
    id: 'PATTI_W', type: 'TRIM_PATTI', label: 'Top Patti', cutWidth: 50, cutHeight: W, qty: 1,
    source: { formula: 'Width = 50 (fixed) | Height = W', constants: [], fixed: true },
  });
  rows.push({
    id: 'PATTI_H', type: 'TRIM_PATTI', label: 'Top Patti', cutWidth: 50, cutHeight: H, qty: 2,
    source: { formula: 'Width = 50 (fixed) | Height = H', constants: [], fixed: true },
  });
  rows.push({
    id: 'H_SELF_A', type: 'SHELF', label: 'H Panal Self', cutWidth: 250, cutHeight: 750, qty: 2,
    source: { formula: 'Fixed 250 x 750 — not derived from W/H/D in source data', constants: [], fixed: true, needsVerification: true, note: 'Confirm if this should scale with bed size.' },
  });
  rows.push({
    id: 'H_SELF_B', type: 'SHELF', label: 'H Panal Self', cutWidth: 200, cutHeight: 1000, qty: 2,
    source: { formula: 'Fixed 200 x 1000 — not derived from W/H/D in source data', constants: [], fixed: true, needsVerification: true, note: 'Confirm if this should scale with bed size.' },
  });
  if (includeHydraulic) {
    rows.push({
      id: 'HYDRAULIC', type: 'HARDWARE', label: 'Hydraulic Mechanism', cutWidth: 0, cutHeight: 0, qty: 1,
      source: { formula: 'Bought-out hardware fitting — adds no cut panel', constants: [], fixed: true, note: 'BOM/hardware flag only.' },
    });
  }
  void headboardH;
  return rows;
}
