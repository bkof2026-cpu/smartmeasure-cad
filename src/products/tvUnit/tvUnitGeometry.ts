import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';

// ─────────────────────────────────────────────────────────────────────────────
// TV Unit — matches the user's own reference sketch exactly. The geometry
// relationship (per the user's own correction) is:
//
//   [ Black Tinted Box ] + [ TV Unit Box ]  =  the complete upper unit
//
// TV Unit Box (H x W x D, all entered) is the main reference area — W here
// is ONLY the TV Unit Box's own width, not a combined/overall width.
// Black Tinted Box is compulsory, attached directly (flush, no gap) to the
// chosen side (Left/Right) of the TV Unit Box. Its own Width is NOT
// entered — it's a fixed proportion of the TV Unit Box's own Width, and
// never shown as a separate dimension on the drawing (no arrow/label for
// it), so it never reads as an independent/extra measurement. Its Height
// is ALWAYS forced equal to TV Unit Box Height, and its top/bottom edges
// always align exactly with the TV Unit Box's own top/bottom edges.
//
// The TV (compulsory) sits centered inside the TV Unit Box specifically
// (not the combined width). The right-side vertical division-line strip
// runs from the TV Unit Box's own top edge down to the lower cabinet.
//
// Profile Shutter (compulsory) is part of the lower cabinet row, which
// spans the FULL COMBINED width — Black Tinted Box Width + TV Unit Box
// Width — directly below both boxes, with no gap. Its width is always
// derived, never entered separately.
//
// Two independent, OPTIONAL extra-measurement attachments, each with its
// own Height x Width x Depth and a Left/Right side:
//   - Mandir — drawn as the blue box from the reference, with its own
//     internal shelf/drawer lines.
//   - Partition — a vertical louvre/slat box.
// Each attaches to the OUTSIDE of the combined upper unit's chosen side,
// without overlapping it. Mandir and Partition may not both be set to the
// same side (the reference shows them on opposite ends) — the caller/UI
// is expected to enforce this; resolvePlan defends against it by forcing
// Partition to the opposite side if both match.
// ─────────────────────────────────────────────────────────────────────────────

export type TvUnitSide = 'left' | 'right';

/** Black Tinted Box Width is never entered — it's this fixed fraction of
 * the TV Unit Box's own Width, matching the reference's own proportions
 * (a visibly narrower box, not close to half the TV Unit Box's size). */
const BLACK_BOX_WIDTH_RATIO = 0.09;

export interface TvUnitInputs {
  H: number;
  W: number;
  D: number;
  blackBoxSide: TvUnitSide;

  hasMandir: boolean;
  mandirSide: TvUnitSide;
  mandirH: number;
  mandirW: number;
  mandirD: number;

  hasPartition: boolean;
  partitionSide: TvUnitSide;
  partitionH: number;
  partitionW: number;
  partitionD: number;
}

export interface TvUnitCutRow {
  component: string;
  width: number;
  height: number;
  qty: number;
  remark: string;
}

const UNIT_COLOR = '#111827';
const MANDIR_COLOR = '#0891b2';
const PARTITION_COLOR = '#7c2d12';
const DIAG = '#cc2200';

function insideDiagonal(cornerX: number, cornerY: number, w: number, h: number) {
  const insetX = Math.min(Math.min(w * 0.35, 70) * 2, w * 0.9);
  const insetY = Math.min(Math.min(h * 0.35, 55) * 2, h * 0.9);
  return { x2: cornerX + insetX, y2: cornerY + insetY };
}

export function tvUnitCutlist(inp: TvUnitInputs): TvUnitCutRow[] {
  const blackBoxW = inp.W * BLACK_BOX_WIDTH_RATIO;
  const combinedW = inp.W + blackBoxW;
  const rows: TvUnitCutRow[] = [
    { component: 'TV Unit Box', width: inp.W, height: inp.H, qty: 1, remark: `Height × Width (both entered) | Depth = ${Math.round(inp.D)}mm (entered)` },
    { component: `Black Tinted Box (${inp.blackBoxSide === 'left' ? 'Left' : 'Right'})`, width: blackBoxW, height: inp.H, qty: 1, remark: 'Width = fixed proportion of TV Unit Box Width (auto) | Height = TV Unit Box Height (auto, always equal) — compulsory, not an extra measurement' },
    { component: 'Profile Shutter', width: combinedW * (1 / 6), height: inp.H * 0.22, qty: 1, remark: `Lower cabinet section width = TV Unit Box Width + Black Tinted Box Width = ${Math.round(combinedW)}mm (auto)` },
  ];
  if (inp.hasMandir) {
    rows.push({ component: `Mandir (${inp.mandirSide === 'left' ? 'Left' : 'Right'})`, width: inp.mandirW, height: inp.mandirH, qty: 1, remark: `Height × Width × Depth (${Math.round(inp.mandirD)}mm) all entered — extra measurement, independent of TV Unit` });
  }
  if (inp.hasPartition) {
    rows.push({ component: `Partition (${inp.partitionSide === 'left' ? 'Left' : 'Right'})`, width: inp.partitionW, height: inp.partitionH, qty: 1, remark: `Height × Width × Depth (${Math.round(inp.partitionD)}mm) all entered — extra measurement, independent of TV Unit` });
  }
  return rows;
}

export function tvUnitTitle(inp: TvUnitInputs): string {
  const extras: string[] = [];
  if (inp.hasMandir) extras.push('MANDIR');
  if (inp.hasPartition) extras.push('PARTITION');
  return extras.length ? `T.V. UNIT — WITH EXTRA MEASUREMENT: ${extras.join(' & ')}` : 'T.V. UNIT';
}

export function resolveTvUnitPlan(inp: TvUnitInputs): ResolvedDrawing {
  const { H, W, D } = inp;

  // Mandir and Partition can't both sit on the same side (reference shows
  // them on opposite ends) — force Partition to the opposite side rather
  // than let them overlap.
  const partitionSide: TvUnitSide = inp.hasMandir && inp.hasPartition && inp.partitionSide === inp.mandirSide
    ? (inp.mandirSide === 'left' ? 'right' : 'left')
    : inp.partitionSide;

  const hasLeftMandir = inp.hasMandir && inp.mandirSide === 'left';
  const hasRightMandir = inp.hasMandir && inp.mandirSide === 'right';
  const hasLeftPartition = inp.hasPartition && partitionSide === 'left';
  const hasRightPartition = inp.hasPartition && partitionSide === 'right';

  // combinedX0 is the outer-left edge of the WHOLE upper unit (Black
  // Tinted Box + TV Unit Box together) — whichever box is leftmost starts
  // here, flush, no gap between them.
  const blackBoxW = W * BLACK_BOX_WIDTH_RATIO;
  const combinedW = W + blackBoxW;
  const leftExtra = (hasLeftMandir ? inp.mandirW : 0) + (hasLeftPartition ? inp.partitionW : 0);
  const leaderMargin = 90 + leftExtra;
  const topPad = 90;

  const combinedX0 = leaderMargin;
  const unitY = topPad; // shared top edge for TV Unit Box AND Black Tinted Box (per spec: same top/bottom levels)

  const components: ComponentSpec[] = [];
  const lines: AnnotationLine[] = [];
  const dimReqs: DimensionRequest[] = [];

  // Black Tinted Box and TV Unit Box sit flush, side by side, sharing the
  // SAME top edge (unitY) and SAME bottom edge (unitY + H) — Black Tinted
  // Box Height is ALWAYS forced equal to TV Unit Box Height, never
  // independently sized.
  const blackBoxX = inp.blackBoxSide === 'left' ? combinedX0 : combinedX0 + W;
  const unitX = inp.blackBoxSide === 'left' ? combinedX0 + blackBoxW : combinedX0;

  // ── TV Unit Box — the main reference area ───────────────────────────────
  components.push({
    id: 'tv-unit', type: 'TV_UNIT_FRAME', label: '', x: unitX, y: unitY, width: W, height: H, qty: 1, visible: true,
    source: { formula: `TV Unit Box Height × Width (entered) | Depth = ${Math.round(D)}mm, shown as the / leader`, constants: [] },
  });

  // ── Black Tinted Box — flush against the TV Unit Box, own Width a
  // fixed proportion of TV Unit Box Width (never entered, never shown as
  // its own dimension — not an extra measurement), Height forced equal to
  // TV Unit Box Height, top/bottom edges forced equal to the TV Unit
  // Box's own top/bottom edges. Outline only, no fill, per the user.
  components.push({
    id: 'black-tinted-box', type: 'BLACK_TINTED_BOX', label: 'Black Tinted Box', x: blackBoxX, y: unitY, width: blackBoxW, height: H, qty: 1, visible: true,
    source: { formula: `Black Tinted Box Width = ${Math.round(BLACK_BOX_WIDTH_RATIO * 100)}% of TV Unit Box Width (auto, not entered) | Height = TV Unit Box Height (auto, always equal) | Side = ${inp.blackBoxSide === 'left' ? 'Left' : 'Right'} (entered)`, constants: [] },
  });

  // Lower cabinet row — spans the FULL COMBINED width (Black Tinted Box +
  // TV Unit Box), directly below both, no gap, per the spec's own
  // "Profile Shutter Width = TV Unit Box Width + Black Tinted Box Width"
  // rule — the whole lower row (not just Profile Shutter) shares that
  // combined span, since it's one continuous cabinet band in the reference.
  const rowH = H * 0.24;
  const rowY = unitY + H - rowH;
  const bodyH = H - rowH; // TV Unit Box's own upper-field height, where the TV / division strip live

  // TV — centered rectangle inside the TV Unit Box specifically (not the
  // combined width).
  const tvW = Math.min(W * 0.42, 360);
  const tvH = Math.min(bodyH * 0.38, 220);
  const tvX = unitX + (W - tvW) / 2;
  const tvY = unitY + (bodyH - tvH) / 2;
  components.push({
    id: 'tv-box', type: 'TV_BOX', label: 'T.V.', x: tvX, y: tvY, width: tvW, height: tvH, qty: 1, visible: true,
    source: { formula: 'Decorative — centered in the TV Unit Box, not independently measured', constants: [] },
  });

  // Narrow vertical division strip beside the TV (opposite side from the
  // Black Tinted Box, near the TV Unit Box's own outer edge), running from
  // the TV Unit Box's own top edge down to the lower cabinet boundary —
  // matching the reference's own cluster of thin lines.
  const stripCount = 7;
  const stripX0 = inp.blackBoxSide === 'left' ? unitX + W - W * 0.16 : unitX + W * 0.02;
  const stripW = W * 0.14;
  for (let i = 0; i < stripCount; i++) {
    const sx = stripX0 + (stripW / (stripCount - 1)) * i;
    lines.push({ x1: sx, y1: unitY + 3, x2: sx, y2: rowY - 3, color: '#4b5563', strokeWidth: 0.8 });
  }

  // Lower cabinet row — split into 6 compartments across the FULL
  // combined width (Black Tinted Box + TV Unit Box), left/right boundaries
  // aligned exactly with the combined upper section's own outer edges.
  const rowX0 = combinedX0;
  const rowW0 = combinedW;
  const compCount = 6;
  const profileShutterIndex = 3; // fixed near-center compartment, regardless of Black Tinted Box side
  const compW = rowW0 / compCount;
  for (let i = 0; i < compCount; i++) {
    const cx = rowX0 + compW * i;
    const isProfile = i === profileShutterIndex;
    components.push({
      id: `lower-comp-${i}`, type: isProfile ? 'PROFILE_SHUTTER' : 'SHUTTER', label: isProfile ? 'Profile shutter' : '',
      x: cx + 2, y: rowY + 2, width: compW - 4, height: rowH - 4, qty: 1, visible: true,
      source: { formula: isProfile ? 'Profile Shutter — width = TV Unit Box Width + Black Tinted Box Width (auto), fixed position in lower cabinet row' : 'Lower cabinet shutter — part of the combined lower cabinet row, not independently measured', constants: [] },
    });
  }
  // Divider lines between lower-row compartments, drawn crisp on top.
  for (let i = 1; i < compCount; i++) {
    const dx = rowX0 + compW * i;
    lines.push({ x1: dx, y1: rowY, x2: dx, y2: rowY + rowH, color: UNIT_COLOR, strokeWidth: 1 });
  }
  // Line separating the upper field from the lower cabinet row.
  lines.push({ x1: rowX0, y1: rowY, x2: rowX0 + rowW0, y2: rowY, color: UNIT_COLOR, strokeWidth: 1.2 });

  // Depth — "/" diagonal leader at the TV Unit Box's own top-left corner.
  const diag = insideDiagonal(unitX, unitY, W, H);
  lines.push({ x1: unitX, y1: unitY, x2: diag.x2, y2: diag.y2, color: DIAG, label: `${Math.round(D)} mm (D)` });

  // TV Unit Box's own Height and Width — dimension arrows reference the
  // TV Unit Box's OWN edges (unitX..unitX+W), never the combined span.
  const heightAnchorX = leftExtra > 0 ? combinedX0 - leftExtra : combinedX0 - 20;
  dimReqs.push({ axis: 'v', x1: heightAnchorX, y1: unitY, x2: heightAnchorX, y2: unitY + H, edge: 'left', componentIds: ['tv-unit', 'black-tinted-box'], label: `${Math.round(H)} mm (H)`, source: { formula: 'TV Unit Box Height (entered) — Black Tinted Box Height is always equal', constants: [] }, color: UNIT_COLOR });
  dimReqs.push({ axis: 'h', x1: unitX, y1: unitY + H, x2: unitX + W, y2: unitY + H, edge: 'bottom', componentIds: ['tv-unit'], label: `${Math.round(W)} mm (TV Unit Box W)`, source: { formula: 'TV Unit Box Width (entered)', constants: [] } });
  // Black Tinted Box's own Width is deliberately NOT dimensioned on the
  // drawing — it's a fixed proportion of TV Unit Box Width, not an entered
  // or extra measurement, so it never gets its own arrow/label here.

  // ── Mandir (optional) — blue box from the reference, attached OUTSIDE
  // the combined upper unit (Black Tinted Box + TV Unit Box), never
  // overlapping either.
  function drawMandir(side: TvUnitSide) {
    const mx = side === 'left'
      ? combinedX0 - inp.mandirW - (hasLeftPartition ? inp.partitionW : 0)
      : combinedX0 + combinedW + (hasRightPartition ? inp.partitionW : 0);
    const id = 'mandir';
    components.push({ id, type: 'MANDIR_FRAME', label: '', x: mx, y: unitY, width: inp.mandirW, height: inp.mandirH, qty: 1, visible: true, source: { formula: 'Mandir Height × Width × Depth (all entered) — extra measurement, independent of TV Unit', constants: [] } });
    // Internal shelf/drawer lines, matching the reference's own blue box
    // internal division (a horizontal shelf band + a vertical split below it).
    const shelfY = unitY + inp.mandirH * 0.62;
    lines.push({ x1: mx + 2, y1: shelfY, x2: mx + inp.mandirW - 2, y2: shelfY, color: MANDIR_COLOR, strokeWidth: 1 });
    const drawerY = unitY + inp.mandirH * 0.78;
    lines.push({ x1: mx + 2, y1: drawerY, x2: mx + inp.mandirW - 2, y2: drawerY, color: MANDIR_COLOR, strokeWidth: 1 });
    lines.push({ x1: mx + inp.mandirW * 0.5, y1: drawerY, x2: mx + inp.mandirW * 0.5, y2: unitY + inp.mandirH - 2, color: MANDIR_COLOR, strokeWidth: 1 });
    lines.push({ x1: mx + inp.mandirW / 2, y1: unitY - 14, x2: mx + inp.mandirW / 2, y2: unitY - 14, color: MANDIR_COLOR, label: 'Mandir' });
    dimReqs.push({ axis: 'v', x1: side === 'left' ? mx - 0 : mx + inp.mandirW, y1: unitY, x2: side === 'left' ? mx - 0 : mx + inp.mandirW, y2: unitY + inp.mandirH, edge: side === 'left' ? 'left' : 'right', componentIds: [id], label: `${Math.round(inp.mandirH)} mm (Mandir H)`, source: { formula: 'Mandir Height (entered)', constants: [] }, color: MANDIR_COLOR });
    dimReqs.push({ axis: 'h', x1: mx, y1: unitY + inp.mandirH, x2: mx + inp.mandirW, y2: unitY + inp.mandirH, edge: 'bottom', componentIds: [id], label: `${Math.round(inp.mandirW)} mm (Mandir W)`, source: { formula: 'Mandir Width (entered)', constants: [] }, color: MANDIR_COLOR });
    const mdiag = insideDiagonal(mx, unitY, inp.mandirW, inp.mandirH);
    lines.push({ x1: mx, y1: unitY, x2: mdiag.x2, y2: mdiag.y2, color: DIAG, label: `${Math.round(inp.mandirD)} mm (Mandir D)` });
    return mx;
  }
  let rightMandirEndX = combinedX0 + combinedW;
  if (hasLeftMandir) drawMandir('left');
  if (hasRightMandir) rightMandirEndX = drawMandir('right') + inp.mandirW;

  // ── Partition (optional) — vertical slat box, attached OUTSIDE the
  // combined upper unit ───────────────────────────────────────────────────
  function drawPartition(side: TvUnitSide) {
    const px = side === 'left' ? combinedX0 - inp.partitionW : combinedX0 + combinedW;
    const id = 'partition';
    // Label drawn as real in-box text (matching the reference's own big,
    // centered "Partition" label), not an external corner leader.
    components.push({ id, type: 'PARTITION_FRAME', label: 'Partition', x: px, y: unitY, width: inp.partitionW, height: inp.partitionH, qty: 1, visible: true, source: { formula: 'Partition Height × Width × Depth (all entered) — extra measurement, independent of TV Unit', constants: [] } });
    // Vertical slats, matching the reference's own louvre partition (3
    // internal lines making 4 strips).
    const slatCount = 4;
    for (let i = 1; i < slatCount; i++) {
      const sx = px + (inp.partitionW / slatCount) * i;
      lines.push({ x1: sx, y1: unitY, x2: sx, y2: unitY + inp.partitionH, color: PARTITION_COLOR, strokeWidth: 1.4 });
    }
    dimReqs.push({ axis: 'v', x1: side === 'left' ? px : px + inp.partitionW, y1: unitY, x2: side === 'left' ? px : px + inp.partitionW, y2: unitY + inp.partitionH, edge: side === 'left' ? 'left' : 'right', componentIds: [id], label: `${Math.round(inp.partitionH)} mm (Partition H)`, source: { formula: 'Partition Height (entered)', constants: [] }, color: PARTITION_COLOR });
    dimReqs.push({ axis: 'h', x1: px, y1: unitY + inp.partitionH, x2: px + inp.partitionW, y2: unitY + inp.partitionH, edge: 'bottom', componentIds: [id], label: `${Math.round(inp.partitionW)} mm (Partition W)`, source: { formula: 'Partition Width (entered)', constants: [] }, color: PARTITION_COLOR });
    // Depth — "/" diagonal leader at the Partition's own top-left (or
    // top-right) corner, doubling as the reference's own short roof-line
    // corner accent at the outer top corner of the whole assembly.
    const cornerX = side === 'left' ? px : px + inp.partitionW;
    const cornerDir = side === 'left' ? -1 : 1;
    lines.push({ x1: cornerX, y1: unitY, x2: cornerX + cornerDir * 55, y2: unitY - 40, color: DIAG, label: `${Math.round(inp.partitionD)} mm (Partition D)` });
    return px;
  }
  let rightPartitionEndX = combinedX0 + combinedW;
  if (hasLeftPartition) drawPartition('left');
  if (hasRightPartition) rightPartitionEndX = drawPartition('right') + inp.partitionW;

  const outerRight = Math.max(combinedX0 + combinedW, hasRightMandir ? rightMandirEndX : combinedX0 + combinedW, hasRightPartition ? rightPartitionEndX : combinedX0 + combinedW);

  const worldWidth = Math.max(outerRight + 90, ...lines.map((l) => Math.max(l.x1, l.x2) + 10));
  const worldHeight = Math.max(unitY + H + 70, ...lines.map((l) => Math.max(l.y1, l.y2) + 10));

  const dimensions = resolveDimensions(dimReqs);
  const fields = [
    { key: 'H', label: 'TV Unit Box Height', min: 1 },
    { key: 'W', label: 'TV Unit Box Width', min: 1 },
    { key: 'D', label: 'TV Unit Depth', min: 1 },
  ];
  if (inp.hasMandir) {
    fields.push({ key: 'mandirH', label: 'Mandir Height', min: 1 }, { key: 'mandirW', label: 'Mandir Width', min: 1 }, { key: 'mandirD', label: 'Mandir Depth', min: 1 });
  }
  if (inp.hasPartition) {
    fields.push({ key: 'partitionH', label: 'Partition Height', min: 1 }, { key: 'partitionW', label: 'Partition Width', min: 1 }, { key: 'partitionD', label: 'Partition Depth', min: 1 });
  }
  const values: Record<string, number> = { H, W, D };
  if (inp.hasMandir) { values.mandirH = inp.mandirH; values.mandirW = inp.mandirW; values.mandirD = inp.mandirD; }
  if (inp.hasPartition) { values.partitionH = inp.partitionH; values.partitionW = inp.partitionW; values.partitionD = inp.partitionD; }

  const issues = [
    ...validateMeasurements(values, fields),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'tv-unit', designId: 'simple', designName: 'TV Unit',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines,
  };
}
