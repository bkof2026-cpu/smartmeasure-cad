import { CLEARANCE_MASTER } from '../../engine/constants';
import type { ComponentSource } from '../../engine/types';

// ─────────────────────────────────────────────────────────────────────────────
// Real, verified BOX cutlist — CALC_BOX in Cutlist_Engine_NEW_SHEETS_ONLY.xlsx.
// This is the shared engine for Loft Box / Cabinet Box / Storage Box / Open
// Box / Service Box (see docs/PRODUCT_STANDARDS.md "BOX family") — the
// user's own catalog "Loft Cabinet" product is this family. Verified exactly
// against 2 real historical orders (see docs/FORMULA_TRACEABILITY.md).
// ─────────────────────────────────────────────────────────────────────────────

export interface BoxInputs {
  W: number; H: number; D: number; thk: number;
  verticalQty: number; shelfQty: number; includeBack: boolean; includeDoor: boolean;
}

export interface BoxCutRow {
  id: string;
  type: string;
  label: string;
  cutWidth: number;
  cutHeight: number;
  qty: number;
  source: ComponentSource;
}

const C = CLEARANCE_MASTER;

export function computeBoxCutlist(inp: BoxInputs): BoxCutRow[] {
  const { W, H, D, verticalQty, shelfQty, includeBack, includeDoor } = inp;
  const rows: BoxCutRow[] = [];

  rows.push({ id: 'TOP', type: 'TOP_PANEL', label: 'Top', cutWidth: W - C.BOX_TB_DEDUCT, cutHeight: D, qty: 1, source: { formula: `Width = W - BOX_TB_DEDUCT(${C.BOX_TB_DEDUCT}) | Height = D`, constants: ['BOX_TB_DEDUCT'] } });
  rows.push({ id: 'BOTTOM', type: 'BOTTOM_PANEL', label: 'Bottom', cutWidth: W - C.BOX_TB_DEDUCT, cutHeight: D, qty: 1, source: { formula: `Width = W - BOX_TB_DEDUCT(${C.BOX_TB_DEDUCT}) | Height = D`, constants: ['BOX_TB_DEDUCT'] } });
  rows.push({ id: 'LHS', type: 'SIDE_PANEL', label: 'Left Side (LHS)', cutWidth: D, cutHeight: H, qty: 1, source: { formula: 'Width = D | Height = H', constants: [] } });
  rows.push({ id: 'RHS', type: 'SIDE_PANEL', label: 'Right Side (RHS)', cutWidth: D, cutHeight: H, qty: 1, source: { formula: 'Width = D | Height = H', constants: [] } });

  if (includeBack) {
    rows.push({ id: 'BACK', type: 'BACK_PANEL', label: 'Back (9mm)', cutWidth: W - C.BOX_BACK_WH_DEDUCT, cutHeight: H - C.BOX_BACK_WH_DEDUCT, qty: 1, source: { formula: `Width = W - BOX_BACK_WH_DEDUCT(${C.BOX_BACK_WH_DEDUCT}) | Height = H - BOX_BACK_WH_DEDUCT(${C.BOX_BACK_WH_DEDUCT})`, constants: ['BOX_BACK_WH_DEDUCT'] } });
  }
  if (verticalQty > 0) {
    rows.push({ id: 'VERTICAL', type: 'VERTICAL_PARTITION', label: 'Vertical', cutWidth: D - C.BOX_VERT_D_DEDUCT, cutHeight: H - C.BOX_VERT_H_DEDUCT, qty: verticalQty, source: { formula: `Width = D - BOX_VERT_D_DEDUCT(${C.BOX_VERT_D_DEDUCT}) | Height = H - BOX_VERT_H_DEDUCT(${C.BOX_VERT_H_DEDUCT})`, constants: ['BOX_VERT_D_DEDUCT', 'BOX_VERT_H_DEDUCT'] } });
  }
  if (shelfQty > 0) {
    rows.push({ id: 'SHELF', type: 'SHELF', label: 'Shelf', cutWidth: W - C.BOX_TB_DEDUCT, cutHeight: D - C.BOX_VERT_D_DEDUCT, qty: shelfQty, source: { formula: `Width = W - BOX_TB_DEDUCT(${C.BOX_TB_DEDUCT}) | Height = D - BOX_VERT_D_DEDUCT(${C.BOX_VERT_D_DEDUCT})`, constants: ['BOX_TB_DEDUCT', 'BOX_VERT_D_DEDUCT'], needsVerification: true, note: 'Same pattern as TOP/BOTTOM — no historical Shelf order available to cross-check yet.' } });
  }
  if (includeDoor) {
    const compartments = Math.max(1, verticalQty + 1);
    rows.push({ id: 'DOOR', type: 'DOOR', label: 'Door', cutWidth: (W - 5) / compartments, cutHeight: H - 5, qty: compartments, source: { formula: 'NOT formula-driven in verified source data — confirmed manual in every historical order (each used a different door width). Shown here at an even compartment split for the drawing only.', constants: [], needsVerification: true, note: 'Enter the real door size from the client cutting slip before fabrication.' } });
  }

  return rows;
}
