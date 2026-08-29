import type { ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';
import { computeSideTableCutlist, type SideTableInputs } from './sideTableFormulas';

/**
 * Front-elevation geometry for one side table, positioned with its top-left
 * corner at (originX, originY) in world mm — so a Bed can place two of these
 * beside the headboard without duplicating any layout logic.
 */
export function resolveSideTableFront(inp: SideTableInputs, originX = 0, originY = 0, idPrefix = 'st'): ResolvedDrawing {
  const { W, H, drawers, includeSkirting } = inp;
  const cutlist = computeSideTableCutlist(inp);
  const components: ComponentSpec[] = [];
  const dimReqs: DimensionRequest[] = [];

  const topRow = cutlist.find((r) => r.id === 'TOP')!;
  const topThk = 18; // board thickness — visual installed thickness of the top board
  components.push({
    id: `${idPrefix}-top`, type: 'TOP', label: 'Top', x: originX, y: originY, width: W, height: topThk, qty: 1, visible: true,
    source: topRow.source,
  });

  const skirtRow = cutlist.find((r) => r.id === 'SKIRTING');
  const skirtH = skirtRow ? skirtRow.cutWidth : 0; // fixed cut width = installed skirt band height
  if (skirtRow) {
    components.push({ id: `${idPrefix}-skirt`, type: 'SKIRTING', label: 'Skirting', x: originX, y: originY + H - skirtH, width: W, height: skirtH, qty: 4, visible: true, source: skirtRow.source });
  }

  const bodyTop = originY + topThk;
  const bodyBottom = originY + H - skirtH;
  const bodyH = Math.max(0, bodyBottom - bodyTop);
  const drawerCount = includeSkirting ? drawers : drawers; // skirting doesn't affect drawer count
  if (drawerCount > 0) {
    const faciaRow = cutlist.find((r) => r.id === 'DRAWER_FACIA')!;
    const rowH = bodyH / drawerCount;
    for (let i = 0; i < drawerCount; i++) {
      components.push({
        id: `${idPrefix}-drawer-${i}`, type: 'DRAWER_FRONT', label: `Drawer ${i + 1}`,
        x: originX + 4, y: bodyTop + i * rowH + 3, width: W - 8, height: rowH - 6, qty: 1, visible: true,
        source: { ...faciaRow.source, note: `Real facia cut size: ${Math.round(faciaRow.cutWidth)}x${Math.round(faciaRow.cutHeight)}mm per drawer.` },
      });
    }
  } else {
    components.push({ id: `${idPrefix}-body`, type: 'CABINET_BODY', label: 'Cabinet Body', x: originX + 2, y: bodyTop + 2, width: W - 4, height: bodyH - 4, qty: 1, visible: true, source: { formula: 'Carcass body (LHS/RHS/BOTTOM assembly)', constants: [] } });
  }

  dimReqs.push({ axis: 'h', x1: originX, y1: originY, x2: originX + W, y2: originY, edge: 'bottom', componentIds: components.map((c) => c.id), source: { formula: 'Overall Width = W', constants: [] } });
  dimReqs.push({ axis: 'v', x1: originX + W, y1: originY, x2: originX + W, y2: originY + H, edge: 'right', componentIds: components.map((c) => c.id), source: { formula: 'Overall Height = H', constants: [] } });

  const dimensions = resolveDimensions(dimReqs);
  const issues = [
    ...validateMeasurements({ W: inp.W, D: inp.D, H: inp.H }, [
      { key: 'W', label: 'Side Table Width' }, { key: 'D', label: 'Side Table Depth' }, { key: 'H', label: 'Side Table Height' },
    ]),
    ...validateComponentBounds(components, originX + W, originY + H),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'front', productType: 'side-table', designId: 'standard', designName: 'Side Table',
    worldWidth: originX + W, worldHeight: originY + H, components, dimensions, issues, formulaStatus: 'verified',
  };
}
