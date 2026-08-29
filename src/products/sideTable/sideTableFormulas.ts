import { CLEARANCE_MASTER } from '../../engine/constants';
import type { ComponentSource } from '../../engine/types';

// ─────────────────────────────────────────────────────────────────────────────
// Real, verified Side Table cutlist — CALC_SIDE_TABLE in
// Cutlist_Engine_NEW_SHEETS_ONLY.xlsx. See docs/PRODUCT_STANDARDS.md.
// W = width, D = depth, H = height (unambiguous for this family).
// ─────────────────────────────────────────────────────────────────────────────

export interface SideTableInputs {
  W: number;
  D: number;
  H: number;
  drawers: number; // 0 = no drawer option
  includeBackPanel: boolean;
  includeSkirting: boolean;
}

export interface SideTableCutRow {
  id: string;
  type: string;
  label: string;
  cutWidth: number;
  cutHeight: number;
  qty: number;
  source: ComponentSource;
}

const C = CLEARANCE_MASTER;

export function computeSideTableCutlist(inp: SideTableInputs): SideTableCutRow[] {
  const { W, D, H, drawers, includeBackPanel, includeSkirting } = inp;
  const rows: SideTableCutRow[] = [];

  rows.push({ id: 'TOP', type: 'TOP', label: 'Top', cutWidth: D, cutHeight: W, qty: 2, source: { formula: 'Width = D | Height = W', constants: [] } });
  rows.push({ id: 'BOTTOM', type: 'BOTTOM', label: 'Bottom', cutWidth: D - C.SIDE_TBL_BOT_D_DEDUCT, cutHeight: W - C.SIDE_TBL_BOT_W_DEDUCT, qty: 2, source: { formula: `Width = D - SIDE_TBL_BOT_D_DEDUCT(${C.SIDE_TBL_BOT_D_DEDUCT}) | Height = W - SIDE_TBL_BOT_W_DEDUCT(${C.SIDE_TBL_BOT_W_DEDUCT})`, constants: ['SIDE_TBL_BOT_D_DEDUCT', 'SIDE_TBL_BOT_W_DEDUCT'] } });
  rows.push({ id: 'LHS', type: 'SIDE_PANEL', label: 'LHS', cutWidth: D - C.SIDE_TBL_BOT_D_DEDUCT, cutHeight: H - C.SIDE_TBL_BOT_W_DEDUCT, qty: 2, source: { formula: `Width = D - SIDE_TBL_BOT_D_DEDUCT | Height = H - SIDE_TBL_BOT_W_DEDUCT`, constants: ['SIDE_TBL_BOT_D_DEDUCT', 'SIDE_TBL_BOT_W_DEDUCT'] } });
  rows.push({ id: 'RHS', type: 'SIDE_PANEL', label: 'RHS', cutWidth: D - C.SIDE_TBL_BOT_D_DEDUCT, cutHeight: H - C.SIDE_TBL_BOT_W_DEDUCT, qty: 2, source: { formula: `Width = D - SIDE_TBL_BOT_D_DEDUCT | Height = H - SIDE_TBL_BOT_W_DEDUCT`, constants: ['SIDE_TBL_BOT_D_DEDUCT', 'SIDE_TBL_BOT_W_DEDUCT'] } });
  if (includeBackPanel) {
    rows.push({ id: 'BACK', type: 'BACK_PANEL', label: 'Back Panal', cutWidth: 440, cutHeight: 420, qty: 2, source: { formula: 'Fixed 440 x 420 — not tied to W/H/D', constants: [], fixed: true, needsVerification: true } });
  }
  if (drawers > 0) {
    rows.push({ id: 'DRAWER_CHANNEL', type: 'DRAWER_CHANNEL', label: 'Drawer Channel', cutWidth: 420, cutHeight: 120, qty: 4 * drawers, source: { formula: 'Fixed drawer-slide channel size', constants: [], fixed: true } });
    rows.push({ id: 'DRAWER_BACK_SIDE', type: 'DRAWER_SIDE', label: 'Drawer Back Side', cutWidth: W - C.SIDE_TBL_DRAWER_W_DEDUCT, cutHeight: 120, qty: 2 * drawers, source: { formula: `Width = W - SIDE_TBL_DRAWER_W_DEDUCT(${C.SIDE_TBL_DRAWER_W_DEDUCT}) | Height = 120 (fixed)`, constants: ['SIDE_TBL_DRAWER_W_DEDUCT'] } });
    rows.push({ id: 'DRAWER_FRNT_SIDE', type: 'DRAWER_SIDE', label: 'Drawer Frnt Side', cutWidth: W - C.SIDE_TBL_DRAWER_W_DEDUCT, cutHeight: 70, qty: 2 * drawers, source: { formula: `Width = W - SIDE_TBL_DRAWER_W_DEDUCT | Height = 70 (fixed)`, constants: ['SIDE_TBL_DRAWER_W_DEDUCT'] } });
    rows.push({ id: 'DRAWER_BACK', type: 'DRAWER_BACK', label: 'Drawer Back', cutWidth: 380, cutHeight: 400, qty: 2 * drawers, source: { formula: 'Width = 380 (fixed) | Height = [Drawer Channel width] - 20', constants: [], fixed: true } });
    rows.push({ id: 'DRAWER_FACIA', type: 'DRAWER_FRONT', label: 'Drawer Facia', cutWidth: 424, cutHeight: (H - C.SIDE_TBL_FACIA_H_DEDUCT) / 2, qty: 2 * drawers, source: { formula: `Width = 424 (fixed) | Height = (H - SIDE_TBL_FACIA_H_DEDUCT(${C.SIDE_TBL_FACIA_H_DEDUCT})) / 2`, constants: ['SIDE_TBL_FACIA_H_DEDUCT'] } });
  }
  if (includeSkirting) {
    rows.push({ id: 'SKIRTING', type: 'SKIRTING', label: 'Screting (Skirting)', cutWidth: 70, cutHeight: 400, qty: 4, source: { formula: 'Fixed 70 x 400 skirting strip', constants: [], fixed: true } });
  }
  return rows;
}
