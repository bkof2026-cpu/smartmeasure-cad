import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Simplified Side Table model — same real site-measurement treatment as the
// simplified Bed/Wardrobe/Shoe Rack: one real box (front elevation, W x H),
// Depth shown as the "/" diagonal leader (never a straight arrow, same
// convention everywhere else in this engine), divided into equal door
// sections by a straight vertical line per door — the door count is the
// only thing that changes the box's internal layout; every door is the
// same Width (Box Width / doorCount), Height and Depth (both = the box's
// own Height/Depth) by default, per the user's explicit direction. The
// detailed CALC_SIDE_TABLE cutlist engine (sideTableFormulas.ts /
// sideTableGeometry.ts) is kept intact for the Component Table / PDF cut
// list — only the on-screen/PDF drawing itself is replaced.
// ─────────────────────────────────────────────────────────────────────────────

export interface SimpleSideTableInputs {
  W: number; // overall box width
  H: number; // overall box height
  D: number; // overall box depth — shown as the "/" diagonal leader
  doors: number; // how many equal vertical sections the box is divided into
}

export interface SimpleSideTableCutRow {
  component: string;
  width: number;
  height: number;
  qty: number;
  remark: string;
}

const BOX_COLOR = '#3b82f6';
const DIAG = '#cc2200';

/** Same "/" inside-corner diagonal convention as Bed/Wardrobe/Shoe Rack. */
function insideDiagonal(cornerX: number, cornerY: number, w: number, h: number, dir: 'right-down' | 'right-up' | 'left-down' | 'left-up') {
  const insetX = Math.min(Math.min(w * 0.35, 70) * 2, w * 0.9);
  const insetY = Math.min(Math.min(h * 0.35, 55) * 2, h * 0.9);
  const dx = dir === 'left-down' || dir === 'left-up' ? -insetX : insetX;
  const dy = dir === 'right-up' || dir === 'left-up' ? -insetY : insetY;
  return { x2: cornerX + dx, y2: cornerY + dy };
}

export function simpleSideTableTitle(inp: SimpleSideTableInputs): string {
  const doorWord = inp.doors === 1 ? 'DOOR' : 'DOORS';
  return `SIDE TABLE — ${Math.round(inp.doors)} ${doorWord}`;
}

/** Same data used for both the screen and the PDF — single source of truth. Every door is equal: Width = Box Width / doorCount, Height = Box Height, Depth = Box Depth. */
export function simpleSideTableCutlist(inp: SimpleSideTableInputs): SimpleSideTableCutRow[] {
  const { W, H, D, doors } = inp;
  const doorCount = Math.max(1, Math.round(doors) || 1);
  const rows: SimpleSideTableCutRow[] = [
    { component: 'Side Table', width: W, height: H, qty: 1, remark: `Width × Height × Depth all entered (${Math.round(W)} × ${Math.round(H)} × ${Math.round(D)}mm)` },
  ];
  rows.push({
    component: `Door (×${doorCount})`, width: W / doorCount, height: H, qty: doorCount,
    remark: `Door Width = Box Width / ${doorCount} — Height & Depth = Box Height & Depth (all doors equal by default)`,
  });
  return rows;
}

export function resolveSimpleSideTablePlan(inp: SimpleSideTableInputs): ResolvedDrawing {
  const { W, H, D } = inp;
  const doorCount = Math.max(1, Math.round(inp.doors) || 1);
  const leaderMargin = 90; // room for the Height dimension on the left
  const topPad = 90; // room above the box for its own Depth "/" leader

  const components: ComponentSpec[] = [];
  const dimReqs: DimensionRequest[] = [];
  const lines: AnnotationLine[] = [];

  const boxX = leaderMargin;
  const boxY = topPad;

  components.push({
    id: 'side-table-body', type: 'SIDE_TABLE_BODY', label: `Side Table ${Math.round(W)}×${Math.round(H)}`,
    x: boxX, y: boxY, width: W, height: H, qty: 1, visible: true,
    source: { formula: `Width × Height (entered) — Depth = ${Math.round(D)}mm, shown as the / leader`, constants: [] },
  });

  // Divide the single box into `doorCount` equal vertical sections — one
  // real divider line per internal seam (doorCount - 1 lines), plus a
  // short pull-mark tick centered on each door, matching the Shoe Rack
  // box's own divider convention.
  const doorW = W / doorCount;
  for (let i = 1; i < doorCount; i++) {
    const dx = boxX + doorW * i;
    lines.push({ x1: dx, y1: boxY + 4, x2: dx, y2: boxY + H - 4, color: '#333' });
  }
  for (let i = 0; i < doorCount; i++) {
    const midX = boxX + doorW * (i + 0.5);
    lines.push({ x1: midX, y1: boxY + H / 2 - 10, x2: midX, y2: boxY + H / 2 + 10, color: '#555' });
  }

  // Depth — "/" diagonal leader drawn INSIDE the box's own top-left
  // corner, per the user's explicit direction (same as every other
  // product in this engine).
  const diag = insideDiagonal(boxX, boxY, W, H, 'right-down');
  lines.push({ x1: boxX, y1: boxY, x2: diag.x2, y2: diag.y2, color: DIAG, label: `${Math.round(D)} mm (D)` });

  // Width — real straight dimension on the box's own bottom edge.
  dimReqs.push({ axis: 'h', x1: boxX, y1: boxY + H, x2: boxX + W, y2: boxY + H, edge: 'bottom', componentIds: ['side-table-body'], label: `${Math.round(W)} mm (W)`, source: { formula: 'Side Table Width = W', constants: [] }, color: BOX_COLOR });
  // Height — real straight dimension on the box's own left edge.
  dimReqs.push({ axis: 'v', x1: boxX, y1: boxY, x2: boxX, y2: boxY + H, edge: 'left', componentIds: ['side-table-body'], label: `${Math.round(H)} mm (H)`, source: { formula: 'Side Table Height = H', constants: [] }, color: BOX_COLOR });

  const worldWidth = Math.max(boxX + W + 20, ...lines.map((l) => Math.max(l.x1, l.x2) + 10));
  const worldHeight = Math.max(boxY + H + 30, ...lines.map((l) => Math.max(l.y1, l.y2) + 10));

  const dimensions = resolveDimensions(dimReqs);
  const issues = [
    ...validateMeasurements({ W, H, D }, [
      { key: 'W', label: 'Side Table Width', min: 1 },
      { key: 'H', label: 'Side Table Height', min: 1 },
      { key: 'D', label: 'Side Table Depth', min: 1 },
    ]),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'side-table', designId: 'simple', designName: 'Side Table',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines,
  };
}
