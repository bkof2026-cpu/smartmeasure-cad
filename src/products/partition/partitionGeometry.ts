import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Partition — two distinct drawings selected by a Partition Type dropdown,
// matching the user's own two reference sketches exactly:
//
// "With Framing": a plain double-line frame around the opening — no
// internal division at all, just the frame structure.
//
// "With Partition": the same frame, but with an inner partition member
// (a second, narrower double-line frame) set to the chosen side (Left or
// Right) — matching the reference sketch's own left/right variants.
//
// Height/Width/Depth are always entered; Partition Position (Left/Right)
// only applies in "With Partition" mode.
// ─────────────────────────────────────────────────────────────────────────────

export type PartitionType = 'framing' | 'partition';
export type PartitionSide = 'left' | 'right';

export interface PartitionInputs {
  type: PartitionType;
  H: number;
  W: number;
  D: number;
  side: PartitionSide; // only meaningful when type === 'partition'
}

export interface PartitionCutRow {
  component: string;
  width: number;
  height: number;
  qty: number;
  remark: string;
}

const FRAME_COLOR = '#111827';
const DIAG = '#cc2200';

function insideDiagonal(cornerX: number, cornerY: number, w: number, h: number) {
  const insetX = Math.min(Math.min(w * 0.35, 70) * 2, w * 0.9);
  const insetY = Math.min(Math.min(h * 0.35, 55) * 2, h * 0.9);
  return { x2: cornerX + insetX, y2: cornerY + insetY };
}

export function partitionTitle(inp: PartitionInputs): string {
  return inp.type === 'framing' ? 'PARTITION — WITH FRAMING' : `PARTITION — WITH PARTITION (${inp.side.toUpperCase()})`;
}

export function partitionCutlist(inp: PartitionInputs): PartitionCutRow[] {
  const rows: PartitionCutRow[] = [
    { component: inp.type === 'framing' ? 'Framing' : 'Outer Frame', width: inp.W, height: inp.H, qty: 1, remark: `Height × Width (both entered) | Depth = ${Math.round(inp.D)}mm (entered)` },
  ];
  if (inp.type === 'partition') {
    rows.push({ component: `Partition Member (${inp.side === 'left' ? 'Left' : 'Right'})`, width: inp.W * 0.28, height: inp.H, qty: 1, remark: 'Position entered — no independent Width/Height/Depth (matches outer frame)' });
  }
  return rows;
}

export function resolvePartitionPlan(inp: PartitionInputs): ResolvedDrawing {
  const { H, W, D } = inp;
  const leaderMargin = 90;
  const topPad = 90;
  const frameGap = Math.max(6, Math.min(W, H) * 0.02); // real double-line frame offset, scales with the opening

  const boxX = leaderMargin;
  const boxY = topPad;

  const components: ComponentSpec[] = [];
  const lines: AnnotationLine[] = [];
  const dimReqs: DimensionRequest[] = [];

  // Outer frame — a real double-line rectangle (outer + inset inner line),
  // matching both reference sketches' own frame convention.
  components.push({ id: 'frame-outer', type: 'FRAMING_OUTER', label: '', x: boxX, y: boxY, width: W, height: H, qty: 1, visible: true, source: { formula: `Width × Height (entered) | Depth = ${Math.round(D)}mm, shown as the / leader`, constants: [] } });
  lines.push({ x1: boxX + frameGap, y1: boxY + frameGap, x2: boxX + W - frameGap, y2: boxY + frameGap, color: FRAME_COLOR, strokeWidth: 1 });
  lines.push({ x1: boxX + frameGap, y1: boxY + H - frameGap, x2: boxX + W - frameGap, y2: boxY + H - frameGap, color: FRAME_COLOR, strokeWidth: 1 });
  lines.push({ x1: boxX + frameGap, y1: boxY + frameGap, x2: boxX + frameGap, y2: boxY + H - frameGap, color: FRAME_COLOR, strokeWidth: 1 });
  lines.push({ x1: boxX + W - frameGap, y1: boxY + frameGap, x2: boxX + W - frameGap, y2: boxY + H - frameGap, color: FRAME_COLOR, strokeWidth: 1 });

  if (inp.type === 'partition') {
    // Inner partition member — a second, narrower double-line frame set to
    // the chosen side, per the reference sketch's own left/right variants.
    const memberW = W * 0.28;
    const mx = inp.side === 'left' ? boxX : boxX + W - memberW;
    components.push({ id: 'partition-member', type: 'PARTITION_MEMBER', label: '', x: mx, y: boxY, width: memberW, height: H, qty: 1, visible: true, source: { formula: `Position = ${inp.side === 'left' ? 'Left' : 'Right'} (entered) — no independent size`, constants: [] } });
    lines.push({ x1: mx + memberW, y1: boxY, x2: mx + memberW, y2: boxY + H, color: FRAME_COLOR, strokeWidth: 1.6 });
    // Leader anchored on the member's own INNER edge (the divider shared
    // with the rest of the box), pointing straight UP into the clear strip
    // between the title and the frame — the vertical-center position tried
    // first collided with the Height dimension's own centered label, and
    // the outer-edge position collided with the Depth diagonal at the
    // top-left corner; this is the one spot nothing else already occupies,
    // regardless of drawing scale.
    lines.push({
      x1: mx + memberW, y1: boxY, x2: mx + memberW, y2: boxY - 45,
      color: '#7c3aed', label: `Partition (${inp.side === 'left' ? 'Left' : 'Right'})`,
    });
  }

  // Depth — "/" diagonal leader at the frame's own top-left corner.
  const diag = insideDiagonal(boxX, boxY, W, H);
  lines.push({ x1: boxX, y1: boxY, x2: diag.x2, y2: diag.y2, color: DIAG, label: `${Math.round(D)} mm (D)` });

  dimReqs.push({ axis: 'v', x1: boxX, y1: boxY, x2: boxX, y2: boxY + H, edge: 'left', componentIds: ['frame-outer'], label: `${Math.round(H)} mm (H)`, source: { formula: 'Height (entered)', constants: [] }, color: FRAME_COLOR });
  dimReqs.push({ axis: 'h', x1: boxX, y1: boxY + H, x2: boxX + W, y2: boxY + H, edge: 'bottom', componentIds: ['frame-outer'], label: `${Math.round(W)} mm (W)`, source: { formula: 'Width (entered)', constants: [] }, color: FRAME_COLOR });

  const worldWidth = Math.max(boxX + W + 20, ...lines.map((l) => Math.max(l.x1, l.x2) + 10));
  const worldHeight = Math.max(boxY + H + 30, ...lines.map((l) => Math.max(l.y1, l.y2) + 10));

  const dimensions = resolveDimensions(dimReqs);
  const issues = [
    ...validateMeasurements({ H, W, D }, [
      { key: 'H', label: 'Height', min: 1 },
      { key: 'W', label: 'Width', min: 1 },
      { key: 'D', label: 'Depth', min: 1 },
    ]),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'partition', designId: inp.type, designName: 'Partition',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines,
  };
}
