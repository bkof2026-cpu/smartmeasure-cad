import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';
import {
  loftOneDoorWidth, loftDoorWidthStatus, totalKhachaWidth,
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
  const { W, H, D, dressing, topPanel, loft, fixPatti, khacha, storage, openBox, totalWidthMm, totalHeightMm } = inp;
  const leaderMargin = 150; // room for the Wardrobe's own Depth "/" leader

  // Skirting — a real 70mm board strip at the bottom of the wardrobe
  // carcass (and Side Dressing, which sits on the same floor line). The
  // ENTERED Height stays the true overall/floor-to-top figure (matching
  // what was actually measured on site); the carcass itself is drawn
  // WARDROBE_SKIRTING_HEIGHT_MM shorter, with the difference filled by a
  // labeled skirting strip below it — per the user's explicit confirmation
  // of this exact math. Guarded so a Height smaller than the skirting
  // itself never goes negative (falls back to the full entered H, no
  // skirting drawn) rather than producing an invalid/inverted box.
  const skirtH = H > WARDROBE_SKIRTING_HEIGHT_MM ? WARDROBE_SKIRTING_HEIGHT_MM : 0;
  const bodyH = H - skirtH;

  const dressL = dressing.enabled && dressing.side !== 'right' ? dressing.widthMm : 0;
  const dressR = dressing.enabled && dressing.side !== 'left' ? dressing.widthMm : 0;
  // Top Panel (renamed from Side Panel — same component, same geometry) is
  // drawn rotated — Depth is its horizontal extent, Width its short
  // vertical extent (a flat horizontal slat, not a tall sliver) — so the
  // horizontal space it reserves in the composite layout is its Depth.
  const topPanelL = topPanel.enabled && topPanel.side !== 'right' ? topPanel.depthMm : 0;
  const topPanelR = topPanel.enabled && topPanel.side !== 'left' ? topPanel.depthMm : 0;

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
          x: doorCursorX, y: loftY + 2, width: doorW, height: loftH - 4, qty: 1, visible: true,
          source: { formula: `Loft Door ${i + 1} of ${count} — Width = (Loft Width(${Math.round(loftFrameWidth)}) − ${count}×2) / ${count} = ${doorW.toFixed(2)}mm`, constants: [] },
        });
        doorCursorX += doorW + gapMm;
      }
    }
    if (loft.mode === 'box') {
      const loftDiag = insideDiagonal(doorsAreaX, loftY, loftFrameWidth, loftH, 'right-down');
      lines.push({ x1: doorsAreaX, y1: loftY, x2: loftDiag.x2, y2: loftDiag.y2, color: DIAG, label: `${Math.round(loft.depthMm)} mm (D)` });
    }
    // Loft Height — a real dimension arrow on the loft's own left edge
    // (it previously only appeared as caption/label text, never a real
    // arrow like every other value in this drawing).
    dimReqs.push({ axis: 'v', x1: loftX, y1: loftY, x2: loftX, y2: loftY + loftH, edge: 'left', componentIds: ['loft'], label: `${Math.round(loftH)} mm (Loft H)`, source: { formula: 'Loft Height = Total Height − Wardrobe Height − 10mm gap (auto-calculated, editable)', constants: [] } });
    // The 10mm gap between Wardrobe and Loft — a required, visible
    // annotation per the spec (§22 "Do not hide the 10mm deduction
    // completely"). Drawn as a short leader just below the Loft's own
    // bottom edge, pointing into the real gap band above the Wardrobe.
    if (totalHeightMm && totalHeightMm > 0) {
      const gapY = loftY + loftH;
      const rowFullWidth = loftRowWidth;
      lines.push({ x1: loftX + rowFullWidth * 0.5, y1: gapY, x2: loftX + rowFullWidth * 0.5 + 40, y2: gapY + 24, color: '#64748b', label: '10 mm GAP' });
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
    if (Math.abs(wallGap) > 1) {
      const wallY = loftY + loftH / 2;
      const gapLeftX = Math.min(loftRowRightEdge, lowerStructureRightEdge);
      const gapRightX = Math.max(loftRowRightEdge, lowerStructureRightEdge);
      lines.push({
        x1: gapLeftX, y1: wallY, x2: gapRightX, y2: wallY,
        color: '#94a3b8', dashed: true, label: `Room Wall (${Math.round(gapRightX - gapLeftX)}mm)`,
      });
    }
  }

  const wardrobeY = topPad + loftH;

  // Wardrobe — a plain W x bodyH carcass (entered H minus the skirting
  // strip below it), Depth shown as the "/" diagonal leader at its own
  // top-left corner.
  components.push({
    id: 'wardrobe', type: 'WARDROBE_BODY', label: `Wardrobe ${Math.round(W)}×${Math.round(bodyH)}`, x: wardrobeX, y: wardrobeY, width: W, height: bodyH, qty: 1, visible: true,
    source: { formula: skirtH > 0 ? `Width (entered) | Height = ${Math.round(H)}mm entered − ${skirtH}mm skirting = ${Math.round(bodyH)}mm carcass` : 'Width x Height (entered) — single carcass, no internal panels', constants: [] },
  });
  // Anchored at the Wardrobe's bottom-left corner rather than top-left —
  // the top-left corner is where Dressing/Side Panel/Loft all converge, so
  // the bottom-left (always open space, nothing else is ever positioned
  // there) keeps this leader clear regardless of which add-ons are active.
  // Drawn INSIDE the Wardrobe's own box (going up-right from that corner),
  // per the user's explicit direction, in the Wardrobe's own colour.
  {
    const wardrobeDiag = insideDiagonal(wardrobeX, wardrobeY + bodyH, W, bodyH, 'right-up');
    lines.push({ x1: wardrobeX, y1: wardrobeY + bodyH, x2: wardrobeDiag.x2, y2: wardrobeDiag.y2, color: DIAG, label: `${Math.round(D)} mm (D)` });
  }

  dimReqs.push({ axis: 'h', x1: wardrobeX, y1: wardrobeY + bodyH, x2: wardrobeX + W, y2: wardrobeY + bodyH, edge: 'bottom', componentIds: ['wardrobe'], label: `${Math.round(W)} mm (width)`, source: { formula: 'Wardrobe Width = W', constants: [] } });
  dimReqs.push({ axis: 'v', x1: wardrobeX + W, y1: wardrobeY, x2: wardrobeX + W, y2: wardrobeY + bodyH, edge: 'right', componentIds: ['wardrobe'], label: `${Math.round(bodyH)} mm (height)`, source: { formula: skirtH > 0 ? `Carcass Height = entered H(${Math.round(H)}) − skirting(${skirtH})` : 'Wardrobe Height = H', constants: [] } });

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
  if (leftExtra + rightExtra > 0) {
    dimReqs.push({ axis: 'h', x1: loftX, y1: wardrobeY + bodyH, x2: loftX + totalWidth, y2: wardrobeY + bodyH, edge: 'bottom', componentIds: [], label: `${Math.round(totalWidth)} mm (total width)`, source: { formula: 'Total Width = Side Panel + Dressing + Wardrobe Width + Dressing + Side Panel', constants: [] } });
  }
  if (loftH > 0) {
    // Total height is measured against the TRUE entered H (floor-to-top,
    // including skirting) — not the shrunk carcass bodyH — since that's
    // the real overall figure a Loft sits on top of.
    dimReqs.push({ axis: 'v', x1: wardrobeX + W, y1: topPad, x2: wardrobeX + W, y2: wardrobeY + bodyH + skirtH, edge: 'right', componentIds: [], label: `${Math.round(loftH + H)} mm (total height)`, source: { formula: 'Total Height = Loft Height + Wardrobe Height (entered, floor-to-top)', constants: [] } });
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
    dimReqs.push({ axis: 'h', x1: loftX, y1: wardrobeY + bodyH, x2: loftX + Math.max(totalWidthMm, totalWidth), y2: wardrobeY + bodyH, edge: 'bottom', componentIds: [], label: `${Math.round(totalWidthMm)} mm (Total Width, entered)`, source: { formula: 'Total Width (entered directly, not derived from Wardrobe Width or add-ons)', constants: [] } });
  }
  if (totalHeightMm && totalHeightMm > 0) {
    dimReqs.push({ axis: 'v', x1: wardrobeX + W, y1: Math.min(topPad, wardrobeY), x2: wardrobeX + W, y2: wardrobeY + bodyH + skirtH, edge: 'right', componentIds: [], label: `${Math.round(totalHeightMm)} mm (Total Height, entered)`, source: { formula: 'Total Height (entered directly, not derived from Wardrobe Height or add-ons)', constants: [] } });
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
          id: `${dressId}-drawer-${i}`, type: 'DRAWER', label: i === 0 ? `Drawer\n${Math.round(eachH)}` : '', x: dx, y: drawerY + i * eachH, width: dressW, height: eachH, qty: 1, visible: true,
          source: { formula: `Drawer ${i + 1} of ${drawerCount} — Width = Dressing Width (auto) | Height = Total Drawer Height(${Math.round(totalDrawerH)}) ÷ ${drawerCount} = ${eachH.toFixed(1)}mm`, constants: [] },
        });
      }
      // Total Drawer Height gets its own real leader (spec §20 "Show that
      // measurement in the drawing") — a short arrow on the drawer
      // section's own inner edge, distinct from the Dressing's own
      // overall Height leader outside the box.
      dimReqs.push({ axis: 'v', x1: dx + dressW * 0.5, y1: drawerY, x2: dx + dressW * 0.5, y2: drawerY + totalDrawerH, edge: 'left', componentIds: [`${dressId}-drawer-0`], label: `${Math.round(totalDrawerH)} mm (Total Drawer H)`, source: { formula: 'Total Drawer Height (entered), auto-divided evenly among the entered Drawer Count', constants: [] } });
    }
  }
  if (dressL > 0) {
    const dx = wardrobeX - dressL;
    components.push({ id: 'dress-l', type: 'DRESSING', label: `Dressing ${Math.round(dressL)}`, x: dx, y: wardrobeY, width: dressL, height: bodyH, qty: 1, visible: true, source: { formula: `Width = ${Math.round(dressL)}mm (entered) | Height = Wardrobe carcass Height (auto-fetched)`, constants: [] } });
    dimReqs.push({ axis: 'v', x1: dx - dressLeaderGap, y1: wardrobeY, x2: dx - dressLeaderGap, y2: wardrobeY + bodyH, edge: 'left', componentIds: ['dress-l'], label: `${Math.round(bodyH)} mm (H)`, source: { formula: 'Dressing Height = Wardrobe carcass Height (auto-fetched)', constants: [] } });
    dimReqs.push({ axis: 'h', x1: dx, y1: wardrobeY + bodyH + 24, x2: dx + dressL, y2: wardrobeY + bodyH + 24, edge: 'bottom', componentIds: ['dress-l'], label: `${Math.round(dressL)} mm (W)`, source: { formula: 'Dressing Width (entered)', constants: [] } });
    drawDressingInternals('dress-l', dx, dressL);
  }
  if (dressR > 0) {
    const dx = wardrobeX + W;
    components.push({ id: 'dress-r', type: 'DRESSING', label: `Dressing ${Math.round(dressR)}`, x: dx, y: wardrobeY, width: dressR, height: bodyH, qty: 1, visible: true, source: { formula: `Width = ${Math.round(dressR)}mm (entered) | Height = Wardrobe carcass Height (auto-fetched)`, constants: [] } });
    dimReqs.push({ axis: 'v', x1: dx + dressR + dressLeaderGap, y1: wardrobeY, x2: dx + dressR + dressLeaderGap, y2: wardrobeY + bodyH, edge: 'right', componentIds: ['dress-r'], label: `${Math.round(bodyH)} mm (H)`, source: { formula: 'Dressing Height = Wardrobe carcass Height (auto-fetched)', constants: [] } });
    dimReqs.push({ axis: 'h', x1: dx, y1: wardrobeY + bodyH + 24, x2: dx + dressR, y2: wardrobeY + bodyH + 24, edge: 'bottom', componentIds: ['dress-r'], label: `${Math.round(dressR)} mm (W)`, source: { formula: 'Dressing Width (entered)', constants: [] } });
    drawDressingInternals('dress-r', dx, dressR);
  }

  // Skirting — a real, labeled strip along the ACTUAL lower-product
  // footprint only (Dressing + Wardrobe + Top Panel), matching how a real
  // skirting/plinth board runs continuously under the whole unit — never
  // the full Room Total Width, per the user's explicit correction ("Do NOT
  // automatically make Skirting Width = Room Total Width... clipped to the
  // actual lower component footprint"). totalWidth here is exactly that
  // footprint (topPanelL/dressL/W/dressR/topPanelR — the same components
  // this loop already draws), deliberately NOT roomWallWidth/loftFrameWidth
  // above. Per the user's own explicit formula — Skirting Width = Wardrobe
  // Width + Dressing (if given) + Study Table (if given) — Study Table
  // would extend this same footprint the moment it becomes a real Wardrobe
  // add-on component (it isn't wired in yet; there's no Study Table input
  // reaching this module today, so nothing to add to totalWidth until that
  // add-on exists — this comment is the extension point for when it does).
  // Drawing-only: no new measurement field, never shown in the
  // Measurements panel.
  if (skirtH > 0) {
    const skirtY = wardrobeY + bodyH;
    const skirtX = wardrobeX - dressL - topPanelL;
    const skirtW = totalWidth;
    components.push({
      id: 'skirting', type: 'SKIRTING', label: `Skirting — ${skirtH}mm`, x: skirtX, y: skirtY, width: skirtW, height: skirtH, qty: 1, visible: true,
      source: { formula: `Fixed ${skirtH}mm skirting strip — real board height, not derived from Wardrobe Width/Depth`, constants: [] },
    });
    dimReqs.push({ axis: 'v', x1: skirtX + skirtW + 16, y1: skirtY, x2: skirtX + skirtW + 16, y2: skirtY + skirtH, edge: 'right', componentIds: ['skirting'], label: `${skirtH} mm (Skirting)`, source: { formula: `Fixed ${skirtH}mm skirting board`, constants: [] } });
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
    lines.push({ x1: px, y1: wardrobeY, x2: px + topPanelL, y2: wardrobeY, color: panelLineColor, strokeWidth: panelLineWidth });
    lines.push({ x1: px, y1: wardrobeY, x2: px - 120, y2: wardrobeY - 110, color: DIAG, label: `${Math.round(topPanelL)} mm (D)` });
    dimReqs.push({ axis: 'v', x1: px, y1: wardrobeY, x2: px, y2: wardrobeY + topPanel.widthMm, edge: 'left', componentIds: [], label: `${Math.round(topPanel.widthMm)} mm (W)`, source: { formula: 'Top Panel Width (auto-calculated from Total Width, editable)', constants: [] } });
  }
  if (topPanelR > 0) {
    const px = wardrobeX + W + dressR;
    // Anchored at px + topPanelR (the line's own RIGHT/outer end) rather
    // than px (its left end, which is the shared inner corner with the
    // Wardrobe/Dressing) — leaning up-left from the inner corner would
    // have crossed straight back over whatever sits immediately to this
    // panel's left.
    lines.push({ x1: px, y1: wardrobeY, x2: px + topPanelR, y2: wardrobeY, color: panelLineColor, strokeWidth: panelLineWidth });
    lines.push({ x1: px + topPanelR, y1: wardrobeY, x2: px + topPanelR + 120, y2: wardrobeY - 110, color: DIAG, label: `${Math.round(topPanelR)} mm (D)` });
    dimReqs.push({ axis: 'v', x1: px + topPanelR, y1: wardrobeY, x2: px + topPanelR, y2: wardrobeY + topPanel.widthMm, edge: 'right', componentIds: [], label: `${Math.round(topPanel.widthMm)} mm (W)`, source: { formula: 'Top Panel Width (auto-calculated from Total Width, editable)', constants: [] } });
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
      dimReqs.push({ axis: 'v', x1: leaderX, y1: cursorY, x2: leaderX, y2: cursorY + storageH, edge: side === 'left' ? 'left' : 'right', componentIds: [], label: `${Math.round(storageSide.heightMm)} mm (Storage H)`, source: { formula: 'Storage Height (entered)', constants: [] } });
      const storageDiag = insideDiagonal(colX, cursorY, colW, storageH, side === 'left' ? 'left-down' : 'right-down');
      lines.push({ x1: colX + (side === 'left' ? colW : 0), y1: cursorY, x2: storageDiag.x2, y2: storageDiag.y2, color: DIAG, label: `${Math.round(storageSide.depthMm)} mm (D)` });
      cursorY += storageH;
    }
    if (hasOpenBox && openBoxSide) {
      components.push({
        id: `open-box-${side}`, type: 'OPEN_BOX', label: `Open Box\n${Math.round(openBoxSide.widthMm)}×${Math.round(openBoxSide.heightMm)}`,
        x: colX, y: cursorY, width: colW, height: openBoxH, qty: 1, visible: true,
        source: { formula: `Open Box (${side}) — Width x Height (both entered), no door/shutter`, constants: [] },
      });
      const leaderX = side === 'left' ? colX - storageBoxLeaderGap : colX + colW + storageBoxLeaderGap;
      dimReqs.push({ axis: 'v', x1: leaderX, y1: cursorY, x2: leaderX, y2: cursorY + openBoxH, edge: side === 'left' ? 'left' : 'right', componentIds: [`open-box-${side}`], label: `${Math.round(openBoxSide.heightMm)} mm (Open Box H)`, source: { formula: 'Open Box Height (entered)', constants: [] } });
      const openBoxDiag = insideDiagonal(colX, cursorY, colW, openBoxH, side === 'left' ? 'left-down' : 'right-down');
      lines.push({ x1: colX + (side === 'left' ? colW : 0), y1: cursorY, x2: openBoxDiag.x2, y2: openBoxDiag.y2, color: DIAG, label: `${Math.round(openBoxSide.depthMm)} mm (D)` });
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
  const worldWidth = Math.max(loftX + totalWidth + (skirtH > 0 ? 26 : 0), loft.enabled ? loftX + roomWallWidth + 20 : 0, ...lines.map((l) => Math.max(l.x1, l.x2) + 10));
  const worldHeight = Math.max(wardrobeY + bodyH + skirtH + (leftExtra + rightExtra > 0 ? 70 : 20), ...lines.map((l) => Math.max(l.y1, l.y2) + 10));

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
