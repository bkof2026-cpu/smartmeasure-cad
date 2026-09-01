import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Study Table — matches the user's own reference sketch: a front-elevation
// box (Height x Width) with a "Top" surface line near the top edge and a
// "Tray" leader pointing down from it, Depth as the "/" diagonal leader.
// Optional Storage (Left/Right/Both) sits beside the table — Storage
// Height = Table Height, Storage Depth = Table Depth (always shared, never
// separately entered), only Storage Width is entered; its three structural
// bands (Fascia/Shutter/Skirting) are drawn but never independently
// measured, per the spec. Optional Side Panel (Left/Right/Both) is a thin
// end panel with no independent measurement — it just marks the outer edge.
// Total Width = Table Width + (Left Storage Width) + (Right Storage Width).
// ─────────────────────────────────────────────────────────────────────────────

export type StudyTableSide = 'none' | 'left' | 'right' | 'both';

export interface StudyTableInputs {
  H: number;
  W: number;
  D: number;
  storage: StudyTableSide;
  storageW: number; // shared width when Both is selected — matches the spec's "or use a common storage width"
  sidePanel: StudyTableSide;
}

export interface StudyTableCutRow {
  component: string;
  width: number;
  height: number;
  qty: number;
  remark: string;
}

const TABLE_COLOR = '#3b82f6';
const STORAGE_COLOR = '#0891b2';
const DIAG = '#cc2200';

function insideDiagonal(cornerX: number, cornerY: number, w: number, h: number) {
  const insetX = Math.min(Math.min(w * 0.35, 70) * 2, w * 0.9);
  const insetY = Math.min(Math.min(h * 0.35, 55) * 2, h * 0.9);
  return { x2: cornerX + insetX, y2: cornerY + insetY };
}

function totalWidth(inp: StudyTableInputs): number {
  const extra = (inp.storage === 'left' || inp.storage === 'right' ? inp.storageW : inp.storage === 'both' ? inp.storageW * 2 : 0);
  return inp.W + extra;
}

export function studyTableCutlist(inp: StudyTableInputs): StudyTableCutRow[] {
  const rows: StudyTableCutRow[] = [
    { component: 'Study Table', width: inp.W, height: inp.H, qty: 1, remark: `Width × Height (both entered) | Depth = ${Math.round(inp.D)}mm (entered)` },
  ];
  if (inp.storage !== 'none') {
    const sides = inp.storage === 'both' ? 2 : 1;
    rows.push({
      component: `Storage (${inp.storage === 'both' ? 'Left + Right' : inp.storage === 'left' ? 'Left' : 'Right'})`,
      width: inp.storageW, height: inp.H, qty: sides,
      remark: `Width entered | Height = Table Height (auto) | Depth = Table Depth (auto)`,
    });
  }
  if (inp.sidePanel !== 'none') {
    const sides = inp.sidePanel === 'both' ? 2 : 1;
    rows.push({ component: `Side Panel (${inp.sidePanel === 'both' ? 'Left + Right' : inp.sidePanel === 'left' ? 'Left' : 'Right'})`, width: 18, height: inp.H, qty: sides, remark: 'No independent measurement — marks the outer edge only' });
  }
  rows.push({ component: 'Total Width', width: totalWidth(inp), height: inp.H, qty: 1, remark: `Table Width${inp.storage !== 'none' ? ` + ${inp.storage === 'both' ? 'Left + Right ' : ''}Storage Width` : ''}` });
  return rows;
}

export function studyTableTitle(inp: StudyTableInputs): string {
  const parts: string[] = [];
  if (inp.storage !== 'none') parts.push(`STORAGE (${inp.storage.toUpperCase()})`);
  if (inp.sidePanel !== 'none') parts.push(`SIDE PANEL (${inp.sidePanel.toUpperCase()})`);
  return parts.length ? `STUDY TABLE — ${parts.join(' + ')}` : 'STUDY TABLE';
}

export function resolveStudyTablePlan(inp: StudyTableInputs): ResolvedDrawing {
  const { H, W, D } = inp;
  const hasLeftStorage = inp.storage === 'left' || inp.storage === 'both';
  const hasRightStorage = inp.storage === 'right' || inp.storage === 'both';
  const hasLeftPanel = inp.sidePanel === 'left' || inp.sidePanel === 'both';
  const hasRightPanel = inp.sidePanel === 'right' || inp.sidePanel === 'both';
  const panelW = 18;

  const leftExtra = (hasLeftStorage ? inp.storageW : 0) + (hasLeftPanel ? panelW : 0);
  const leaderMargin = 90 + leftExtra;
  const topPad = 90;

  const tableX = leaderMargin;
  const tableY = topPad;

  const components: ComponentSpec[] = [{
    id: 'study-table', type: 'STUDY_TABLE_FRAME', label: '', x: tableX, y: tableY, width: W, height: H, qty: 1, visible: true,
    source: { formula: `Width × Height (entered) | Depth = ${Math.round(D)}mm, shown as the / leader`, constants: [] },
  }];
  const lines: AnnotationLine[] = [];
  const dimReqs: DimensionRequest[] = [];

  // "Top" surface line near the top edge — symmetric margins on both sides
  // (was 6%-70%, biased left) so it reads as the table's own centered top
  // surface, not an off-center stripe.
  const topLineY = tableY + H * 0.08;
  lines.push({ x1: tableX + W * 0.06, y1: topLineY, x2: tableX + W * 0.94, y2: topLineY, color: '#111827', strokeWidth: 2 });
  lines.push({ x1: tableX + W * 0.4, y1: topLineY - 14, x2: tableX + W * 0.46, y2: topLineY - 3, color: '#111827', label: 'Top' });
  // Tray — dead-center horizontally (exactly W/2, equal distance from both
  // edges, was 40% from the left before) and a short drop (was 0.18*H,
  // now a fixed, modest reach so it doesn't read as an oversized gap).
  const trayX = tableX + W * 0.5;
  lines.push({ x1: trayX, y1: topLineY, x2: trayX, y2: topLineY + Math.min(60, H * 0.1), color: '#111827', strokeWidth: 1, label: 'Tray' });

  // Base — a bold line right on the table's own bottom edge, matching the
  // Top line's treatment (the box's own thin rect stroke there reads as
  // just a border, not a distinct "this is the base/floor edge" marker
  // like the reference sketch shows).
  lines.push({ x1: tableX, y1: tableY + H, x2: tableX + W, y2: tableY + H, color: '#111827', strokeWidth: 2.5 });

  // Depth — "/" diagonal leader at the table's own top-left corner.
  const diag = insideDiagonal(tableX, tableY, W, H);
  lines.push({ x1: tableX, y1: tableY, x2: diag.x2, y2: diag.y2, color: DIAG, label: `${Math.round(D)} mm (D)` });

  // Study Table's own Height (left edge) — only drawn on the table's own
  // side when there's no Left Storage/Panel competing for that space;
  // otherwise it reads off the outermost left edge instead (still the same
  // real value, since Storage Height = Table Height always).
  const heightAnchorX = leftExtra > 0 ? tableX - leftExtra : tableX;
  dimReqs.push({ axis: 'v', x1: heightAnchorX, y1: tableY, x2: heightAnchorX, y2: tableY + H, edge: 'left', componentIds: ['study-table'], label: `${Math.round(H)} mm (H)`, source: { formula: 'Height (entered)', constants: [] }, color: TABLE_COLOR });

  // Study Table's own Width, on the table's own bottom edge.
  dimReqs.push({ axis: 'h', x1: tableX, y1: tableY + H, x2: tableX + W, y2: tableY + H, edge: 'bottom', componentIds: ['study-table'], label: `${Math.round(W)} mm (W)`, source: { formula: 'Width (entered)', constants: [] }, color: TABLE_COLOR });

  function drawStorage(side: 'left' | 'right') {
    const sx = side === 'left' ? tableX - inp.storageW - (hasLeftPanel ? panelW : 0) : tableX + W + (hasRightPanel ? panelW : 0);
    const id = `storage-${side}`;
    components.push({ id, type: 'STORAGE_FRAME', label: '', x: sx, y: tableY, width: inp.storageW, height: H, qty: 1, visible: true, source: { formula: `Width entered | Height = Table Height (auto) | Depth = Table Depth (auto)`, constants: [] } });
    // Fascia / Shutter / Skirting — three structural bands, visual only,
    // matching the reference sketch's own labels and proportions.
    const fesiaH = Math.min(30, H * 0.06);
    const skirtH = Math.min(24, H * 0.05);
    const shutterH = H - fesiaH - skirtH;
    components.push({ id: `${id}-fascia`, type: 'FESIA', label: '', x: sx + 2, y: tableY + 2, width: inp.storageW - 4, height: fesiaH - 4, qty: 1, visible: true, source: { formula: 'Structural — not independently measured', constants: [] } });
    components.push({ id: `${id}-shutter`, type: 'SHUTTER', label: '', x: sx + 2, y: tableY + fesiaH, width: inp.storageW - 4, height: shutterH - 4, qty: 1, visible: true, source: { formula: 'Structural — not independently measured', constants: [] } });
    components.push({ id: `${id}-skirting`, type: 'SKIRT', label: '', x: sx + 2, y: tableY + fesiaH + shutterH, width: inp.storageW - 4, height: skirtH - 4, qty: 1, visible: true, source: { formula: 'Structural — not independently measured', constants: [] } });
    const labelX = side === 'left' ? sx - 55 : sx + inp.storageW + 55;
    lines.push({ x1: side === 'left' ? sx : sx + inp.storageW, y1: tableY + fesiaH / 2, x2: labelX, y2: tableY + fesiaH / 2, color: STORAGE_COLOR, label: 'Fesia' });
    lines.push({ x1: side === 'left' ? sx : sx + inp.storageW, y1: tableY + H * 0.5, x2: labelX, y2: tableY + H * 0.5, color: STORAGE_COLOR, label: 'Shutter' });
    lines.push({ x1: side === 'left' ? sx : sx + inp.storageW, y1: tableY + H - skirtH / 2, x2: labelX, y2: tableY + H - skirtH / 2, color: STORAGE_COLOR, label: 'Skirting' });
    lines.push({ x1: side === 'left' ? sx : sx + inp.storageW, y1: tableY + fesiaH / 2, x2: labelX, y2: tableY - 30, color: STORAGE_COLOR, label: 'Storage' });
    dimReqs.push({ axis: 'h', x1: sx, y1: tableY + H + 26, x2: sx + inp.storageW, y2: tableY + H + 26, edge: 'bottom', componentIds: [id], label: `${Math.round(inp.storageW)} mm (Storage W)`, source: { formula: 'Storage Width (entered)', constants: [] }, color: STORAGE_COLOR });
    return sx;
  }

  let leftStorageX = tableX;
  let rightStorageEndX = tableX + W;
  if (hasLeftStorage) leftStorageX = drawStorage('left');
  if (hasRightStorage) rightStorageEndX = drawStorage('right') + inp.storageW;

  function drawSidePanel(side: 'left' | 'right') {
    const px = side === 'left' ? (hasLeftStorage ? leftStorageX - panelW : tableX - panelW) : (hasRightStorage ? rightStorageEndX : tableX + W);
    lines.push({ x1: px, y1: tableY, x2: px, y2: tableY + H, color: '#7c3aed', strokeWidth: 2.5 });
    lines.push({ x1: px + panelW / 2, y1: tableY + H / 2, x2: px + (side === 'left' ? -50 : panelW + 50), y2: tableY + H / 2, color: '#7c3aed', label: `Side Panel (${side === 'left' ? 'Left' : 'Right'})` });
  }
  if (hasLeftPanel) drawSidePanel('left');
  if (hasRightPanel) drawSidePanel('right');

  // Total Width — only shown when Storage or a Side Panel actually changes
  // the overall footprint (matching the "no redundant dimension" rule used
  // throughout this engine).
  const outerLeft = hasLeftPanel ? (hasLeftStorage ? leftStorageX - panelW : tableX - panelW) : (hasLeftStorage ? leftStorageX : tableX);
  const outerRight = hasRightPanel ? rightStorageEndX + panelW : rightStorageEndX;
  if (outerLeft !== tableX || outerRight !== tableX + W) {
    dimReqs.push({ axis: 'h', x1: outerLeft, y1: tableY + H + 52, x2: outerRight, y2: tableY + H + 52, edge: 'bottom', componentIds: [], label: `${Math.round(totalWidth(inp))} mm (total width)`, source: { formula: 'Total Width = Table Width + Storage Width(s)', constants: [] } });
  }

  const worldWidth = Math.max(outerRight + 90, ...lines.map((l) => Math.max(l.x1, l.x2) + 10));
  const worldHeight = Math.max(tableY + H + 70, ...lines.map((l) => Math.max(l.y1, l.y2) + 10));

  const dimensions = resolveDimensions(dimReqs);
  const issues = [
    ...validateMeasurements({ H, W, D }, [
      { key: 'H', label: 'Height', min: 1 },
      { key: 'W', label: 'Width', min: 1 },
      { key: 'D', label: 'Depth', min: 1 },
    ]),
    ...(inp.storage !== 'none' ? validateMeasurements({ storageW: inp.storageW }, [{ key: 'storageW', label: 'Storage Width', min: 1 }]) : []),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'study-table', designId: 'simple', designName: 'Study Table',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines,
  };
}
