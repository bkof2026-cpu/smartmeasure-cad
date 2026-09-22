import type { AnnotationLine, ComponentSpec, DimensionLine, NoteBox, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity } from '../../engine/validationEngine';
import {
  resolveSimpleBedPlan, simpleBedCutlist, BED_COMPONENT_COLORS,
  type SimpleBedInputs, type SimpleSideTableInput, type SimpleBedCutRow,
} from './simpleBedGeometry';

// ─────────────────────────────────────────────────────────────────────────────
// Children Bed — ALWAYS exactly 2 beds (Bed A left, Bed B right), optionally
// flanked by LST (outside Bed A) / RST (outside Bed B), with an optional
// Center Table between them. Per the user's explicit instruction this reuses
// the existing Bed engine (resolveSimpleBedPlan) and existing Side Table
// shape (SimpleSideTableInput) UNMODIFIED — Bed A and Bed B are each a real,
// independent resolveSimpleBedPlan() call; this file only composes their
// already-resolved output side by side and adds the new Center Table.
// ─────────────────────────────────────────────────────────────────────────────

const DISABLED_ST: SimpleSideTableInput = { enabled: false, depthMm: 460, widthMm: 560, drawerCount: 0 };
const GAP_MM = 200; // real visual gap between Bed A/Center Table/Bed B — same role as HEADBOARD_GAP in simpleBedGeometry.ts

export interface CenterTableInput {
  enabled: boolean;
  H: number;
  W: number;
  D: number;
}

export interface ChildrenBedInputs {
  bedA: SimpleBedInputs;
  bedB: SimpleBedInputs;
  centerTable: CenterTableInput;
  lst: SimpleSideTableInput; // outside Bed A's own left edge
  rst: SimpleSideTableInput; // outside Bed B's own right edge
}

/** Shifts every absolute-coordinate field of an already-resolved drawing by dx (mm). Pure — returns new arrays/objects, never mutates the input. */
function translateDrawing(drawing: ResolvedDrawing, dx: number): { components: ComponentSpec[]; dimensions: DimensionLine[]; lines: AnnotationLine[]; noteBoxes: NoteBox[] } {
  const components = drawing.components.map((c) => ({ ...c, x: c.x + dx }));
  const dimensions = drawing.dimensions.map((d) => ({ ...d, x1: d.x1 + dx, x2: d.x2 + dx }));
  const lines = (drawing.lines ?? []).map((l) => ({ ...l, x1: l.x1 + dx, x2: l.x2 + dx }));
  const noteBoxes = (drawing.noteBoxes ?? []).map((n) => ({
    ...n, x: n.x + dx,
    anchor: n.anchor ? { x: n.anchor.x + dx, y: n.anchor.y } : undefined,
  }));
  return { components, dimensions, lines, noteBoxes };
}

/** Prefixes every id (component ids + each dimension's componentIds) so Bed A's and Bed B's internally-identical ids ('bed-body', 'lst', 'rst', ...) never collide once merged. */
function prefixIds(parts: { components: ComponentSpec[]; dimensions: DimensionLine[] }, prefix: string): { components: ComponentSpec[]; dimensions: DimensionLine[] } {
  return {
    components: parts.components.map((c) => ({ ...c, id: `${prefix}-${c.id}` })),
    dimensions: parts.dimensions.map((d) => ({ ...d, id: `${prefix}-${d.id}` })),
  };
}

function bedColor(prefixedId: string): string {
  const original = prefixedId.replace(/^bed[ab]-/, '');
  return BED_COMPONENT_COLORS[original] ?? '#333';
}

export const CENTER_TABLE_COLOR = '#c2410c';

export function childrenBedCutlist(inp: ChildrenBedInputs): SimpleBedCutRow[] {
  const bedAInputs: SimpleBedInputs = { ...inp.bedA, lst: inp.lst, rst: DISABLED_ST };
  const bedBInputs: SimpleBedInputs = { ...inp.bedB, lst: DISABLED_ST, rst: inp.rst };
  const rows: SimpleBedCutRow[] = [
    ...simpleBedCutlist(bedAInputs).map((r) => ({ ...r, component: `Bed A — ${r.component}` })),
    ...simpleBedCutlist(bedBInputs).map((r) => ({ ...r, component: `Bed B — ${r.component}` })),
  ];
  if (inp.centerTable.enabled) {
    rows.push({
      component: 'Center Table (CT)', width: inp.centerTable.W, height: inp.centerTable.D, qty: 1,
      remark: `Width × Depth entered; Height = ${Math.round(inp.centerTable.H)}mm (entered)`,
    });
  }
  return rows;
}

export function resolveChildrenBedPlan(inp: ChildrenBedInputs): ResolvedDrawing {
  const bedAInputs: SimpleBedInputs = { ...inp.bedA, lst: inp.lst, rst: DISABLED_ST };
  const bedBInputs: SimpleBedInputs = { ...inp.bedB, lst: DISABLED_ST, rst: inp.rst };

  const bedADrawing = resolveSimpleBedPlan(bedAInputs);
  const bedBDrawing = resolveSimpleBedPlan(bedBInputs);

  const bedAParts = prefixIds({ components: bedADrawing.components, dimensions: bedADrawing.dimensions }, 'bedA');
  const bedALines = bedADrawing.lines ?? [];
  const bedANoteBoxes = bedADrawing.noteBoxes ?? [];

  const ct = inp.centerTable;
  // Center Table sits FLUSH against both Bed A and Bed B — no gap on either
  // side, per the user's explicit correction. Only when there's no Center
  // Table does Bed A/Bed B keep the normal visual GAP_MM between them.
  //
  // resolveSimpleBedPlan's own bed-body never starts at x=0 — it reserves
  // its own left leader margin (bedX = leftW + leaderMargin + ...) inside
  // its own drawing. Translating by worldWidth alone would carry that
  // internal margin through as an unwanted extra gap on Bed B's side, so
  // the offset is corrected by Bed B's own bed-body.x to make its REAL
  // left edge (not its abstract drawing origin) the thing that lands flush.
  const centerTableWidth = ct.enabled ? ct.W : 0;
  const centerTableGap = ct.enabled ? centerTableWidth : GAP_MM;
  const bedBOwnBodyX = bedBDrawing.components.find((c) => c.id === 'bed-body')?.x ?? 0;
  const bedBOffset = bedADrawing.worldWidth + centerTableGap - bedBOwnBodyX;

  const bedBTranslated = translateDrawing(bedBDrawing, bedBOffset);
  const bedBParts = prefixIds(bedBTranslated, 'bedB');

  const components: ComponentSpec[] = [...bedAParts.components, ...bedBParts.components];
  let dimensions: DimensionLine[] = [...bedAParts.dimensions, ...bedBParts.dimensions];
  let lines: AnnotationLine[] = [...bedALines, ...bedBTranslated.lines];
  const noteBoxes: NoteBox[] = [...bedANoteBoxes, ...bedBTranslated.noteBoxes];

  // Bed A / Bed B name labels, plain text above each bed's own body — reuse
  // the existing in-box label rendering by attaching a NoteBox-free plain
  // AnnotationLine label instead, since a full extra ComponentSpec box would
  // draw an unwanted outline. Positioned above the tallest thing in each
  // bed's own drawing (its headboard if present, else the bed itself).
  const bedATopY = Math.min(...bedADrawing.components.map((c) => c.y));
  lines.push({ x1: 0, y1: Math.max(0, bedATopY - 24), x2: 0, y2: Math.max(0, bedATopY - 24), color: '#1e3a8a', label: 'BED A' });
  const bedBTopY = Math.min(...bedBDrawing.components.map((c) => c.y));
  lines.push({ x1: bedBOffset, y1: Math.max(0, bedBTopY - 24), x2: bedBOffset, y2: Math.max(0, bedBTopY - 24), color: '#1e3a8a', label: 'BED B' });

  let ctIssues: ReturnType<typeof validateComponentBounds> = [];
  if (ct.enabled) {
    const ctX = bedADrawing.worldWidth; // flush against Bed A's own right edge — no gap
    // Sits at the TOP, flush with both beds' own top (mattress) edge — per
    // the user's own reference sketch, never vertically centred mid-height.
    // Bed A/Bed B's own bed-body.y is already identical to each other
    // (both use the same headboardEnabled/headboardH-driven bedY formula
    // when configured the same way), but read from Bed A's own value as
    // the single source of truth for "the top of the beds" in case they
    // ever differ (e.g. one has a headboard and the other doesn't).
    const bedABodyY = bedADrawing.components.find((c) => c.id === 'bed-body')?.y ?? 0;
    const ctY = bedABodyY;

    const ctComponent: ComponentSpec = {
      id: 'center-table', type: 'CENTER_TABLE', label: `Center Table (CT)`,
      x: ctX, y: ctY, width: ct.W, height: ct.D, qty: 1, visible: true,
      source: { formula: 'Width × Depth entered; Height entered (own real measurements, independent of Bed A/Bed B)', constants: [] },
    };
    components.push(ctComponent);

    const ctDimReqs: DimensionRequest[] = [
      { axis: 'h', x1: ctX, y1: ctY + ct.D + 8, x2: ctX + ct.W, y2: ctY + ct.D + 8, edge: 'bottom', componentIds: ['center-table'], label: `${Math.round(ct.W)} mm (W)`, source: { formula: 'Center Table Width (entered)', constants: [] }, color: CENTER_TABLE_COLOR },
      { axis: 'v', x1: ctX - 8, y1: ctY, x2: ctX - 8, y2: ctY + ct.H, edge: 'left', componentIds: ['center-table'], label: `${Math.round(ct.H)} mm (H)`, source: { formula: 'Center Table Height (entered)', constants: [] }, color: CENTER_TABLE_COLOR },
    ];
    dimensions = [...dimensions, ...resolveDimensions(ctDimReqs)];

    // Depth as the same inside-diagonal leader convention LST/RST use.
    const insetX = Math.min(ct.W * 0.35, 70) * 2;
    const insetY = Math.min(ct.D * 0.35, 55) * 2;
    lines = [...lines, { x1: ctX, y1: ctY + ct.D, x2: ctX + Math.min(insetX, ct.W * 0.9), y2: ctY + ct.D - Math.min(insetY, ct.D * 0.9), color: CENTER_TABLE_COLOR, label: `${Math.round(ct.D)} mm (D)` }];
    lines.push({ x1: ctX, y1: Math.max(0, ctY - 24), x2: ctX, y2: Math.max(0, ctY - 24), color: CENTER_TABLE_COLOR, label: 'CENTER TABLE (CT)' });

    ctIssues = validateComponentBounds([ctComponent], Infinity, Infinity);
  }

  const worldWidth = Math.max(
    bedADrawing.worldWidth,
    bedBOffset + bedBDrawing.worldWidth,
    ...(ct.enabled ? [bedADrawing.worldWidth + ct.W] : []),
    ...lines.map((l) => Math.max(l.x1, l.x2) + 10),
  );
  const worldHeight = Math.max(
    bedADrawing.worldHeight,
    bedBDrawing.worldHeight,
    ...(ct.enabled ? [(inp.centerTable.D)] : []),
    ...lines.map((l) => Math.max(l.y1, l.y2) + 10),
  );

  const issues = [
    ...bedADrawing.issues.map((i) => ({ ...i, id: `bedA-${i.id}` })),
    ...bedBDrawing.issues.map((i) => ({ ...i, id: `bedB-${i.id}` })),
    ...ctIssues,
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'bed', designId: 'children-bed', designName: 'Children Bed',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines, noteBoxes,
  };
}

export { bedColor as childrenBedComponentColor };

const n = (v: number | string | undefined) => Number(v ?? 0);
const bool1 = (v: number | string | undefined, def: number) => Number(v ?? def) === 1;

/** Single source of truth for parsing the registry's flat `dims` record into ChildrenBedInputs — shared by ChildrenBedDrawing.tsx (on-screen) and ProductFlow.tsx (PDF cutlist), so the two paths can never drift apart. */
/** Bed A / Bed B only — parsed from the plain, always-expanded measurementFields (never behind a "+", since both beds are mandatory). */
export function childrenBedsFromDims(dims: Record<string, number | string>): { bedA: SimpleBedInputs; bedB: SimpleBedInputs } {
  const bedA: SimpleBedInputs = {
    W: n(dims.bedA_W), L: n(dims.bedA_L), H: n(dims.bedA_H),
    headboardEnabled: bool1(dims.bedA_hasHeadboard, 1),
    headboardH: n(dims.bedA_headboardH) || 900,
    lst: DISABLED_ST, rst: DISABLED_ST,
    profileShutter: { enabled: false, side: 'left', heightMm: 150, light: false },
  };
  const bedB: SimpleBedInputs = {
    W: n(dims.bedB_W), L: n(dims.bedB_L), H: n(dims.bedB_H),
    headboardEnabled: bool1(dims.bedB_hasHeadboard, 1),
    headboardH: n(dims.bedB_headboardH) || 900,
    lst: DISABLED_ST, rst: DISABLED_ST,
    profileShutter: { enabled: false, side: 'left', heightMm: 150, light: false },
  };
  return { bedA, bedB };
}

export const CHILDREN_BED_CENTER_TABLE_DISABLED: CenterTableInput = { enabled: false, H: 500, W: 500, D: 450 };
export const CHILDREN_BED_ST_DISABLED: SimpleSideTableInput = DISABLED_ST;

/** Full ChildrenBedInputs — Bed A/Bed B from `dims` (plain fields), Center Table/LST/RST from the addon cards' own state (PRODUCT_ADDONS['bed']: children-bed-center-table/lst/rst) since those are optional "+" extras, not plain fields. */
export function childrenBedInputsFromDims(
  dims: Record<string, number | string>,
  centerTable: CenterTableInput = CHILDREN_BED_CENTER_TABLE_DISABLED,
  lst: SimpleSideTableInput = CHILDREN_BED_ST_DISABLED,
  rst: SimpleSideTableInput = CHILDREN_BED_ST_DISABLED,
): ChildrenBedInputs {
  const { bedA, bedB } = childrenBedsFromDims(dims);
  return { bedA, bedB, lst, rst, centerTable };
}
