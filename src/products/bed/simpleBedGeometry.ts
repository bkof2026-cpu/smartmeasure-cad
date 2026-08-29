import type { ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Simplified Bed model — replaces the CALC_BED panel/patti/platform/foot-rail
// breakdown for the primary Bed product screen, per the user's own real
// site-measurement workflow: a measurement person sketches ONE bed rectangle
// + a headboard band + optional side tables at the head-end corners, in
// under a minute — not a fabrication component tree. The detailed CALC_BED
// engine (bedFormulas.ts / bedGeometry.ts / BedTechnicalDrawing.tsx) is kept
// intact, just no longer wired into the live Bed product entry.
//
// This is a single combined "site sketch" style plan view — headboard drawn
// at its real height directly above the bed's own W x L footprint, matching
// the user's hand-measured reference sketch exactly, not a strict single
// orthographic projection.
// ─────────────────────────────────────────────────────────────────────────────

export interface SimpleSideTableInput {
  enabled: boolean;
  depthMm: number;
  widthMm: number;
}

export interface SimpleBedInputs {
  W: number; // bed width
  L: number; // bed length
  H: number; // bed height — also auto-fetched as LST/RST height
  headboardH: number; // standard default 900mm, editable
  lst: SimpleSideTableInput;
  rst: SimpleSideTableInput;
}

export interface SimpleBedCutRow {
  component: string;
  width: number;
  height: number;
  qty: number;
  remark: string;
}

/** "BED — PLAN VIEW" / "BED + LST — PLAN VIEW" / "BED + LST + RST — PLAN VIEW", per the selected side tables. */
export function simpleBedTitle(inp: SimpleBedInputs): string {
  const parts = ['BED'];
  if (inp.lst.enabled) parts.push('LST');
  if (inp.rst.enabled) parts.push('RST');
  return `${parts.join(' + ')} — PLAN VIEW`;
}

/** Same data used for both the screen and the PDF — single source of truth. */
export function simpleBedCutlist(inp: SimpleBedInputs): SimpleBedCutRow[] {
  const rows: SimpleBedCutRow[] = [
    { component: 'Bed', width: inp.W, height: inp.L, qty: 1, remark: 'Single rectangular footprint — Width = W, Length = L' },
    { component: 'Headboard', width: inp.W, height: inp.headboardH, qty: 1, remark: 'Width = Bed Width (auto) | Height = standard 900mm, editable' },
  ];
  if (inp.lst.enabled) {
    rows.push({ component: 'Left Side Table (LST)', width: inp.lst.widthMm, height: inp.lst.depthMm, qty: 1, remark: `Depth × Width entered; Height = Bed Height (auto-fetched, ${Math.round(inp.H)}mm)` });
  }
  if (inp.rst.enabled) {
    rows.push({ component: 'Right Side Table (RST)', width: inp.rst.widthMm, height: inp.rst.depthMm, qty: 1, remark: `Depth × Width entered; Height = Bed Height (auto-fetched, ${Math.round(inp.H)}mm)` });
  }
  return rows;
}

export function resolveSimpleBedPlan(inp: SimpleBedInputs): ResolvedDrawing {
  const { W, L, H, headboardH, lst, rst } = inp;
  const leftW = lst.enabled ? lst.widthMm : 0;
  const rightW = rst.enabled ? rst.widthMm : 0;
  const bedX = leftW; // shift everything right so nothing is negative

  const components: ComponentSpec[] = [];
  const dimReqs: DimensionRequest[] = [];

  components.push({
    id: 'headboard', type: 'HEAD_BOARD', label: 'Headboard', x: bedX, y: 0, width: W, height: headboardH, qty: 1, visible: true,
    source: { formula: 'Width = Bed Width (auto) | Height = Headboard Height (standard default 900mm, editable)', constants: [] },
  });
  components.push({
    id: 'bed-body', type: 'BED_BODY', label: `BED  ${Math.round(W)}×${Math.round(L)}`, x: bedX, y: headboardH, width: W, height: L, qty: 1, visible: true,
    source: { formula: 'Width = W | Length = L — single rectangular footprint, no internal panels', constants: [] },
  });

  dimReqs.push({ axis: 'h', x1: bedX, y1: headboardH + L, x2: bedX + W, y2: headboardH + L, edge: 'bottom', componentIds: ['bed-body'], label: `${Math.round(W)} mm (W)`, source: { formula: 'Bed Width = W', constants: [] } });
  dimReqs.push({ axis: 'v', x1: bedX + W, y1: headboardH, x2: bedX + W, y2: headboardH + L, edge: 'right', componentIds: ['bed-body'], label: `${Math.round(L)} mm (L)`, source: { formula: 'Bed Length = L', constants: [] } });
  dimReqs.push({ axis: 'v', x1: bedX, y1: 0, x2: bedX, y2: headboardH, edge: 'left', componentIds: ['headboard'], label: `${Math.round(headboardH)} mm (headboard H)`, source: { formula: 'Headboard Height (standard default 900mm, editable)', constants: [] } });

  if (lst.enabled) {
    const lw = lst.widthMm, ld = lst.depthMm;
    components.push({
      id: 'lst', type: 'SIDE_TABLE', label: 'LST', x: 0, y: 0, width: lw, height: ld, qty: 1, visible: true,
      source: { formula: `Depth = ${Math.round(ld)}mm (entered) | Width = ${Math.round(lw)}mm (entered) | Height = Bed Height (auto-fetched, ${Math.round(H)}mm)`, constants: [] },
    });
    dimReqs.push({ axis: 'h', x1: 0, y1: -8, x2: lw, y2: -8, edge: 'top', componentIds: ['lst'], label: `${Math.round(lw)} mm (W)`, source: { formula: 'LST Width (entered)', constants: [] } });
    dimReqs.push({ axis: 'v', x1: -8, y1: 0, x2: -8, y2: ld, edge: 'left', componentIds: ['lst'], label: `${Math.round(ld)} mm (D)`, source: { formula: 'LST Depth (entered)', constants: [] } });
  }
  if (rst.enabled) {
    const rw = rst.widthMm, rd = rst.depthMm;
    const rx = bedX + W;
    components.push({
      id: 'rst', type: 'SIDE_TABLE', label: 'RST', x: rx, y: 0, width: rw, height: rd, qty: 1, visible: true,
      source: { formula: `Depth = ${Math.round(rd)}mm (entered) | Width = ${Math.round(rw)}mm (entered) | Height = Bed Height (auto-fetched, ${Math.round(H)}mm)`, constants: [] },
    });
    dimReqs.push({ axis: 'h', x1: rx, y1: -8, x2: rx + rw, y2: -8, edge: 'top', componentIds: ['rst'], label: `${Math.round(rw)} mm (W)`, source: { formula: 'RST Width (entered)', constants: [] } });
    dimReqs.push({ axis: 'v', x1: rx + rw + 8, y1: 0, x2: rx + rw + 8, y2: rd, edge: 'right', componentIds: ['rst'], label: `${Math.round(rd)} mm (D)`, source: { formula: 'RST Depth (entered)', constants: [] } });
  }

  const worldWidth = leftW + W + rightW;
  const worldHeight = headboardH + L;

  const dimensions = resolveDimensions(dimReqs);
  const issues = [
    ...validateMeasurements({ W, L, H, headboardH }, [
      { key: 'W', label: 'Bed Width', min: 1 },
      { key: 'L', label: 'Bed Length', min: 1 },
      { key: 'H', label: 'Bed Height', min: 1 },
      { key: 'headboardH', label: 'Headboard Height', min: 1 },
    ]),
    ...(lst.enabled ? validateMeasurements({ D: lst.depthMm, W: lst.widthMm }, [{ key: 'D', label: 'LST Depth', min: 1 }, { key: 'W', label: 'LST Width', min: 1 }]) : []),
    ...(rst.enabled ? validateMeasurements({ D: rst.depthMm, W: rst.widthMm }, [{ key: 'D', label: 'RST Depth', min: 1 }, { key: 'W', label: 'RST Width', min: 1 }]) : []),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'bed', designId: 'simple', designName: 'Bed',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified',
  };
}
