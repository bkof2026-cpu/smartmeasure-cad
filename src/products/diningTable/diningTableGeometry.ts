import type { AnnotationLine, ComponentSpec, CustomShape, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Dining Table — two genuinely different products behind one "Dining Table
// Type" dropdown, matching the user's own two reference drawings:
//
//  • Folding Dining Table — a single rounded-bottom top surface. Only
//    Width × Length are entered (no Depth). The bottom two corners curve
//    inward into a U shape — real CAD geometry (an SVG path in world mm),
//    not an image, drawn via the shared engine's CustomShape capability.
//
//  • Simple Dining Table — an outer Box (L × W × D) with a smaller inner
//    Top (its own L × W only, no Depth) drawn centered inside it, per the
//    reference's box-with-banded-top structure.
// ─────────────────────────────────────────────────────────────────────────────

export type DiningTableType = 'folding' | 'simple';

export interface DiningTableInputs {
  type: DiningTableType;
  // Folding
  foldW: number;
  foldL: number;
  // Simple — outer box
  boxL: number;
  boxW: number;
  boxD: number;
  // Simple — inner top
  topL: number;
  topW: number;
}

export interface DiningTableCutRow {
  component: string;
  width: number;
  height: number;
  qty: number;
  remark: string;
}

const TABLE_COLOR = '#3b82f6';
const TOP_COLOR = '#f59e0b';
const DIAG = '#cc2200';

function insideDiagonal(cornerX: number, cornerY: number, w: number, h: number) {
  const insetX = Math.min(Math.min(w * 0.35, 70) * 2, w * 0.9);
  const insetY = Math.min(Math.min(h * 0.35, 55) * 2, h * 0.9);
  return { x2: cornerX + insetX, y2: cornerY + insetY };
}

export function diningTableCutlist(inp: DiningTableInputs): DiningTableCutRow[] {
  if (inp.type === 'folding') {
    return [
      { component: 'Folding Dining Table Top', width: inp.foldW, height: inp.foldL, qty: 1, remark: 'Width × Length (both entered) | Bottom corners curved, no Depth' },
    ];
  }
  return [
    { component: 'Dining Table Box', width: inp.boxW, height: inp.boxL, qty: 1, remark: `Length × Width (both entered) | Depth = ${Math.round(inp.boxD)}mm (entered)` },
    { component: 'Top', width: inp.topW, height: inp.topL, qty: 1, remark: 'Top Length × Top Width (both entered) — no independent Depth' },
  ];
}

export function diningTableTitle(inp: DiningTableInputs): string {
  return inp.type === 'folding' ? 'FOLDING DINING TABLE' : 'SIMPLE DINING TABLE';
}

function resolveFoldingPlan(inp: DiningTableInputs): ResolvedDrawing {
  const { foldW: W, foldL: L } = inp;
  const leaderMargin = 90;
  const topPad = 60;
  const tableX = leaderMargin;
  const tableY = topPad;

  // Curve radius proportional to the table's own size — capped so a very
  // narrow/short table never produces a curve wider than the table itself.
  const curve = Math.min(W * 0.22, L * 0.3, 90);

  // Outline path in world mm: straight top, straight sides down to where
  // the curve begins, then the bottom sweeps inward via two quadratic
  // curves into a flat, shorter bottom edge — the rounded "U-like bottom"
  // from the reference, built as real vector geometry.
  const top = tableY;
  const bottom = tableY + L;
  const curveStartY = bottom - curve;
  const path = [
    `M ${tableX} ${top}`,
    `L ${tableX + W} ${top}`,
    `L ${tableX + W} ${curveStartY}`,
    `Q ${tableX + W} ${bottom} ${tableX + W - curve} ${bottom}`,
    `L ${tableX + curve} ${bottom}`,
    `Q ${tableX} ${bottom} ${tableX} ${curveStartY}`,
    `Z`,
  ].join(' ');

  const shapes: CustomShape[] = [{ id: 'folding-top', d: path, fill: '#f0eee8', stroke: TABLE_COLOR, strokeWidth: 1.2 }];
  // A plain ComponentSpec still stands in for the shape for selection /
  // bounds-validation / dimension anchoring purposes (invisible — the real
  // outline is the CustomShape above), so the rest of the engine's
  // component-based machinery (validateComponentBounds) still has a real
  // bounding box to check against.
  const components: ComponentSpec[] = [{
    id: 'folding-table', type: 'FOLDING_TABLE_TOP', label: '', x: tableX, y: tableY, width: W, height: L, qty: 1, visible: false,
    source: { formula: 'Width × Length (entered) | Bottom corners curved — no Depth', constants: [] },
  }];
  const lines: AnnotationLine[] = [
    { x1: tableX + W * 0.28, y1: tableY + L * 0.32, x2: tableX + W * 0.28, y2: tableY + L * 0.32, color: '#111827', label: 'Folding Dining' },
    { x1: tableX + W * 0.28, y1: tableY + L * 0.44, x2: tableX + W * 0.28, y2: tableY + L * 0.44, color: '#111827', label: 'Table Top' },
  ];
  const dimReqs: DimensionRequest[] = [
    { axis: 'h', x1: tableX, y1: tableY, x2: tableX + W, y2: tableY, edge: 'top', componentIds: ['folding-table'], label: `${Math.round(W)} mm (Width)`, source: { formula: 'Width (entered)', constants: [] }, color: TABLE_COLOR },
    { axis: 'v', x1: tableX, y1: tableY, x2: tableX, y2: tableY + L, edge: 'left', componentIds: ['folding-table'], label: `${Math.round(L)} mm (Length)`, source: { formula: 'Length (entered)', constants: [] }, color: TABLE_COLOR },
  ];

  const worldWidth = tableX + W + 70;
  const worldHeight = tableY + L + 50;
  const dimensions = resolveDimensions(dimReqs);
  const issues = [
    ...validateMeasurements({ W, L }, [
      { key: 'W', label: 'Width', min: 1 },
      { key: 'L', label: 'Length', min: 1 },
    ]),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'dining-table', designId: 'folding', designName: 'Folding Dining Table',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines, shapes,
  };
}

function resolveSimplePlan(inp: DiningTableInputs): ResolvedDrawing {
  const { boxL: L, boxW: W, boxD: D, topL, topW } = inp;
  const leaderMargin = 90;
  const topPad = 60;
  const boxX = leaderMargin;
  const boxY = topPad;

  const components: ComponentSpec[] = [{
    id: 'dining-box', type: 'DINING_TABLE_BOX', label: '', x: boxX, y: boxY, width: W, height: L, qty: 1, visible: true,
    source: { formula: `Length × Width (entered) | Depth = ${Math.round(D)}mm (entered)`, constants: [] },
  }];

  // Inner Top — its own real L×W, centered inside the outer box (clamped
  // so an oversized Top entry never renders outside the box it sits in).
  const clampedTopW = Math.min(topW, W);
  const clampedTopL = Math.min(topL, L);
  const topX = boxX + (W - clampedTopW) / 2;
  const topY = boxY + (L - clampedTopL) / 2;
  components.push({
    id: 'dining-top', type: 'TOP', label: 'Top', x: topX, y: topY, width: clampedTopW, height: clampedTopL, qty: 1, visible: true,
    source: { formula: 'Top Length × Top Width (both entered) — no independent Depth', constants: [] },
  });

  const lines: AnnotationLine[] = [];
  const dimReqs: DimensionRequest[] = [];

  // Depth — "/" diagonal leader at the box's own top-left corner.
  const diag = insideDiagonal(boxX, boxY, W, L);
  lines.push({ x1: boxX, y1: boxY, x2: diag.x2, y2: diag.y2, color: DIAG, label: `${Math.round(D)} mm (D)` });

  // Outer box dimensions.
  dimReqs.push({ axis: 'v', x1: boxX, y1: boxY, x2: boxX, y2: boxY + L, edge: 'left', componentIds: ['dining-box'], label: `${Math.round(L)} mm (L)`, source: { formula: 'Length (entered)', constants: [] }, color: TABLE_COLOR });
  dimReqs.push({ axis: 'h', x1: boxX, y1: boxY + L, x2: boxX + W, y2: boxY + L, edge: 'bottom', componentIds: ['dining-box'], label: `${Math.round(W)} mm (W)`, source: { formula: 'Width (entered)', constants: [] }, color: TABLE_COLOR });

  // Inner Top dimensions — its own L (right edge, inside the box, so it
  // never collides with the outer box's own left-edge L) and its own W
  // (top edge, so it never collides with the outer box's own bottom-edge W).
  dimReqs.push({ axis: 'v', x1: topX + clampedTopW, y1: topY, x2: topX + clampedTopW, y2: topY + clampedTopL, edge: 'right', componentIds: ['dining-top'], label: `${Math.round(clampedTopL)} mm (Top L)`, source: { formula: 'Top Length (entered)', constants: [] }, color: TOP_COLOR });
  dimReqs.push({ axis: 'h', x1: topX, y1: topY, x2: topX + clampedTopW, y2: topY, edge: 'top', componentIds: ['dining-top'], label: `${Math.round(clampedTopW)} mm (Top W)`, source: { formula: 'Top Width (entered)', constants: [] }, color: TOP_COLOR });

  const worldWidth = boxX + W + 70;
  const worldHeight = boxY + L + 60;
  const dimensions = resolveDimensions(dimReqs);
  const issues = [
    ...validateMeasurements({ L, W, D }, [
      { key: 'L', label: 'Length', min: 1 },
      { key: 'W', label: 'Width', min: 1 },
      { key: 'D', label: 'Depth', min: 1 },
    ]),
    ...validateMeasurements({ topL, topW }, [
      { key: 'topL', label: 'Top Length', min: 1 },
      { key: 'topW', label: 'Top Width', min: 1 },
    ]),
    ...(topL > L || topW > W ? [{
      id: 'val-dining-top-oversized', severity: 'WARNING' as const, code: 'TOP_LARGER_THAN_BOX',
      message: `Top (${Math.round(topL)}×${Math.round(topW)}mm) is larger than the outer Box (${Math.round(L)}×${Math.round(W)}mm) on at least one side — clamped to fit in the drawing.`,
    }] : []),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'dining-table', designId: 'simple', designName: 'Simple Dining Table',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines,
  };
}

export function resolveDiningTablePlan(inp: DiningTableInputs): ResolvedDrawing {
  return inp.type === 'folding' ? resolveFoldingPlan(inp) : resolveSimplePlan(inp);
}
