import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Separate Side Table — matches the user's own reference sketch: two
// separate rectangles stacked with a real, visible gap between them — a
// Mirror on top (Width x Height, plain box) and a Base Storage unit below
// (Height x Width x Depth, with one internal division line, per the
// sketch), never touching. Depth is only meaningful for Base Storage (the
// Mirror has none) — shown as the "/" diagonal leader, same convention as
// every other product.
// ─────────────────────────────────────────────────────────────────────────────

export interface SeparateSideTableInputs {
  mirrorW: number;
  mirrorH: number;
  baseH: number;
  baseW: number;
  baseD: number;
}

export interface SeparateSideTableCutRow {
  component: string;
  width: number;
  height: number;
  qty: number;
  remark: string;
}

const MIRROR_COLOR = '#111827'; // near-black, matching the reference sketch's plain outline
const BASE_COLOR = '#0891b2'; // cyan/blue, matching the reference sketch
const DIAG = '#0891b2';

function insideDiagonal(cornerX: number, cornerY: number, w: number, h: number) {
  const insetX = Math.min(Math.min(w * 0.35, 70) * 2, w * 0.9);
  const insetY = Math.min(Math.min(h * 0.35, 55) * 2, h * 0.9);
  return { x2: cornerX + insetX, y2: cornerY + insetY };
}

export function separateSideTableCutlist(inp: SeparateSideTableInputs): SeparateSideTableCutRow[] {
  return [
    { component: 'Mirror', width: inp.mirrorW, height: inp.mirrorH, qty: 1, remark: `Width × Height (both entered, ${Math.round(inp.mirrorW)} × ${Math.round(inp.mirrorH)}mm) — no Depth` },
    { component: 'Base Storage', width: inp.baseW, height: inp.baseH, qty: 1, remark: `Height × Width × Depth (all entered, ${Math.round(inp.baseH)} × ${Math.round(inp.baseW)} × ${Math.round(inp.baseD)}mm)` },
  ];
}

export function resolveSeparateSideTablePlan(inp: SeparateSideTableInputs): ResolvedDrawing {
  const { mirrorW, mirrorH, baseH, baseW, baseD } = inp;
  const leaderMargin = 90;
  const topPad = 40;
  const gap = Math.max(30, Math.min(mirrorH, baseH) * 0.25); // real, visible gap — scales a little with the components so it never reads as a rendering artifact on very small/large boxes

  const boxX = leaderMargin;
  const mirrorY = topPad;
  const baseY = mirrorY + mirrorH + gap;

  const components: ComponentSpec[] = [
    { id: 'mirror', type: 'MIRROR', label: 'mirror', x: boxX, y: mirrorY, width: mirrorW, height: mirrorH, qty: 1, visible: true, source: { formula: `Width × Height (both entered)`, constants: [] } },
    { id: 'base-storage', type: 'BASE_STORAGE_FRAME', label: '', x: boxX, y: baseY, width: baseW, height: baseH, qty: 1, visible: true, source: { formula: `Height × Width (entered) | Depth = ${Math.round(baseD)}mm, shown as the / leader`, constants: [] } },
  ];
  const lines: AnnotationLine[] = [];

  // Base Storage's own internal division (two rows, per the reference
  // sketch) — real sub-boxes so the label can sit in the top row (clear of
  // the division) rather than centered on the frame, matching the same
  // fix already applied to Separate Dressing.
  const baseRowH = baseH / 2;
  for (let i = 0; i < 2; i++) {
    const ry = baseY + i * baseRowH;
    components.push({ id: `base-storage-row-${i}`, type: 'BASE_STORAGE_ROW', label: '', x: boxX + 3, y: ry + 3, width: baseW - 6, height: baseRowH - 6, qty: 1, visible: true, source: { formula: `Row ${i + 1} of 2`, constants: [] } });
    // Small handle dash, matching the short horizontal mark in the
    // reference sketch's own two rows.
    const dashY = ry + baseRowH * 0.3;
    lines.push({ x1: boxX + baseW * 0.35, y1: dashY, x2: boxX + baseW * 0.55, y2: dashY, color: '#333', strokeWidth: 1.4 });
  }

  // Depth — "/" diagonal leader on Base Storage's own top-left corner (the
  // Mirror has no Depth at all, per the spec).
  const diag = insideDiagonal(boxX, baseY, baseW, baseH);
  lines.push({ x1: boxX, y1: baseY, x2: diag.x2, y2: diag.y2, color: DIAG, label: `${Math.round(baseD)} mm (D)` });

  const dimReqs: DimensionRequest[] = [
    // Mirror — Width along its own top edge, Height on its own left edge.
    { axis: 'h', x1: boxX, y1: mirrorY, x2: boxX + mirrorW, y2: mirrorY, edge: 'top', componentIds: ['mirror'], label: `${Math.round(mirrorW)} mm (W)`, source: { formula: 'Mirror Width (entered)', constants: [] }, color: MIRROR_COLOR },
    { axis: 'v', x1: boxX, y1: mirrorY, x2: boxX, y2: mirrorY + mirrorH, edge: 'left', componentIds: ['mirror'], label: `${Math.round(mirrorH)} mm (H)`, source: { formula: 'Mirror Height (entered)', constants: [] }, color: MIRROR_COLOR },
    // Base Storage — Width along its own bottom edge, Height on its own left edge.
    { axis: 'h', x1: boxX, y1: baseY + baseH, x2: boxX + baseW, y2: baseY + baseH, edge: 'bottom', componentIds: ['base-storage'], label: `${Math.round(baseW)} mm (W)`, source: { formula: 'Base Storage Width (entered)', constants: [] }, color: BASE_COLOR },
    { axis: 'v', x1: boxX, y1: baseY, x2: boxX, y2: baseY + baseH, edge: 'left', componentIds: ['base-storage'], label: `${Math.round(baseH)} mm (H)`, source: { formula: 'Base Storage Height (entered)', constants: [] }, color: BASE_COLOR },
  ];

  const worldWidth = Math.max(boxX + Math.max(mirrorW, baseW) + 90, ...lines.map((l) => Math.max(l.x1, l.x2) + 10));
  const worldHeight = Math.max(baseY + baseH + 30, ...lines.map((l) => Math.max(l.y1, l.y2) + 10));

  const dimensions = resolveDimensions(dimReqs);
  const issues = [
    ...validateMeasurements({ mirrorW, mirrorH }, [
      { key: 'mirrorW', label: 'Mirror Width', min: 1 },
      { key: 'mirrorH', label: 'Mirror Height', min: 1 },
    ]),
    ...validateMeasurements({ baseH, baseW, baseD }, [
      { key: 'baseH', label: 'Base Storage Height', min: 1 },
      { key: 'baseW', label: 'Base Storage Width', min: 1 },
      { key: 'baseD', label: 'Base Storage Depth', min: 1 },
    ]),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'separate-side-table', designId: 'simple', designName: 'Separate Side Table',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines,
  };
}
