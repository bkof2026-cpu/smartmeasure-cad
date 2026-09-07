import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';

// Same real 70mm skirting constant used across this codebase (Side Table,
// Wardrobe) — per the user's explicit instruction. Drawing-only: no new
// measurement field, entered Height stays the true floor-to-top figure,
// the box itself is drawn 70mm shorter with the skirting strip filling
// the gap at the bottom.
export const SHOE_RACK_SKIRTING_HEIGHT_MM = 70;

// ─────────────────────────────────────────────────────────────────────────────
// Shoe Rack — same real site-measurement pattern as the simplified Bed/
// Wardrobe: no mandatory base size, just two optional box types the user
// picks from (per the user's own reference sketch), each taking its own
// H x W x D. Both boxes sit flush on a shared bottom line, side by side
// (2 Door Box on the left, Single Door Box on the right, matching the
// sketch), Depth shown as the "/" diagonal leader — never a straight
// dimension for that value, same convention used everywhere else.
// ─────────────────────────────────────────────────────────────────────────────

export interface ShoeRackBoxInput {
  enabled: boolean;
  heightMm: number;
  widthMm: number;
  depthMm: number;
}

export interface ShoeRackInputs {
  twoDoor: ShoeRackBoxInput;
  singleDoor: ShoeRackBoxInput;
}

export interface ShoeRackCutRow {
  component: string;
  width: number;
  height: number;
  qty: number;
  remark: string;
}

function activeParts(inp: ShoeRackInputs): string[] {
  const parts: string[] = [];
  if (inp.twoDoor.enabled) parts.push('2 DOOR BOX');
  if (inp.singleDoor.enabled) parts.push('SINGLE DOOR BOX');
  return parts;
}

/** "SHOE RACK — 2 DOOR BOX" / "SHOE RACK — SINGLE DOOR BOX" / "SHOE RACK — 2 DOOR BOX + SINGLE DOOR BOX" / "SHOE RACK" (nothing added yet). */
export function shoeRackTitle(inp: ShoeRackInputs): string {
  const parts = activeParts(inp);
  return parts.length ? `SHOE RACK — ${parts.join(' + ')}` : 'SHOE RACK';
}

/** Same data used for both the screen and the PDF — single source of truth. */
export function shoeRackCutlist(inp: ShoeRackInputs): ShoeRackCutRow[] {
  const rows: ShoeRackCutRow[] = [];
  if (inp.twoDoor.enabled) {
    const { heightMm: h, widthMm: w, depthMm: d } = inp.twoDoor;
    rows.push({ component: '2 Door Box', width: w, height: h, qty: 1, remark: `Height × Width × Depth all entered (${Math.round(h)} × ${Math.round(w)} × ${Math.round(d)}mm)` });
    rows.push({ component: '2 Door Box — Door', width: w / 2, height: h, qty: 2, remark: 'Door Width = Box Width / 2 (2 doors)' });
  }
  if (inp.singleDoor.enabled) {
    const { heightMm: h, widthMm: w, depthMm: d } = inp.singleDoor;
    rows.push({ component: 'Single Door Box', width: w, height: h, qty: 1, remark: `Height × Width × Depth all entered (${Math.round(h)} × ${Math.round(w)} × ${Math.round(d)}mm)` });
    rows.push({ component: 'Single Door Box — Door', width: w, height: h, qty: 1, remark: 'Single door, full Box Width' });
  }
  return rows;
}

const DIAG = '#cc2200';

/**
 * A short "/" or "\" diagonal drawn INSIDE a component's own corner, rather
 * than hovering small and outside it — per the user's explicit direction
 * (matches the same helper in src/products/bed/simpleBedGeometry.ts).
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

export function resolveShoeRackPlan(inp: ShoeRackInputs): ResolvedDrawing {
  const { twoDoor, singleDoor } = inp;
  const leaderMargin = 100; // room for the 2 Door Box's own Depth "/" leader on the left
  const topPad = 90; // room above the taller box for its own Depth leader

  const components: ComponentSpec[] = [];
  const dimReqs: DimensionRequest[] = [];
  const lines: AnnotationLine[] = [];

  const anyEnabled = twoDoor.enabled || singleDoor.enabled;
  const maxH = Math.max(twoDoor.enabled ? twoDoor.heightMm : 0, singleDoor.enabled ? singleDoor.heightMm : 0);
  const skirtH = SHOE_RACK_SKIRTING_HEIGHT_MM;
  const bottomY = topPad + maxH; // shared floor line (skirting's own bottom edge)

  let cursorX = leaderMargin;
  const twoDoorX = cursorX;
  if (twoDoor.enabled) cursorX += twoDoor.widthMm;
  const singleDoorX = cursorX;

  if (twoDoor.enabled) {
    const { widthMm: w, heightMm: h, depthMm: d } = twoDoor;
    // Entered Height stays the true floor-to-top figure (what was actually
    // measured on-site); the carcass box itself is drawn skirtH shorter,
    // with a continuous skirting strip (below, spanning both boxes) filling
    // the gap — per the user's explicit skirting-math confirmation.
    const bodyH = h > skirtH ? h - skirtH : h;
    const y = bottomY - skirtH - bodyH;
    components.push({
      // Plain name only — the real Height/Width/Depth are already shown via
      // the dimension arrows and the "/" leader around the box; repeating
      // them in the caption risks overflowing a narrower box and colliding
      // with the Height dimension sitting right beside it.
      id: 'two-door-box', type: 'SHOE_RACK_BOX', label: '2 Door Box', x: twoDoorX, y, width: w, height: bodyH, qty: 1, visible: true,
      source: { formula: `Width = ${Math.round(w)}mm | Height = ${Math.round(h)}mm entered − ${skirtH}mm skirting = ${Math.round(bodyH)}mm carcass | Depth = ${Math.round(d)}mm (entered)`, constants: [] },
    });
    // The shared middle divider — one real line splitting the box into its
    // two doors, matching the sketch — plus a short pull-mark tick on each
    // door's inner edge (the small "|" beside each door in the sketch).
    const midX = twoDoorX + w / 2;
    lines.push({ x1: midX, y1: y + 4, x2: midX, y2: y + bodyH - 4, color: '#333' });
    lines.push({ x1: midX - 16, y1: y + bodyH / 2 - 10, x2: midX - 16, y2: y + bodyH / 2 + 10, color: '#555' });
    lines.push({ x1: midX + 16, y1: y + bodyH / 2 - 10, x2: midX + 16, y2: y + bodyH / 2 + 10, color: '#555' });
    // Depth — "/" diagonal leader drawn INSIDE the box's own top-left
    // corner, per the user's explicit direction.
    const twoDoorDiag = insideDiagonal(twoDoorX, y, w, bodyH, 'right-down');
    lines.push({ x1: twoDoorX, y1: y, x2: twoDoorDiag.x2, y2: twoDoorDiag.y2, color: DIAG, label: `${Math.round(d)} mm (D)` });
    // Height — real straight dimension on the box's own outer (left) edge,
    // spanning the carcass (bodyH) only — skirting gets its own separate
    // dimension below.
    dimReqs.push({ axis: 'v', x1: twoDoorX, y1: y, x2: twoDoorX, y2: bottomY - skirtH, edge: 'left', componentIds: ['two-door-box'], label: `${Math.round(bodyH)} mm (H)`, source: { formula: `Carcass Height = entered H(${Math.round(h)}) − skirting(${skirtH})`, constants: [] } });
    // Width — real straight dimension on the box's own bottom edge (the
    // carcass/skirting boundary, not the true floor line — matches Wardrobe's
    // own convention of measuring Width against the carcass, not skirting).
    dimReqs.push({ axis: 'h', x1: twoDoorX, y1: bottomY - skirtH, x2: twoDoorX + w, y2: bottomY - skirtH, edge: 'bottom', componentIds: ['two-door-box'], label: `${Math.round(w)} mm (W)`, source: { formula: 'Width (entered)', constants: [] } });
  }

  if (singleDoor.enabled) {
    const { widthMm: w, heightMm: h, depthMm: d } = singleDoor;
    const bodyH = h > skirtH ? h - skirtH : h;
    const y = bottomY - skirtH - bodyH;
    components.push({
      id: 'single-door-box', type: 'SHOE_RACK_BOX', label: 'Single Door Box', x: singleDoorX, y, width: w, height: bodyH, qty: 1, visible: true,
      source: { formula: `Width = ${Math.round(w)}mm | Height = ${Math.round(h)}mm entered − ${skirtH}mm skirting = ${Math.round(bodyH)}mm carcass | Depth = ${Math.round(d)}mm (entered)`, constants: [] },
    });
    // Single door pull-mark tick, matching the sketch's one "|" mark.
    const doorMidX = singleDoorX + w * 0.35;
    lines.push({ x1: doorMidX, y1: y + bodyH / 2 - 10, x2: doorMidX, y2: y + bodyH / 2 + 10, color: '#555' });
    // Depth — drawn INSIDE this box's own top-RIGHT corner instead of its
    // left: its left corner is the shared boundary with the 2 Door Box
    // (whenever that one is also present), so a leader there would overlap
    // that box's own space. The top-right corner is always this box's own.
    const singleDoorDiag = insideDiagonal(singleDoorX + w, y, w, bodyH, 'left-down');
    lines.push({ x1: singleDoorX + w, y1: y, x2: singleDoorDiag.x2, y2: singleDoorDiag.y2, color: DIAG, label: `${Math.round(d)} mm (D)` });
    // Height — real straight dimension on the box's own outer (right) edge.
    dimReqs.push({ axis: 'v', x1: singleDoorX + w, y1: y, x2: singleDoorX + w, y2: bottomY - skirtH, edge: 'right', componentIds: ['single-door-box'], label: `${Math.round(bodyH)} mm (H)`, source: { formula: `Carcass Height = entered H(${Math.round(h)}) − skirting(${skirtH})`, constants: [] } });
    // Width — real straight dimension on the box's own bottom (carcass) edge.
    dimReqs.push({ axis: 'h', x1: singleDoorX, y1: bottomY - skirtH, x2: singleDoorX + w, y2: bottomY - skirtH, edge: 'bottom', componentIds: ['single-door-box'], label: `${Math.round(w)} mm (W)`, source: { formula: 'Width (entered)', constants: [] } });
  }

  // Skirting — one continuous, labeled strip along the FULL floor line
  // shared by both boxes (a real skirting board runs under the whole unit,
  // not a separate piece per box), per the user's explicit instruction.
  // Drawing-only: no new measurement field, never shown in the
  // Measurements panel.
  if (anyEnabled) {
    const skirtX = twoDoorX;
    const skirtRightEdge = singleDoor.enabled ? singleDoorX + singleDoor.widthMm : twoDoor.enabled ? twoDoorX + twoDoor.widthMm : twoDoorX;
    const skirtW = skirtRightEdge - twoDoorX;
    const skirtY = bottomY - skirtH;
    components.push({
      id: 'skirting', type: 'SKIRTING', label: `Skirting — ${skirtH}mm`, x: skirtX, y: skirtY, width: skirtW, height: skirtH, qty: 1, visible: true,
      source: { formula: `Fixed ${skirtH}mm skirting strip — real board height, not derived from Box Width/Depth`, constants: [] },
    });
    // Dimension anchored on the RIGHT edge — the left edge already carries
    // the 2 Door Box's own Depth "/" leader and leaderMargin is sized for
    // that, not an extra dimension further left; the right edge has open
    // space (same reasoning Single Door Box's own Height dimension already
    // uses on this side).
    dimReqs.push({ axis: 'v', x1: skirtRightEdge + 16, y1: skirtY, x2: skirtRightEdge + 16, y2: skirtY + skirtH, edge: 'right', componentIds: ['skirting'], label: `${skirtH} mm (Skirting)`, source: { formula: `Fixed ${skirtH}mm skirting board`, constants: [] } });
  }

  const worldWidth = Math.max(
    anyEnabled ? singleDoorX + (singleDoor.enabled ? singleDoor.widthMm : 0) + (anyEnabled ? 46 : 20) : 200,
    ...lines.map((l) => Math.max(l.x1, l.x2) + 10),
  );
  const worldHeight = Math.max(anyEnabled ? bottomY + 30 : 200, ...lines.map((l) => Math.max(l.y1, l.y2) + 10));

  // The Single Door Box's own Height dimension sits right beside its
  // caption, which is centered inside a box that can be fairly narrow — the
  // standard tier-0 offset is smaller than that label's own rendered width,
  // so it would otherwise clip into the caption. Same scale-independent
  // fix already used for the Wardrobe's Dressing Height leader.
  const dimensions = resolveDimensions(dimReqs).map((d) =>
    d.componentIds.includes('single-door-box') && d.edge === 'right' ? { ...d, tier: Math.max(d.tier, 2) } : d,
  );
  const issues = [
    ...(!anyEnabled ? [{
      id: 'val-shoe-rack-empty', severity: 'CRITICAL' as const, code: 'NOT_CONFIGURED',
      message: 'Add at least one box — "2 Door Box" or "Single Door Box" — to generate the Shoe Rack drawing.',
    }] : []),
    ...(twoDoor.enabled ? validateMeasurements({ H: twoDoor.heightMm, W: twoDoor.widthMm, D: twoDoor.depthMm }, [
      { key: 'H', label: '2 Door Box Height', min: 1 },
      { key: 'W', label: '2 Door Box Width', min: 1 },
      { key: 'D', label: '2 Door Box Depth', min: 1 },
    ]) : []),
    ...(singleDoor.enabled ? validateMeasurements({ H: singleDoor.heightMm, W: singleDoor.widthMm, D: singleDoor.depthMm }, [
      { key: 'H', label: 'Single Door Box Height', min: 1 },
      { key: 'W', label: 'Single Door Box Width', min: 1 },
      { key: 'D', label: 'Single Door Box Depth', min: 1 },
    ]) : []),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'shoe-rack', designId: 'simple', designName: 'Shoe Rack',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines,
  };
}
