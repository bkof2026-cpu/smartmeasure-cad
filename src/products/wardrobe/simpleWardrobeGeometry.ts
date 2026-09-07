import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';
import {
  loftOneDoorWidth, loftDoorWidthStatus,
  type FixPattiInput, type FixPattiPosition,
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
  const { W, H, D, dressing, topPanel, loft, fixPatti, totalWidthMm, totalHeightMm } = inp;
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

  const leftExtra = topPanelL + dressL;
  const rightExtra = dressR + topPanelR;
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
  const loftX = leaderMargin;
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
  const doorsAreaX = loftX + leftFPW;
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
      source: { formula: `Width = Total Room Width − Fix Patti (Left+Right) | Height = Total Height − Wardrobe Height − 10mm gap | split into ${loft.doorCount} doors`, constants: [] },
    });

    // Fix Patti — a real, separate component from Top Panel, drawn at the
    // OUTER edge(s) of the room (green, per the spec's own colour
    // convention — see FIX_PATTI's componentStyle in
    // SimpleWardrobeDrawing.tsx), beside the Loft's own door span, not
    // inside it.
    if (hasLeftFP) {
      components.push({
        id: 'fix-patti-left', type: 'FIX_PATTI', label: `Fix Patti\n${Math.round(fp.leftHeightMm)}×${Math.round(fp.leftWidthMm)}`,
        x: loftX, y: loftY, width: leftFPW, height: loftH, qty: 1, visible: true,
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
      const rowFullWidth = leftFPW + loftFrameWidth + rightFPW;
      lines.push({ x1: loftX + rowFullWidth * 0.5, y1: gapY, x2: loftX + rowFullWidth * 0.5 + 40, y2: gapY + 24, color: '#64748b', label: '10 mm GAP' });
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
    dimReqs.push({ axis: 'h', x1: loftX, y1: wardrobeY + bodyH, x2: loftX + totalWidth, y2: wardrobeY + bodyH, edge: 'bottom', componentIds: [], label: `${Math.round(totalWidthMm)} mm (Total Width, entered)`, source: { formula: 'Total Width (entered directly, not derived from Wardrobe Width or add-ons)', constants: [] } });
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
  if (dressL > 0) {
    const dx = wardrobeX - dressL;
    components.push({ id: 'dress-l', type: 'DRESSING', label: `Dressing ${Math.round(dressL)}`, x: dx, y: wardrobeY, width: dressL, height: bodyH, qty: 1, visible: true, source: { formula: `Width = ${Math.round(dressL)}mm (entered) | Height = Wardrobe carcass Height (auto-fetched)`, constants: [] } });
    dimReqs.push({ axis: 'v', x1: dx - dressLeaderGap, y1: wardrobeY, x2: dx - dressLeaderGap, y2: wardrobeY + bodyH, edge: 'left', componentIds: ['dress-l'], label: `${Math.round(bodyH)} mm (H)`, source: { formula: 'Dressing Height = Wardrobe carcass Height (auto-fetched)', constants: [] } });
    dimReqs.push({ axis: 'h', x1: dx, y1: wardrobeY + bodyH + 24, x2: dx + dressL, y2: wardrobeY + bodyH + 24, edge: 'bottom', componentIds: ['dress-l'], label: `${Math.round(dressL)} mm (W)`, source: { formula: 'Dressing Width (entered)', constants: [] } });
  }
  if (dressR > 0) {
    const dx = wardrobeX + W;
    components.push({ id: 'dress-r', type: 'DRESSING', label: `Dressing ${Math.round(dressR)}`, x: dx, y: wardrobeY, width: dressR, height: bodyH, qty: 1, visible: true, source: { formula: `Width = ${Math.round(dressR)}mm (entered) | Height = Wardrobe carcass Height (auto-fetched)`, constants: [] } });
    dimReqs.push({ axis: 'v', x1: dx + dressR + dressLeaderGap, y1: wardrobeY, x2: dx + dressR + dressLeaderGap, y2: wardrobeY + bodyH, edge: 'right', componentIds: ['dress-r'], label: `${Math.round(bodyH)} mm (H)`, source: { formula: 'Dressing Height = Wardrobe carcass Height (auto-fetched)', constants: [] } });
    dimReqs.push({ axis: 'h', x1: dx, y1: wardrobeY + bodyH + 24, x2: dx + dressR, y2: wardrobeY + bodyH + 24, edge: 'bottom', componentIds: ['dress-r'], label: `${Math.round(dressR)} mm (W)`, source: { formula: 'Dressing Width (entered)', constants: [] } });
  }

  // Skirting — a real, labeled strip along the FULL composite floor line
  // (Dressing + Wardrobe + Top Panel together, matching how a real
  // skirting/plinth board runs continuously under the whole unit), filling
  // the entered-Height-minus-carcass gap. Drawing-only — no new
  // measurement field, and never shown in the Measurements panel.
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

  // +26 covers the skirting dimension line's own +16 offset past the
  // composite's right edge (see above) plus its label's own drawn width.
  // Also covers the full Loft row (Fix Patti + loftFrameWidth + Fix
  // Patti), which can genuinely exceed the wardrobe's own composite
  // totalWidth when a larger Total Width is entered.
  const worldWidth = Math.max(loftX + totalWidth + (skirtH > 0 ? 26 : 0), loft.enabled ? loftX + leftFPW + loftFrameWidth + rightFPW + 20 : 0, ...lines.map((l) => Math.max(l.x1, l.x2) + 10));
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
    ...(topPanel.enabled ? validateMeasurements({ W: topPanel.widthMm, D: topPanel.depthMm }, [{ key: 'W', label: 'Top Panel Width', min: 1 }, { key: 'D', label: 'Top Panel Depth', min: 1 }]) : []),
    ...(loft.enabled ? validateMeasurements({ W: loft.widthMm, H: loft.heightMm }, [{ key: 'W', label: 'Loft Width', min: 1 }, { key: 'H', label: 'Loft Height', min: 1 }]) : []),
    ...(loft.enabled && (fixPatti.position === 'left' || fixPatti.position === 'both') ? validateMeasurements({ H: fixPatti.leftHeightMm, W: fixPatti.leftWidthMm }, [{ key: 'H', label: 'Left Fix Patti Height', min: 1 }, { key: 'W', label: 'Left Fix Patti Width', min: 1 }]) : []),
    ...(loft.enabled && (fixPatti.position === 'right' || fixPatti.position === 'both') ? validateMeasurements({ H: fixPatti.rightHeightMm, W: fixPatti.rightWidthMm }, [{ key: 'H', label: 'Right Fix Patti Height', min: 1 }, { key: 'W', label: 'Right Fix Patti Width', min: 1 }]) : []),
    // Door width standard (310–400mm) — a real WARNING, not a hard block,
    // per the spec's own "⚠ Door width below/exceeds..." wording (not a
    // CRITICAL that stops PDF generation the way a genuinely invalid
    // layout does).
    ...(() => {
      if (!loft.enabled) return [];
      // loft.widthMm is already the usable Loft Width (Total Room Width −
      // Fix Patti) — no further Fix Patti subtraction here.
      const usableW = loft.widthMm;
      const count = Math.max(1, Math.round(loft.doorCount) || 1);
      const oneDoorW = loftOneDoorWidth(usableW, count);
      const status = loftDoorWidthStatus(oneDoorW);
      if (status === 'below-min') return [{ id: 'val-loft-door-narrow', severity: 'WARNING' as const, code: 'LOFT_DOOR_TOO_NARROW', message: `⚠ Door width below 310mm (currently ${oneDoorW.toFixed(0)}mm) — reduce Door Count or increase Total Width.` }];
      if (status === 'above-max') return [{ id: 'val-loft-door-wide', severity: 'WARNING' as const, code: 'LOFT_DOOR_TOO_WIDE', message: `⚠ Door width exceeds 400mm (currently ${oneDoorW.toFixed(0)}mm) — increase Door Count.` }];
      return [];
    })(),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'wardrobe', designId: 'simple', designName: 'Wardrobe',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines,
  };
}
