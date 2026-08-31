import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
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

export type ProfileShutterSide = 'left' | 'right';

export interface ProfileShutterInput {
  enabled: boolean;
  side: ProfileShutterSide; // which side table (LST/RST) it's mounted on — Width is always that table's Width (auto)
  heightMm: number;
  depthMm: number;
  light: boolean; // optional profile/spot light, drawn as a small light-cone callout
}

export interface SimpleBedInputs {
  W: number; // bed width
  L: number; // bed length
  H: number; // bed height — also auto-fetched as LST/RST height
  headboardH: number; // standard default 900mm, editable
  lst: SimpleSideTableInput;
  rst: SimpleSideTableInput;
  profileShutter: ProfileShutterInput;
}

export interface SimpleBedCutRow {
  component: string;
  width: number;
  height: number;
  qty: number;
  remark: string;
}

function profileShutterActive(inp: SimpleBedInputs): boolean {
  const { profileShutter: ps, lst, rst } = inp;
  return ps.enabled && (ps.side === 'left' ? lst.enabled : rst.enabled);
}

/** "BED WITHOUT SIDE TABLE" / "BED WITH LEFT SIDE TABLE" / "BED WITH RIGHT SIDE TABLE" / "BED WITH SIDE TABLES",
 *  with " + PROFILE SHUTTER" appended when one is mounted and active. */
export function simpleBedTitle(inp: SimpleBedInputs): string {
  const base = inp.lst.enabled && inp.rst.enabled ? 'BED WITH SIDE TABLES'
    : inp.lst.enabled ? 'BED WITH LEFT SIDE TABLE'
    : inp.rst.enabled ? 'BED WITH RIGHT SIDE TABLE'
    : 'BED WITHOUT SIDE TABLE';
  return profileShutterActive(inp) ? `${base} + PROFILE SHUTTER` : base;
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
  if (profileShutterActive(inp)) {
    const targetW = inp.profileShutter.side === 'left' ? inp.lst.widthMm : inp.rst.widthMm;
    const sideLabel = inp.profileShutter.side === 'left' ? 'LST' : 'RST';
    rows.push({
      component: `Profile Shutter (on ${sideLabel})`, width: targetW, height: inp.profileShutter.heightMm, qty: 1,
      remark: `Height × Depth entered (${Math.round(inp.profileShutter.heightMm)} × ${Math.round(inp.profileShutter.depthMm)}mm); Width = ${sideLabel} Width (auto-fetched, ${Math.round(targetW)}mm)${inp.profileShutter.light ? ' | Profile light included' : ''}`,
    });
  }
  return rows;
}

const HEADBOARD_GAP = 300; // real visual gap between the Headboard box and the Bed — big enough for a clearly visible height leader through it

export function resolveSimpleBedPlan(inp: SimpleBedInputs): ResolvedDrawing {
  const { W, L, H, headboardH, lst, rst } = inp;
  const leaderMargin = 110; // room for the diagonal Bed-Height leader, which extends left of bedX even with no LST
  const leftW = lst.enabled ? lst.widthMm : 0;
  const rightW = rst.enabled ? rst.widthMm : 0;
  const bedX = leftW + leaderMargin; // shift everything right so nothing is negative
  const bedY = headboardH + HEADBOARD_GAP; // Headboard sits above, with a real gap before the Bed

  const components: ComponentSpec[] = [];
  const dimReqs: DimensionRequest[] = [];
  const lines: AnnotationLine[] = [];

  // Headboard — a separate box above the Bed with a real gap between them,
  // captioned with its own size inline (no dimension arrows on it;
  // Headboard Width always = Bed Width, so a redundant arrow would just
  // repeat the Bed Width dimension below). The Bed Height leader (below)
  // is drawn through this gap.
  components.push({
    id: 'headboard', type: 'HEAD_BOARD', label: `Headboard = ${Math.round(headboardH)} × ${Math.round(W)}`, x: bedX, y: 0, width: W, height: headboardH, qty: 1, visible: true,
    source: { formula: 'Width = Bed Width (auto) | Height = Headboard Height (standard default 900mm, editable)', constants: [] },
  });
  components.push({
    id: 'bed-body', type: 'BED_BODY', label: `Bed - ${Math.round(L)} × ${Math.round(W)}`, x: bedX, y: bedY, width: W, height: L, qty: 1, visible: true,
    source: { formula: 'Width = W | Length = L — single rectangular footprint, no internal panels', constants: [] },
  });

  dimReqs.push({ axis: 'h', x1: bedX, y1: bedY + L, x2: bedX + W, y2: bedY + L, edge: 'bottom', componentIds: ['bed-body'], label: `${Math.round(W)} mm (W)`, source: { formula: 'Bed Width = W', constants: [] } });
  dimReqs.push({ axis: 'v', x1: bedX, y1: bedY, x2: bedX, y2: bedY + L, edge: 'left', componentIds: ['bed-body'], label: `${Math.round(L)} mm (L)`, source: { formula: 'Bed Length = L', constants: [] } });

  // Bed Height (h) — has no natural edge to dimension in a plan view (it's
  // the vertical axis, perpendicular to the page), so it's a diagonal
  // corner leader/callout instead of an axis-aligned DimensionLine. Drawn as
  // a long stroke through the headboard gap, not a short stub, so it reads
  // as a real "big" callout line — anchored at the Bed's own top-left corner
  // by default, matching the user's hand-sketch convention (the "/" leader
  // marks depth/height for any box, at that box's left corner).
  //
  // That left-side gap is only ever empty when nothing else claims it. A
  // Profile Shutter mounted on the LST now fills the WHOLE gap column (see
  // below) with a real box + caption, so the leader is routed to the
  // opposite (right) corner instead whenever that's the case — the right
  // gap is guaranteed clear unless a Profile Shutter sits on the RST too, in
  // which case both gaps are occupied and the leader falls back to the
  // Bed's own bottom-left corner (always open — nothing is ever positioned
  // below the Bed itself), the same "always-open corner" fix already used
  // for the Wardrobe's own Depth leader.
  const psOnLeft = profileShutterActive(inp) && inp.profileShutter.side === 'left';
  const psOnRight = profileShutterActive(inp) && inp.profileShutter.side === 'right';
  if (psOnLeft && psOnRight) {
    lines.push({ x1: bedX, y1: bedY + L, x2: bedX - 90, y2: bedY + L + 60, color: '#cc2200', label: `${Math.round(H)} mm (h)` });
  } else if (psOnLeft) {
    lines.push({ x1: bedX + W, y1: bedY, x2: bedX + W + 100, y2: headboardH + 30, color: '#cc2200', label: `${Math.round(H)} mm (h)` });
  } else {
    lines.push({ x1: bedX, y1: bedY, x2: bedX - 100, y2: headboardH + 30, color: '#cc2200', label: `${Math.round(H)} mm (h)` });
  }

  if (lst.enabled) {
    const lw = lst.widthMm, ld = lst.depthMm;
    const lx = bedX - lw; // flush against the Bed's left edge
    components.push({
      id: 'lst', type: 'SIDE_TABLE', label: 'LST', x: lx, y: bedY, width: lw, height: ld, qty: 1, visible: true,
      source: { formula: `Depth = ${Math.round(ld)}mm (entered) | Width = ${Math.round(lw)}mm (entered) | Height = Bed Height (auto-fetched, ${Math.round(H)}mm)`, constants: [] },
    });
    dimReqs.push({ axis: 'h', x1: lx, y1: bedY - 8, x2: lx + lw, y2: bedY - 8, edge: 'top', componentIds: ['lst'], label: `${Math.round(lw)} mm (W)`, source: { formula: 'LST Width (entered)', constants: [] } });
    // Height is a real, straight vertical dimension (auto-fetched from Bed
    // Height, but still the table's genuine vertical extent). Depth is the
    // "/" diagonal leader at the table's own left corner (bottom-left,
    // since its top-left corner sits flush against the headboard/Bed
    // edge) — per the user's own reference sketch, where the diagonal
    // marks Depth, not Height.
    dimReqs.push({ axis: 'v', x1: lx - 8, y1: bedY, x2: lx - 8, y2: bedY + H, edge: 'left', componentIds: ['lst'], label: `${Math.round(H)} mm (H)`, source: { formula: 'LST Height = Bed Height (auto-fetched)', constants: [] } });
    // Reach extended (26 → 75) so the Depth label clears the Height
    // dimension's own end point — Bed Height and LST Depth are often close
    // in value (e.g. 436 vs 460mm by default), so their two labels would
    // otherwise land almost on top of each other right at the table's
    // bottom-left corner — and drawn bigger overall, matching the "big
    // callout line" treatment used everywhere else.
    lines.push({ x1: lx, y1: bedY + ld, x2: lx - 75, y2: bedY + ld + 60, color: '#cc2200', label: `${Math.round(ld)} mm (D)` });
  }
  if (rst.enabled) {
    const rw = rst.widthMm, rd = rst.depthMm;
    const rx = bedX + W;
    components.push({
      id: 'rst', type: 'SIDE_TABLE', label: 'RST', x: rx, y: bedY, width: rw, height: rd, qty: 1, visible: true,
      source: { formula: `Depth = ${Math.round(rd)}mm (entered) | Width = ${Math.round(rw)}mm (entered) | Height = Bed Height (auto-fetched, ${Math.round(H)}mm)`, constants: [] },
    });
    dimReqs.push({ axis: 'h', x1: rx, y1: bedY - 8, x2: rx + rw, y2: bedY - 8, edge: 'top', componentIds: ['rst'], label: `${Math.round(rw)} mm (W)`, source: { formula: 'RST Width (entered)', constants: [] } });
    dimReqs.push({ axis: 'v', x1: rx + rw + 8, y1: bedY, x2: rx + rw + 8, y2: bedY + H, edge: 'right', componentIds: ['rst'], label: `${Math.round(H)} mm (H)`, source: { formula: 'RST Height = Bed Height (auto-fetched)', constants: [] } });
    // Same "/" convention as LST, anchored at RST's own left corner (its
    // bottom-left, the corner shared with the Bed's edge), with the same
    // extended, bigger reach.
    lines.push({ x1: rx, y1: bedY + rd, x2: rx - 75, y2: bedY + rd + 60, color: '#cc2200', label: `${Math.round(rd)} mm (D)` });
  }

  // Profile Shutter — mounted flush on top of whichever side table it's
  // assigned to (per the user's own reference sketch: it sits directly
  // above the LST/RST, sharing that table's full Width — never independently
  // entered). Its rendered box fills the WHOLE Headboard-row band (y=0 down
  // to the table's own top edge) — the same "real gap, not to scale" move
  // already used for HEADBOARD_GAP — so it reads clearly next to the full-
  // height Headboard, rather than as a sliver sized to a genuinely small
  // real-world light-box height. The entered Height/Depth stay exactly what
  // the user typed; they're just shown in the caption (H×D) rather than
  // controlling how tall the box is drawn.
  const psActive = profileShutterActive(inp);
  if (psActive) {
    const onLeft = inp.profileShutter.side === 'left';
    const tableW = onLeft ? lst.widthMm : rst.widthMm;
    const tableX = onLeft ? bedX - tableW : bedX + W;
    const psH = inp.profileShutter.heightMm;
    const psD = inp.profileShutter.depthMm;
    components.push({
      id: 'profile-shutter', type: 'PROFILE_SHUTTER', label: `Profile Shutter ${Math.round(psH)}×${Math.round(psD)}`,
      x: tableX, y: 0, width: tableW, height: bedY, qty: 1, visible: true,
      source: { formula: `Height = ${Math.round(psH)}mm (entered) | Depth = ${Math.round(psD)}mm (entered) | Width = ${onLeft ? 'LST' : 'RST'} Width (auto-fetched, ${Math.round(tableW)}mm)`, constants: [] },
    });
    // Depth — same "/" diagonal convention as every other out-of-plan value,
    // anchored at the shutter's own bottom corner (shared with the table),
    // pointed toward the OUTER edge (away from the Bed) so it never crosses
    // into the LST/RST's own dimension lines on the inner side.
    const outerX = onLeft ? tableX : tableX + tableW;
    const dxDir = onLeft ? -55 : 55;
    lines.push({ x1: outerX, y1: bedY, x2: outerX + dxDir, y2: bedY + 55, color: '#cc2200', label: `${Math.round(psD)} mm (D)` });
    if (inp.profileShutter.light) {
      // Optional profile/spot light — a small light-cone callout just inside
      // the shutter's own top edge (two rays converging downward from the
      // top corners), matching the user's own reference sketch — drawn
      // inward rather than above, since the box's top now sits flush with
      // the very top of the drawing (y=0), leaving no external headroom.
      const apexX = tableX + tableW / 2;
      const apexY = 50;
      lines.push({ x1: tableX + 8, y1: 0, x2: apexX, y2: apexY, color: '#f59e0b', label: 'SPOT LIGHT' });
      lines.push({ x1: apexX, y1: apexY, x2: tableX + tableW - 8, y2: 0, color: '#f59e0b' });
    }
  }

  // Include every leader-line endpoint so nothing (e.g. the LST/RST Height
  // callouts, which extend slightly past their table's own bounds) risks
  // being clipped at the edge of the drawing.
  const worldWidth = Math.max(bedX + W + rightW, ...lines.map((l) => Math.max(l.x1, l.x2) + 10));
  const worldHeight = Math.max(bedY + L, ...lines.map((l) => Math.max(l.y1, l.y2) + 10));

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
    ...(psActive ? validateMeasurements({ H: inp.profileShutter.heightMm, D: inp.profileShutter.depthMm }, [{ key: 'H', label: 'Profile Shutter Height', min: 1 }, { key: 'D', label: 'Profile Shutter Depth', min: 1 }]) : []),
    ...(inp.profileShutter.enabled && !psActive ? [{ id: `val-ps-${inp.profileShutter.side}`, severity: 'WARNING' as const, code: 'PROFILE_SHUTTER_NO_TABLE', message: `Profile Shutter is set to mount on the ${inp.profileShutter.side === 'left' ? 'Left' : 'Right'} Side Table, but that side table isn't added — enable it first.` }] : []),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'bed', designId: 'simple', designName: 'Bed',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines,
  };
}
