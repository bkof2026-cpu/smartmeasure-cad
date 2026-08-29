import { CLEARANCE_MASTER } from '../../engine/constants';
import type { ComponentSource } from '../../engine/types';

// ─────────────────────────────────────────────────────────────────────────────
// Real, verified per-zone Wardrobe cutlist — CALC_OPEN_WARDROBE /
// CALC_SLIDE_WARDROBE in Cutlist_Engine_NEW_SHEETS_ONLY.xlsx. See
// docs/PRODUCT_STANDARDS.md "OPENABLE WARDROBE" / "SLIDING WARDROBE".
//
// The verified sheets describe ONE full-width carcass. This app's 25 design
// cards need multiple independent zones (e.g. mixed-storage's left/center/
// right sections, or a niche/drawer-tower/dressing zone beside a standard
// door zone) — each zone is its own real wardrobe-cabinet cross-section, so
// the same verified per-zone formulas below are applied once per zone with
// that zone's own W/H/D. This is applying the verified formula correctly at
// smaller scale, not inventing a new one.
// ─────────────────────────────────────────────────────────────────────────────

export type WardrobeConstruction = 'openable' | 'sliding';

export interface ZoneCutRow {
  id: string;
  type: string;
  label: string;
  cutWidth: number;
  cutHeight: number;
  qty: number;
  source: ComponentSource;
}

export interface ZoneInputs {
  W: number;
  H: number;
  D: number;
  construction: WardrobeConstruction;
  doorCount: number;
  shelves: number;
  drawers: number;
  verticals: number;
  backThk: number;
}

const C = CLEARANCE_MASTER;

export function computeZoneCutlist(z: ZoneInputs): ZoneCutRow[] {
  const { W, H, D, construction, doorCount, shelves, drawers, verticals, backThk } = z;
  const sliding = construction === 'sliding';
  const rows: ZoneCutRow[] = [];

  rows.push({ id: 'TOP', type: 'TOP_PANEL', label: 'Top', cutWidth: W - C.WARD_TB_DEDUCT, cutHeight: D, qty: 1, source: { formula: `Width = W - WARD_TB_DEDUCT(${C.WARD_TB_DEDUCT}) | Height = D`, constants: ['WARD_TB_DEDUCT'] } });
  rows.push({ id: 'BOTTOM', type: 'BOTTOM_PANEL', label: 'Bottom', cutWidth: W - C.WARD_TB_DEDUCT, cutHeight: D, qty: 1, source: { formula: `Width = W - WARD_TB_DEDUCT(${C.WARD_TB_DEDUCT}) | Height = D`, constants: ['WARD_TB_DEDUCT'] } });
  rows.push({ id: 'SIDE_L', type: 'SIDE_PANEL', label: 'Side LHS', cutWidth: D, cutHeight: H, qty: 1, source: { formula: 'Width = D | Height = H', constants: [] } });
  rows.push({ id: 'SIDE_R', type: 'SIDE_PANEL', label: 'Side RHS', cutWidth: D, cutHeight: H, qty: 1, source: { formula: 'Width = D | Height = H', constants: [] } });

  const vertDDeduct = sliding ? C.WARD_SLIDE_VERT_D_DEDUCT : C.WARD_OPEN_VERT_D_DEDUCT;
  if (verticals > 0) {
    rows.push({ id: 'VERTICAL', type: 'VERTICAL_PARTITION', label: 'Vertical', cutWidth: D - vertDDeduct, cutHeight: H - C.WARD_VERT_H_DEDUCT, qty: verticals, source: { formula: `Width = D - ${sliding ? 'WARD_SLIDE_VERT_D_DEDUCT' : 'WARD_OPEN_VERT_D_DEDUCT'}(${vertDDeduct}) | Height = H - WARD_VERT_H_DEDUCT(${C.WARD_VERT_H_DEDUCT})`, constants: [sliding ? 'WARD_SLIDE_VERT_D_DEDUCT' : 'WARD_OPEN_VERT_D_DEDUCT', 'WARD_VERT_H_DEDUCT'] } });
  }

  const depthA = sliding ? C.WARD_SLIDE_DEPTH_A : C.WARD_OPEN_DEPTH_A;
  const selfTopH = (W - C.WARD_SELF_W_DEDUCT) / 2;
  if (shelves > 0) {
    rows.push({ id: 'SELF_TOP', type: 'SHELF', label: 'Self Top', cutWidth: D - depthA, cutHeight: selfTopH, qty: shelves, source: { formula: `Width = D - ${sliding ? 'WARD_SLIDE_DEPTH_A' : 'WARD_OPEN_DEPTH_A'}(${depthA}) | Height = (W - WARD_SELF_W_DEDUCT(${C.WARD_SELF_W_DEDUCT})) / 2`, constants: [sliding ? 'WARD_SLIDE_DEPTH_A' : 'WARD_OPEN_DEPTH_A', 'WARD_SELF_W_DEDUCT'] } });
  }

  const depthB = sliding ? C.WARD_SLIDE_DEPTH_B : C.WARD_OPEN_DEPTH_B;
  if (drawers > 0) {
    rows.push({ id: 'DRAWER_LHS', type: 'DRAWER_SIDE', label: 'Drawer LHS', cutWidth: D - depthB, cutHeight: 120, qty: drawers * 4, source: { formula: `Width = D - ${sliding ? 'WARD_SLIDE_DEPTH_B' : 'WARD_OPEN_DEPTH_B'}(${depthB}) | Height = 120 (fixed)`, constants: [sliding ? 'WARD_SLIDE_DEPTH_B' : 'WARD_OPEN_DEPTH_B'] } });
    const drFrontW = (selfTopH - 90) / 2 - C.WARD_DR_OFFSET;
    rows.push({ id: 'DR_FACIA', type: 'DRAWER_FRONT', label: 'Dr Facia', cutWidth: (selfTopH - 80) / 2, cutHeight: 148, qty: drawers * 4, source: { formula: `Width = ([Self Top height]-80)/2 | Height = 148 (fixed)`, constants: ['WARD_SELF_W_DEDUCT'] } });
    void drFrontW;
  }

  rows.push({ id: 'SCRTING', type: 'SKIRTING', label: 'Skirting', cutWidth: W - C.WARD_TB_DEDUCT, cutHeight: 70, qty: 2, source: { formula: `Width = W - WARD_TB_DEDUCT(${C.WARD_TB_DEDUCT}) | Height = 70 (fixed)`, constants: ['WARD_TB_DEDUCT'] } });
  rows.push({ id: 'BACK_PANEL', type: 'BACK_PANEL', label: `Back Panel (${backThk}mm)`, cutWidth: H - C.WARD_BACKPANEL_H_DEDUCT, cutHeight: (W - C.WARD_BACKPANEL_W_DEDUCT) / 2, qty: 2, source: { formula: `Width = H - WARD_BACKPANEL_H_DEDUCT(${C.WARD_BACKPANEL_H_DEDUCT}) | Height = (W - WARD_BACKPANEL_W_DEDUCT(${C.WARD_BACKPANEL_W_DEDUCT})) / 2`, constants: ['WARD_BACKPANEL_H_DEDUCT', 'WARD_BACKPANEL_W_DEDUCT'] } });

  if (doorCount > 0) {
    if (sliding) {
      rows.push({ id: 'DOOR', type: 'SLIDING_SHUTTER', label: 'Sliding Door', cutWidth: W / doorCount, cutHeight: H - C.WARD_SLIDE_DOOR_H_DEDUCT, qty: doorCount, source: { formula: `Width = W / DoorQty${doorCount === 2 ? '' : ' (generalized beyond the verified 2-door case — see docs/PRODUCT_STANDARDS.md)'} | Height = H - WARD_SLIDE_DOOR_H_DEDUCT(${C.WARD_SLIDE_DOOR_H_DEDUCT})`, constants: ['WARD_SLIDE_DOOR_H_DEDUCT'], needsVerification: doorCount !== 2, note: doorCount !== 2 ? 'Verified formula covers exactly 2 sliding doors; this design extrapolates the same width-split pattern to more shutters.' : undefined } });
    } else {
      rows.push({ id: 'DOOR', type: 'HINGED_SHUTTER', label: 'Door', cutWidth: (W - C.WARD_OPEN_DOOR_W_DEDUCT) / doorCount, cutHeight: H - C.WARD_OPEN_DOOR_H_DEDUCT, qty: doorCount, source: { formula: `Width = (W - WARD_OPEN_DOOR_W_DEDUCT(${C.WARD_OPEN_DOOR_W_DEDUCT})) / DoorQty | Height = H - WARD_OPEN_DOOR_H_DEDUCT(${C.WARD_OPEN_DOOR_H_DEDUCT})`, constants: ['WARD_OPEN_DOOR_W_DEDUCT', 'WARD_OPEN_DOOR_H_DEDUCT'], needsVerification: true, note: 'Source data flags: historical order QTY column showed 2 while this formula divides by the entered door count — verify with shop floor.' } });
    }
  }

  return rows;
}
