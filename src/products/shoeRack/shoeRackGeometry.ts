import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';

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
  const insetX = Math.min(w * 0.35, 70);
  const insetY = Math.min(h * 0.35, 55);
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
  const bottomY = topPad + maxH; // both boxes sit flush on this shared baseline, per the reference sketch

  let cursorX = leaderMargin;
  const twoDoorX = cursorX;
  if (twoDoor.enabled) cursorX += twoDoor.widthMm;
  const singleDoorX = cursorX;

  if (twoDoor.enabled) {
    const { widthMm: w, heightMm: h, depthMm: d } = twoDoor;
    const y = bottomY - h;
    components.push({
      // Plain name only — the real Height/Width/Depth are already shown via
      // the dimension arrows and the "/" leader around the box; repeating
      // them in the caption risks overflowing a narrower box and colliding
      // with the Height dimension sitting right beside it.
      id: 'two-door-box', type: 'SHOE_RACK_BOX', label: '2 Door Box', x: twoDoorX, y, width: w, height: h, qty: 1, visible: true,
      source: { formula: `Height = ${Math.round(h)}mm | Width = ${Math.round(w)}mm | Depth = ${Math.round(d)}mm (all entered)`, constants: [] },
    });
    // The shared middle divider — one real line splitting the box into its
    // two doors, matching the sketch — plus a short pull-mark tick on each
    // door's inner edge (the small "|" beside each door in the sketch).
    const midX = twoDoorX + w / 2;
    lines.push({ x1: midX, y1: y + 4, x2: midX, y2: y + h - 4, color: '#333' });
    lines.push({ x1: midX - 16, y1: y + h / 2 - 10, x2: midX - 16, y2: y + h / 2 + 10, color: '#555' });
    lines.push({ x1: midX + 16, y1: y + h / 2 - 10, x2: midX + 16, y2: y + h / 2 + 10, color: '#555' });
    // Depth — "/" diagonal leader drawn INSIDE the box's own top-left
    // corner, per the user's explicit direction.
    const twoDoorDiag = insideDiagonal(twoDoorX, y, w, h, 'right-down');
    lines.push({ x1: twoDoorX, y1: y, x2: twoDoorDiag.x2, y2: twoDoorDiag.y2, color: DIAG, label: `${Math.round(d)} mm (D)` });
    // Height — real straight dimension on the box's own outer (left) edge.
    dimReqs.push({ axis: 'v', x1: twoDoorX, y1: y, x2: twoDoorX, y2: bottomY, edge: 'left', componentIds: ['two-door-box'], label: `${Math.round(h)} mm (H)`, source: { formula: 'Height (entered)', constants: [] } });
    // Width — real straight dimension on the shared bottom baseline.
    dimReqs.push({ axis: 'h', x1: twoDoorX, y1: bottomY, x2: twoDoorX + w, y2: bottomY, edge: 'bottom', componentIds: ['two-door-box'], label: `${Math.round(w)} mm (W)`, source: { formula: 'Width (entered)', constants: [] } });
  }

  if (singleDoor.enabled) {
    const { widthMm: w, heightMm: h, depthMm: d } = singleDoor;
    const y = bottomY - h;
    components.push({
      id: 'single-door-box', type: 'SHOE_RACK_BOX', label: 'Single Door Box', x: singleDoorX, y, width: w, height: h, qty: 1, visible: true,
      source: { formula: `Height = ${Math.round(h)}mm | Width = ${Math.round(w)}mm | Depth = ${Math.round(d)}mm (all entered)`, constants: [] },
    });
    // Single door pull-mark tick, matching the sketch's one "|" mark.
    const doorMidX = singleDoorX + w * 0.35;
    lines.push({ x1: doorMidX, y1: y + h / 2 - 10, x2: doorMidX, y2: y + h / 2 + 10, color: '#555' });
    // Depth — drawn INSIDE this box's own top-RIGHT corner instead of its
    // left: its left corner is the shared boundary with the 2 Door Box
    // (whenever that one is also present), so a leader there would overlap
    // that box's own space. The top-right corner is always this box's own.
    const singleDoorDiag = insideDiagonal(singleDoorX + w, y, w, h, 'left-down');
    lines.push({ x1: singleDoorX + w, y1: y, x2: singleDoorDiag.x2, y2: singleDoorDiag.y2, color: DIAG, label: `${Math.round(d)} mm (D)` });
    // Height — real straight dimension on the box's own outer (right) edge.
    dimReqs.push({ axis: 'v', x1: singleDoorX + w, y1: y, x2: singleDoorX + w, y2: bottomY, edge: 'right', componentIds: ['single-door-box'], label: `${Math.round(h)} mm (H)`, source: { formula: 'Height (entered)', constants: [] } });
    // Width — real straight dimension on the shared bottom baseline.
    dimReqs.push({ axis: 'h', x1: singleDoorX, y1: bottomY, x2: singleDoorX + w, y2: bottomY, edge: 'bottom', componentIds: ['single-door-box'], label: `${Math.round(w)} mm (W)`, source: { formula: 'Width (entered)', constants: [] } });
  }

  const worldWidth = Math.max(
    anyEnabled ? singleDoorX + (singleDoor.enabled ? singleDoor.widthMm : 0) + 20 : 200,
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
