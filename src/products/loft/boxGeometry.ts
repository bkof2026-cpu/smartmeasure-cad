import type { ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';
import { computeBoxCutlist, type BoxInputs } from './boxFormulas';

export function resolveBoxFront(inp: BoxInputs): ResolvedDrawing {
  const { W, H, thk, verticalQty, includeDoor } = inp;
  const cutlist = computeBoxCutlist(inp);
  const components: ComponentSpec[] = [];
  const dimReqs: DimensionRequest[] = [];

  const top = cutlist.find((r) => r.id === 'TOP')!;
  const bottom = cutlist.find((r) => r.id === 'BOTTOM')!;
  const lhs = cutlist.find((r) => r.id === 'LHS')!;
  components.push({ id: 'top', type: 'TOP_PANEL', label: 'Top', x: 0, y: 0, width: W, height: thk, qty: 1, visible: true, source: top.source });
  components.push({ id: 'bottom', type: 'BOTTOM_PANEL', label: 'Bottom', x: 0, y: H - thk, width: W, height: thk, qty: 1, visible: true, source: bottom.source });
  components.push({ id: 'lhs', type: 'SIDE_PANEL', label: 'LHS', x: 0, y: 0, width: thk, height: H, qty: 1, visible: true, source: lhs.source });
  components.push({ id: 'rhs', type: 'SIDE_PANEL', label: 'RHS', x: W - thk, y: 0, width: thk, height: H, qty: 1, visible: true, source: lhs.source });

  const compartments = verticalQty + 1;
  const compW = (W - thk * 2) / compartments;
  const vertRow = cutlist.find((r) => r.id === 'VERTICAL');
  for (let i = 1; i <= verticalQty; i++) {
    const vx = thk + compW * i - thk / 2;
    components.push({ id: `vert-${i}`, type: 'VERTICAL_PARTITION', label: 'Vertical', x: vx, y: thk, width: thk, height: H - thk * 2, qty: 1, visible: true, source: vertRow?.source ?? { formula: 'Vertical divider', constants: [] } });
  }

  const doorRow = cutlist.find((r) => r.id === 'DOOR');
  for (let i = 0; i < compartments; i++) {
    const cx = thk + compW * i;
    if (includeDoor && doorRow) {
      // Door drawn at its real cutlist width (W/compartments - thk - 2mm
      // groove — see boxFormulas.ts), centered in its raw W/compartments
      // slot so the BOM and the drawing never disagree on door size.
      const doorW = doorRow.cutWidth;
      const doorX = cx + (compW - doorW) / 2;
      components.push({ id: `door-${i}`, type: 'DOOR', label: `Door ${i + 1}`, x: doorX, y: thk + 2, width: doorW, height: H - thk * 2 - 4, qty: 1, visible: true, source: doorRow.source });
    } else {
      components.push({ id: `open-${i}`, type: 'NICHE_PANEL', label: `Box ${i + 1}`, x: cx + 3, y: thk + 3, width: compW - 6, height: H - thk * 2 - 6, qty: 1, visible: true, source: { formula: 'Open compartment (no door)', constants: [] } });
    }
  }

  dimReqs.push({ axis: 'h', x1: 0, y1: H, x2: W, y2: H, edge: 'bottom', componentIds: components.map((c) => c.id), label: `${Math.round(W)} mm`, source: { formula: 'Overall Width = W', constants: [] } });
  dimReqs.push({ axis: 'v', x1: W, y1: 0, x2: W, y2: H, edge: 'right', componentIds: components.map((c) => c.id), label: `${Math.round(H)} mm`, source: { formula: 'Overall Height = H', constants: [] } });
  if (compartments > 1) {
    for (let i = 0; i < compartments; i++) {
      const cx = thk + compW * i;
      dimReqs.push({ axis: 'h', x1: cx, y1: 0, x2: cx + compW, y2: 0, edge: 'top', componentIds: [], label: `${Math.round(compW)} mm`, source: { formula: 'Compartment width = (W - 2×thk) / compartments', constants: [] } });
    }
  }

  const dimensions = resolveDimensions(dimReqs);
  const issues = [
    ...validateMeasurements(inp as unknown as Record<string, number>, [{ key: 'W', label: 'Overall Width', min: 1 }, { key: 'H', label: 'Overall Height', min: 1 }]),
    ...validateComponentBounds(components, W, H),
    ...validateDimensionIntegrity(dimensions),
  ];

  return { view: 'front', productType: 'loft', designId: 'standard', designName: 'Loft Cabinet', worldWidth: W, worldHeight: H, components, dimensions, issues, formulaStatus: 'verified' };
}

export function resolveBoxPlan(inp: BoxInputs): ResolvedDrawing {
  const { W, D, thk, verticalQty, includeBack } = inp;
  const cutlist = computeBoxCutlist(inp);
  const components: ComponentSpec[] = [];
  const backRow = cutlist.find((r) => r.id === 'BACK');
  const lhs = cutlist.find((r) => r.id === 'LHS')!;

  components.push({ id: 'plan-lhs', type: 'SIDE_PANEL', label: 'LHS', x: 0, y: 0, width: thk, height: D, qty: 1, visible: true, source: lhs.source });
  components.push({ id: 'plan-rhs', type: 'SIDE_PANEL', label: 'RHS', x: W - thk, y: 0, width: thk, height: D, qty: 1, visible: true, source: lhs.source });
  if (includeBack && backRow) {
    components.push({ id: 'plan-back', type: 'BACK_PANEL', label: 'Back (9mm)', x: 0, y: D - 9, width: W, height: 9, qty: 1, visible: true, source: backRow.source });
  }
  const compartments = verticalQty + 1;
  const compW = (W - thk * 2) / compartments;
  for (let i = 1; i <= verticalQty; i++) {
    const vx = thk + compW * i - thk / 2;
    components.push({ id: `plan-vert-${i}`, type: 'VERTICAL_PARTITION', label: 'Vertical', x: vx, y: 0, width: thk, height: D - (includeBack ? 9 : 0), qty: 1, visible: true, source: { formula: 'Vertical divider footprint', constants: [] } });
  }

  const dimReqs: DimensionRequest[] = [
    { axis: 'h', x1: 0, y1: D, x2: W, y2: D, edge: 'bottom', componentIds: [], label: `${Math.round(W)} mm`, source: { formula: 'Overall Width = W', constants: [] } },
    { axis: 'v', x1: W, y1: 0, x2: W, y2: D, edge: 'right', componentIds: [], label: `${Math.round(D)} mm`, source: { formula: 'Depth = D', constants: [] } },
  ];
  const dimensions = resolveDimensions(dimReqs);
  const issues = [...validateComponentBounds(components, W, D), ...validateDimensionIntegrity(dimensions)];

  return { view: 'plan', productType: 'loft', designId: 'standard', designName: 'Loft Cabinet', worldWidth: W, worldHeight: D, components, dimensions, issues, formulaStatus: 'verified' };
}

export function resolveBoxSide(inp: BoxInputs): ResolvedDrawing {
  const { H, D, thk, includeBack } = inp;
  const cutlist = computeBoxCutlist(inp);
  const top = cutlist.find((r) => r.id === 'TOP')!;
  const backRow = cutlist.find((r) => r.id === 'BACK');
  const components: ComponentSpec[] = [
    { id: 'side-top', type: 'TOP_PANEL', label: 'Top', x: 0, y: 0, width: D, height: thk, qty: 1, visible: true, source: top.source },
    { id: 'side-bottom', type: 'BOTTOM_PANEL', label: 'Bottom', x: 0, y: H - thk, width: D, height: thk, qty: 1, visible: true, source: top.source },
  ];
  if (includeBack && backRow) {
    components.push({ id: 'side-back', type: 'BACK_PANEL', label: 'Back (9mm)', x: D - 9, y: 0, width: 9, height: H, qty: 1, visible: true, source: backRow.source });
  }

  const dimReqs: DimensionRequest[] = [
    { axis: 'h', x1: 0, y1: H, x2: D, y2: H, edge: 'bottom', componentIds: [], label: `${Math.round(D)} mm`, source: { formula: 'Depth = D', constants: [] } },
    { axis: 'v', x1: D, y1: 0, x2: D, y2: H, edge: 'right', componentIds: [], label: `${Math.round(H)} mm`, source: { formula: 'Overall Height = H', constants: [] } },
  ];
  const dimensions = resolveDimensions(dimReqs);
  const issues = [...validateComponentBounds(components, D, H), ...validateDimensionIntegrity(dimensions)];

  return { view: 'side', productType: 'loft', designId: 'standard', designName: 'Loft Cabinet', worldWidth: D, worldHeight: H, components, dimensions, issues, formulaStatus: 'verified' };
}
