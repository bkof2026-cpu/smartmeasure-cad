import type { ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';
import { computeBedCutlist, type BedInputs } from './bedFormulas';
import { resolveSideTableFront } from '../sideTable/sideTableGeometry';
import type { SideTableInputs } from '../sideTable/sideTableFormulas';

export interface SideTableZone {
  side: 'left' | 'right';
  inputs: SideTableInputs;
}

const GAP = 40; // mm real gap drawn between bed and side table, not a fabrication clearance

/**
 * Front-elevation geometry: headboard, side rails, foot rail, platform,
 * trim patti and mattress zone — assembled from Bed's real verified cutlist
 * (bedFormulas.ts). Optional side-table zones are placed beside the
 * headboard end, bottom-aligned to the same floor line as the bed, never
 * overlapping or below it (spec's own Bed+Side-Table acceptance test).
 */
export function resolveBedFront(inp: BedInputs, sideTables: SideTableZone[] = []): ResolvedDrawing {
  const { W, H, headboardH, thk, includeHeadboard } = inp;
  const cutlist = computeBedCutlist(inp);
  const components: ComponentSpec[] = [];
  const dimReqs: DimensionRequest[] = [];

  const leftZone = sideTables.find((z) => z.side === 'left');
  const rightZone = sideTables.find((z) => z.side === 'right');
  const leftW = leftZone ? leftZone.inputs.W + GAP : 0;
  const rightW = rightZone ? rightZone.inputs.W + GAP : 0;
  const bedX = leftW;
  const floorY = headboardH + H;

  if (includeHeadboard) {
    const hb = cutlist.find((r) => r.id === 'HEAD_BOARD')!;
    components.push({ id: 'bed-headboard', type: 'HEAD_BOARD', label: 'Headboard', x: bedX, y: 0, width: W, height: headboardH, qty: 1, visible: true, source: hb.source });
  }

  const frameY = includeHeadboard ? headboardH : 0;
  const frameH = includeHeadboard ? H : headboardH + H;

  const leftSide = cutlist.find((r) => r.id === 'SIDE_400')!;
  components.push({ id: 'bed-side-l', type: 'SIDE_PANEL', label: 'LHS', x: bedX, y: frameY, width: thk, height: frameH, qty: 1, visible: true, source: leftSide.source });
  components.push({ id: 'bed-side-r', type: 'SIDE_PANEL', label: 'RHS', x: bedX + W - thk, y: frameY, width: thk, height: frameH, qty: 1, visible: true, source: leftSide.source });

  const pattiRow = cutlist.find((r) => r.id === 'PATTI_W')!;
  const pattiH = pattiRow.cutWidth; // fixed 50mm cut width = installed trim band height
  components.push({ id: 'bed-patti', type: 'TRIM_PATTI', label: 'Top Patti', x: bedX + thk, y: frameY, width: W - thk * 2, height: pattiH, qty: 1, visible: true, source: pattiRow.source });

  const frnt = cutlist.find((r) => r.id === 'FRNT')!;
  const footRailH = frnt.cutWidth; // fixed 330mm cut width = installed foot-rail height
  components.push({ id: 'bed-foot-rail', type: 'FOOT_RAIL', label: 'Foot Rail', x: bedX + thk, y: floorY - footRailH, width: W - thk * 2, height: footRailH, qty: 1, visible: true, source: frnt.source });

  // Mattress zone — drawn at its stated size, not a fabricated panel.
  const mattY = frameY + pattiH + 6;
  const mattH = Math.max(0, floorY - footRailH - mattY - 6);
  components.push({ id: 'bed-mattress', type: 'MATTRESS', label: 'Mattress Zone', x: bedX + thk + 6, y: mattY, width: W - thk * 2 - 12, height: mattH, qty: 1, visible: true, source: { formula: 'Drawn at entered mattress size — not a cut panel', constants: [] } });

  // Per-component dimensions — every drawn part gets its own real size
  // labeled on the drawing, not just the overall width/height. (Platform
  // Top/Bottom boards are lay-flat panels, not visible edge-on in a front
  // elevation with a meaningful height — their real W x L/2 dimension is
  // shown in the Plan view instead, where the board's true face is seen.)
  dimReqs.push({ axis: 'v', x1: bedX, y1: frameY, x2: bedX, y2: frameY + pattiH, edge: 'left', componentIds: ['bed-patti'], label: `${Math.round(pattiH)} mm`, source: pattiRow.source });
  dimReqs.push({ axis: 'v', x1: bedX, y1: floorY - footRailH, x2: bedX, y2: floorY, edge: 'left', componentIds: ['bed-foot-rail'], label: `${Math.round(footRailH)} mm`, source: frnt.source });
  dimReqs.push({ axis: 'h', x1: bedX, y1: frameY, x2: bedX + thk, y2: frameY, edge: 'top', componentIds: ['bed-side-l'], label: `${Math.round(thk)} mm`, source: leftSide.source });

  // Side tables
  for (const zone of sideTables) {
    const originX = zone.side === 'left' ? 0 : bedX + W + GAP;
    const originY = floorY - zone.inputs.H;
    const st = resolveSideTableFront(zone.inputs, originX, originY, `bed-${zone.side}`);
    components.push(...st.components);
    dimReqs.push({ axis: 'h', x1: originX, y1: originY, x2: originX + zone.inputs.W, y2: originY, edge: 'top', componentIds: st.components.map((c) => c.id), label: `${Math.round(zone.inputs.W)} mm`, source: { formula: 'Side Table Width', constants: [] } });
    dimReqs.push({ axis: 'v', x1: zone.side === 'left' ? originX - 4 : originX + zone.inputs.W + 4, y1: originY, x2: zone.side === 'left' ? originX - 4 : originX + zone.inputs.W + 4, y2: floorY, edge: zone.side === 'left' ? 'left' : 'right', componentIds: st.components.map((c) => c.id), label: `${Math.round(zone.inputs.H)} mm`, source: { formula: 'Side Table Height', constants: [] } });
  }

  const worldWidth = leftW + W + rightW;
  const worldHeight = floorY;

  dimReqs.push({ axis: 'h', x1: bedX, y1: worldHeight, x2: bedX + W, y2: worldHeight, edge: 'bottom', componentIds: components.map((c) => c.id), label: `${Math.round(W)} mm (bed width)`, source: { formula: 'Overall Width = W', constants: [] } });
  if (includeHeadboard) {
    dimReqs.push({ axis: 'v', x1: bedX + W, y1: 0, x2: bedX + W, y2: headboardH, edge: 'right', componentIds: ['bed-headboard'], label: `${Math.round(headboardH)} mm (headboard)`, source: { formula: 'Headboard Height (user-set)', constants: [] } });
  }
  dimReqs.push({ axis: 'v', x1: bedX + W, y1: frameY, x2: bedX + W, y2: floorY, edge: 'right', componentIds: ['bed-side-r'], label: `${Math.round(frameH)} mm (frame)`, source: { formula: 'Frame Height = H', constants: [] } });

  const dimensions = resolveDimensions(dimReqs);
  const issues = [
    ...validateMeasurements(inp as unknown as Record<string, number>, [
      { key: 'W', label: 'Overall Width', min: 1 }, { key: 'H', label: 'Frame Height', min: 1 }, { key: 'headboardH', label: 'Headboard Height', min: 1 },
    ]),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'front', productType: 'bed', designId: 'standard', designName: 'Bed',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified',
  };
}

/** Side elevation — headboard profile at the head end, frame height, mattress zone along the length. */
export function resolveBedSide(inp: BedInputs, L: number): ResolvedDrawing {
  const { H, headboardH, thk, includeHeadboard } = inp;
  const worldWidth = L;
  const worldHeight = headboardH + H;
  const components: ComponentSpec[] = [];

  if (includeHeadboard) {
    components.push({ id: 'bed-side-headboard', type: 'HEAD_BOARD', label: 'HB', x: 0, y: 0, width: thk * 2, height: headboardH, qty: 1, visible: true, source: { formula: 'Headboard profile thickness', constants: [] } });
  }
  const frameY = includeHeadboard ? headboardH : 0;
  const frameH = includeHeadboard ? H : headboardH + H;
  components.push({ id: 'bed-side-frame', type: 'PLATFORM_TOP', label: 'Frame', x: 0, y: frameY, width: L, height: frameH, qty: 1, visible: true, source: { formula: 'Frame profile, height = H', constants: [] } });
  components.push({ id: 'bed-side-mattress', type: 'MATTRESS', label: 'Mattress', x: thk * 2 + 4, y: frameY + 4, width: L - thk * 2 - 8, height: Math.max(0, frameH - 40), qty: 1, visible: true, source: { formula: 'Drawn at entered mattress length', constants: [] } });

  const dimReqs: DimensionRequest[] = [
    { axis: 'h', x1: 0, y1: worldHeight, x2: L, y2: worldHeight, edge: 'bottom', componentIds: components.map((c) => c.id), label: `${Math.round(L)} mm`, source: { formula: 'Mattress Length = L', constants: [] } },
    { axis: 'v', x1: L, y1: 0, x2: L, y2: worldHeight, edge: 'right', componentIds: components.map((c) => c.id), label: `${Math.round(worldHeight)} mm`, source: { formula: 'Headboard + Frame Height', constants: [] } },
  ];
  const dimensions = resolveDimensions(dimReqs);
  const issues = [
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];
  return { view: 'side', productType: 'bed', designId: 'standard', designName: 'Bed', worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified' };
}

/** Plan view — headboard band, side rails, foot band, mattress footprint, side tables beside the head end. */
export function resolveBedPlan(inp: BedInputs, L: number, sideTables: SideTableZone[] = []): ResolvedDrawing {
  const { W, thk } = inp;
  const railBand = Math.max(thk * 3, 40);
  const footBand = Math.max(thk * 2, 30);

  const leftZone = sideTables.find((z) => z.side === 'left');
  const rightZone = sideTables.find((z) => z.side === 'right');
  const leftW = leftZone ? leftZone.inputs.W + GAP : 0;
  const rightW = rightZone ? rightZone.inputs.W + GAP : 0;
  const bedX = leftW;

  const components: ComponentSpec[] = [
    { id: 'bed-plan-headboard', type: 'HEAD_BOARD', label: 'Headboard', x: bedX, y: 0, width: W, height: railBand, qty: 1, visible: true, source: { formula: 'Headboard band at head end', constants: [] } },
    { id: 'bed-plan-lhs', type: 'SIDE_PANEL', label: 'LHS', x: bedX, y: railBand, width: railBand, height: L - railBand - footBand, qty: 1, visible: true, source: { formula: 'Side rail runs the mattress length', constants: [] } },
    { id: 'bed-plan-rhs', type: 'SIDE_PANEL', label: 'RHS', x: bedX + W - railBand, y: railBand, width: railBand, height: L - railBand - footBand, qty: 1, visible: true, source: { formula: 'Side rail runs the mattress length', constants: [] } },
    { id: 'bed-plan-foot', type: 'FOOT_RAIL', label: 'Foot Rail', x: bedX, y: L - footBand, width: W, height: footBand, qty: 1, visible: true, source: { formula: 'Foot rail band', constants: [] } },
    { id: 'bed-plan-mattress', type: 'MATTRESS', label: 'Mattress', x: bedX + railBand + 6, y: railBand + 6, width: W - railBand * 2 - 12, height: L - railBand - footBand - 12, qty: 1, visible: true, source: { formula: 'Drawn at entered mattress length (L) x width (W)', constants: [] } },
  ];

  const dimReqs: DimensionRequest[] = [
    { axis: 'h', x1: bedX, y1: L, x2: bedX + W, y2: L, edge: 'bottom', componentIds: components.map((c) => c.id), label: `${Math.round(W)} mm`, source: { formula: 'Overall Width = W', constants: [] } },
    { axis: 'v', x1: bedX + W, y1: 0, x2: bedX + W, y2: L, edge: 'right', componentIds: components.map((c) => c.id), label: `${Math.round(L)} mm`, source: { formula: 'Mattress Length = L (entered)', constants: [] } },
  ];

  // Platform (Top) boards are real, correctly-formula'd cutlist rows (W x
  // L/2 each, qty 2) but — like Back Panel+Front, Bottom, and the H-Panel
  // shelves — they're lay-flat panels with no honest single-view placement:
  // drawing them full-size inside this footprint either overlaps every
  // other component or (as tried and reverted) forces the canvas taller
  // than the bed itself, corrupting this view's own "W x L" title. They
  // stay fully documented — correct formula and size — in the component
  // table and Drawing Inspector instead of a misleading forced drawing.

  for (const zone of sideTables) {
    const originX = zone.side === 'left' ? 0 : bedX + W + GAP;
    const originY = 0; // upper side, beside the headboard end — never below or overlapping the bed
    components.push({
      id: `bed-plan-${zone.side}-table`, type: 'SIDE_TABLE', label: `Side Table (${zone.side})`,
      x: originX, y: originY, width: zone.inputs.W, height: zone.inputs.D, qty: 1, visible: true,
      source: { formula: 'Side table footprint, positioned beside the headboard end', constants: [] },
    });
    dimReqs.push({ axis: 'h', x1: originX, y1: originY, x2: originX + zone.inputs.W, y2: originY, edge: 'top', componentIds: [`bed-plan-${zone.side}-table`], label: `${Math.round(zone.inputs.W)} mm`, source: { formula: 'Side Table Width', constants: [] } });
  }

  const worldWidth = leftW + W + rightW;
  const worldHeight = L;
  const dimensions = resolveDimensions(dimReqs);
  const issues = [
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'bed', designId: 'standard', designName: 'Bed',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified',
  };
}
