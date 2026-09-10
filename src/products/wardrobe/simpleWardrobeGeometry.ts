import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';
import {
  loftOneDoorWidth, loftDoorWidthStatus, totalKhachaWidth, LOFT_WARDROBE_GAP_MM,
  type FixPattiInput, type FixPattiPosition, type KhachaInput, type KhachaPosition,
} from '../../engine/loftDoorEngine';

// Wardrobe's skirting is a fixed, real board height — same 70mm constant
// already used elsewhere in this codebase (Side Table's own skirting strip,
// and the older Wardrobe formula engine's SCRTING row) — not an invented
// number. Per the user's explicit instruction, this is subtracted from the
// ENTERED Wardrobe Height (and from an explicitly-entered Total Height, if
// any) to get the wardrobe CARCASS's own drawn height — the entered value
// stays the true overall/floor-to-top figure, exactly what was measured on
// site, with the skirting strip accounting for the difference. Drawing-only:
// no new measurement field, nothing saved differently, and the Wardrobe's
// Measurements panel keeps showing the plain entered Height unchanged.
export const WARDROBE_SKIRTING_HEIGHT_MM = 70;

// ─────────────────────────────────────────────────────────────────────────────
// Simplified Wardrobe model — same real site-measurement workflow as the
// simplified Bed (src/products/bed/simpleBedGeometry.ts), applied to the
// Wardrobe per the user's own reference sketches: a plain W x H carcass with
// Depth (D) shown as the "/" diagonal leader (never a straight arrow — same
// convention as Bed's own height), plus optional Side Dressing, Side Panel,
// and a Loft box/door unit on top. The existing 25-design zone system
// (wardrobeFormulas.ts / wardrobeGeometry.ts / WardrobeTechnicalDrawing.tsx)
// is kept intact for a future "fabrication detail" mode — nothing deleted,
// just no longer the mandatory first step for the live Wardrobe product.
// ─────────────────────────────────────────────────────────────────────────────

export type WardrobeSide = 'left' | 'right' | 'both';

export interface WardrobeDressingInput {
  enabled: boolean;
  side: WardrobeSide;
  widthMm: number; // Height is always Wardrobe Height (auto-fetched)
  // Mirror (spec §22) — a real, separate optional component inside
  // Dressing, no independent measurement (fills the Dressing's own
  // upper portion, matching the reference layout).
  hasMirror: boolean;
  // Drawers (spec §19-21) — a manual count, dynamically generated in the
  // drawing (never a fixed number). Drawer Width is ALWAYS Dressing
  // Width (spec §21 "Do NOT create a separate drawer-width input") — no
  // separate field for it. drawerCount=0 means no drawer section at all.
  drawerCount: number;
  // Total Drawer Height (spec §20) — the total vertical span the drawer
  // section occupies, auto-divided evenly among drawerCount for the
  // drawing. A single measurement, never per-drawer heights.
  totalDrawerHeightMm: number;
}

// Renamed from WardrobeSidePanelInput → WardrobeTopPanelInput per the
// user's explicit, twice-confirmed instruction — this is the SAME
// component (same fields, same geometry, same drawing position, same
// purpose: a thin horizontal partition-marker line below the Loft), only
// its displayed name/type name changed. Never confuse this with Fix Patti
// (below) — completely separate component, per the spec's own repeated
// "do not combine them" instruction.
export interface WardrobeTopPanelInput {
  enabled: boolean;
  side: WardrobeSide;
  widthMm: number;
  depthMm: number;
}
// Back-compat alias so any not-yet-updated call site still type-checks —
// the two names are otherwise identical.
export type WardrobeSidePanelInput = WardrobeTopPanelInput;

// Fix Patti — a real, separate component from Top Panel. Sits at the outer
// edge(s) of the Loft (never below it, never combined with Top Panel's own
// position). Its own Height/Width per side, entered directly by the user
// (never derived). Its WIDTH is the one thing deducted from Total Width
// before the Loft Door Count is calculated — Top Panel's width is
// explicitly NOT part of that deduction, per the spec's own repeated
// correction.
export interface WardrobeFixPattiInput {
  position: FixPattiPosition;
  leftHeightMm: number;
  leftWidthMm: number;
  rightHeightMm: number;
  rightWidthMm: number;
}

// Khacha — a real, separate component from BOTH Fix Patti and Top Panel
// (spec §16/§50: "Do not merge their data"). Same None/Left/Right/Both
// shape and the same H×W-both-entered pattern as Fix Patti, but tracked
// completely independently: a Loft can have Fix Patti AND Khacha at once,
// on the same or different sides, and both widths deduct from the usable
// Loft door area TOGETHER (spec §17's worked example: Wall=2500,
// FixPatti=100, Khacha=150 → usable = 2250 — both stack, neither replaces
// the other). Drawn even further outward than Fix Patti (outermost of the
// two), matching the reference sketch where Khacha sits at the very
// corner/edge of the room, beyond the Fix Patti strip.
export interface WardrobeKhachaInput {
  position: KhachaPosition;
  leftHeightMm: number;
  leftWidthMm: number;
  rightHeightMm: number;
  rightWidthMm: number;
}

// Extra Storage — a real box beside the Wardrobe/Dressing (spec §26-31),
// with its OWN door calculation using the SAME shared loftDoorEngine
// formulas (2mm gap, 310-400mm standard, /400 recommendation) applied to
// Storage Width alone — never Room/Loft/Wardrobe Width (spec §29's own
// explicit "Do NOT calculate Storage Doors using Room Width, Loft Width,
// Wardrobe Width" rule). Depth defaults to Wardrobe Depth (spec §28) but
// stays editable per-side.
export interface WardrobeStorageSideInput {
  enabled: boolean;
  heightMm: number;
  widthMm: number;
  depthMm: number;
  // The door count actually used for the drawing/cutlist — same "resolved
  // upstream, drawn here" pattern as WardrobeLoftInput.doorCount.
  doorCount: number;
}
export interface WardrobeStorageInput {
  position: WardrobeSide | 'none';
  left: WardrobeStorageSideInput;
  right: WardrobeStorageSideInput;
}

// Open Box — a real box beside the Wardrobe/Dressing (spec §32-35), no
// door calculation at all (it's an open box, not a shuttered one) — just
// W×H×D per side. Sits BELOW Storage on the same side when both are
// present (spec §33/§36); alone in the storage area when Storage isn't.
export interface WardrobeOpenBoxSideInput {
  enabled: boolean;
  heightMm: number;
  widthMm: number;
  depthMm: number;
}
export interface WardrobeOpenBoxInput {
  position: WardrobeSide | 'none';
  left: WardrobeOpenBoxSideInput;
  right: WardrobeOpenBoxSideInput;
}

// Study Table attached to the Wardrobe (spec §23-25) — only offered when
// Dressing is NOT selected. Reuses the EXISTING standalone Study Table
// product's own measurement/drawing system (studyTableGeometry.ts /
// StudyTableDrawing.tsx) — per the spec's own explicit "Do NOT create a
// second Study Table calculation system" rule, this module does NOT
// duplicate that geometry; it only tracks whether the attachment is
// active, its side, and passes its own H/W/D straight through to the
// real Study Table engine, rendered as a separate composite section
// beside the Wardrobe (see SimpleWardrobeDrawing.tsx / ProductFlow.tsx).
export interface WardrobeStudyTableInput {
  enabled: boolean;
  side: WardrobeSide;
  heightMm: number;
  widthMm: number;
  depthMm: number;
}

export type LoftMode = 'door' | 'box';

export interface WardrobeLoftInput {
  enabled: boolean;
  mode: LoftMode;
  widthMm: number; // defaults to the composite total width when not overridden
  heightMm: number;
  depthMm: number; // only meaningful in 'box' mode
  // The door count actually used for the drawing/cutlist — the caller
  // (ProductFlow.tsx) resolves this from the loftDoorEngine recommendation
  // unless the user has explicitly overridden it, then passes the final
  // number in here. This module doesn't recompute the recommendation
  // itself — it just draws whatever count it's handed, per doors that
  // width using the shared engine's real deduction formula.
  doorCount: number;
}

// L-Shaped Loft — Wall B, a second, fully independent Loft standing on
// the ADJACENT wall (Left or Right of the main Wardrobe structure), per
// the user's own reference sketch. Uses the EXACT SAME rules as the main
// Loft (Wall A) — same Total Width/Height/Door Count formulas, same
// shared loftDoorEngine, same real Fix Patti + Khacha option (both
// optional, both manual H×W per side, both deduct from THIS wall's own
// usable width only — never combined with Wall A's Fix Patti/Khacha,
// per the user's explicit "left side pe khacha aur fixed patti alag se
// hoga" instruction). Wall A and Wall B are calculated completely
// independently — never combined into one width for door calculation.
export interface WardrobeAdjacentLoftInput {
  enabled: boolean;
  side: 'left' | 'right';
  mode: LoftMode;
  widthMm: number; // this wall's own usable Loft Door Width (after its own Fix Patti/Khacha)
  heightMm: number;
  depthMm: number;
  doorCount: number;
  fixPatti: WardrobeFixPattiInput;
  khacha: WardrobeKhachaInput;
}

export interface SimpleWardrobeInputs {
  W: number; // wardrobe width
  H: number; // wardrobe height
  D: number; // wardrobe depth — shown as a "/" diagonal leader, never a straight arrow
  dressing: WardrobeDressingInput;
  topPanel: WardrobeTopPanelInput;
  loft: WardrobeLoftInput;
  fixPatti: WardrobeFixPattiInput;
  khacha: WardrobeKhachaInput;
  storage: WardrobeStorageInput;
  openBox: WardrobeOpenBoxInput;
  studyTable: WardrobeStudyTableInput;
  adjacentLoft: WardrobeAdjacentLoftInput;
  // Separate, explicitly-entered overall envelope values — per the user's
  // own instruction, these are NOT derived/recomputed from W/H + add-ons;
  // whatever is typed here is exactly what the drawing's outer "Total
  // Width"/"Total Height" dimension line shows. 0 (or omitted) hides that
  // line entirely, same as the add-on-driven total-* lines already did.
  // Now ALSO the source Room/Total Width the Fix Patti deduction and Top
  // Panel Width auto-calc read from, per the Loft engine spec.
  totalWidthMm?: number;
  totalHeightMm?: number;
}

export interface SimpleWardrobeCutRow {
  component: string;
  width: number;
  height: number;
  qty: number;
  remark: string;
}

function activeParts(inp: SimpleWardrobeInputs): string[] {
  const parts: string[] = [];
  if (inp.dressing.enabled) parts.push('DRESSING');
  if (inp.topPanel.enabled) parts.push('TOP PANEL');
  if (inp.loft.enabled) parts.push(inp.loft.mode === 'box' ? 'LOFT BOX' : 'LOFT');
  if (inp.fixPatti.position !== 'none') parts.push('FIX PATTI');
  if (inp.khacha.position !== 'none') parts.push('KHACHA');
  if (inp.storage.position !== 'none') parts.push('STORAGE');
  if (inp.openBox.position !== 'none') parts.push('OPEN BOX');
  if (inp.studyTable.enabled) parts.push('STUDY TABLE');
  if (inp.adjacentLoft.enabled) parts.push('L-SHAPED LOFT');
  return parts;
}

/** "WARDROBE" / "WARDROBE + DRESSING" / "WARDROBE + DRESSING + LOFT" etc., per the active add-ons. */
export function simpleWardrobeTitle(inp: SimpleWardrobeInputs): string {
  const parts = activeParts(inp);
  return parts.length ? `WARDROBE + ${parts.join(' + ')}` : 'WARDROBE';
}

/** Same data used for both the screen and the PDF — single source of truth. */
export function simpleWardrobeCutlist(inp: SimpleWardrobeInputs): SimpleWardrobeCutRow[] {
  const rows: SimpleWardrobeCutRow[] = [
    { component: 'Wardrobe', width: inp.W, height: inp.H, qty: 1, remark: `Width x Height (entered) | Depth = ${Math.round(inp.D)}mm (entered, shown as the / leader)` },
  ];
  if (inp.dressing.enabled) {
    const sideLabel = inp.dressing.side === 'both' ? 'Left + Right' : inp.dressing.side === 'left' ? 'Left' : 'Right';
    const qty = inp.dressing.side === 'both' ? 2 : 1;
    rows.push({ component: `Side Dressing (${sideLabel})`, width: inp.dressing.widthMm, height: inp.H, qty, remark: `Width entered; Height = Wardrobe Height (auto-fetched, ${Math.round(inp.H)}mm)` });
    if (inp.dressing.hasMirror) {
      rows.push({ component: 'Dressing Mirror', width: inp.dressing.widthMm, height: inp.H, qty: 1, remark: 'Width = Dressing Width, Height = Dressing Height (both auto-fetched) — no independent measurement' });
    }
    if (inp.dressing.drawerCount > 0) {
      rows.push({ component: `Dressing Drawer (x${inp.dressing.drawerCount})`, width: inp.dressing.widthMm, height: inp.dressing.totalDrawerHeightMm / inp.dressing.drawerCount, qty: inp.dressing.drawerCount, remark: `Drawer Width = Dressing Width (${Math.round(inp.dressing.widthMm)}mm, auto) | Total Drawer Height = ${Math.round(inp.dressing.totalDrawerHeightMm)}mm ÷ ${inp.dressing.drawerCount} drawers = ${(inp.dressing.totalDrawerHeightMm / inp.dressing.drawerCount).toFixed(1)}mm each` });
    }
  }
  if (inp.topPanel.enabled) {
    const sideLabel = inp.topPanel.side === 'both' ? 'Left + Right' : inp.topPanel.side === 'left' ? 'Left' : 'Right';
    const qty = inp.topPanel.side === 'both' ? 2 : 1;
    rows.push({ component: `Top Panel (${sideLabel})`, width: inp.topPanel.widthMm, height: inp.topPanel.depthMm, qty, remark: `Width x Depth (both entered/auto-calculated) — drawn rotated: Depth horizontal, Width vertical` });
  }
  if (inp.fixPatti.position !== 'none') {
    if (inp.fixPatti.position === 'left' || inp.fixPatti.position === 'both') {
      rows.push({ component: 'Fix Patti (Left)', width: inp.fixPatti.leftWidthMm, height: inp.fixPatti.leftHeightMm, qty: 1, remark: `Height x Width (both entered) — separate from Top Panel; its width is deducted from Total Width before the Loft Door Count is calculated` });
    }
    if (inp.fixPatti.position === 'right' || inp.fixPatti.position === 'both') {
      rows.push({ component: 'Fix Patti (Right)', width: inp.fixPatti.rightWidthMm, height: inp.fixPatti.rightHeightMm, qty: 1, remark: `Height x Width (both entered) — separate from Top Panel; its width is deducted from Total Width before the Loft Door Count is calculated` });
    }
  }
  if (inp.khacha.position !== 'none') {
    if (inp.khacha.position === 'left' || inp.khacha.position === 'both') {
      rows.push({ component: 'Khacha (Left)', width: inp.khacha.leftWidthMm, height: inp.khacha.leftHeightMm, qty: 1, remark: `Height x Width (both entered) — separate from Fix Patti and Top Panel; its width is deducted (together with any Fix Patti) from the usable Loft door area` });
    }
    if (inp.khacha.position === 'right' || inp.khacha.position === 'both') {
      rows.push({ component: 'Khacha (Right)', width: inp.khacha.rightWidthMm, height: inp.khacha.rightHeightMm, qty: 1, remark: `Height x Width (both entered) — separate from Fix Patti and Top Panel; its width is deducted (together with any Fix Patti) from the usable Loft door area` });
    }
  }
  if (inp.loft.enabled) {
    // inp.loft.widthMm is ALREADY the usable Loft Door Width — per the
    // user's final, explicit formula:
    //   Loft Width = Total Room Width − Left Fix Patti − Right Fix Patti
    // (Wardrobe Width, Dressing Width and Top Panel Width are never part
    // of this deduction — resolved once in ProductFlow.tsx's
    // deriveWardrobeAddonInputs). No further Fix Patti subtraction happens
    // here — doing so would double-deduct. Same real per-door formula as
    // the shared loftDoorEngine (used identically by the standalone Loft
    // Box product and any future Loft-bearing product), in BOTH Loft Type
    // modes — "Box" mode shows the same real per-door boxes as "Only
    // Door", not a plain undivided box.
    const usableW = inp.loft.widthMm;
    const count = Math.max(1, Math.round(inp.loft.doorCount) || 1);
    const doorW = loftOneDoorWidth(usableW, count);
    const doorLabel = inp.loft.mode === 'box' ? `Loft Box Door (x${count})` : `Loft Door (x${count})`;
    rows.push({ component: doorLabel, width: doorW, height: inp.loft.heightMm, qty: count, remark: `Loft Width (Total Width − Fix Patti) = ${Math.round(usableW)}mm | Deduction = ${count} × 2 = ${count * 2}mm | Each Door = (${Math.round(usableW)} − ${count * 2}) / ${count} = ${doorW.toFixed(2)}mm` });
    if (inp.loft.mode === 'box') {
      rows.push({ component: 'Loft Box Depth', width: inp.loft.widthMm, height: inp.loft.depthMm, qty: 1, remark: `Depth = ${Math.round(inp.loft.depthMm)}mm (entered, shown as the / leader) — Width shown here is the full Loft Width for reference only; see individual doors above for real cut widths` });
    }
  }
  if (inp.storage.position !== 'none') {
    const sides: Array<['Left' | 'Right', WardrobeStorageSideInput]> = [];
    if ((inp.storage.position === 'left' || inp.storage.position === 'both') && inp.storage.left.enabled) sides.push(['Left', inp.storage.left]);
    if ((inp.storage.position === 'right' || inp.storage.position === 'both') && inp.storage.right.enabled) sides.push(['Right', inp.storage.right]);
    for (const [sideLabel, s] of sides) {
      // Storage Box has its OWN door calculation, from Storage Width ONLY
      // (spec §29's own explicit "Do NOT calculate Storage Doors using
      // Room Width, Loft Width, Wardrobe Width" rule) — same shared
      // loftDoorEngine formula, just a different width source, per the
      // spec's own "Use the same Loft door calculation logic" (§30).
      const count = Math.max(1, Math.round(s.doorCount) || 1);
      const doorW = loftOneDoorWidth(s.widthMm, count);
      rows.push({ component: `Storage Box (${sideLabel}) Door (x${count})`, width: doorW, height: s.heightMm, qty: count, remark: `Storage Width = ${Math.round(s.widthMm)}mm (independent of Room/Loft/Wardrobe Width) | Deduction = ${count} × 2 = ${count * 2}mm | Each Door = (${Math.round(s.widthMm)} − ${count * 2}) / ${count} = ${doorW.toFixed(2)}mm` });
      rows.push({ component: `Storage Box (${sideLabel}) Depth`, width: s.widthMm, height: s.depthMm, qty: 1, remark: `Depth = ${Math.round(s.depthMm)}mm (defaults to Wardrobe Depth, editable) — Width shown here is the full Storage Width for reference only; see individual doors above for real cut widths` });
    }
  }
  if (inp.openBox.position !== 'none') {
    const sides: Array<['Left' | 'Right', WardrobeOpenBoxSideInput]> = [];
    if ((inp.openBox.position === 'left' || inp.openBox.position === 'both') && inp.openBox.left.enabled) sides.push(['Left', inp.openBox.left]);
    if ((inp.openBox.position === 'right' || inp.openBox.position === 'both') && inp.openBox.right.enabled) sides.push(['Right', inp.openBox.right]);
    for (const [sideLabel, b] of sides) {
      rows.push({ component: `Open Box (${sideLabel})`, width: b.widthMm, height: b.heightMm, qty: 1, remark: `Width x Height (both entered) | Depth = ${Math.round(b.depthMm)}mm (defaults to Wardrobe Depth, editable) — no door/shutter, a real open box` });
    }
  }
  if (inp.studyTable.enabled) {
    // Only a summary reference row here — the real, full cutlist for the
    // attached Study Table comes from the EXISTING standalone Study Table
    // product's own studyTableCutlist() (studyTableGeometry.ts), rendered
    // as its own separate section (spec §23 "Do NOT create a second Study
    // Table calculation system").
    const sideLabel = inp.studyTable.side === 'both' ? 'Left + Right' : inp.studyTable.side === 'left' ? 'Left' : 'Right';
    rows.push({ component: `Study Table (${sideLabel}, attached)`, width: inp.studyTable.widthMm, height: inp.studyTable.heightMm, qty: 1, remark: `Height x Width x Depth = ${Math.round(inp.studyTable.heightMm)}×${Math.round(inp.studyTable.widthMm)}×${Math.round(inp.studyTable.depthMm)}mm — see the separate Study Table section below for its full cutlist (same engine as the standalone Study Table product)` });
  }
  if (inp.adjacentLoft.enabled) {
    // Wall B — a fully independent Loft, calculated with the EXACT SAME
    // rules as Wall A (the main Loft) above, but never combined with it:
    // its own usable width (already Fix Patti/Khacha-deducted upstream),
    // its own Door Count/One Door Width.
    const al = inp.adjacentLoft;
    const alSideLabel = al.side === 'left' ? 'Left' : 'Right';
    const alCount = Math.max(1, Math.round(al.doorCount) || 1);
    const alDoorW = loftOneDoorWidth(al.widthMm, alCount);
    rows.push({ component: `L-Shaped Loft (${alSideLabel} Wall) Door (x${alCount})`, width: alDoorW, height: al.heightMm, qty: alCount, remark: `Wall B Usable Width = ${Math.round(al.widthMm)}mm (own Fix Patti/Khacha already deducted, independent of Wall A) | Deduction = ${alCount} × 2 = ${alCount * 2}mm | Each Door = (${Math.round(al.widthMm)} − ${alCount * 2}) / ${alCount} = ${alDoorW.toFixed(2)}mm` });
    if (al.mode === 'box') {
      rows.push({ component: `L-Shaped Loft (${alSideLabel} Wall) Depth`, width: al.widthMm, height: al.depthMm, qty: 1, remark: `Depth = ${Math.round(al.depthMm)}mm (entered) — Width shown here is the full Wall B Width for reference only; see individual doors above for real cut widths` });
    }
    if (al.fixPatti.position === 'left' || al.fixPatti.position === 'both') {
      rows.push({ component: `L-Shaped Loft (${alSideLabel} Wall) Fix Patti (Left)`, width: al.fixPatti.leftWidthMm, height: al.fixPatti.leftHeightMm, qty: 1, remark: `Height x Width (both entered) — Wall B's own Fix Patti, independent of Wall A's` });
    }
    if (al.fixPatti.position === 'right' || al.fixPatti.position === 'both') {
      rows.push({ component: `L-Shaped Loft (${alSideLabel} Wall) Fix Patti (Right)`, width: al.fixPatti.rightWidthMm, height: al.fixPatti.rightHeightMm, qty: 1, remark: `Height x Width (both entered) — Wall B's own Fix Patti, independent of Wall A's` });
    }
    if (al.khacha.position === 'left' || al.khacha.position === 'both') {
      rows.push({ component: `L-Shaped Loft (${alSideLabel} Wall) Khacha (Left)`, width: al.khacha.leftWidthMm, height: al.khacha.leftHeightMm, qty: 1, remark: `Height x Width (both entered) — Wall B's own Khacha, independent of Wall A's` });
    }
    if (al.khacha.position === 'right' || al.khacha.position === 'both') {
      rows.push({ component: `L-Shaped Loft (${alSideLabel} Wall) Khacha (Right)`, width: al.khacha.rightWidthMm, height: al.khacha.rightHeightMm, qty: 1, remark: `Height x Width (both entered) — Wall B's own Khacha, independent of Wall A's` });
    }
  }
  return rows;
}

const DIAG = '#cc2200';

/**
 * A short "/" or "\" diagonal drawn INSIDE a component's own corner, rather
 * than hovering small and outside it — per the user's explicit direction
 * (matches the same helper in src/products/bed/simpleBedGeometry.ts).
 * Inset is a fraction of the component's own size (capped) so it always
 * stays clear of that component's centered caption regardless of size.
 */
function insideDiagonal(cornerX: number, cornerY: number, w: number, h: number, dir: 'right-down' | 'right-up' | 'left-down' | 'left-up') {
  // 2x the original reach, per the user's explicit request — still capped
  // at 90% of the component's own size so it can never poke out the
  // opposite edge on a genuinely small box.
  const insetX = Math.min(Math.min(w * 0.35, 70) * 2, w * 0.9);
  const insetY = Math.min(Math.min(h * 0.35, 55) * 2, h * 0.9);
  const dx = dir === 'left-down' || dir === 'left-up' ? -insetX : insetX;
  const dy = dir === 'right-up' || dir === 'left-up' ? -insetY : insetY;
  return { x2: cornerX + dx, y2: cornerY + dy };
}

export function resolveSimpleWardrobePlan(inp: SimpleWardrobeInputs): ResolvedDrawing {
  const { W, H, D, dressing, topPanel, loft, fixPatti, khacha, storage, openBox, adjacentLoft, totalWidthMm, totalHeightMm } = inp;
  // room for the Wardrobe's own Depth "/" leader — extended when a
  // LEFT-side L-Shaped Loft (Wall B) is active, since that column is
  // drawn even further left, outside every other component's own
  // origin (roomWallX/leaderMargin). Computed up front so every X
  // coordinate below (including roomWallX itself) already accounts for
  // it, rather than letting Wall B's column go to a negative, off-
  // canvas X. 130 (column width) + 60 (real visual gap) matches the
  // alColW/alGap constants used where Wall B is actually drawn, below.
  const leftAdjacentLoftMargin = adjacentLoft.enabled && adjacentLoft.side === 'left' ? 130 + 60 : 0;
  const leaderMargin = 150 + leftAdjacentLoftMargin;

  // Skirting — a real 70mm board strip drawn at the FLOOR line of the
  // wardrobe. Per the user's explicit final instruction: the entered
  // Wardrobe Height ALREADY includes the skirting — do NOT subtract it.
  // The wardrobe box is drawn at its full entered Height (bodyH === H);
  // the skirting is just a labelled 70mm band at the bottom OF that same
  // height (a visual sub-strip, not an extra strip added below), so
  //   Total Height = Wardrobe Height (incl. skirting) + 10mm gap + Loft Height.
  // Guarded so a Height smaller than the skirting itself simply draws no
  // skirting band rather than an inverted strip.
  const skirtH = H > WARDROBE_SKIRTING_HEIGHT_MM ? WARDROBE_SKIRTING_HEIGHT_MM : 0;
  const bodyH = H;

  const dressL = dressing.enabled && dressing.side !== 'right' ? dressing.widthMm : 0;
  const dressR = dressing.enabled && dressing.side !== 'left' ? dressing.widthMm : 0;
  // Top Panel (a.k.a. Side Panel) — per the user's explicit composite
  // formula "Total Width = Wardrobe Width + Dressing Width + Side Panel
  // Width", the horizontal footprint it reserves in the composite is its
  // WIDTH (not its Depth). Depth runs front-to-back and is shown only as
  // the diagonal "(D)" leader.
  const topPanelL = topPanel.enabled && topPanel.side !== 'right' ? topPanel.widthMm : 0;
  const topPanelR = topPanel.enabled && topPanel.side !== 'left' ? topPanel.widthMm : 0;

  // Extra Storage + Open Box — real boxes beside the Wardrobe/Dressing
  // stack (spec §26-36), reserving their own horizontal space the same
  // way Dressing/Top Panel do. Storage sits above Open Box on the SAME
  // side when both are present (spec §33/§36); each side's reserved width
  // is simply the WIDER of its own active Storage/Open Box (they stack
  // vertically, not side-by-side, so they never both add to the
  // horizontal footprint at once).
  const storageActiveL = storage.position === 'left' || storage.position === 'both' ? storage.left : null;
  const storageActiveR = storage.position === 'right' || storage.position === 'both' ? storage.right : null;
  const openBoxActiveL = openBox.position === 'left' || openBox.position === 'both' ? openBox.left : null;
  const openBoxActiveR = openBox.position === 'right' || openBox.position === 'both' ? openBox.right : null;
  const hasStorageL = !!storageActiveL?.enabled;
  const hasStorageR = !!storageActiveR?.enabled;
  const hasOpenBoxL = !!openBoxActiveL?.enabled;
  const hasOpenBoxR = !!openBoxActiveR?.enabled;
  const storageColL = Math.max(hasStorageL ? storageActiveL!.widthMm : 0, hasOpenBoxL ? openBoxActiveL!.widthMm : 0);
  const storageColR = Math.max(hasStorageR ? storageActiveR!.widthMm : 0, hasOpenBoxR ? openBoxActiveR!.widthMm : 0);

  const leftExtra = storageColL + topPanelL + dressL;
  const rightExtra = dressR + topPanelR + storageColR;
  const wardrobeX = leaderMargin + leftExtra;

  const components: ComponentSpec[] = [];
  const dimReqs: DimensionRequest[] = [];
  const lines: AnnotationLine[] = [];

  // Loft — touches the top of the composite stack directly (no gap; a real
  // loft cabinet is built flush on top of the wardrobe carcass), spanning
  // the full total width (wardrobe + any side panels/dressing), matching
  // the reference sketch's topmost box. topPad reserves room above the
  // topmost element (loft, or the Wardrobe itself if no loft) for its own
  // "/" diagonal leader — never a straight arrow, same convention as the
  // Bed's own height.
  // Bumped from 70 — the Side Panel's own Depth leader (below) now reaches
  // 110 units up from wardrobeY, which needs more headroom above it than
  // before to stay on-canvas when no Loft pushes wardrobeY down further.
  const topPad = 130;
  const totalWidth = leftExtra + W + rightExtra;
  // roomWallX — the SINGLE shared left origin every top-level element in
  // this drawing is positioned from: the Loft row (Fix Patti + doors), the
  // Wardrobe/Dressing/Top Panel stack below it, and the Room Wall boundary
  // line itself. Per the user's explicit correction: "the Loft is not
  // properly aligned... build the drawing from a common coordinate system
  // ... every component must derive its position from the parent
  // geometry" — so this is deliberately the ONE constant every other X
  // coordinate below is an offset from, never a second independent margin.
  const roomWallX = leaderMargin;
  const loftX = roomWallX;
  let loftH = 0;
  // The Loft's own real (doors-only) width — per the user's FINAL, explicit
  // formula:
  //   Loft Width = Total Room Width − Left Fix Patti − Right Fix Patti
  // loft.widthMm already resolves to exactly this (computed once in
  // deriveWardrobeAddonInputs, ProductFlow.tsx) — Wardrobe Width, Dressing
  // Width and Top Panel Width are NEVER part of this deduction; those
  // components sit below the Loft, not beside it. Hoisted above the
  // `loft.enabled` block so worldWidth (below) can size the canvas to it.
  // Falls back to the wardrobe's own composite width only when the Loft is
  // enabled with no real width resolved at all (defensive — the normal
  // path always provides a real usableW, even 0 when Fix Patti consumes
  // the whole Total Width).
  const loftFrameWidth = loft.widthMm > 0 ? loft.widthMm : totalWidth;
  // Fix Patti reserves real space OUTSIDE the Loft's own door span (never
  // carved out of it) — matching the reference drawing, where the two
  // green Fix Patti strips sit at the outer edges of the room and the
  // purple Loft/door row sits strictly between them. So the Loft row's
  // total drawn extent is leftFPW + loftFrameWidth + rightFPW; doors
  // themselves use the full loftFrameWidth with no further deduction.
  // Hoisted above the `loft.enabled` block (alongside loftFrameWidth) so
  // worldWidth (below) can size the canvas to the row's true full extent.
  const fp = inp.fixPatti;
  const hasLeftFP = fp.position === 'left' || fp.position === 'both';
  const hasRightFP = fp.position === 'right' || fp.position === 'both';
  const leftFPW = hasLeftFP ? Math.max(0, fp.leftWidthMm) : 0;
  const rightFPW = hasRightFP ? Math.max(0, fp.rightWidthMm) : 0;
  // Khacha — a real, separate component from Fix Patti (never merged data,
  // per the spec's own "Do not merge their data" rule). Drawn even further
  // outward than Fix Patti (outermost of the two, at the very room-wall
  // corner), matching the reference sketch. Reserves its own real
  // horizontal space the same way Fix Patti does — the doors area starts
  // only after BOTH a side's Khacha and Fix Patti reservations.
  const kh = inp.khacha;
  const hasLeftKhacha = kh.position === 'left' || kh.position === 'both';
  const hasRightKhacha = kh.position === 'right' || kh.position === 'both';
  const leftKhachaW = hasLeftKhacha ? Math.max(0, kh.leftWidthMm) : 0;
  const rightKhachaW = hasRightKhacha ? Math.max(0, kh.rightWidthMm) : 0;
  const doorsAreaX = loftX + leftKhachaW + leftFPW;
  // The TRUE room-wall-to-room-wall span (Room Wall A → Room Wall B), per
  // the user's explicit correction — this is what the Loft row and the
  // outer "Total Width" dimension both measure against, NOT the lower
  // Wardrobe/Dressing composite's own (possibly narrower) width. Prefers
  // the raw entered Total Width (the true wall measurement) whenever it's
  // set; falls back to the Loft row's own natural extent (Khacha + Fix
  // Patti + doors) when Total Width isn't entered, and finally to the
  // lower composite when there's no Loft at all.
  const loftRowWidth = leftKhachaW + leftFPW + loftFrameWidth + rightFPW + rightKhachaW;
  const roomWallWidth = loft.enabled
    ? Math.max(totalWidthMm && totalWidthMm > 0 ? totalWidthMm : 0, loftRowWidth, totalWidth)
    : totalWidth;
  if (loft.enabled) {
    loftH = loft.heightMm;
    const loftY = topPad;
    // Blank frame label — every individual door component (below) carries
    // its own real computed-width label instead, same as Loft Box's own
    // "onlyShutter ? '' : 'Loft Box'" convention; showing both would
    // collide visually. Per the user's explicit correction, "Box" mode
    // renders identically to "Only Door" mode — the SAME real per-door
    // Loft Box formula/boxes in both cases; "Box" only additionally shows
    // a Depth "/" leader, since a door-only loft has no real depth to call
    // out the same way.
    components.push({
      id: 'loft', type: 'PLATFORM_TOP', label: '', x: doorsAreaX, y: loftY, width: loftFrameWidth, height: loftH, qty: 1, visible: true,
      source: { formula: `Width = Total Room Width − Fix Patti (Left+Right) − Khacha (Left+Right) | Height = Total Height − Wardrobe Height − 10mm gap | split into ${loft.doorCount} doors`, constants: [] },
    });

    // Fix Patti — a real, separate component from Top Panel, drawn at the
    // OUTER edge(s) of the room (green, per the spec's own colour
    // convention — see FIX_PATTI's componentStyle in
    // SimpleWardrobeDrawing.tsx), beside the Loft's own door span (and just
    // inside any Khacha on the same side — Khacha sits further out still).
    if (hasLeftFP) {
      components.push({
        id: 'fix-patti-left', type: 'FIX_PATTI', label: `Fix Patti\n${Math.round(fp.leftHeightMm)}×${Math.round(fp.leftWidthMm)}`,
        x: loftX + leftKhachaW, y: loftY, width: leftFPW, height: loftH, qty: 1, visible: true,
        source: { formula: `Left Fix Patti — Height x Width (both entered) | subtracted from Total Room Width to get the Loft Width`, constants: [] },
      });
    }
    if (hasRightFP) {
      components.push({
        id: 'fix-patti-right', type: 'FIX_PATTI', label: `Fix Patti\n${Math.round(fp.rightHeightMm)}×${Math.round(fp.rightWidthMm)}`,
        x: doorsAreaX + loftFrameWidth, y: loftY, width: rightFPW, height: loftH, qty: 1, visible: true,
        source: { formula: `Right Fix Patti — Height x Width (both entered) | subtracted from Total Room Width to get the Loft Width`, constants: [] },
      });
    }

    // Khacha — a real, separate component from Fix Patti, drawn at the
    // VERY outer edge of the room (further out than Fix Patti), per the
    // spec's own §16/§50 "do not merge their data" rule and the reference
    // sketch's own layout (Khacha sits at the extreme corner, beyond the
    // Fix Patti strip).
    if (hasLeftKhacha) {
      components.push({
        id: 'khacha-left', type: 'KHACHA', label: `Khacha\n${Math.round(kh.leftHeightMm)}×${Math.round(kh.leftWidthMm)}`,
        x: loftX, y: loftY, width: leftKhachaW, height: loftH, qty: 1, visible: true,
        source: { formula: `Left Khacha — Height x Width (both entered) | subtracted (together with any Fix Patti) from the usable Loft door area`, constants: [] },
      });
    }
    if (hasRightKhacha) {
      components.push({
        id: 'khacha-right', type: 'KHACHA', label: `Khacha\n${Math.round(kh.rightHeightMm)}×${Math.round(kh.rightWidthMm)}`,
        x: doorsAreaX + loftFrameWidth + rightFPW, y: loftY, width: rightKhachaW, height: loftH, qty: 1, visible: true,
        source: { formula: `Right Khacha — Height x Width (both entered) | subtracted (together with any Fix Patti) from the usable Loft door area`, constants: [] },
      });
    }

    // Doors — packed across the FULL Loft Width (loftFrameWidth already IS
    // the usable width, Fix Patti already excluded), using the shared
    // loftDoorEngine's exact deduction formula: Width = (LoftWidth −
    // doorCount×2) / doorCount. loft.doorCount here is already the FINAL
    // resolved count (auto-recommended unless the user overrode it) —
    // this module just draws it.
    {
      const count = Math.max(1, Math.round(loft.doorCount) || 1);
      const doorW = loftOneDoorWidth(loftFrameWidth, count);
      const gapMm = 2;
      let doorCursorX = doorsAreaX;
      // Each door is its OWN component box (with its own real border,
      // drawn by the shared engine — same as Loft Box) rather than one
      // wide box plus manual divider lines, so the borders always land
      // exactly on the real per-door boundaries.
      for (let i = 0; i < count; i++) {
        components.push({
          id: `loft-door-${i}`, type: 'DOOR', label: `${Math.round(doorW)}`,
          x: doorCursorX, y: loftY + 2, width: doorW, height: loftH - 4, qty: 1, visible: true, noHandle: true,
          source: { formula: `Loft Door ${i + 1} of ${count} — Width = (Loft Width(${Math.round(loftFrameWidth)}) − ${count}×2) / ${count} = ${doorW.toFixed(2)}mm`, constants: [] },
        });
        doorCursorX += doorW + gapMm;
      }
    }
    if (loft.mode === 'box') {
      const loftDiag = insideDiagonal(doorsAreaX, loftY, loftFrameWidth, loftH, 'right-down');
      lines.push({ x1: doorsAreaX, y1: loftY, x2: loftDiag.x2, y2: loftDiag.y2, color: DIAG, label: `${Math.round(loft.depthMm)} (D)` });
    }
    // Loft Height — a real dimension arrow on the loft's own left edge
    // (it previously only appeared as caption/label text, never a real
    // arrow like every other value in this drawing).
    dimReqs.push({ axis: 'v', x1: loftX, y1: loftY, x2: loftX, y2: loftY + loftH, edge: 'left', componentIds: ['loft'], label: `${Math.round(loftH)} (Loft H)`, source: { formula: 'Loft Height = Total Height − Wardrobe Height − 10mm gap (auto-calculated, editable)', constants: [] } });
    // The 10mm gap between Wardrobe and Loft — a required, visible
    // annotation per the spec (§22 "Do not hide the 10mm deduction
    // completely"). Drawn as a short leader just below the Loft's own
    // bottom edge, pointing into the real gap band above the Wardrobe.
    if (totalHeightMm && totalHeightMm > 0) {
      const gapY = loftY + loftH;
      const rowFullWidth = loftRowWidth;
      lines.push({ x1: loftX + rowFullWidth * 0.5, y1: gapY, x2: loftX + rowFullWidth * 0.5 + 40, y2: gapY + 24, color: '#64748b', label: '10 (Gap)' });
    }

    // Room Wall boundary — a real, labeled marker for whichever span is
    // WIDER: the Loft row (Fix Patti + doors) or the lower Wardrobe/
    // Dressing/Top Panel composite below it. Per the user's explicit
    // correction: the Loft must "not extend into unrelated blank space" —
    // when the two differ (e.g. entered Total Width=3400 but Wardrobe+
    // Dressing=2800), the leftover span on the wider side is real wall
    // space, not a drawing bug, so it must read as one: a dashed wall-line
    // + label, not empty canvas. Both left edges already share roomWallX,
    // so only the RIGHT edges can differ — compare them directly rather
    // than the Loft row's own right edge against itself (which is always
    // trivially equal to roomWallWidth and would never show a gap here).
    const loftRowRightEdge = doorsAreaX + loftFrameWidth + rightFPW + rightKhachaW;
    const lowerStructureRightEdge = loftX + totalWidth;
    const wallGap = loftRowRightEdge - lowerStructureRightEdge;
    // Ignore a gap within ~25mm — that's just the intentional +20mm Side
    // Panel overhang (plus rounding), not real leftover wall space worth
    // annotating.
    if (Math.abs(wallGap) > 25) {
      const wallY = loftY + loftH / 2;
      const gapLeftX = Math.min(loftRowRightEdge, lowerStructureRightEdge);
      const gapRightX = Math.max(loftRowRightEdge, lowerStructureRightEdge);
      lines.push({
        x1: gapLeftX, y1: wallY, x2: gapRightX, y2: wallY,
        color: '#94a3b8', dashed: true, label: `Room Wall (${Math.round(gapRightX - gapLeftX)})`,
      });
    }
  }

  const wardrobeY = topPad + loftH;

  // L-Shaped Loft — Wall B, a fully independent second Loft standing on
  // the adjacent wall (Left or Right of the main structure), drawn as its
  // own separate, visually disconnected column — never merged with Wall
  // A's own row above, per the reference sketch (Wall B floats to the
  // side with a real gap, its own outline, its own door stack). The
  // divided formula-width becomes each door's real cut width (used
  // correctly in the cutlist above); in THIS drawing those doors are
  // stacked vertically (top-to-bottom bands, each spanning the column's
  // full drawn width) rather than side-by-side, per the user's explicit
  // confirmation of the reference sketch's own layout — Wall B reads as
  // a vertical run on the adjacent wall, not a second horizontal row.
  const alGap = 60; // real visual gap between Wall B and the rest of the drawing — never touching
  let adjacentLoftWorldLeft = 0; // tracks how far left Wall B's own column reaches, for worldWidth below
  if (inp.adjacentLoft.enabled) {
    const al = inp.adjacentLoft;
    const alColW = 130; // fixed drawn column width — Wall B's real Width lives in its door-count formula, not this column's screen footprint (same convention as the Wardrobe's own fixed leaderMargin)
    const alX = al.side === 'left' ? roomWallX - alGap - alColW : loftX + roomWallWidth + alGap;
    const alY = topPad;
    const alH = wardrobeY + bodyH - alY; // spans the SAME full vertical extent as the rest of the composite (Loft row through Wardrobe floor), matching the reference sketch's floor-to-ceiling column
    adjacentLoftWorldLeft = al.side === 'left' ? alX : adjacentLoftWorldLeft;

    components.push({
      id: 'adjacent-loft', type: 'PLATFORM_TOP', label: 'L-Shaped Loft', x: alX, y: alY, width: alColW, height: alH, qty: 1, visible: true,
      source: { formula: `Wall B (${al.side}) — independent Loft on the adjacent wall, own Height(${Math.round(al.heightMm)}mm)/Width(${Math.round(al.widthMm)}mm)/Depth(${Math.round(al.depthMm)}mm), same door-count formula as Wall A, split into ${al.doorCount} doors`, constants: [] },
    });

    // Wall B's own Fix Patti + Khacha — independent of Wall A's, drawn at
    // the OUTER (far) edge of this column, per the user's explicit
    // "iski bhi fix patti aur khacha alag honi chahiye" instruction.
    const alFp = al.fixPatti;
    const alHasLeftFP = alFp.position === 'left' || alFp.position === 'both';
    const alHasRightFP = alFp.position === 'right' || alFp.position === 'both';
    const alKh = al.khacha;
    const alHasLeftKhacha = alKh.position === 'left' || alKh.position === 'both';
    const alHasRightKhacha = alKh.position === 'right' || alKh.position === 'both';
    // "Outer" edge is whichever edge faces away from the main structure —
    // for a Left-side Wall B that's its own left edge; for a Right-side
    // Wall B that's its own right edge.
    const outerIsLeftEdge = al.side === 'left';
    const fpBandH = Math.min(60, alH * 0.15);
    if (alHasLeftFP || alHasRightFP) {
      const fpY = outerIsLeftEdge ? alY : alY + alH - fpBandH;
      const fpSide = alHasLeftFP ? alFp.leftHeightMm : alFp.rightHeightMm;
      const fpSideW = alHasLeftFP ? alFp.leftWidthMm : alFp.rightWidthMm;
      components.push({
        id: 'adjacent-fix-patti', type: 'FIX_PATTI', label: `Fix Patti\n${Math.round(fpSide)}×${Math.round(fpSideW)}`,
        x: alX, y: fpY, width: alColW, height: fpBandH, qty: 1, visible: true,
        source: { formula: `Wall B Fix Patti — Height x Width (both entered) — independent of Wall A's own Fix Patti, subtracted from Wall B's own Width`, constants: [] },
      });
    }
    if (alHasLeftKhacha || alHasRightKhacha) {
      const khY = outerIsLeftEdge ? alY + fpBandH : alY + alH - fpBandH * 2;
      const khSide = alHasLeftKhacha ? alKh.leftHeightMm : alKh.rightHeightMm;
      const khSideW = alHasLeftKhacha ? alKh.leftWidthMm : alKh.rightWidthMm;
      components.push({
        id: 'adjacent-khacha', type: 'KHACHA', label: `Khacha\n${Math.round(khSide)}×${Math.round(khSideW)}`,
        x: alX, y: khY, width: alColW, height: fpBandH, qty: 1, visible: true,
        source: { formula: `Wall B Khacha — Height x Width (both entered) — independent of Wall A's own Khacha, subtracted (together with Fix Patti) from Wall B's own Width`, constants: [] },
      });
    }

    // Doors — Wall B's own formula-resolved doors, stacked vertically
    // (top-to-bottom bands) rather than side-by-side, per the confirmed
    // reference layout. al.widthMm is already Wall B's own usable Width
    // (its own Fix Patti/Khacha already deducted upstream, exactly like
    // Wall A's loft.widthMm) — no further deduction here.
    {
      const alCount = Math.max(1, Math.round(al.doorCount) || 1);
      const doorH = alH / alCount;
      const alDoorW = loftOneDoorWidth(al.widthMm, alCount);
      let doorCursorY = alY;
      for (let i = 0; i < alCount; i++) {
        components.push({
          id: `adjacent-loft-door-${i}`, type: 'DOOR', label: `${Math.round(alDoorW)}`,
          x: alX + 2, y: doorCursorY, width: alColW - 4, height: doorH - 2, qty: 1, visible: true, noHandle: true,
          source: { formula: `Wall B Door ${i + 1} of ${alCount} — Width = (Wall B Width(${Math.round(al.widthMm)}) − ${alCount}×2) / ${alCount} = ${alDoorW.toFixed(2)}mm (real cut width; drawn as a vertical band on the adjacent wall)`, constants: [] },
        });
        doorCursorY += doorH;
      }
    }

    // Height/Width/Depth get their own real callouts — same diagonal-D
    // convention as every other component in this drawing.
    dimReqs.push({ axis: 'v', x1: alX - 20, y1: alY, x2: alX - 20, y2: alY + alH, edge: 'left', componentIds: ['adjacent-loft'], label: `${Math.round(al.heightMm)} (Wall B H)`, source: { formula: 'Wall B Loft Height (entered, independent of Wall A)', constants: [] } });
    const alDiag = insideDiagonal(alX, alY, alColW, alH, 'right-down');
    lines.push({ x1: alX, y1: alY, x2: alDiag.x2, y2: alDiag.y2, color: DIAG, label: `${Math.round(al.depthMm)} (Wall B D)` });
  }

  // Wardrobe — a plain W x H carcass at its FULL entered Height (the
  // entered Height already includes the 70mm skirting; it is NOT
  // subtracted — see skirtH/bodyH note above). Depth shown as the "/"
  // diagonal leader at its own top-left corner. W and H are shown as
  // plain callouts inside/beside this box, never a boxed label.
  components.push({
    id: 'wardrobe', type: 'WARDROBE_BODY', label: `Wardrobe ${Math.round(W)}×${Math.round(H)}`, x: wardrobeX, y: wardrobeY, width: W, height: bodyH, qty: 1, visible: true,
    source: { formula: 'Width x Height (both entered) — single carcass, entered Height already includes the 70mm skirting', constants: [] },
  });
  // Anchored at the Wardrobe's bottom-left corner rather than top-left —
  // the top-left corner is where Dressing/Side Panel/Loft all converge, so
  // the bottom-left (always open space, nothing else is ever positioned
  // there) keeps this leader clear regardless of which add-ons are active.
  // Drawn INSIDE the Wardrobe's own box (going up-right from that corner),
  // per the user's explicit direction, in the Wardrobe's own colour.
  {
    const wardrobeDiag = insideDiagonal(wardrobeX, wardrobeY + bodyH, W, bodyH, 'right-up');
    lines.push({ x1: wardrobeX, y1: wardrobeY + bodyH, x2: wardrobeDiag.x2, y2: wardrobeDiag.y2, color: DIAG, label: `${Math.round(D)} (D)` });
  }

  dimReqs.push({ axis: 'h', x1: wardrobeX, y1: wardrobeY + bodyH, x2: wardrobeX + W, y2: wardrobeY + bodyH, edge: 'bottom', componentIds: ['wardrobe'], label: `${Math.round(W)} (W)`, source: { formula: 'Wardrobe Width (entered)', constants: [] } });
  dimReqs.push({ axis: 'v', x1: wardrobeX + W, y1: wardrobeY, x2: wardrobeX + W, y2: wardrobeY + bodyH, edge: 'right', componentIds: ['wardrobe'], label: `${Math.round(H)} (H)`, source: { formula: 'Wardrobe Height (entered, includes the 70mm skirting)', constants: [] } });

  // Skirting drawn further below, AFTER Dressing/Side Panel are resolved —
  // it spans the full composite floor line (Dressing + Wardrobe + Side
  // Panel together, matching how a real skirting/plinth board runs
  // continuously under the whole unit) rather than just the wardrobe body
  // alone.

  // "Total width" / "total height" outer dimensions, only shown when a side
  // panel or loft actually changes the overall footprint — matching the
  // reference sketch's "total width (if side panel exist)" label.
  // "Total width"/"total height" sit on the SAME base edge as the
  // Wardrobe's own width/height dim (not a hand-added world-mm offset,
  // e.g. "+40") — that offset shrinks to almost nothing once a dense
  // composite drawing gets scaled down for its canvas, letting the two
  // labels collide. The stacked-offset tier system (collisionEngine.ts,
  // fixed screen-px per tier, scale-independent) is what actually keeps
  // them apart; forcing totalWidthTier/totalHeightTier one tier further
  // out than the inner dimension makes the real-CAD "overall dimension is
  // the outermost line" convention explicit rather than incidental.
  // Auto-derived composite "total width" / "total height" — only shown
  // when the user has NOT entered an explicit Total Width / Total Height
  // below (those entered values are the authoritative overall figures;
  // showing both the composite AND the entered value just clutters and
  // reads as "why are there two totals?"). When shown, these are the
  // "Wardrobe + Dressing + Side Panel" composite / "Wardrobe Height +
  // 10mm gap + Loft Height" stack.
  if (leftExtra + rightExtra > 0 && !(totalWidthMm && totalWidthMm > 0)) {
    dimReqs.push({ axis: 'h', x1: loftX, y1: wardrobeY + bodyH, x2: loftX + totalWidth, y2: wardrobeY + bodyH, edge: 'bottom', componentIds: [], label: `${Math.round(totalWidth)} (Total W)`, source: { formula: 'Total Width = Side Panel + Dressing + Wardrobe Width + Dressing + Side Panel', constants: [] } });
  }
  if (loftH > 0 && !(totalHeightMm && totalHeightMm > 0)) {
    dimReqs.push({ axis: 'v', x1: wardrobeX + W, y1: topPad, x2: wardrobeX + W, y2: wardrobeY + bodyH, edge: 'right', componentIds: [], label: `${Math.round(loftH + LOFT_WARDROBE_GAP_MM + H)} (Total H)`, source: { formula: 'Total Height = Wardrobe Height (incl. skirting) + 10mm gap + Loft Height', constants: [] } });
  }

  // Explicitly-entered "Total Width" / "Total Height" — separate measurement
  // fields the user fills in directly (not derived from add-ons); the
  // drawing shows exactly the value entered, never recomputed. These are
  // genuinely allowed to differ from the Wardrobe's own Width/Height (e.g.
  // when the overall opening is larger than the wardrobe unit itself) —
  // per the user's explicit confirmation, no reconciliation between the two
  // is attempted; both are shown, honestly, side by side. Spans the full
  // composite footprint (same outer span as the add-on-driven total lines
  // above) so it always reads as the true overall envelope, but carries
  // its own distinct label/formula so it's never confused with — or
  // silently overwritten by — the add-on-derived total above.
  if (totalWidthMm && totalWidthMm > 0) {
    // This dimension's VISUAL span must match its own label — per the
    // user's explicit correction ("dimensions must follow the corrected
    // geometry... do not leave dimensions attached to old coordinates").
    // Spanning to `loftX + totalWidth` (the lower composite's own,
    // possibly-narrower width) here was a real bug: the line would end
    // short of where its "Total Width, entered" label claims whenever the
    // entered Total Width exceeds the Wardrobe+Dressing+Top Panel
    // composite (exactly the Loft-alignment scenario this fix addresses).
    // roomWallWidth is the same true wall-to-wall span the Loft row itself
    // is now measured against.
    dimReqs.push({ axis: 'h', x1: loftX, y1: wardrobeY + bodyH, x2: loftX + Math.max(totalWidthMm, totalWidth), y2: wardrobeY + bodyH, edge: 'bottom', componentIds: [], label: `${Math.round(totalWidthMm)} (Total W)`, source: { formula: 'Total Width (entered directly — a separate measurement, NOT Wardrobe Width + Dressing Width + Side Panel Width)', constants: [] } });
  }
  if (totalHeightMm && totalHeightMm > 0) {
    dimReqs.push({ axis: 'v', x1: wardrobeX + W, y1: Math.min(topPad, wardrobeY), x2: wardrobeX + W, y2: wardrobeY + bodyH, edge: 'right', componentIds: [], label: `${Math.round(totalHeightMm)} (Total H)`, source: { formula: 'Total Height (entered directly — a separate measurement, NOT the same as Wardrobe Height)', constants: [] } });
  }

  // Side Dressing — flush against the Wardrobe carcass (both sit on the
  // same skirting/floor line, so Dressing's own drawn height matches
  // bodyH, the wardrobe's post-skirting carcass height — not the raw
  // entered H). Width now gets its own real dimension arrow (below), on
  // top of the existing caption text (which stays, per no-redesign) — it
  // previously only appeared as text, never a measured arrow like every
  // other value here. Height still gets its own real leader since it's
  // the auto-fetched, non-obvious value. The Height leader is pushed
  // clear of the box (not just a few px) and forced to tier 1 — its label
  // is centered ON the line, so a tight same-tier offset let the label's
  // own rendered width dip back into the "Dressing" caption inside the box.
  const dressLeaderGap = 40;
  // Mirror (spec §22) + Drawers (spec §19-21) — real optional internals
  // drawn INSIDE the Dressing box: Mirror fills the upper portion (no
  // independent measurement, per the spec), Drawers fill the lower
  // portion, dynamically generated per the entered count and Total
  // Drawer Height (auto-divided evenly, never asked per-drawer), each
  // one's Width always equal to Dressing Width (never a separate field).
  function drawDressingInternals(dressId: string, dx: number, dressW: number) {
    const hasMirror = dressing.hasMirror;
    const drawerCount = Math.max(0, Math.round(dressing.drawerCount) || 0);
    const totalDrawerH = drawerCount > 0 ? Math.min(dressing.totalDrawerHeightMm, bodyH) : 0;
    if (hasMirror) {
      const mirrorH = bodyH - totalDrawerH;
      components.push({
        id: `${dressId}-mirror`, type: 'MIRROR', label: 'Mirror', x: dx, y: wardrobeY, width: dressW, height: mirrorH, qty: 1, visible: true,
        source: { formula: 'Dressing Mirror — Width = Dressing Width, Height = Dressing Height minus Drawer section (both auto-fetched), no independent measurement', constants: [] },
      });
    }
    if (drawerCount > 0) {
      const drawerY = wardrobeY + bodyH - totalDrawerH;
      const eachH = totalDrawerH / drawerCount;
      for (let i = 0; i < drawerCount; i++) {
        components.push({
          // No per-drawer size label — the user only wants the Total
          // Drawer Height shown, never each individual drawer's height.
          // Just the count of drawer bands drawn.
          id: `${dressId}-drawer-${i}`, type: 'DRAWER', label: i === 0 ? `${drawerCount} Drawers` : '', x: dx, y: drawerY + i * eachH, width: dressW, height: eachH, qty: 1, visible: true,
          source: { formula: `Drawer ${i + 1} of ${drawerCount} — Width = Dressing Width (auto) | drawn height = Total Drawer Height(${Math.round(totalDrawerH)}) ÷ ${drawerCount}`, constants: [] },
        });
      }
      // Only the Total Drawer Height is called out (a plain vertical
      // arrow on the drawer section's own edge) — never per-drawer sizes.
      dimReqs.push({ axis: 'v', x1: dx + dressW * 0.5, y1: drawerY, x2: dx + dressW * 0.5, y2: drawerY + totalDrawerH, edge: 'left', componentIds: [`${dressId}-drawer-0`], label: `${Math.round(totalDrawerH)} (Total Drawer H)`, source: { formula: 'Total Drawer Height (entered), auto-divided evenly among the entered Drawer Count', constants: [] } });
    }
  }
  if (dressL > 0) {
    const dx = wardrobeX - dressL;
    // Dressing's own Width shown right IN its box (label), Height as a
    // plain vertical arrow on its outer edge. Height = Wardrobe Height
    // (they are equal — per the user's "Wardrobe height = dressing
    // height" note), so it's not re-labelled as a separate figure.
    components.push({ id: 'dress-l', type: 'DRESSING', label: `Dressing\n${Math.round(dressL)} W`, x: dx, y: wardrobeY, width: dressL, height: bodyH, qty: 1, visible: true, source: { formula: `Width = ${Math.round(dressL)}mm (entered) | Height = Wardrobe Height (equal, auto-fetched)`, constants: [] } });
    dimReqs.push({ axis: 'v', x1: dx - dressLeaderGap, y1: wardrobeY, x2: dx - dressLeaderGap, y2: wardrobeY + bodyH, edge: 'left', componentIds: ['dress-l'], label: `${Math.round(bodyH)} (H)`, source: { formula: 'Dressing Height = Wardrobe Height (equal, auto-fetched)', constants: [] } });
    drawDressingInternals('dress-l', dx, dressL);
  }
  if (dressR > 0) {
    const dx = wardrobeX + W;
    components.push({ id: 'dress-r', type: 'DRESSING', label: `Dressing\n${Math.round(dressR)} W`, x: dx, y: wardrobeY, width: dressR, height: bodyH, qty: 1, visible: true, source: { formula: `Width = ${Math.round(dressR)}mm (entered) | Height = Wardrobe Height (equal, auto-fetched)`, constants: [] } });
    dimReqs.push({ axis: 'v', x1: dx + dressR + dressLeaderGap, y1: wardrobeY, x2: dx + dressR + dressLeaderGap, y2: wardrobeY + bodyH, edge: 'right', componentIds: ['dress-r'], label: `${Math.round(bodyH)} (H)`, source: { formula: 'Dressing Height = Wardrobe Height (equal, auto-fetched)', constants: [] } });
    drawDressingInternals('dress-r', dx, dressR);
  }

  // Skirting — a real, labelled 70mm band at the FLOOR line of the lower
  // structure (Dressing + Wardrobe + Top Panel), drawn as the bottom
  // 70mm OF the wardrobe's own full entered Height (not an extra strip
  // added below it — the entered Height already includes it, per the
  // user's explicit instruction). Width is clipped to the actual lower-
  // product footprint (never the full Room Total Width). Drawing-only:
  // no measurement field, just a labelled band + a plain "70 (Skirting)"
  // callout.
  if (skirtH > 0) {
    // Skirting spans ONLY the floor-standing components: Dressing +
    // Wardrobe (+ Study Table when attached) — NOT the Top/Side Panel,
    // which sits up at the Loft's bottom edge, not on the floor. Per the
    // user's explicit "skirting width = wardrobe width + dressing (if
    // given) + study table (if given)".
    const skirtY = wardrobeY + bodyH - skirtH;
    const skirtX = wardrobeX - dressL;
    const skirtW = dressL + W + dressR;
    components.push({
      id: 'skirting', type: 'SKIRTING', label: `Skirting ${skirtH}`, x: skirtX, y: skirtY, width: skirtW, height: skirtH, qty: 1, visible: true,
      source: { formula: `Fixed ${skirtH}mm skirting band at the floor line — spans Dressing + Wardrobe (+ Study Table), part of the entered Wardrobe Height, not subtracted from it`, constants: [] },
    });
    dimReqs.push({ axis: 'v', x1: skirtX + skirtW + 16, y1: skirtY, x2: skirtX + skirtW + 16, y2: skirtY + skirtH, edge: 'right', componentIds: ['skirting'], label: `${skirtH} (Skirting)`, source: { formula: `Fixed ${skirtH}mm skirting band`, constants: [] } });
  }

  // Top Panel (renamed from Side Panel — per the user's own, twice-
  // confirmed correction; SAME geometry/position/purpose, only the name
  // changed) — not a box at all, just one real horizontal line (a thin
  // partition marker, real technical-drawing convention for a panel whose
  // thickness isn't worth drawing as a filled rectangle), top-aligned
  // against the Wardrobe/Dressing edge, directly below the Loft (unchanged
  // position). Depth (its length) is called out the same way every other
  // out-of-plan value in this drawing is: a big "/" diagonal leader
  // anchored at the line's own OUTER corner (away from the Wardrobe/
  // Dressing it sits beside), never the inner one shared with them. Width
  // gets its own real straight arrow — a short vertical dimension stub
  // right beside the panel, spanning its actual Width value.
  //
  // Once a Loft is added, the Loft's own box visually spans directly above
  // this same panel (it covers the full composite width), so the panel is
  // drawn bold and in a distinct colour — otherwise it would read as just
  // another thin line under the Loft's edge. Never confused with Fix
  // Patti (which lives INSIDE the Loft's own row, above) — two completely
  // separate components at two completely separate drawing positions.
  const panelLineColor = loft.enabled ? '#7c3aed' : '#222';
  const panelLineWidth = loft.enabled ? 2.5 : 0.8;
  if (topPanelL > 0) {
    const px = wardrobeX - dressL - topPanelL;
    // Horizontal slat spanning the Top Panel's own WIDTH; a horizontal
    // dim line under it shows that Width, and a short diagonal "(D)"
    // leader shows its Depth.
    lines.push({ x1: px, y1: wardrobeY, x2: px + topPanelL, y2: wardrobeY, color: panelLineColor, strokeWidth: panelLineWidth });
    lines.push({ x1: px, y1: wardrobeY, x2: px - 90, y2: wardrobeY - 90, color: DIAG, label: `${Math.round(topPanel.depthMm)} (D)` });
    dimReqs.push({ axis: 'h', x1: px, y1: wardrobeY, x2: px + topPanelL, y2: wardrobeY, edge: 'top', componentIds: [], label: `${Math.round(topPanel.widthMm)} (W)`, source: { formula: 'Side Panel Width = Total Room Width − Wardrobe Width − Dressing Width + 20mm extra (auto-calculated, editable)', constants: [] } });
  }
  if (topPanelR > 0) {
    const px = wardrobeX + W + dressR;
    lines.push({ x1: px, y1: wardrobeY, x2: px + topPanelR, y2: wardrobeY, color: panelLineColor, strokeWidth: panelLineWidth });
    lines.push({ x1: px + topPanelR, y1: wardrobeY, x2: px + topPanelR + 90, y2: wardrobeY - 90, color: DIAG, label: `${Math.round(topPanel.depthMm)} (D)` });
    dimReqs.push({ axis: 'h', x1: px, y1: wardrobeY, x2: px + topPanelR, y2: wardrobeY, edge: 'top', componentIds: [], label: `${Math.round(topPanel.widthMm)} (W)`, source: { formula: 'Side Panel Width = Total Room Width − Wardrobe Width − Dressing Width + 20mm extra (auto-calculated, editable)', constants: [] } });
  }

  // Extra Storage + Open Box — real boxes drawn OUTSIDE Top Panel/Dressing
  // (the outermost column in the composite, per storageColL/storageColR
  // above), with Storage stacked ABOVE Open Box on the same side when
  // both are present (spec §33/§36 — "Storage above, Open Box below"),
  // and each one's own real door/leader-arrow treatment.
  const storageBoxLeaderGap = 16;
  function drawStorageColumn(side: 'left' | 'right', colX: number, colW: number, storageSide: WardrobeStorageSideInput | null, openBoxSide: WardrobeOpenBoxSideInput | null) {
    const hasStorage = !!storageSide?.enabled;
    const hasOpenBox = !!openBoxSide?.enabled;
    if (!hasStorage && !hasOpenBox) return;
    // Storage occupies the TOP portion of the reserved column, Open Box
    // the BOTTOM — matching the reference's "Storage above, Open Box
    // below" stacking. When only one is present, it simply fills the
    // whole bodyH height on its own (spec §33 "do not leave an empty
    // Storage Box placeholder" — no phantom box for the absent one).
    const storageH = hasStorage ? (hasOpenBox ? bodyH * 0.55 : bodyH) : 0;
    const openBoxH = hasOpenBox ? bodyH - storageH : 0;
    let cursorY = wardrobeY;
    if (hasStorage && storageSide) {
      const count = Math.max(1, Math.round(storageSide.doorCount) || 1);
      const doorW = loftOneDoorWidth(storageSide.widthMm, count);
      const gapMm = 2;
      let doorCursorX = colX;
      for (let i = 0; i < count; i++) {
        components.push({
          id: `storage-${side}-door-${i}`, type: 'STORAGE_DOOR', label: count === 1 ? `Storage\n${Math.round(doorW)}` : `${Math.round(doorW)}`,
          x: doorCursorX, y: cursorY, width: doorW, height: storageH, qty: 1, visible: true,
          source: { formula: `Storage Box (${side}) Door ${i + 1} of ${count} — Width = (Storage Width(${Math.round(storageSide.widthMm)}) − ${count}×2) / ${count} = ${doorW.toFixed(2)}mm — from Storage Width only, never Room/Loft/Wardrobe Width`, constants: [] },
        });
        doorCursorX += doorW + gapMm;
      }
      // Small leader-arrow callouts for Height/Depth — kept OUTSIDE the
      // component (per spec §35 "DO NOT squeeze the dimension text into
      // the component... use Leader Arrow + Measurement Text") since the
      // column is often narrow.
      const leaderX = side === 'left' ? colX - storageBoxLeaderGap : colX + colW + storageBoxLeaderGap;
      dimReqs.push({ axis: 'v', x1: leaderX, y1: cursorY, x2: leaderX, y2: cursorY + storageH, edge: side === 'left' ? 'left' : 'right', componentIds: [], label: `${Math.round(storageSide.heightMm)} (Storage H)`, source: { formula: 'Storage Height (entered)', constants: [] } });
      const storageDiag = insideDiagonal(colX, cursorY, colW, storageH, side === 'left' ? 'left-down' : 'right-down');
      lines.push({ x1: colX + (side === 'left' ? colW : 0), y1: cursorY, x2: storageDiag.x2, y2: storageDiag.y2, color: DIAG, label: `${Math.round(storageSide.depthMm)} (D)` });
      cursorY += storageH;
    }
    if (hasOpenBox && openBoxSide) {
      components.push({
        id: `open-box-${side}`, type: 'OPEN_BOX', label: `Open Box\n${Math.round(openBoxSide.widthMm)}×${Math.round(openBoxSide.heightMm)}`,
        x: colX, y: cursorY, width: colW, height: openBoxH, qty: 1, visible: true,
        source: { formula: `Open Box (${side}) — Width x Height (both entered), no door/shutter`, constants: [] },
      });
      const leaderX = side === 'left' ? colX - storageBoxLeaderGap : colX + colW + storageBoxLeaderGap;
      dimReqs.push({ axis: 'v', x1: leaderX, y1: cursorY, x2: leaderX, y2: cursorY + openBoxH, edge: side === 'left' ? 'left' : 'right', componentIds: [`open-box-${side}`], label: `${Math.round(openBoxSide.heightMm)} (Open Box H)`, source: { formula: 'Open Box Height (entered)', constants: [] } });
      const openBoxDiag = insideDiagonal(colX, cursorY, colW, openBoxH, side === 'left' ? 'left-down' : 'right-down');
      lines.push({ x1: colX + (side === 'left' ? colW : 0), y1: cursorY, x2: openBoxDiag.x2, y2: openBoxDiag.y2, color: DIAG, label: `${Math.round(openBoxSide.depthMm)} (D)` });
    }
  }
  if (storageColL > 0) {
    const colX = wardrobeX - dressL - topPanelL - storageColL;
    drawStorageColumn('left', colX, storageColL, hasStorageL ? storageActiveL : null, hasOpenBoxL ? openBoxActiveL : null);
  }
  if (storageColR > 0) {
    const colX = wardrobeX + W + dressR + topPanelR;
    drawStorageColumn('right', colX, storageColR, hasStorageR ? storageActiveR : null, hasOpenBoxR ? openBoxActiveR : null);
  }

  // +26 covers the skirting dimension line's own +16 offset past the
  // composite's right edge (see above) plus its label's own drawn width.
  // Also covers the full room-wall span (roomWallWidth — Fix Patti +
  // loftFrameWidth + Fix Patti, or the raw entered Total Width if that's
  // wider still), which can genuinely exceed the wardrobe's own composite
  // totalWidth once the Loft/room-wall alignment fix means the two are no
  // longer assumed equal.
  // adjacentLoftRightEdge covers a RIGHT-side Wall B, which can extend
  // the canvas further right than the room-wall span alone would — a
  // LEFT-side Wall B is already covered by the leaderMargin/roomWallX
  // shift above (everything else's own origin already makes room for it).
  const adjacentLoftRightEdge = adjacentLoft.enabled && adjacentLoft.side === 'right' ? loftX + roomWallWidth + 60 + 130 + 20 : 0;
  const worldWidth = Math.max(loftX + totalWidth + (skirtH > 0 ? 26 : 0), loft.enabled ? loftX + roomWallWidth + 20 : 0, adjacentLoftRightEdge, ...lines.map((l) => Math.max(l.x1, l.x2) + 10));
  // bodyH now IS the full entered Wardrobe Height (skirting is drawn as
  // a band inside its bottom, not an extra strip below it) — so no
  // "+ skirtH" here any more; the extra 70/20 is just headroom for the
  // bottom dimension line(s).
  const worldHeight = Math.max(wardrobeY + bodyH + (leftExtra + rightExtra > 0 ? 70 : 20), ...lines.map((l) => Math.max(l.y1, l.y2) + 10));

  // The Dressing Height leader sits right beside a narrow box whose own
  // "Dressing" caption is centered inside it — the standard tier-0 offset
  // (18px, fixed regardless of drawing scale) is narrower than the label's
  // own rendered width, so its bordered box would clip into the component
  // it's labeling. Forcing it out to tier 1 (36px) is scale-independent —
  // unlike widening dressLeaderGap, which is a world-mm value that shrinks
  // to almost nothing once scaled down for a large composite drawing.
  const resolvedDims = resolveDimensions(dimReqs);
  // "total width"/"total height" share the Wardrobe's own width/height
  // base edge (see above) so the collisionEngine's span-overlap tiering
  // is what actually separates them on screen — but the engine sorts by
  // span START, and the total-* span (Side Panel/Dressing to Side Panel/
  // Dressing) always starts at or before the Wardrobe's own narrower
  // span, so auto-tiering alone can put it on the INNER tier instead of
  // the outer one. Real CAD convention: the overall dimension always
  // reads outside the individual one it encloses — so pin it explicitly,
  // one tier past whatever the wardrobe's own width/height landed on.
  const ownWidthTier = resolvedDims.find((d) => d.label.includes('(width)'))?.tier ?? 0;
  const ownHeightTier = resolvedDims.find((d) => d.label.includes('(height)'))?.tier ?? 0;
  const computedTotalWidthTier = resolvedDims.find((d) => d.label.includes('total width'))?.tier;
  const computedTotalHeightTier = resolvedDims.find((d) => d.label.includes('total height'))?.tier;
  const dimensions = resolvedDims.map((d) => {
    const isDressingHeight = (d.componentIds.includes('dress-l') || d.componentIds.includes('dress-r')) && (d.edge === 'left' || d.edge === 'right');
    if (isDressingHeight) return { ...d, tier: Math.max(d.tier, 1) };
    if (d.label.includes('total width')) return { ...d, tier: Math.max(d.tier, ownWidthTier + 1) };
    if (d.label.includes('total height')) return { ...d, tier: Math.max(d.tier, ownHeightTier + 1) };
    // The user-entered "Total Width/Height" always reads as the true
    // outermost dimension — one tier past the add-on-driven computed total
    // when one is showing, or past the wardrobe's own width/height when
    // there's no add-on total to sit outside of.
    if (d.label.includes('Total Width, entered')) return { ...d, tier: Math.max(d.tier, (computedTotalWidthTier ?? ownWidthTier) + 1) };
    if (d.label.includes('Total Height, entered')) return { ...d, tier: Math.max(d.tier, (computedTotalHeightTier ?? ownHeightTier) + 1) };
    return d;
  });
  const issues = [
    ...validateMeasurements({ W, H, D }, [
      { key: 'W', label: 'Wardrobe Width', min: 1 },
      { key: 'H', label: 'Wardrobe Height', min: 1 },
      { key: 'D', label: 'Wardrobe Depth', min: 1 },
    ]),
    ...(dressing.enabled ? validateMeasurements({ W: dressing.widthMm }, [{ key: 'W', label: 'Dressing Width', min: 1 }]) : []),
    ...(dressing.enabled && dressing.drawerCount > 0 ? validateMeasurements({ H: dressing.totalDrawerHeightMm }, [{ key: 'H', label: 'Total Drawer Height', min: 1 }]) : []),
    ...(dressing.enabled && dressing.drawerCount > 0 && dressing.totalDrawerHeightMm > bodyH ? [{ id: 'val-drawer-height-exceeds', severity: 'WARNING' as const, code: 'DRAWER_HEIGHT_EXCEEDS_DRESSING', message: `⚠ Total Drawer Height (${Math.round(dressing.totalDrawerHeightMm)}mm) exceeds Dressing Height (${Math.round(bodyH)}mm) — clamped to fit.` }] : []),
    ...(inp.studyTable.enabled ? validateMeasurements({ H: inp.studyTable.heightMm, W: inp.studyTable.widthMm, D: inp.studyTable.depthMm }, [{ key: 'H', label: 'Study Table Height', min: 1 }, { key: 'W', label: 'Study Table Width', min: 1 }, { key: 'D', label: 'Study Table Depth', min: 1 }]) : []),
    ...(adjacentLoft.enabled ? validateMeasurements({ H: adjacentLoft.heightMm, W: adjacentLoft.widthMm }, [{ key: 'H', label: 'L-Shaped Loft (Wall B) Height', min: 1 }, { key: 'W', label: 'L-Shaped Loft (Wall B) Width', min: 1 }]) : []),
    ...(adjacentLoft.enabled && (adjacentLoft.fixPatti.position === 'left' || adjacentLoft.fixPatti.position === 'both') ? validateMeasurements({ H: adjacentLoft.fixPatti.leftHeightMm, W: adjacentLoft.fixPatti.leftWidthMm }, [{ key: 'H', label: 'Wall B Left Fix Patti Height', min: 1 }, { key: 'W', label: 'Wall B Left Fix Patti Width', min: 1 }]) : []),
    ...(adjacentLoft.enabled && (adjacentLoft.fixPatti.position === 'right' || adjacentLoft.fixPatti.position === 'both') ? validateMeasurements({ H: adjacentLoft.fixPatti.rightHeightMm, W: adjacentLoft.fixPatti.rightWidthMm }, [{ key: 'H', label: 'Wall B Right Fix Patti Height', min: 1 }, { key: 'W', label: 'Wall B Right Fix Patti Width', min: 1 }]) : []),
    ...(adjacentLoft.enabled && (adjacentLoft.khacha.position === 'left' || adjacentLoft.khacha.position === 'both') ? validateMeasurements({ H: adjacentLoft.khacha.leftHeightMm, W: adjacentLoft.khacha.leftWidthMm }, [{ key: 'H', label: 'Wall B Left Khacha Height', min: 1 }, { key: 'W', label: 'Wall B Left Khacha Width', min: 1 }]) : []),
    ...(adjacentLoft.enabled && (adjacentLoft.khacha.position === 'right' || adjacentLoft.khacha.position === 'both') ? validateMeasurements({ H: adjacentLoft.khacha.rightHeightMm, W: adjacentLoft.khacha.rightWidthMm }, [{ key: 'H', label: 'Wall B Right Khacha Height', min: 1 }, { key: 'W', label: 'Wall B Right Khacha Width', min: 1 }]) : []),
    // Wall B door width standard (310–400mm) — same real WARNING
    // treatment as Wall A's own check, using Wall B's own width only.
    ...(() => {
      if (!adjacentLoft.enabled) return [];
      const count = Math.max(1, Math.round(adjacentLoft.doorCount) || 1);
      const oneDoorW = loftOneDoorWidth(adjacentLoft.widthMm, count);
      const status = loftDoorWidthStatus(oneDoorW);
      if (status === 'below-min') return [{ id: 'val-adjacent-loft-door-narrow', severity: 'WARNING' as const, code: 'ADJACENT_LOFT_DOOR_TOO_NARROW', message: `⚠ Wall B door width below 310mm (currently ${oneDoorW.toFixed(0)}mm) — reduce Door Count or increase Wall B Width.` }];
      if (status === 'above-max') return [{ id: 'val-adjacent-loft-door-wide', severity: 'WARNING' as const, code: 'ADJACENT_LOFT_DOOR_TOO_WIDE', message: `⚠ Wall B door width exceeds 400mm (currently ${oneDoorW.toFixed(0)}mm) — increase Door Count.` }];
      return [];
    })(),
    // Total Width (entered) must be a real, physically consistent room
    // measurement — it should not be meaningfully narrower than the
    // furniture placed against it (Wardrobe + Dressing + Side Panel +
    // Storage column). A tolerance covers the intentional +20mm Side
    // Panel overhang (Side Panel Width = Total − Wardrobe − Dressing +
    // 20, so the composite legitimately runs ~20mm past Total Width) plus
    // rounding. Real WARNING (not CRITICAL) — the drawing still renders.
    ...(totalWidthMm && totalWidthMm > 0 && totalWidthMm < totalWidth - 25 ? [{ id: 'val-total-width-too-small', severity: 'WARNING' as const, code: 'TOTAL_WIDTH_SMALLER_THAN_FURNITURE', message: `⚠ Total Width entered (${Math.round(totalWidthMm)}mm) is smaller than the Wardrobe+Dressing+Side Panel width (${Math.round(totalWidth)}mm) — Total Width should be the full room span and can never be narrower than the furniture placed in it.` }] : []),
    ...(topPanel.enabled ? validateMeasurements({ W: topPanel.widthMm, D: topPanel.depthMm }, [{ key: 'W', label: 'Top Panel Width', min: 1 }, { key: 'D', label: 'Top Panel Depth', min: 1 }]) : []),
    ...(loft.enabled ? validateMeasurements({ W: loft.widthMm, H: loft.heightMm }, [{ key: 'W', label: 'Loft Width', min: 1 }, { key: 'H', label: 'Loft Height', min: 1 }]) : []),
    ...(loft.enabled && (fixPatti.position === 'left' || fixPatti.position === 'both') ? validateMeasurements({ H: fixPatti.leftHeightMm, W: fixPatti.leftWidthMm }, [{ key: 'H', label: 'Left Fix Patti Height', min: 1 }, { key: 'W', label: 'Left Fix Patti Width', min: 1 }]) : []),
    ...(loft.enabled && (fixPatti.position === 'right' || fixPatti.position === 'both') ? validateMeasurements({ H: fixPatti.rightHeightMm, W: fixPatti.rightWidthMm }, [{ key: 'H', label: 'Right Fix Patti Height', min: 1 }, { key: 'W', label: 'Right Fix Patti Width', min: 1 }]) : []),
    ...(loft.enabled && (khacha.position === 'left' || khacha.position === 'both') ? validateMeasurements({ H: khacha.leftHeightMm, W: khacha.leftWidthMm }, [{ key: 'H', label: 'Left Khacha Height', min: 1 }, { key: 'W', label: 'Left Khacha Width', min: 1 }]) : []),
    ...(loft.enabled && (khacha.position === 'right' || khacha.position === 'both') ? validateMeasurements({ H: khacha.rightHeightMm, W: khacha.rightWidthMm }, [{ key: 'H', label: 'Right Khacha Height', min: 1 }, { key: 'W', label: 'Right Khacha Width', min: 1 }]) : []),
    // Door width standard (310–400mm) — a real WARNING, not a hard block,
    // per the spec's own "⚠ Door width below/exceeds..." wording (not a
    // CRITICAL that stops PDF generation the way a genuinely invalid
    // layout does).
    ...(() => {
      if (!loft.enabled) return [];
      // loft.widthMm is already the usable Loft Width (Total Room Width −
      // Fix Patti − Khacha) — no further deduction here.
      const usableW = loft.widthMm;
      const count = Math.max(1, Math.round(loft.doorCount) || 1);
      const oneDoorW = loftOneDoorWidth(usableW, count);
      const status = loftDoorWidthStatus(oneDoorW);
      if (status === 'below-min') return [{ id: 'val-loft-door-narrow', severity: 'WARNING' as const, code: 'LOFT_DOOR_TOO_NARROW', message: `⚠ Door width below 310mm (currently ${oneDoorW.toFixed(0)}mm) — reduce Door Count or increase Total Width.` }];
      if (status === 'above-max') return [{ id: 'val-loft-door-wide', severity: 'WARNING' as const, code: 'LOFT_DOOR_TOO_WIDE', message: `⚠ Door width exceeds 400mm (currently ${oneDoorW.toFixed(0)}mm) — increase Door Count.` }];
      return [];
    })(),
    ...(hasStorageL ? validateMeasurements({ H: storageActiveL!.heightMm, W: storageActiveL!.widthMm, D: storageActiveL!.depthMm }, [{ key: 'H', label: 'Left Storage Height', min: 1 }, { key: 'W', label: 'Left Storage Width', min: 1 }, { key: 'D', label: 'Left Storage Depth', min: 1 }]) : []),
    ...(hasStorageR ? validateMeasurements({ H: storageActiveR!.heightMm, W: storageActiveR!.widthMm, D: storageActiveR!.depthMm }, [{ key: 'H', label: 'Right Storage Height', min: 1 }, { key: 'W', label: 'Right Storage Width', min: 1 }, { key: 'D', label: 'Right Storage Depth', min: 1 }]) : []),
    ...(hasOpenBoxL ? validateMeasurements({ H: openBoxActiveL!.heightMm, W: openBoxActiveL!.widthMm, D: openBoxActiveL!.depthMm }, [{ key: 'H', label: 'Left Open Box Height', min: 1 }, { key: 'W', label: 'Left Open Box Width', min: 1 }, { key: 'D', label: 'Left Open Box Depth', min: 1 }]) : []),
    ...(hasOpenBoxR ? validateMeasurements({ H: openBoxActiveR!.heightMm, W: openBoxActiveR!.widthMm, D: openBoxActiveR!.depthMm }, [{ key: 'H', label: 'Right Open Box Height', min: 1 }, { key: 'W', label: 'Right Open Box Width', min: 1 }, { key: 'D', label: 'Right Open Box Depth', min: 1 }]) : []),
    // Storage Box door width standard (310–400mm) — same real WARNING
    // treatment as the Loft's own door-width check, per side, using
    // Storage Width ONLY (never Room/Loft/Wardrobe Width, spec §29).
    ...(() => {
      const out: { id: string; severity: 'WARNING'; code: string; message: string }[] = [];
      for (const [side, s] of [['Left', hasStorageL ? storageActiveL : null], ['Right', hasStorageR ? storageActiveR : null]] as const) {
        if (!s) continue;
        const count = Math.max(1, Math.round(s.doorCount) || 1);
        const oneDoorW = loftOneDoorWidth(s.widthMm, count);
        const status = loftDoorWidthStatus(oneDoorW);
        if (status === 'below-min') out.push({ id: `val-storage-door-narrow-${side}`, severity: 'WARNING', code: 'STORAGE_DOOR_TOO_NARROW', message: `⚠ ${side} Storage door width below 310mm (currently ${oneDoorW.toFixed(0)}mm) — reduce Door Count or increase Storage Width.` });
        if (status === 'above-max') out.push({ id: `val-storage-door-wide-${side}`, severity: 'WARNING', code: 'STORAGE_DOOR_TOO_WIDE', message: `⚠ ${side} Storage door width exceeds 400mm (currently ${oneDoorW.toFixed(0)}mm) — increase Door Count.` });
      }
      return out;
    })(),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'wardrobe', designId: 'simple', designName: 'Wardrobe',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines,
  };
}
