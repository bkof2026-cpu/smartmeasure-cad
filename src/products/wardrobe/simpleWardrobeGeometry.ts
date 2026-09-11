import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { placeNoteBoxes, type CalloutRequest } from '../../engine/noteBoxPlacement';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';
import {
  loftOneDoorWidth, loftDoorWidthStatus, totalKhachaWidth, LOFT_WARDROBE_GAP_MM,
  type FixPattiInput, type FixPattiPosition, type KhachaInput, type KhachaPosition,
} from '../../engine/loftDoorEngine';
import { resolveStudyTablePlan, studyTableCutlist, type StudyTableInputs } from '../studyTable/studyTableGeometry';

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
// Dressing is NOT selected. Uses the EXACT SAME measurement set and
// drawing as the standalone "Study Table" product (H/W/D + optional
// Storage + optional Side Panel); the ONLY difference is `position`,
// which docks it to the Wardrobe on that side (Left / Right / Both). The
// same table config is drawn on each attached side.
export interface WardrobeStudyTableInput {
  position: WardrobeSide | 'none';
  heightMm: number;
  widthMm: number;
  depthMm: number;
  storage: WardrobeSide | 'none';   // standalone Study Table's own "Add Storage"
  storageWidthMm: number;
  sidePanel: WardrobeSide | 'none'; // standalone Study Table's own "Add Side Panel"
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
  if (inp.studyTable.position !== 'none') parts.push('STUDY TABLE');
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
    const obHasStorageSameSide = (sl: 'Left' | 'Right') =>
      sl === 'Left'
        ? (inp.storage.position === 'left' || inp.storage.position === 'both') && inp.storage.left.enabled
        : (inp.storage.position === 'right' || inp.storage.position === 'both') && inp.storage.right.enabled;
    for (const [sideLabel, b] of sides) {
      const withStorage = obHasStorageSameSide(sideLabel);
      rows.push({ component: `Open Box (${sideLabel})`, width: b.widthMm, height: b.heightMm, qty: 1, remark: `${Math.round(b.widthMm)}(W) x ${Math.round(b.heightMm)}(H) x ${Math.round(b.depthMm)}(D) — no door/shutter, a real open box in the top pocket | ${withStorage ? 'sits directly below the Storage Box (Width defaults to the Storage Box Width)' : 'takes the Storage Box top spot (no Storage on this side); default small box 300(W) x 200(H) x 200(D)'}` });
    }
  }
  if (inp.studyTable.position !== 'none') {
    // Same cutlist as the standalone Study Table product — one copy per
    // docked side (Left / Right / Both).
    const stt = inp.studyTable;
    const stCut = studyTableCutlist({
      H: Math.max(1, stt.heightMm), W: Math.max(1, stt.widthMm), D: Math.max(1, stt.depthMm),
      storage: stt.storage === 'none' ? 'none' : stt.storage,
      storageW: Math.max(1, stt.storageWidthMm || 450),
      sidePanel: stt.sidePanel === 'none' ? 'none' : stt.sidePanel,
    });
    const sides = stt.position === 'both' ? ['Left', 'Right'] : [stt.position === 'left' ? 'Left' : 'Right'];
    for (const sideLabel of sides) {
      for (const r of stCut) {
        rows.push({ component: `Study Table ${sideLabel} — ${r.component}`, width: r.width, height: r.height, qty: r.qty, remark: `Attached to the Wardrobe on the ${sideLabel.toLowerCase()} side. ${r.remark}` });
      }
    }
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
  const dressL = dressing.enabled && dressing.side !== 'right' ? dressing.widthMm : 0;
  const dressR = dressing.enabled && dressing.side !== 'left' ? dressing.widthMm : 0;
  // Top Panel (a.k.a. Side Panel) — per the user's explicit composite
  // formula "Total Width = Wardrobe Width + Dressing Width + Side Panel
  // Width", the horizontal footprint it reserves in the composite is its
  // WIDTH (not its Depth). Depth runs front-to-back and is shown only as
  // the diagonal "(D)" leader. Hoisted above leaderMargin (below) because
  // the left Storage/Open Box note box's own reserved margin depends on it.
  const topPanelL = topPanel.enabled && topPanel.side !== 'right' ? topPanel.widthMm : 0;
  const topPanelR = topPanel.enabled && topPanel.side !== 'left' ? topPanel.widthMm : 0;

  // room for the Wardrobe's own Depth "/" leader — extended when a
  // LEFT-side L-Shaped Loft (Wall B) is active, since that column is
  // drawn even further left, outside every other component's own
  // origin (roomWallX/leaderMargin). Computed up front so every X
  // coordinate below (including roomWallX itself) already accounts for
  // it, rather than letting Wall B's column go to a negative, off-
  // canvas X. Must cover alGap (320) + max drawn column depth (260) +
  // the per-door width dim ticks and label on Wall B's outer edge (~70).
  const leftAdjacentLoftMargin = adjacentLoft.enabled && adjacentLoft.side === "left" ? 480 + 260 + 80 : 0;
  // A LEFT-side Storage / Open Box's measurements go into a spec note box
  // anchored at (wardrobeX - dressL - topPanelL) - 190 — i.e. 190mm to
  // the LEFT of the Top Panel's own far edge (never the pocket's own,
  // possibly-narrower, edge — the Top Panel's line/diagonal/width-dim all
  // sit at that same x-span and must never be crossed). Reserve exactly
  // that much room so the note box never lands at a negative, off-canvas
  // X. (Right-side boxes extend right and are picked up by worldWidth.)
  const hasLeftStorageOrOpenBox =
    ((storage.position === 'left' || storage.position === 'both') && storage.left.enabled) ||
    ((openBox.position === 'left' || openBox.position === 'both') && openBox.left.enabled);
  const leftStorageMargin = hasLeftStorageOrOpenBox ? (topPanelL + 190) : 0;
  const leaderMargin = 150 + leftAdjacentLoftMargin + leftStorageMargin;

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

  // Extra Storage + Open Box — small boxes tucked in the top-left / top-
  // right POCKET (the empty band between the Loft's bottom edge and the
  // top of the Dressing, in the column beside the Dressing), per the
  // user's explicit reference drawing. They do NOT run the full wardrobe
  // height and they DO NOT widen the composite / Total Width — the
  // Wardrobe+Dressing+Top-Panel span is unchanged whether or not a
  // Storage/Open Box is present. Storage sits at the top of the pocket
  // (top = Loft bottom); Open Box goes directly below it when both are
  // present, or takes the Storage Box's own top spot when Storage is
  // absent. Each keeps its OWN entered Width/Height/Depth.
  const storageActiveL = storage.position === 'left' || storage.position === 'both' ? storage.left : null;
  const storageActiveR = storage.position === 'right' || storage.position === 'both' ? storage.right : null;
  const openBoxActiveL = openBox.position === 'left' || openBox.position === 'both' ? openBox.left : null;
  const openBoxActiveR = openBox.position === 'right' || openBox.position === 'both' ? openBox.right : null;
  const hasStorageL = !!storageActiveL?.enabled;
  const hasStorageR = !!storageActiveR?.enabled;
  const hasOpenBoxL = !!openBoxActiveL?.enabled;
  const hasOpenBoxR = !!openBoxActiveR?.enabled;

  // Attached Study Table — Left / Right / Both, each its OWN H×W×D. A
  // floor-standing box tucked beside the Wardrobe/Dressing on its side
  // (outside any Dressing / Top Panel), bottom-aligned to the same floor
  // line, only as tall as its own entered Height. It DOES widen the
  // composite footprint on its side (unlike Storage/Open Box, which sit
  // in the top pocket and don't) — so it's part of leftExtra/rightExtra.
  const st = inp.studyTable;
  const studyOnLeft = st.position === 'left' || st.position === 'both';
  const studyOnRight = st.position === 'right' || st.position === 'both';
  // The attached Study Table is drawn via the SAME resolveStudyTablePlan
  // as the standalone product — build its inputs once here so the drawn
  // footprint (table + its own optional Storage + Side Panels) is what
  // widens the composite on the docked side(s).
  const stInputs: StudyTableInputs | null = st.position !== 'none' ? {
    H: Math.max(1, st.heightMm), W: Math.max(1, st.widthMm), D: Math.max(1, st.depthMm),
    storage: st.storage === 'none' ? 'none' : st.storage,
    storageW: Math.max(1, st.storageWidthMm || 450),
    sidePanel: st.sidePanel === 'none' ? 'none' : st.sidePanel,
  } : null;
  // Its full drawn width (table + storages + side panels) — resolved once.
  const stPlan = stInputs ? resolveStudyTablePlan(stInputs) : null;
  const stFullW = stPlan
    ? Math.max(...stPlan.components.map((c) => c.x + c.width)) - Math.min(...stPlan.components.map((c) => c.x))
    : 0;
  const studyLW = studyOnLeft ? stFullW : 0;
  const studyRW = studyOnRight ? stFullW : 0;

  const leftExtra = topPanelL + dressL + studyLW;
  const rightExtra = dressR + topPanelR + studyRW;
  const wardrobeX = leaderMargin + leftExtra;

  const components: ComponentSpec[] = [];
  const dimReqs: DimensionRequest[] = [];
  const lines: AnnotationLine[] = [];
  // Callout requests (Name + H/W/D for a crowded small component) are
  // queued here as they're found, then resolved into real, collision-
  // checked NoteBox positions ONCE at the very end of this function — see
  // noteBoxPlacement.ts. Never placed at a hand-picked fixed offset,
  // which breaks the moment the composite around it changes shape.
  const calloutRequests: CalloutRequest[] = [];

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
  // Base headroom above the topmost drawn element. When an explicitly
  // entered Total Height is TALLER than the wardrobe body itself, the
  // "Total H" dimension arrow (bottom pinned to the floor line) has to
  // reach ABOVE the wardrobe top by that overflow for its visual length
  // to match its label — so reserve that much extra canvas above.
  // Computed against the no-loft case (loftH not yet resolved here);
  // a Loft only pushes the wardrobe further down, so this never
  // under-reserves — at worst it adds harmless whitespace up top.
  const enteredTotalHTopOverflow = totalHeightMm && totalHeightMm > 0
    ? Math.max(0, totalHeightMm - H + 20)
    : 0;
  // +40 over the old 130 base: the Loft now carries a per-door width
  // dimension chain along its TOP edge, which offsets upward and needs
  // its own headroom above the loft.
  const topPad = 170 + enteredTotalHTopOverflow;
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
  // Fix Patti — a real, separate component; sits at the OUTER edge(s) of
  // the Loft row (never carved out of the door span). Its Width feeds the
  // Loft Door COUNT formula (Total Room Width − Fix Patti − Khacha, done
  // in deriveWardrobeAddonInputs) but is drawn as its own strip here.
  const fp = inp.fixPatti;
  const hasLeftFP = fp.position === 'left' || fp.position === 'both';
  const hasRightFP = fp.position === 'right' || fp.position === 'both';
  const leftFPW = hasLeftFP ? Math.max(0, fp.leftWidthMm) : 0;
  const rightFPW = hasRightFP ? Math.max(0, fp.rightWidthMm) : 0;
  // Khacha — a real, separate component from Fix Patti (never merged
  // data). Drawn even further outward than Fix Patti (outermost of the
  // two, at the very room-wall corner). Reserves its own real horizontal
  // space the same way Fix Patti does.
  const kh = inp.khacha;
  const hasLeftKhacha = kh.position === 'left' || kh.position === 'both';
  const hasRightKhacha = kh.position === 'right' || kh.position === 'both';
  const leftKhachaW = hasLeftKhacha ? Math.max(0, kh.leftWidthMm) : 0;
  const rightKhachaW = hasRightKhacha ? Math.max(0, kh.rightWidthMm) : 0;
  // The Loft is built flush ON TOP of the Wardrobe composite, so the
  // whole Loft row spans EXACTLY the composite's own left→right extent
  // (Study Table / Top Panel / Dressing start  →  Wardrobe / Dressing /
  // Top Panel end), running parallel to it — never offset to one side and
  // never stretched to a theoretical wall-to-wall width. Fix Patti /
  // Khacha, when present, are carved from the OUTER ends of that span;
  // the doors then fill whatever is left. With NO Fix Patti / Khacha the
  // doors run edge-to-edge of the composite — exactly the reference
  // drawing (doors divided from the first end to the last end / Top
  // Panel end).
  const loftRowLeftX = wardrobeX - leftExtra;          // == composite left edge
  const loftRowWidth = totalWidth;                     // == composite full width
  const loftFrameWidth = Math.max(1, loftRowWidth - leftKhachaW - leftFPW - rightFPW - rightKhachaW);
  const doorsAreaX = loftRowLeftX + leftKhachaW + leftFPW;
  // Canvas-sizing width — the widest of: the entered Total Width, the
  // Loft row's own extent, and the furniture composite.
  const roomWallWidth = loft.enabled
    ? Math.max(totalWidthMm && totalWidthMm > 0 ? totalWidthMm : 0, loftRowWidth, totalWidth)
    : totalWidth;
  if (loft.enabled) {
    loftH = loft.heightMm;
    const loftY = topPad;
    // Blank frame label — the frame box is entirely covered edge-to-edge
    // by the individual door components drawn on top of it (below), so an
    // in-box/leader name on the frame itself would never find a visible
    // spot to render. The mode name instead goes into its own small
    // callout — "Loft - Only Door" or "Loft - Box", so the drawing itself
    // shows which was picked, not just a generic "Loft" — placed by the
    // same real collision-free placement engine as Top Panel/Storage/Open
    // Box, with a leader arrow to the frame. Per the user's explicit
    // correction, "Box" mode renders identically to "Only Door" mode — the
    // SAME real per-door Loft Box formula/boxes in both cases; "Box" only
    // additionally shows a Depth "/" leader, since a door-only loft has no
    // real depth to call out the same way.
    const loftModeLabel = loft.mode === 'box' ? 'Loft - Box' : 'Loft - Only Door';
    components.push({
      id: 'loft', type: 'PLATFORM_TOP', label: '', x: doorsAreaX, y: loftY, width: loftFrameWidth, height: loftH, qty: 1, visible: true,
      source: { formula: `Width = Total Room Width − Fix Patti (Left+Right) − Khacha (Left+Right) | Height = Total Height − Wardrobe Height − 10mm gap | split into ${loft.doorCount} doors`, constants: [] },
    });
    calloutRequests.push({
      id: 'loft-mode-note',
      componentBounds: { x: doorsAreaX, y: loftY, w: loftFrameWidth, h: loftH },
      title: loftModeLabel, color: '#7c3aed',
      lines: [],
    });

    // Fix Patti — a real, separate component from Top Panel, drawn at the
    // OUTER edge(s) of the room (green, per the spec's own colour
    // convention — see FIX_PATTI's componentStyle in
    // SimpleWardrobeDrawing.tsx), beside the Loft's own door span (and just
    // inside any Khacha on the same side — Khacha sits further out still).
    if (hasLeftFP) {
      components.push({
        id: 'fix-patti-left', type: 'FIX_PATTI', label: `Fix Patti`,
        x: loftRowLeftX + leftKhachaW, y: loftY, width: leftFPW, height: loftH, qty: 1, visible: true,
        source: { formula: `Left Fix Patti — Width x Height (both entered) | its Width is subtracted from Total Room Width to get the Loft Width`, constants: [] },
      });
    }
    if (hasRightFP) {
      components.push({
        id: 'fix-patti-right', type: 'FIX_PATTI', label: `Fix Patti`,
        x: doorsAreaX + loftFrameWidth, y: loftY, width: rightFPW, height: loftH, qty: 1, visible: true,
        source: { formula: `Right Fix Patti — Width x Height (both entered) | its Width is subtracted from Total Room Width to get the Loft Width`, constants: [] },
      });
    }

    // Khacha — a real, separate component from Fix Patti, drawn at the
    // VERY outer edge of the room (further out than Fix Patti), per the
    // spec's own §16/§50 "do not merge their data" rule and the reference
    // sketch's own layout (Khacha sits at the extreme corner, beyond the
    // Fix Patti strip).
    if (hasLeftKhacha) {
      components.push({
        id: 'khacha-left', type: 'KHACHA', label: `Khacha`,
        x: loftRowLeftX, y: loftY, width: leftKhachaW, height: loftH, qty: 1, visible: true,
        source: { formula: `Left Khacha — Height x Width (both entered) | subtracted (together with any Fix Patti) from the usable Loft door area`, constants: [] },
      });
    }
    if (hasRightKhacha) {
      components.push({
        id: 'khacha-right', type: 'KHACHA', label: `Khacha`,
        x: doorsAreaX + loftFrameWidth + rightFPW, y: loftY, width: rightKhachaW, height: loftH, qty: 1, visible: true,
        source: { formula: `Right Khacha — Height x Width (both entered) | subtracted (together with any Fix Patti) from the usable Loft door area`, constants: [] },
      });
    }

    // Doors — packed across the FULL Loft Width (loftFrameWidth already IS
    // the usable width: Total Room Width − Fix Patti − Khacha, resolved
    // upstream), using the shared loftDoorEngine's exact deduction
    // formula: Width = (LoftWidth − doorCount×2) / doorCount.
    // loft.doorCount here is already the FINAL resolved count
    // (auto-recommended unless the user overrode it) — this module just
    // draws it. Same value the cutlist reports.
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
          // No in-box label — each door's width is shown by its own
          // dimension tick along the Loft top edge (below).
          id: `loft-door-${i}`, type: 'DOOR', label: '',
          x: doorCursorX, y: loftY + 2, width: doorW, height: loftH - 4, qty: 1, visible: true, noHandle: true,
          source: { formula: `Loft Door ${i + 1} of ${count} — Width = (Loft Width(${Math.round(loftFrameWidth)}) − ${count}×2) / ${count} = ${doorW.toFixed(2)}mm`, constants: [] },
        });
        // Each door's own width as a real dimension tick along the Loft's
        // TOP edge — a chain of per-door "(W)" arrows in the free space
        // above the Loft, so every door's size is visible even when the
        // door box itself is too narrow to hold the number. All on the
        // same 'top' edge → the collision engine keeps the chain on one
        // tier and clear of the Wardrobe/Top-Panel dims below.
        dimReqs.push({
          axis: 'h', x1: doorCursorX, y1: loftY, x2: doorCursorX + doorW, y2: loftY,
          edge: 'top', componentIds: [`loft-door-${i}`], label: `${Math.round(doorW)}`,
          source: { formula: `Loft Door ${i + 1} of ${count} width = (Loft Width ${Math.round(loftFrameWidth)} − ${count}×2) / ${count} = ${doorW.toFixed(2)}mm`, constants: [] },
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
    dimReqs.push({ axis: 'v', x1: loftRowLeftX, y1: loftY, x2: loftRowLeftX, y2: loftY + loftH, edge: 'left', componentIds: ['loft'], label: `${Math.round(loftH)} (Loft H)`, source: { formula: 'Loft Height = Total Height − Wardrobe Height − 10mm gap (auto-calculated, editable)', constants: [] } });
    // The 10mm Wardrobe↔Loft gap is a FORMULA reference only
    // (Loft Height = Total Height − Wardrobe Height − 10mm) — per the
    // user's explicit instruction it is NOT drawn or annotated on the
    // plan any more.

    // (No "Room Wall (…)" gap annotation any more — the Loft row is now
    // always drawn exactly as wide as the Wardrobe/Dressing/Top-Panel
    // composite it sits on, so the two right edges always coincide and
    // there is no leftover span to mark. The entered Total Width, when it
    // exceeds the drawn furniture, is still shown honestly by its own
    // "Total W" dimension line — that stays.)
  }

  const wardrobeY = topPad + loftH;

  // L-Shaped Loft — Wall B: a fully independent second Loft on the
  // adjacent wall, drawn the SAME way as the Loft above the Wardrobe
  // (a real frame + a row of doors that divide the span by the shared
  // loft-door formula) but ROTATED 90° — the doors stack top-to-bottom
  // and Wall B's own Width is the VERTICAL span. Kept well clear of the
  // Wardrobe in free space (a large fixed gap), with its own Fix Patti /
  // Khacha at the ends of the door stack, its own per-door width labels,
  // and its own "Total Wall B Width" dimension. loft-door formula and
  // door count are identical to Wall A's, just applied to Wall B's own
  // usable width (already Fix Patti/Khacha-deducted upstream).
  const alGap = 480; // large real gap so Wall B floats clearly in free space, away from the Wardrobe/main Loft
  let adjacentLoftWorldLeft = 0; // how far left Wall B reaches, for worldWidth
  let adjacentLoftRightEdgeX = 0; // how far right Wall B reaches, for worldWidth
  if (inp.adjacentLoft.enabled) {
    const al = inp.adjacentLoft;
    // Drawn column DEPTH (its horizontal thickness on screen) represents
    // Wall B's Depth to scale, clamped to a sensible on-screen band.
    const alColW = Math.max(90, Math.min(al.depthMm, 260));
    const alFullH = wardrobeY + bodyH - topPad; // available vertical run (Loft top → Wardrobe floor)
    const alX = al.side === 'left'
      ? roomWallX - alGap - alColW
      : loftX + roomWallWidth + alGap;
    // The door stack's own vertical span == Wall B usable Width, scaled
    // to fill the available run (so it reads as a full floor-to-ceiling
    // vertical loft like the reference), with Fix Patti / Khacha bands
    // carved from the ends.
    const alFp = al.fixPatti;
    const alHasFP = alFp.position !== 'none';
    const alFPW = alHasFP ? Math.max(0, alFp.position === 'right' ? alFp.rightWidthMm : alFp.leftWidthMm) : 0;
    const alKh = al.khacha;
    const alHasKh = alKh.position !== 'none';
    const alKhW = alHasKh ? Math.max(0, alKh.position === 'right' ? alKh.rightWidthMm : alKh.leftWidthMm) : 0;
    // Total Wall B Width = usable door span + its Fix Patti + Khacha.
    const alTotalW = al.widthMm + alFPW + alKhW;
    // Vertical layout: top → [Khacha band][Fix Patti band][door 1..n] → bottom.
    // Scale mm → px so the whole Wall B Total Width fills alFullH.
    const alScale = alFullH / Math.max(1, alTotalW);
    const alKhH = alKhW * alScale;
    const alFPH = alFPW * alScale;
    const alDoorsSpanH = al.widthMm * alScale;
    const alY = topPad;
    adjacentLoftWorldLeft = al.side === 'left' ? alX - 60 : adjacentLoftWorldLeft;
    adjacentLoftRightEdgeX = al.side === 'right' ? alX + alColW + 60 : 0;

    // Frame (the whole Wall B outline) — same PLATFORM_TOP style as Wall A.
    // Blank label: same reason as the main Loft — the frame is covered
    // edge-to-edge by its own door stack (below), so an in-box name would
    // never find a visible spot. The mode name ("L-Shaped Loft - Only
    // Door" / "L-Shaped Loft - Box") instead goes into its own callout,
    // placed by the collision-free placement engine, same as the main Loft.
    const alModeLabel = al.mode === 'box' ? 'L-Shaped Loft - Box' : 'L-Shaped Loft - Only Door';
    components.push({
      id: 'adjacent-loft', type: 'PLATFORM_TOP', label: '', x: alX, y: alY, width: alColW, height: alFullH, qty: 1, visible: true,
      source: { formula: `Wall B (${al.side}) — independent vertical Loft on the adjacent wall. Total Wall B Width = ${Math.round(alTotalW)}mm (usable door span ${Math.round(al.widthMm)} + Fix Patti ${Math.round(alFPW)} + Khacha ${Math.round(alKhW)}). Same door-count/width formula as the main Loft, applied vertically.`, constants: [] },
    });
    calloutRequests.push({
      id: `adjacent-loft-mode-note-${al.side}`,
      componentBounds: { x: alX, y: alY, w: alColW, h: alFullH },
      title: alModeLabel, color: '#7c3aed',
      lines: [],
    });

    let alCursorY = alY;
    // Khacha band (outermost) at the top.
    if (alHasKh && alKhH > 1) {
      components.push({
        id: 'adjacent-khacha', type: 'KHACHA', label: `Khacha`,
        x: alX, y: alCursorY, width: alColW, height: alKhH, qty: 1, visible: true,
        source: { formula: `Wall B Khacha — independent of Wall A's; its Width is deducted (with any Fix Patti) from Wall B's usable Loft door span`, constants: [] },
      });
      alCursorY += alKhH;
    }
    // Fix Patti band next.
    if (alHasFP && alFPH > 1) {
      components.push({
        id: 'adjacent-fix-patti', type: 'FIX_PATTI', label: `Fix Patti`,
        x: alX, y: alCursorY, width: alColW, height: alFPH, qty: 1, visible: true,
        source: { formula: `Wall B Fix Patti — independent of Wall A's; its Width is deducted from Wall B's usable Loft door span before the door count`, constants: [] },
      });
      alCursorY += alFPH;
    }
    // Doors — Wall B's own formula-resolved doors, stacked vertically.
    // Each door's CUT WIDTH comes from the shared loft-door formula on
    // Wall B's own usable Width; here that value is drawn as a per-door
    // dimension tick along the door stack's outer vertical edge.
    {
      const alCount = Math.max(1, Math.round(al.doorCount) || 1);
      const alDoorW = loftOneDoorWidth(al.widthMm, alCount);
      const eachH = alDoorsSpanH / alCount;
      const doorEdgeX = al.side === 'left' ? alX : alX + alColW; // outer edge of the stack
      for (let i = 0; i < alCount; i++) {
        const dy = alCursorY + i * eachH;
        components.push({
          id: `adjacent-loft-door-${i}`, type: 'DOOR', label: '',
          x: alX + 2, y: dy + 1, width: alColW - 4, height: eachH - 2, qty: 1, visible: true, noHandle: true,
          source: { formula: `Wall B Door ${i + 1} of ${alCount} — Width = (Wall B usable Width ${Math.round(al.widthMm)} − ${alCount}×2) / ${alCount} = ${alDoorW.toFixed(2)}mm`, constants: [] },
        });
        // per-door width dim tick along the stack's outer edge (vertical axis)
        dimReqs.push({
          axis: 'v', x1: doorEdgeX, y1: dy, x2: doorEdgeX, y2: dy + eachH,
          edge: al.side === 'left' ? 'left' : 'right', componentIds: [`adjacent-loft-door-${i}`],
          label: `${Math.round(alDoorW)}`,
          source: { formula: `Wall B Door ${i + 1} width = (${Math.round(al.widthMm)} − ${alCount}×2) / ${alCount} = ${alDoorW.toFixed(2)}mm`, constants: [] },
        });
      }
    }

    // Wall B is a VERTICAL loft — the doors stack top-to-bottom, so
    // Wall B's own WIDTH (the door-span direction) runs VERTICALLY, and
    // its DEPTH (the column thickness) runs HORIZONTALLY. Dimension them
    // to match:
    //   • Total Wall B Width  → a VERTICAL arrow along the door stack's
    //     OUTER edge, spanning the whole stack.
    //   • Wall B Depth        → a HORIZONTAL arrow across the column top.
    const outerEdgeX = al.side === 'left' ? alX : alX + alColW;
    const wOff = al.side === 'left' ? -18 : 18;
    dimReqs.push({
      axis: 'v', x1: outerEdgeX + wOff, y1: alY, x2: outerEdgeX + wOff, y2: alY + alFullH,
      edge: al.side === 'left' ? 'left' : 'right', componentIds: ['adjacent-loft'],
      label: `${Math.round(alTotalW)} (Wall B W)`,
      source: { formula: `Total Wall B Width = usable door span (${Math.round(al.widthMm)}) + Fix Patti (${Math.round(alFPW)}) + Khacha (${Math.round(alKhW)}) — runs vertically because Wall B's loft is rotated`, constants: [] },
    });
    // Wall B Depth — a horizontal arrow across the column thickness,
    // just above the frame's top edge.
    dimReqs.push({
      axis: 'h', x1: alX, y1: alY, x2: alX + alColW, y2: alY,
      edge: 'top', componentIds: ['adjacent-loft'],
      label: `${Math.round(al.depthMm)} (Wall B D)`,
      source: { formula: 'Wall B Loft Depth (entered) — the column thickness', constants: [] },
    });
    // Wall B Loft Height (the entered value) — a horizontal arrow BELOW
    // the whole stack (a real, separate figure from the drawn
    // floor-to-ceiling extent).
    dimReqs.push({
      axis: 'h', x1: alX, y1: alY + alFullH, x2: alX + alColW, y2: alY + alFullH,
      edge: 'bottom', componentIds: ['adjacent-loft'],
      label: `${Math.round(al.heightMm)} (Wall B H)`,
      source: { formula: 'Wall B Loft Height (entered, independent of Wall A)', constants: [] },
    });
  }

  // Wardrobe — a plain W x H carcass at its FULL entered Height (the
  // entered Height already includes the 70mm skirting; it is NOT
  // subtracted — see skirtH/bodyH note above). Depth shown as the "/"
  // diagonal leader at its own top-left corner. W and H are shown as
  // plain callouts inside/beside this box, never a boxed label.
  components.push({
    id: 'wardrobe', type: 'WARDROBE_BODY', label: 'Wardrobe', x: wardrobeX, y: wardrobeY, width: W, height: bodyH, qty: 1, visible: true,
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
  // Wardrobe Height arrow — placed on the OUTER right edge of the whole
  // composite (past any right-side Dressing / Top Panel), never on the
  // wardrobe/dressing seam where it would collide with the Dressing's own
  // internals (Mirror / Drawers) and their Total-Drawer-H leader. The
  // Total-H arrow (also on the right) is then tiered one step further out.
  const rightDimX = wardrobeX + W + dressR + topPanelR;
  dimReqs.push({ axis: 'v', x1: rightDimX, y1: wardrobeY, x2: rightDimX, y2: wardrobeY + bodyH, edge: 'right', componentIds: ['wardrobe'], label: `${Math.round(H)} (H)`, source: { formula: 'Wardrobe Height (entered, includes the 70mm skirting)', constants: [] } });

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
    dimReqs.push({ axis: 'v', x1: rightDimX, y1: topPad, x2: rightDimX, y2: wardrobeY + bodyH, edge: 'right', componentIds: [], label: `${Math.round(loftH + LOFT_WARDROBE_GAP_MM + H)} (Total H)`, source: { formula: 'Total Height = Wardrobe Height (incl. skirting) + 10mm gap + Loft Height', constants: [] } });
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
    // The arrow's VISUAL span must equal its own label — so it runs the
    // full entered Total Height UP from the floor line, not just the
    // wardrobe body. Bottom pinned to the floor (`wardrobeY + bodyH`);
    // top = bottom − totalHeightMm (which reaches above the wardrobe /
    // loft stack whenever the entered Total exceeds what's drawn — the
    // `topPad` bump above reserves the canvas room for that). Clamped so
    // an unusually small entered Total still can't invert the arrow.
    const totalHBottomY = wardrobeY + bodyH;
    const totalHTopY = Math.min(totalHBottomY - totalHeightMm, wardrobeY);
    dimReqs.push({ axis: 'v', x1: rightDimX, y1: totalHTopY, x2: rightDimX, y2: totalHBottomY, edge: 'right', componentIds: [], label: `${Math.round(totalHeightMm)} (Total H)`, source: { formula: 'Total Height (entered directly — a separate measurement, NOT the same as Wardrobe Height)', constants: [] } });
  }

  // Side Dressing — flush against the Wardrobe carcass (both sit on the
  // same skirting/floor line, so Dressing's own drawn height matches
  // bodyH, the wardrobe's post-skirting carcass height — not the raw
  // entered H). Width now gets its own real dimension arrow (below), on
  // top of the existing caption text (which stays, per no-redesign) — it
  // previously only appeared as text, never a measured arrow like every
  // other value here. The Dressing Height is NOT dimensioned separately —
  // it is always equal to the Wardrobe Height, and the single Wardrobe
  // "(H)" arrow already states it (per the user's "wardrobe height =
  // Dressing height, no need to show it differently").
  // Mirror (spec §22) + Drawers (spec §19-21) — real optional internals
  // drawn INSIDE the Dressing box: Mirror fills the upper portion (no
  // independent measurement, per the spec), Drawers fill the lower
  // portion, dynamically generated per the entered count and Total
  // Drawer Height (auto-divided evenly, never asked per-drawer), each
  // one's Width always equal to Dressing Width (never a separate field).
  function drawDressingInternals(dressId: string, dx: number, dressW: number, side: 'left' | 'right') {
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
      // Only the Total Drawer Height is called out — a plain vertical
      // arrow on the Dressing's OUTER edge (the side facing away from the
      // Wardrobe), never per-drawer sizes and never through the middle of
      // the box where the "Mirror"/"Drawers" captions and the Wardrobe-H /
      // Total-H arrows already are. Left dressing → left edge; right
      // dressing → right edge.
      const drawerLeaderX = side === 'left' ? dx : dx + dressW;
      dimReqs.push({ axis: 'v', x1: drawerLeaderX, y1: drawerY, x2: drawerLeaderX, y2: drawerY + totalDrawerH, edge: side, componentIds: [`${dressId}-drawer-0`], label: `${Math.round(totalDrawerH)} (Total Drawer H)`, source: { formula: 'Total Drawer Height (entered), auto-divided evenly among the entered Drawer Count', constants: [] } });
    }
  }
  // Dressing's own Width — a real horizontal "<n>(W)" arrow drawn as an
  // AnnotationLine so it sits EXACTLY inside the Dressing box (a
  // dimReq/edge line always gets offset out of the box, up into the Loft
  // — exactly what the user said not to do). Placed low in the box
  // (~65% down), well clear of the vertical "Dressing" name near the
  // centre. Its Height is always the Wardrobe Height (auto-fetched) so no
  // separate height arrow is drawn.
  const drawDressingWidthArrow = (dx: number, w: number) => {
    const y = wardrobeY + bodyH * 0.65;
    const inset = Math.min(6, w * 0.06);
    lines.push({
      x1: dx + inset, y1: y, x2: dx + w - inset, y2: y,
      color: '#2563eb', strokeWidth: 0.9, arrowAtStart: true, arrowAtEnd: true,
      label: `${Math.round(w)}(W)`,
    });
  };
  if (dressL > 0) {
    const dx = wardrobeX - dressL;
    components.push({ id: 'dress-l', type: 'DRESSING', label: `Dressing`, x: dx, y: wardrobeY, width: dressL, height: bodyH, qty: 1, visible: true, source: { formula: `Width = ${Math.round(dressL)}mm (entered) | Height = Wardrobe Height (equal, auto-fetched)`, constants: [] } });
    drawDressingWidthArrow(dx, dressL);
    drawDressingInternals('dress-l', dx, dressL, 'left');
  }
  if (dressR > 0) {
    const dx = wardrobeX + W;
    components.push({ id: 'dress-r', type: 'DRESSING', label: `Dressing`, x: dx, y: wardrobeY, width: dressR, height: bodyH, qty: 1, visible: true, source: { formula: `Width = ${Math.round(dressR)}mm (entered) | Height = Wardrobe Height (equal, auto-fetched)`, constants: [] } });
    drawDressingWidthArrow(dx, dressR);
    drawDressingInternals('dress-r', dx, dressR, 'right');
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
      // The label is written directly ON the skirting band itself —
      // "Skirting (70mm)" — no leader arrow and no separate dimension
      // line (per the user: "do not show the skirting by big arrow,
      // write this on the skirting line"). The band is wide enough to
      // hold this short caption centered in it.
      id: 'skirting', type: 'SKIRTING', label: `Skirting (${skirtH}mm)`, x: skirtX, y: skirtY, width: skirtW, height: skirtH, qty: 1, visible: true,
      source: { formula: `Fixed ${skirtH}mm skirting band at the floor line — spans Dressing + Wardrobe (+ Study Table), part of the entered Wardrobe Height, not subtracted from it`, constants: [] },
    });
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
  // Top Panel is a thin line, not a box, so its own W/D used to be shown
  // via a dimension arrow + diagonal leader right next to the panel —
  // exactly the kind of crowded, small-component annotation the callout
  // system replaces elsewhere (Storage/Open Box). Same treatment here:
  // a Name+W+D callout box placed by the real collision-free placement
  // engine, with a leader arrow to the panel line, instead of in-place
  // arrows that collided with neighbouring Storage/Open Box callouts.
  const TOP_PANEL_CALLOUT_H = 40; // nominal thickness for the callout's own anchor bounds — the panel itself is a zero-height line
  if (topPanelL > 0) {
    const px = wardrobeX - dressL - topPanelL;
    // The drawn line itself extends all the way to the composite's true
    // outer-left edge (loftRowLeftX, below) — matching whatever the Loft
    // row's own left boundary is, even when a Study Table sits further
    // left still (studyLW, already folded into leftExtra). Per the user:
    // the panel should read as continuous from the Dressing edge out to
    // the outside of the Loft box above it, not stop short at its own
    // un-extended Width and leave a visible gap under the Loft. The
    // callout's own componentBounds (and its W/D VALUES) stay anchored to
    // the panel's real entered Width nearest the Dressing — only the
    // visible line is extended, never the measured quantity.
    const outerX = wardrobeX - leftExtra;
    lines.push({ x1: outerX, y1: wardrobeY, x2: px + topPanelL, y2: wardrobeY, color: panelLineColor, strokeWidth: panelLineWidth });
    calloutRequests.push({
      id: 'top-panel-left-note',
      componentBounds: { x: px, y: wardrobeY - TOP_PANEL_CALLOUT_H, w: topPanelL, h: TOP_PANEL_CALLOUT_H },
      title: 'Top Panel', color: panelLineColor,
      lines: [`W : ${Math.round(topPanel.widthMm)}`, `D : ${Math.round(topPanel.depthMm)}`],
    });
  }
  if (topPanelR > 0) {
    const px = wardrobeX + W + dressR;
    // Same outward extension on the right, to the composite's true
    // outer-right edge (wardrobeX + rightExtra).
    const outerX = wardrobeX + rightExtra;
    lines.push({ x1: px, y1: wardrobeY, x2: outerX, y2: wardrobeY, color: panelLineColor, strokeWidth: panelLineWidth });
    calloutRequests.push({
      id: 'top-panel-right-note',
      componentBounds: { x: px, y: wardrobeY - TOP_PANEL_CALLOUT_H, w: topPanelR, h: TOP_PANEL_CALLOUT_H },
      title: 'Top Panel', color: panelLineColor,
      lines: [`W : ${Math.round(topPanel.widthMm)}`, `D : ${Math.round(topPanel.depthMm)}`],
    });
  }

  // Extra Storage + Open Box — small boxes in the top pocket beside the
  // Dressing (top = Loft bottom = wardrobeY). Each keeps its OWN entered
  // Width/Height/Depth — the box is NOT stretched to any column width and
  // does NOT run the full wardrobe height. Storage sits at the top;
  // Open Box goes directly BELOW it (its own Height) when both are
  // present, or takes the Storage Box's own top spot when Storage is
  // absent. Never widens the composite / Total Width.
  // Track how far the drawn Storage/Open Box pockets reach past the
  // wardrobe composite, so worldWidth/worldHeight below can size the
  // canvas to them (a right-side box extends the canvas right; any box
  // taller than the wardrobe body, or a stacked Storage+Open Box column,
  // extends it down). Without this, validateComponentBounds flags the
  // pocket doors as out-of-bounds and raises a spurious CRITICAL.
  let storagePocketRightEdge = 0;
  let storagePocketBottomEdge = 0;
  function drawStoragePocket(side: 'left' | 'right', storageSide: WardrobeStorageSideInput | null, openBoxSide: WardrobeOpenBoxSideInput | null) {
    const hasStorage = !!storageSide?.enabled;
    const hasOpenBox = !!openBoxSide?.enabled;
    if (!hasStorage && !hasOpenBox) return;
    // Pocket's inner edge is the Dressing's own outer edge (or the
    // Wardrobe's, if no Dressing on that side). The box extends AWAY from
    // the wardrobe by its own entered Width.
    const dressOnThisSide = side === 'left' ? dressL : dressR;
    const innerEdgeX = side === 'left'
      ? (dressOnThisSide > 0 ? wardrobeX - dressL : wardrobeX)
      : (dressOnThisSide > 0 ? wardrobeX + W + dressR : wardrobeX + W);
    const gapMm = 2;
    let cursorY = wardrobeY;

    // Per the user: instead of packing H/W/D text and multiple leader
    // arrows onto/into the small component itself (which crowds badly
    // once several add-ons are active), each small component gets ONE
    // short leader arrow out to a small bordered "callout" text box —
    // Name + H/W/D — placed by REAL collision detection against every
    // other component / dimension / line / callout already on the
    // drawing (see noteBoxPlacement.ts), never a hand-picked fixed
    // offset. Requests are queued here and resolved into real, collision-
    // checked NoteBox positions once, at the very end of this function,
    // after every other piece of geometry/dimension/line is finalised.
    const placeNoteBox = (name: string, color: string, boxX: number, boxW: number, boxY: number, boxH: number, rows: string[]) => {
      calloutRequests.push({
        id: `${name.toLowerCase().replace(/\s+/g, '-')}-${side}-note`,
        componentBounds: { x: boxX, y: boxY, w: boxW, h: boxH },
        title: name, lines: rows, color,
      });
      storagePocketBottomEdge = Math.max(storagePocketBottomEdge, boxY + boxH);
    };

    if (hasStorage && storageSide) {
      const boxW = Math.max(1, storageSide.widthMm);
      const boxH = Math.max(1, storageSide.heightMm);
      const boxX = side === 'left' ? innerEdgeX - boxW : innerEdgeX;
      const count = Math.max(1, Math.round(storageSide.doorCount) || 1);
      const doorW = loftOneDoorWidth(boxW, count);
      let doorCursorX = boxX;
      for (let i = 0; i < count; i++) {
        components.push({
          // No in-box text any more — the door row stays visually clean;
          // all measurements move to the note box.
          id: `storage-${side}-door-${i}`, type: 'STORAGE_DOOR', label: '',
          x: doorCursorX, y: cursorY, width: doorW, height: boxH, qty: 1, visible: true,
          source: { formula: `Storage Box (${side}) Door ${i + 1} of ${count} — Width = (Storage Width(${Math.round(boxW)}) − ${count}×2) / ${count} = ${doorW.toFixed(2)}mm — from Storage Width only`, constants: [] },
        });
        doorCursorX += doorW + gapMm;
      }
      placeNoteBox('Storage', '#b45309', boxX, boxW, cursorY, boxH, [
        `H : ${Math.round(boxH)}`,
        `W : ${Math.round(boxW)}`,
        `D : ${Math.round(storageSide.depthMm)}`,
        `Doors : ${count} (${Math.round(doorW)} ea.)`,
      ]);
      storagePocketRightEdge = Math.max(storagePocketRightEdge, boxX + boxW + (side === 'right' ? 20 : 0));
      storagePocketBottomEdge = Math.max(storagePocketBottomEdge, cursorY + boxH);
      cursorY += boxH;
    }

    if (hasOpenBox && openBoxSide) {
      const boxW = Math.max(1, openBoxSide.widthMm);
      const boxH = Math.max(1, openBoxSide.heightMm);
      const boxX = side === 'left' ? innerEdgeX - boxW : innerEdgeX;
      components.push({
        // Plain box, no in-box text — its H/W/D go in the note box.
        id: `open-box-${side}`, type: 'OPEN_BOX', label: '',
        x: boxX, y: cursorY, width: boxW, height: boxH, qty: 1, visible: true,
        source: { formula: `Open Box (${side}) — Height x Depth x Width (all entered), no door/shutter${hasStorage ? ' — sits directly below the Storage Box' : ' — takes the Storage Box position (no Storage on this side)'}`, constants: [] },
      });
      placeNoteBox('Open Box', '#ea580c', boxX, boxW, cursorY, boxH, [
        `H : ${Math.round(boxH)}`,
        `W : ${Math.round(boxW)}`,
        `D : ${Math.round(openBoxSide.depthMm)}`,
        `No door / shutter`,
      ]);
      storagePocketRightEdge = Math.max(storagePocketRightEdge, boxX + boxW + (side === 'right' ? 20 : 0));
      storagePocketBottomEdge = Math.max(storagePocketBottomEdge, cursorY + boxH);
    }
  }
  if (hasStorageL || hasOpenBoxL) drawStoragePocket('left', hasStorageL ? storageActiveL : null, hasOpenBoxL ? openBoxActiveL : null);
  if (hasStorageR || hasOpenBoxR) drawStoragePocket('right', hasStorageR ? storageActiveR : null, hasOpenBoxR ? openBoxActiveR : null);

  // Attached Study Table — drawn by EMBEDDING the standalone Study Table
  // product's own resolved plan (resolveStudyTablePlan), translated so
  // its floor line meets the Wardrobe's floor and its docked edge meets
  // the Wardrobe/Dressing/Top-Panel edge on that side. Its full drawn
  // width is already reserved in leftExtra / rightExtra above. Every
  // component / line / dimension from that sub-plan is offset into the
  // Wardrobe's own coordinate space with a unique id prefix.
  function drawStudyTable(side: 'left' | 'right') {
    if (!stPlan) return;
    const floorY = wardrobeY + bodyH;
    const subBottom = Math.max(...stPlan.components.map((c) => c.y + c.height));
    // The Study Table sub-drawing (frame + any Storage + Side Panels)
    // sits FLUSH against the Wardrobe or Dressing — NO gap. Dock the
    // sub-plan's edge NEAREST the wardrobe onto that composite edge: left
    // dock → sub-plan's RIGHT edge; right dock → sub-plan's LEFT edge.
    // Deliberately does NOT include topPanelL/topPanelR — the Top Panel
    // is drawn as a thin horizontal LINE at the very top only (no full-
    // height box), so docking against its far edge would leave a real
    // visible gap below it where nothing fills the reserved width.
    const subLeft = Math.min(...stPlan.components.map((c) => c.x));
    const subRight = Math.max(...stPlan.components.map((c) => c.x + c.width));
    const compositeLeftEdge = wardrobeX - dressL;
    const compositeRightEdge = wardrobeX + W + dressR;
    const dx = side === 'left'
      ? compositeLeftEdge - subRight
      : compositeRightEdge - subLeft;
    const dy = floorY - subBottom;
    const pfx = `study-${side}-`;
    for (const c of stPlan.components) {
      components.push({
        ...c, id: pfx + c.id, x: c.x + dx, y: c.y + dy,
        label: c.id === 'study-table' ? 'Study Table' : c.label,
      });
    }
    for (const l of (stPlan.lines ?? [])) {
      // Per the user: in the ATTACHED Study Table drawing, don't carry
      // over the standalone's "Top" / "Tray" name leaders — just the
      // measurements (and Storage, if added). Skip those two leader lines
      // and the Tray's own decorative bar. Same treatment for "Side Panel
      // (Left/Right)" and the storage sub-assembly's own floating
      // "Storage" heading — none of them carry a real measurement (the
      // standalone's own remark says so), they're name-only leaders like
      // Top/Tray, and their positions (authored for the standalone's own
      // free space) collide with the Wardrobe composite's own component
      // labels once docked. The panel's own bold structural line, and the
      // storage sub-assembly's Fesia/Shutter/Skirting bands, are kept —
      // only the floating name labels are dropped (Storage's own Name +
      // H/W/D go into a proper note box below instead).
      if (l.label === 'Top' || l.label === 'Tray' || l.label === 'Storage' || (l.label && l.label.startsWith('Side Panel'))) continue;
      if (!l.label && l.color === '#2563eb' && Math.abs(l.y1 - l.y2) < 0.5) continue; // the unlabelled Tray bar
      // Normalise "600 mm (D)" → "600 (D)" to match the Wardrobe drawing.
      const nl = l.label ? l.label.replace(/\s*mm\s*/i, ' ').trim() : l.label;
      lines.push({ ...l, label: nl, x1: l.x1 + dx, y1: l.y1 + dy, x2: l.x2 + dx, y2: l.y2 + dy });
    }
    for (const d of stPlan.dimensions) {
      // Drop the standalone's own "total width" AND "Storage W" lines —
      // the Wardrobe drawing has its own Total-W, and the Storage
      // sub-assembly's Width goes into its own note box below instead of
      // a dimension arrow (consistent with the main Storage/Open Box
      // treatment elsewhere in this composite).
      if (/total width/i.test(d.label) || /Storage W\)$/.test(d.label)) continue;
      const norm = d.label
        .replace(/\s*mm\s*/i, ' ')
        .replace(/\(W\)$/, '(Study Table W)')
        .replace(/\(H\)$/, '(Study Table H)')
        .replace(/\(D\)$/, '(Study Table D)')
        .trim();
      dimReqs.push({
        axis: d.axis, x1: d.x1 + dx, y1: d.y1 + dy, x2: d.x2 + dx, y2: d.y2 + dy,
        edge: d.edge, componentIds: d.componentIds.map((cid) => pfx + cid),
        label: norm, source: d.source, color: d.color,
      });
    }
    // The Study Table's own internal Storage sub-assembly (Fesia/Shutter/
    // Skirting bands) — if present — gets one note box with its Name +
    // H/W/D, matching the main Storage/Open Box treatment above, instead
    // of the standalone's own floating "Storage" heading + separate width
    // dimension arrow (both dropped above). This box may sit on EITHER
    // side of the table frame within the standalone sub-plan (the user's
    // own "Add Storage: Left/Right/Both" choice), but the note itself
    // must always point OUT into the free margin AWAY from the Wardrobe
    // composite — never toward it, where the crowded "Study Table" name
    // and the rest of the composite live. Its real position is now found
    // by the same collision-checked callout placement as the main
    // Storage/Open Box pocket (see noteBoxPlacement.ts) — queued here,
    // resolved once at the very end of this function.
    for (const c of stPlan.components) {
      if (c.type !== 'STORAGE_FRAME') continue;
      const boxX = c.x + dx, boxY = c.y + dy;
      calloutRequests.push({
        id: `study-${side}-${c.id}-note`,
        componentBounds: { x: boxX, y: boxY, w: c.width, h: c.height },
        title: 'Storage', color: '#0891b2',
        lines: [
          `H : ${Math.round(c.height)}`,
          `W : ${Math.round(c.width)}`,
          `D : ${Math.round(inp.studyTable.depthMm)}`,
        ],
      });
    }
  }
  if (studyOnLeft) drawStudyTable('left');
  if (studyOnRight) drawStudyTable('right');

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
  // shift above. `adjacentLoftRightEdgeX` is the actual drawn right edge
  // (frame + its outer-edge dim ticks + label) tracked in the Wall B
  // block; fall back to a conservative estimate if the block set nothing.
  const adjacentLoftRightEdge = adjacentLoft.enabled && adjacentLoft.side === 'right'
    ? Math.max(adjacentLoftRightEdgeX + 90, loftX + roomWallWidth + 480 + 260 + 90)
    : 0;
  // An explicitly-entered Total Width can exceed the drawn furniture
  // composite (the "overall opening is wider than the wardrobe unit"
  // case) — its dimension line runs out to `loftX + max(totalWidthMm,
  // totalWidth)`, so the canvas must reach past that plus room for the
  // line's end tick and its label, or the arrow spills off the plot.
  const enteredTotalWRightEdge = totalWidthMm && totalWidthMm > 0
    ? loftX + Math.max(totalWidthMm, totalWidth) + 40
    : 0;
  // A preliminary world size — used only as the callout-placement search's
  // OWN preferred region (it may legitimately place a callout outside
  // this, per its own "search a larger surrounding area" fallback). The
  // REAL, final worldWidth/worldHeight (below, after placeNoteBoxes runs)
  // additionally covers wherever the callouts actually landed.
  const preWorldWidth = Math.max(
    loftX + totalWidth + (skirtH > 0 ? 26 : 0),
    loft.enabled ? loftX + roomWallWidth + 20 : 0,
    adjacentLoftRightEdge, storagePocketRightEdge, enteredTotalWRightEdge,
    ...lines.map((l) => Math.max(l.x1, l.x2) + 10),
  );
  // bodyH now IS the full entered Wardrobe Height (skirting is drawn as
  // a band inside its bottom, not an extra strip below it) — so no
  // "+ skirtH" here any more; the extra 70/20 is just headroom for the
  // bottom dimension line(s).
  const preWorldHeight = Math.max(wardrobeY + bodyH + (leftExtra + rightExtra > 0 ? 70 : 20), storagePocketBottomEdge + 40, ...lines.map((l) => Math.max(l.y1, l.y2) + 10));

  const resolvedDims = resolveDimensions(dimReqs);
  // Real-CAD convention: the individual dimension (Wardrobe W / H) reads on
  // the INNER tier, closest to the drawing; every enclosing "total" reads
  // strictly OUTSIDE it. The wardrobe's own W/H arrows are labelled
  // `"<n> (W)"` / `"<n> (H)"`; both the add-on-derived composite total and
  // the user-entered overall are `"<n> (Total W)"` / `"(Total H)"` (only
  // the source/formula differs, and they're mutually exclusive). Match on
  // those exact suffixes and pin the tiers so the ordering is explicit,
  // not left to the collision engine's span-sort — which, seeing the
  // total's span start at/before the wardrobe's own narrower span, can
  // otherwise drop the total onto the inner tier.
  const isTotalWidth = (d: (typeof resolvedDims)[number]) => /\(Total W\)$/.test(d.label);
  const isTotalHeight = (d: (typeof resolvedDims)[number]) => /\(Total H\)$/.test(d.label);
  // Read the WARDROBE'S OWN W / H dim tiers specifically (by componentId),
  // not just any "(W)"/"(H)"-suffixed label — several add-ons (Storage,
  // embedded Study Table, …) also emit "<n>(H)"/"<n> mm (W)" dims, and
  // `find` on a loose regex would grab one of those instead, leaving the
  // Total arrow pinned to the wrong (usually inner) tier.
  const wardrobeWidthTier = resolvedDims.find((d) => d.componentIds.includes('wardrobe') && d.axis === 'h')?.tier ?? 0;
  const wardrobeHeightTier = resolvedDims.find((d) => d.componentIds.includes('wardrobe') && d.axis === 'v')?.tier ?? 0;
  const dimensions = resolvedDims.map((d) => {
    // Wardrobe's own W/H keeps its (inner) resolved tier; any enclosing
    // "Total W" / "Total H" is pushed one full tier further out.
    if (isTotalWidth(d)) return { ...d, tier: Math.max(d.tier, wardrobeWidthTier + 1) };
    if (isTotalHeight(d)) return { ...d, tier: Math.max(d.tier, wardrobeHeightTier + 1) };
    // A right-side Dressing's "Total Drawer H" leader shares the outer
    // right edge with the Wardrobe-H / Total-H arrows and overlaps them in
    // Y — push it one tier past the Total-H so the three never stack on
    // the same offset. (Left-side Dressing puts it on the free left edge,
    // no conflict, so only bump when it landed on the right.)
    if (/Total Drawer H/.test(d.label) && d.edge === 'right') return { ...d, tier: Math.max(d.tier, wardrobeHeightTier + 2) };
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
    ...(inp.studyTable.position !== 'none' ? validateMeasurements({ H: inp.studyTable.heightMm, W: inp.studyTable.widthMm, D: inp.studyTable.depthMm }, [{ key: 'H', label: 'Study Table Height', min: 1 }, { key: 'W', label: 'Study Table Width', min: 1 }, { key: 'D', label: 'Study Table Depth', min: 1 }]) : []),
    ...(inp.studyTable.position !== 'none' && inp.studyTable.storage !== 'none' ? validateMeasurements({ W: inp.studyTable.storageWidthMm }, [{ key: 'W', label: 'Study Table Storage Width', min: 1 }]) : []),
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
    // NOTE: the 310–400mm door-width standard is a LOFT-door rule only.
    // A Storage Box's Door Count is entered manually and its doors are
    // legitimately small (the user's own reference: 340mm / 2 doors =
    // 168mm each, shown as the correct answer), so NO 310–400 warning is
    // applied to Storage Box doors — only the shared (Width − count×2) /
    // count formula is used for the cut width.
    ...validateComponentBounds(components, preWorldWidth, preWorldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  // Resolve every queued callout (Storage / Open Box / embedded Study
  // Table's own internal Storage, ...) into a real, collision-checked
  // NoteBox position — ONLY now, once components/dimensions/lines are
  // fully final, so the placement search sees every real obstacle on the
  // finished drawing (never an earlier, incomplete snapshot of it).
  //
  // placeNoteBoxes converts every fixed-screen-px metric (label size, the
  // 18px dimension tier step, clearance, ...) into world-mm via the
  // drawing's own REAL render scale — computeRenderScale(worldWidth,
  // worldHeight, maxTier), reproducing CanonicalSvg's own fitScale exactly.
  // But the final worldWidth/worldHeight aren't known until AFTER the
  // callouts are placed (they must grow to fit wherever the callouts
  // land) — a genuine chicken-and-egg. Placing once against the
  // preliminary (pre-callout) size uses an optimistically LARGER scale
  // than what actually renders once the canvas grows to fit the callouts,
  // which under-reserves every fixed-px footprint (tier gaps included) and
  // lets a callout land on top of a dimension that looked clear under the
  // wrong scale. Fixed by placing twice: once to learn the real final
  // size, then again — from scratch, against the SAME original obstacles
  // — using that real size, so the unit conversion converges to what will
  // actually render.
  const firstPass = placeNoteBoxes(calloutRequests, { components, dimensions, lines, worldWidth: preWorldWidth, worldHeight: preWorldHeight });
  const settledWidth = Math.max(preWorldWidth, ...firstPass.map((nb) => nb.x + 190));
  const settledHeight = Math.max(preWorldHeight, ...firstPass.map((nb) => nb.y + 80));
  let noteBoxes = placeNoteBoxes(calloutRequests, { components, dimensions, lines, worldWidth: settledWidth, worldHeight: settledHeight });
  // A left-side callout's own free-space search can legitimately need
  // more room than the fixed leaderMargin reserved (an especially dense
  // pocket, several stacked callouts, ...) and land at a negative world
  // X. Rather than trying to predict that margin ahead of time, shift the
  // WHOLE drawing right by however much overflow actually occurred —
  // guaranteed correct regardless of how far the search had to go.
  const leftOverflow = Math.max(0, -Math.min(0, ...noteBoxes.map((nb) => nb.x)));
  if (leftOverflow > 0) {
    for (const c of components) c.x += leftOverflow;
    for (const d of dimensions) { d.x1 += leftOverflow; d.x2 += leftOverflow; }
    for (const l of lines) { l.x1 += leftOverflow; l.x2 += leftOverflow; }
    noteBoxes = noteBoxes.map((nb) => ({ ...nb, x: nb.x + leftOverflow, anchor: nb.anchor ? { x: nb.anchor.x + leftOverflow, y: nb.anchor.y } : undefined }));
  }
  // The REAL, final canvas size — the preliminary size PLUS wherever the
  // callouts actually ended up (a callout may legitimately extend past
  // the preliminary bounds via its own "search a larger area" fallback).
  const worldWidth = Math.max(preWorldWidth + leftOverflow, ...noteBoxes.map((nb) => nb.x + 190));
  const worldHeight = Math.max(preWorldHeight, ...noteBoxes.map((nb) => nb.y + 80));

  return {
    view: 'plan', productType: 'wardrobe', designId: 'simple', designName: 'Wardrobe',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines, noteBoxes,
  };
}
