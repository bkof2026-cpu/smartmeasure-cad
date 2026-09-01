import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Door — a simple rectangular Door (Height × Width), with two independent
// optional components per the reference sketch:
//   • Side Panel (None/Left/Right/Both) — height always equals Door Height
//     (never independently entered); only its own width is asked (and,
//     when Both is selected, Left/Right widths independently, since the
//     spec explicitly allows them to differ).
//   • Top (Yes/No) — its own Height is entered; its Width defaults to the
//     Door's own Width (auto-populated, overridable) — deduplicated out of
//     the dimension set entirely whenever it still equals the Door Width,
//     per the spec's "do not clutter with a duplicate value" rule.
// ─────────────────────────────────────────────────────────────────────────────

export type DoorSide = 'none' | 'left' | 'right' | 'both';

export interface DoorInputs {
  H: number;
  W: number;
  sidePanel: DoorSide;
  sidePanelWLeft: number;
  sidePanelWRight: number;
  addTop: boolean;
  topH: number;
  topW: number;
}

export interface DoorCutRow {
  component: string;
  width: number;
  height: number;
  qty: number;
  remark: string;
}

const DOOR_COLOR = '#3b82f6';
const PANEL_COLOR = '#0891b2';
const TOP_COLOR = '#7c3aed';

export function doorCutlist(inp: DoorInputs): DoorCutRow[] {
  const rows: DoorCutRow[] = [
    { component: 'Door', width: inp.W, height: inp.H, qty: 1, remark: 'Width × Height (both entered)' },
  ];
  const hasLeft = inp.sidePanel === 'left' || inp.sidePanel === 'both';
  const hasRight = inp.sidePanel === 'right' || inp.sidePanel === 'both';
  if (hasLeft) rows.push({ component: 'Side Panel (Left)', width: inp.sidePanelWLeft, height: inp.H, qty: 1, remark: 'Width entered | Height = Door Height (auto)' });
  if (hasRight) rows.push({ component: 'Side Panel (Right)', width: inp.sidePanelWRight, height: inp.H, qty: 1, remark: 'Width entered | Height = Door Height (auto)' });
  if (inp.addTop) {
    const w = inp.topW || inp.W;
    rows.push({ component: 'Top', width: w, height: inp.topH, qty: 1, remark: `Height entered | Width ${w === inp.W ? '= Door Width (auto)' : '(entered, overridden)'}` });
  }
  return rows;
}

export function doorTitle(inp: DoorInputs): string {
  const parts: string[] = [];
  if (inp.sidePanel !== 'none') parts.push(`SIDE PANEL (${inp.sidePanel.toUpperCase()})`);
  if (inp.addTop) parts.push('TOP');
  return parts.length ? `DOOR — ${parts.join(' + ')}` : 'DOOR';
}

export function resolveDoorPlan(inp: DoorInputs): ResolvedDrawing {
  const { H, W } = inp;
  const hasLeft = inp.sidePanel === 'left' || inp.sidePanel === 'both';
  const hasRight = inp.sidePanel === 'right' || inp.sidePanel === 'both';
  // Top Width auto-populates from Door Width by default — the caller
  // (DoorDrawing / measurement form) is expected to seed dims.topW = W
  // when Top is first enabled; this resolver just treats 0/unset as
  // "inherit", so a stale 0 can never render a zero-width Top.
  const topW = inp.addTop && inp.topW > 0 ? inp.topW : W;
  const topWIsDoorW = Math.round(topW) === Math.round(W);

  const leftW = hasLeft ? inp.sidePanelWLeft : 0;
  const leaderMargin = 90 + leftW + (hasLeft ? 20 : 0);
  // Top sits ABOVE the door (see topY below) — topPad must reserve real
  // room for the Top's own entered Height plus its leader/dimension space,
  // not a fixed 90 regardless of size. A fixed pad meant a tall Top's own
  // box, and everything anchored to it, rendered at a NEGATIVE world Y
  // (off the top of the drawing's own coordinate space) whenever
  // topH > ~60 — this scales the reserved pad with the real entered value.
  const topPad = inp.addTop ? inp.topH + 90 : 60;

  const doorX = leaderMargin;
  const doorY = topPad;

  const components: ComponentSpec[] = [{
    id: 'door', type: 'DOOR', label: 'Door', x: doorX, y: doorY, width: W, height: H, qty: 1, visible: true,
    source: { formula: 'Width × Height (both entered)', constants: [] },
  }];
  const lines: AnnotationLine[] = [];
  const dimReqs: DimensionRequest[] = [];

  // Door's own Height — reads off the OUTERMOST left edge when a Left Side
  // Panel exists (real leaderMargin already reserves room for it), not the
  // door's own inner edge, which would otherwise sit exactly where the
  // panel's own centered label is drawn and cut straight through the text.
  const heightAnchorX = hasLeft ? doorX - inp.sidePanelWLeft : doorX;
  dimReqs.push({ axis: 'v', x1: heightAnchorX, y1: doorY, x2: heightAnchorX, y2: doorY + H, edge: 'left', componentIds: ['door'], label: `${Math.round(H)} mm (Door H)`, source: { formula: 'Height (entered)', constants: [] }, color: DOOR_COLOR });
  dimReqs.push({ axis: 'h', x1: doorX, y1: doorY + H, x2: doorX + W, y2: doorY + H, edge: 'bottom', componentIds: ['door'], label: `${Math.round(W)} mm (Door W)`, source: { formula: 'Width (entered)', constants: [] }, color: DOOR_COLOR });

  let leftPanelX = doorX;
  let rightPanelEndX = doorX + W;

  if (hasLeft) {
    leftPanelX = doorX - inp.sidePanelWLeft;
    components.push({ id: 'side-panel-left', type: 'SIDE_PANEL', label: 'Left Side Panel', x: leftPanelX, y: doorY, width: inp.sidePanelWLeft, height: H, qty: 1, visible: true, source: { formula: 'Width entered | Height = Door Height (auto — always equal, never independently entered)', constants: [] } });
    dimReqs.push({ axis: 'h', x1: leftPanelX, y1: doorY + H + 26, x2: doorX, y2: doorY + H + 26, edge: 'bottom', componentIds: ['side-panel-left'], label: `${Math.round(inp.sidePanelWLeft)} mm (Side Panel W)`, source: { formula: 'Side Panel Width (entered)', constants: [] }, color: PANEL_COLOR });
  }
  if (hasRight) {
    rightPanelEndX = doorX + W + inp.sidePanelWRight;
    components.push({ id: 'side-panel-right', type: 'SIDE_PANEL', label: 'Right Side Panel', x: doorX + W, y: doorY, width: inp.sidePanelWRight, height: H, qty: 1, visible: true, source: { formula: 'Width entered | Height = Door Height (auto — always equal, never independently entered)', constants: [] } });
    dimReqs.push({ axis: 'h', x1: doorX + W, y1: doorY + H + 26, x2: rightPanelEndX, y2: doorY + H + 26, edge: 'bottom', componentIds: ['side-panel-right'], label: `${Math.round(inp.sidePanelWRight)} mm (Side Panel W)`, source: { formula: 'Side Panel Width (entered)', constants: [] }, color: PANEL_COLOR });
  }

  if (inp.addTop) {
    const topX = doorX + (W - topW) / 2;
    const topY = doorY - inp.topH - 30;
    components.push({ id: 'top', type: 'TOP', label: 'Top', x: topX, y: topY, width: topW, height: inp.topH, qty: 1, visible: true, source: { formula: `Height entered | Width ${topWIsDoorW ? '= Door Width (auto)' : '(entered, overridden)'}`, constants: [] } });
    dimReqs.push({ axis: 'v', x1: topX - 24, y1: topY, x2: topX - 24, y2: topY + inp.topH, edge: 'left', componentIds: ['top'], label: `${Math.round(inp.topH)} mm (Top H)`, source: { formula: 'Top Height (entered)', constants: [] }, color: TOP_COLOR });
    // Automatic dimension deduplication (spec §12): only show Top Width as
    // its own dimension when it actually differs from Door Width — when it
    // still equals Door Width (the default), a small leader just notes
    // "Top W = Door W" instead of drawing a second, redundant width line
    // stacked directly above the one the door itself already shows.
    if (!topWIsDoorW) {
      dimReqs.push({ axis: 'h', x1: topX, y1: topY, x2: topX + topW, y2: topY, edge: 'top', componentIds: ['top'], label: `${Math.round(topW)} mm (Top W)`, source: { formula: 'Top Width (entered, overridden)', constants: [] }, color: TOP_COLOR });
    } else {
      // Clear of the Top component's own centered "Top" label — reaches up
      // and to the right, well outside the box itself, rather than a short
      // stub landing just above the top edge (which cramped into the same
      // narrow strip as the component label on a short/narrow Top).
      lines.push({ x1: topX + topW * 0.75, y1: topY, x2: topX + topW + 60, y2: topY - 34, color: TOP_COLOR, label: 'Top W = Door W', arrowAtStart: true });
    }
  }

  const outerLeft = hasLeft ? leftPanelX : doorX;
  const outerRight = hasRight ? rightPanelEndX : doorX + W;
  const worldWidth = Math.max(outerRight + 60, doorX + W + 60, ...lines.map((l) => Math.max(l.x1, l.x2) + 20));
  const worldHeight = Math.max(doorY + H + (hasLeft || hasRight ? 90 : 50), ...lines.map((l) => Math.max(l.y1, l.y2) + 20));

  const dimensions = resolveDimensions(dimReqs);
  const issues = [
    ...validateMeasurements({ H, W }, [
      { key: 'H', label: 'Door Height', min: 1 },
      { key: 'W', label: 'Door Width', min: 1 },
    ]),
    ...(hasLeft ? validateMeasurements({ sidePanelWLeft: inp.sidePanelWLeft }, [{ key: 'sidePanelWLeft', label: 'Side Panel Width (Left)', min: 1 }]) : []),
    ...(hasRight ? validateMeasurements({ sidePanelWRight: inp.sidePanelWRight }, [{ key: 'sidePanelWRight', label: 'Side Panel Width (Right)', min: 1 }]) : []),
    ...(inp.addTop ? validateMeasurements({ topH: inp.topH }, [{ key: 'topH', label: 'Top Height', min: 1 }]) : []),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'door', designId: 'simple', designName: 'Door',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines,
  };
}
