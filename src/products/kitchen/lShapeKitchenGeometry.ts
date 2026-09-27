import type { AnnotationLine, ComponentSpec, ResolvedDrawing, ValidationIssue } from '../../engine/types';
import { placeNoteBoxes, type CalloutRequest } from '../../engine/noteBoxPlacement';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity } from '../../engine/validationEngine';
import type { LShapeKitchenConfig, KitchenWallConfig } from '../../store/types';
import { resolveKitchenWall, rotateWallOutput, type ResolvedWall, type WallOrigin } from './kitchenWallGeometry';

// ─────────────────────────────────────────────────────────────────────────────
// L-Shape Kitchen — Wall A Engine + Wall B Engine + Shared Corner Engine.
// See LSHAPE_KITCHEN_PLAN.md for the full design. Every Kadappa/Clear-
// Width/Trolley/Trolley-Panel/Side-Door/Fix-Patti rule is the SAME I-Shape
// engine (resolveKitchenWall, kitchenWallGeometry.ts) called once per wall —
// nothing here reimplements or duplicates those formulas. The only new
// logic in this file is: (1) copying the shared Kitchen Height/Depth/Pani
// Patti Height into each wall before resolving it, (2) picking which Wall A
// endpoint the corner sits at, (3) the dedicated corner resolver (Corner
// Fix Patti only — see §0.1 of the plan: NEVER a Wall-Side Kadappa, NEVER
// counted into either wall's own width), and (4) merging everything into
// one ResolvedDrawing.
// ─────────────────────────────────────────────────────────────────────────────

export interface LShapeKitchenDrawingInputs {
  lShape: LShapeKitchenConfig;
}

const LEADER_MARGIN = 60;
const DRAWING_ORIGIN_Y = 90;
const FIX_PATTI_COLOR = '#16a34a';

/** Wall A's / Wall B's own KitchenWallConfig, with the shared whole-kitchen
 * Height/Depth/Pani-Patti-Height (§15 Q1 of the plan) copied in — the wall
 * resolver itself stays completely unaware these three values are shared
 * across both walls rather than independently entered. */
function withSharedMeasurements(wall: KitchenWallConfig, lShape: LShapeKitchenConfig): KitchenWallConfig {
  return { ...wall, height: lShape.kitchenHeight, depth: lShape.kitchenDepth, paniPattiHeight: lShape.paniPattiHeight };
}

/**
 * Corner Fix Patti — the ONLY new geometry this feature introduces. A real
 * physical panel bolted across the shared Wall A / Wall B intersection,
 * built entirely from `lShape.corner` — never assembled from, or written
 * into, either wall's own KitchenWallConfig (no Wall-Side Kadappa field,
 * no per-wall fixPatti field). If disabled, returns everything empty: no
 * invented Fix Patti (LSHAPE_KITCHEN_PLAN.md §24/§0.1).
 *
 * Placement: a small square panel sitting IN the corner itself, on the
 * Wall A side of the intersection (bottom-aligned to the shared floor
 * line, matching the Fix Patti convention of standing on the same floor as
 * every other Kadappa/Fix Patti box) — closing the visual gap between Wall
 * A's own end and Wall B's own start. Exact quadrant/inset can be refined
 * later against the user's reference sketches without touching Wall A or
 * Wall B's own resolver code at all, since this function is fully
 * self-contained.
 */
function resolveLShapeCorner(
  lShape: LShapeKitchenConfig,
  corner: { x: number; y: number },
  wallA: ResolvedWall,
): { components: ComponentSpec[]; dimensions: DimensionRequest[]; lines: AnnotationLine[]; calloutRequests: CalloutRequest[]; issues: ValidationIssue[] } {
  const empty = { components: [] as ComponentSpec[], dimensions: [] as DimensionRequest[], lines: [] as AnnotationLine[], calloutRequests: [] as CalloutRequest[], issues: [] as ValidationIssue[] };
  if (!lShape.corner.fixPattiEnabled) return empty;

  const width = Math.max(1, lShape.corner.fixPattiWidth || 40);
  const height = Math.max(1, lShape.corner.fixPattiHeight || lShape.kitchenHeight || 1);
  if (width <= 0 || height <= 0) {
    return {
      ...empty,
      issues: [{ id: 'l-corner-fixpatti-invalid', severity: 'CRITICAL', code: 'L_CORNER_FIX_PATTI_INVALID', message: 'Corner Fix Patti Width/Height must both be greater than 0mm.' }],
    };
  }

  // Wall A's own body spans a known y-band (its bounds.top..bounds.bottom,
  // already in real world coordinates post-rotation) — the corner panel is
  // bottom-aligned to that same floor line, and its own right/left edge
  // (depending on which side the corner is on) sits flush against Wall A's
  // real end so it visibly closes the join with no gap.
  const wallBPosition = lShape.wallBPosition;
  const x = wallBPosition === 'right' ? corner.x - width : corner.x;
  const y = wallA.bounds.bottom - height;
  const id = 'corner-fix-patti';

  const components: ComponentSpec[] = [{
    id, type: 'FIX_PATTI', label: '',
    x, y, width, height, qty: 1, visible: true,
    source: { formula: `Corner Fix Patti — Height × Width both entered (independent of Wall A/Wall B's own Fix Patti) = ${Math.round(height)} × ${Math.round(width)}mm`, constants: [] },
  }];
  const calloutRequests: CalloutRequest[] = [{
    id, componentBounds: { x, y, w: width, h: height },
    title: 'Corner Fix Patti',
    lines: [`H: ${Math.round(height)}mm`, `W: ${Math.round(width)}mm`],
    color: FIX_PATTI_COLOR,
  }];

  return { components, dimensions: [], lines: [], calloutRequests, issues: [] };
}

/** Defensive geometric sanity checks — per LSHAPE_KITCHEN_PLAN.md §4.4,
 * these should be structurally impossible given the corner is always
 * derived from Wall A's own resolved endpoint, never a second independent
 * value; checked anyway since a future edit to either wall's resolver
 * could otherwise silently reintroduce a mismatch. */
function validateLCorner(wallA: ResolvedWall, wallB: ResolvedWall, corner: { x: number; y: number }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const TOLERANCE = 1;
  const wallBStart = wallB.startPoint;
  if (Math.abs(wallBStart.x - corner.x) > TOLERANCE || Math.abs(wallBStart.y - corner.y) > TOLERANCE) {
    issues.push({
      id: 'l-corner-invalid', severity: 'CRITICAL', code: 'L_CORNER_INVALID',
      message: `Wall B's own start point (${Math.round(wallBStart.x)}, ${Math.round(wallBStart.y)}) does not land exactly on the shared corner (${Math.round(corner.x)}, ${Math.round(corner.y)}).`,
    });
  }
  return issues;
}

/**
 * Wall B's own "Total Kitchen Height" dimension — per the user's explicit
 * correction, must always render as a VERTICAL line running along Wall B's
 * own RIGHT edge (mirroring Wall A's own Height dimension on Wall A's LEFT
 * edge), with the label text reading vertically — never the horizontal
 * line at the bottom edge the generic CW/CCW `edge` rotation produces
 * (`rotateWallOutput`'s rotation is geometrically correct for every OTHER
 * dimension, but Total Kitchen Height specifically needs a fixed, always-
 * vertical placement on Wall B regardless of which rotation handedness was
 * used, since it represents the corridor's shared thickness rather than
 * Wall B's own visual run length). Finds that one dimension by its label
 * and rewrites its geometry in place — every other Wall B dimension keeps
 * whatever edge the rotation naturally produced.
 */
function fixWallBHeightDimension(dimensions: DimensionRequest[], wallB: ResolvedWall): DimensionRequest[] {
  const rightX = wallB.bounds.right;
  const top = wallB.bounds.top;
  const bottom = wallB.bounds.bottom;
  return dimensions.map((d) => {
    if (!d.label?.includes('Total Kitchen Height')) return d;
    return { ...d, axis: 'v', edge: 'right', x1: rightX, y1: top, x2: rightX, y2: bottom };
  });
}

/**
 * Wall B's own plain-text width/height callouts (Trolley Panel's "(W)"/
 * "(h)", Kadappa's "(W)", Side Section Door's "(W)"/"(h)") are emitted as
 * ZERO-LENGTH AnnotationLines in kitchenWallGeometry.ts (a point, not a real
 * line) — CanonicalSvg.tsx's rotation-angle formula (`atan2(0,0) = 0`)
 * always reads a zero-length line as horizontal, so these labels stayed
 * horizontal even after Wall B's own 90° rotation, per the user's explicit
 * bug report ("panel height and width should be vertical" for Wall B).
 * Fixed by giving each SUCH label a tiny real vertical extent (a few mm,
 * invisible at any real drawing scale) once Wall B's own output is already
 * in world space — this is enough for CanonicalSvg's own angle computation
 * to read it as a vertical line and rotate the text to match, without
 * drawing any visible tick/arrow (the line itself stays far too short to
 * render as a visible stroke).
 */
function verticalizeWallBPlainLabels(lines: AnnotationLine[]): AnnotationLine[] {
  const STUB_MM = 0.5;
  return lines.map((l) => {
    const isZeroLength = l.x1 === l.x2 && l.y1 === l.y2;
    const isPlainWidthOrHeightLabel = !!l.label && /\((?:W|h)\)$/.test(l.label);
    if (!isZeroLength || !isPlainWidthOrHeightLabel) return l;
    return { ...l, y2: l.y2 + STUB_MM };
  });
}

/** How far to the RIGHT of `mainDrawingRight` (the real "L" footprint's own
 * rightmost extent) the shared Inner Trolley area starts, and how much
 * vertical gap separates Wall A's own Inner Trolley drawing from Wall B's,
 * stacked one below the other WITHIN that shared side column. Per the
 * user's explicit correction: the Trolley drawing(s) belong in the real
 * free space beside the main kitchen drawing (previously wasted white
 * space), not stacked below it — the two Inner Trolley drawings still
 * share ONE compact column (never side-by-side with each other, which
 * would waste horizontal space), just positioned to the right of the main
 * drawing instead of underneath it. */
const SHARED_INNER_TROLLEY_GAP = 100;
const INNER_TROLLEY_STACK_GAP = 100;

/** Identifies exactly the Inner Trolley detail drawing's own output inside
 * an already-rotated ResolvedWall — every TROLLEY_INNER_ and
 * TROLLEY_OUTER_BOUND component (see trolleyTemplates.ts), the 3 dimension
 * requests that
 * reference 'trolley-outer-bound', and its one "INNER TROLLEY" title
 * line/Depth diagonal (see kitchenWallGeometry.ts). Isolated by TYPE/ID,
 * not by any coordinate heuristic, so it is exact regardless of where pass
 * 1 happened to place it. Used so the shared stacked placement (below) can
 * relocate ONLY this content, in WORLD space, without needing to invert
 * either wall's own rotation transform — the main Kadappa/Pani-Patti/Door
 * row is left completely untouched. */
function isolateInnerTrolley(wall: ResolvedWall): {
  main: ResolvedWall;
  innerTrolley: { components: ComponentSpec[]; dimensions: DimensionRequest[]; lines: AnnotationLine[] };
} {
  const isInnerTrolleyComponent = (c: ComponentSpec) => c.type === 'TROLLEY_OUTER_BOUND' || c.type.startsWith('TROLLEY_INNER_');
  const isInnerTrolleyDim = (d: DimensionRequest) => d.componentIds.includes('trolley-outer-bound');
  const isInnerTrolleyLine = (l: AnnotationLine) => l.label === 'INNER TROLLEY' || l.label?.endsWith('(D)') && isDepthLineNearInnerTrolley(l, wall);

  const trolleyComponents = wall.components.filter(isInnerTrolleyComponent);
  const trolleyIds = new Set(trolleyComponents.map((c) => c.id));
  const mainComponents = wall.components.filter((c) => !trolleyIds.has(c.id));

  const trolleyDims = wall.dimensionRequests.filter(isInnerTrolleyDim);
  const mainDims = wall.dimensionRequests.filter((d) => !isInnerTrolleyDim(d));

  const trolleyLines = wall.lines.filter(isInnerTrolleyLine);
  const mainLines = wall.lines.filter((l) => !isInnerTrolleyLine(l));

  return {
    main: { ...wall, components: mainComponents, dimensionRequests: mainDims, lines: mainLines },
    innerTrolley: { components: trolleyComponents, dimensions: trolleyDims, lines: trolleyLines },
  };
}

/** The Inner Trolley's own Depth diagonal shares no unique label text with
 * the main Kitchen Depth diagonal (both end in "(D)"), so it's identified
 * by proximity to the Inner Trolley's own outer bound instead — its (x1,y1)
 * always sits exactly at that bound's own top-left corner. */
function isDepthLineNearInnerTrolley(l: AnnotationLine, wall: ResolvedWall): boolean {
  const outerBound = wall.components.find((c) => c.id === 'trolley-outer-bound');
  if (!outerBound) return false;
  return Math.abs(l.x1 - outerBound.x) < 1 && Math.abs(l.y1 - outerBound.y) < 1;
}

/** Translates an isolated Inner Trolley's own components/dimensions/lines
 * by a real WORLD-space offset — a pure additive shift, safe to apply after
 * rotation since this content is already in world coordinates at this
 * point (isolateInnerTrolley runs on the wall's post-rotateWallOutput
 * output). */
function translateInnerTrolley(
  inner: { components: ComponentSpec[]; dimensions: DimensionRequest[]; lines: AnnotationLine[] },
  dx: number, dy: number,
): { components: ComponentSpec[]; dimensions: DimensionRequest[]; lines: AnnotationLine[] } {
  return {
    components: inner.components.map((c) => ({ ...c, x: c.x + dx, y: c.y + dy })),
    dimensions: inner.dimensions.map((d) => ({ ...d, x1: d.x1 + dx, y1: d.y1 + dy, x2: d.x2 + dx, y2: d.y2 + dy })),
    lines: inner.lines.map((l) => ({ ...l, x1: l.x1 + dx, y1: l.y1 + dy, x2: l.x2 + dx, y2: l.y2 + dy })),
  };
}

export function resolveLShapeKitchenPlan(inputs: LShapeKitchenDrawingInputs): ResolvedDrawing {
  const { lShape } = inputs;

  // 1. Wall A — resolve in its own local frame (cornerEnd tells it which
  //    of ITS OWN local ends will be the L-Shape corner, so it suppresses
  //    Side-Section-Door eligibility there — see kitchenWallGeometry.ts),
  //    then translate (no rotation — Wall A is always the horizontal run)
  //    onto the drawing's fixed origin. Each wall's Inner Trolley drawing
  //    lands wherever its OWN local layout naturally puts it at this point
  //    (kitchenWallGeometry.ts's own default, unchanged) — that placement
  //    is only ever used to learn the content's real size; it is isolated
  //    and relocated in WORLD space below, once both walls are known.
  const wallAConfig = withSharedMeasurements(lShape.wallA, lShape);
  const wallALocal = resolveKitchenWall(wallAConfig, 'Wall A', lShape.wallBPosition);
  const wallAOrigin: WallOrigin = { x: LEADER_MARGIN, y: DRAWING_ORIGIN_Y };
  const wallARotated = rotateWallOutput(wallALocal, wallAOrigin, 'horizontal');

  const corner = lShape.wallBPosition === 'right' ? wallARotated.endPoint : wallARotated.startPoint;

  // 2. Wall B — resolve + rotate. CW and CCW are genuine mirror images of
  //    each other (see kitchenWallGeometry.ts's rotateWallOutput) — 'right'
  //    (corner = Wall A's own right end) needs the body to extend LEFT of
  //    the corner (into the L, under Wall A), which is the CCW direction;
  //    'left' needs the mirror image (CW). Confirmed empirically: CW at a
  //    'right'-side corner put Wall B's body to the RIGHT of the corner —
  //    i.e. outside the L, colliding with nothing but reading as visually
  //    disconnected/wrong — while CCW correctly closed it flush.
  const wallBConfig = withSharedMeasurements(lShape.wallB, lShape);
  const wallBLocal = resolveKitchenWall(wallBConfig, 'Wall B', 'left');
  const wallBRotation = lShape.wallBPosition === 'right' ? 'vertical-down-ccw' : 'vertical-down-cw';
  const wallBRotated = rotateWallOutput(wallBLocal, corner, wallBRotation);

  // 3. Isolate each wall's own Inner Trolley detail drawing from its main
  //    Kadappa/Pani-Patti/Door row (by component TYPE/ID — see
  //    isolateInnerTrolley above), then relocate ONLY that isolated content
  //    into ONE shared, compact column directly below the whole merged
  //    L-shape's own real footprint — Wall A's own Inner Trolley first,
  //    Wall B's stacked directly beneath it (never side by side, which
  //    wasted horizontal space and produced a needlessly wide canvas).
  //    This is a pure WORLD-space translation applied AFTER each wall's own
  //    rotation, so it never needs to reason about — or invert — either
  //    wall's rotation transform; it only ever moves already-rotated,
  //    already-world-space content from wherever it naturally landed to
  //    wherever the shared stack says it should be.
  const { main: wallA, innerTrolley: wallAInner } = isolateInnerTrolley(wallARotated);
  const { main: wallBIsolated, innerTrolley: wallBInner } = isolateInnerTrolley(wallBRotated);
  // Wall B-specific orientation fixes (§ see the two functions' own docs
  // above) — applied only to Wall B's own MAIN row (never Wall A, never
  // Wall B's own relocated Inner Trolley content, which keeps whatever
  // orientation its own template/panel formulas already produce).
  const wallB: ResolvedWall = {
    ...wallBIsolated,
    dimensionRequests: fixWallBHeightDimension(wallBIsolated.dimensionRequests, wallBRotated),
    lines: verticalizeWallBPlainLabels(wallBIsolated.lines),
  };

  // Inner Trolley placement — a shared column of free space to the RIGHT of
  // the whole merged L-shape's own real footprint, per the user's explicit
  // correction (moved from "stacked below the drawing" to "beside it,
  // using the free space to the right" — the earlier below-the-drawing
  // placement wasted exactly the space now being used). Wall A's own Inner
  // Trolley (if any) sits first in that column, Wall B's stacked directly
  // beneath it — same "one compact column, never side-by-side duplicating
  // wasted space" principle as before, just relocated to the right edge
  // instead of the bottom edge.
  const mainDrawingRight = Math.max(
    ...wallA.components.map((c) => c.x + c.width),
    ...wallB.components.map((c) => c.x + c.width),
  );
  const mainDrawingTop = Math.min(
    ...wallA.components.map((c) => c.y),
    ...wallB.components.map((c) => c.y),
  );
  const stackX = mainDrawingRight + SHARED_INNER_TROLLEY_GAP;
  const stackTopY = mainDrawingTop;

  const wallAInnerBoundsTopLeft = wallAInner.components.length > 0
    ? { x: Math.min(...wallAInner.components.map((c) => c.x)), y: Math.min(...wallAInner.components.map((c) => c.y)) }
    : null;
  const wallAInnerHeight = wallAInner.components.length > 0
    ? Math.max(...wallAInner.components.map((c) => c.y + c.height)) - Math.min(...wallAInner.components.map((c) => c.y))
    : 0;
  const wallAInnerShifted = wallAInnerBoundsTopLeft
    ? translateInnerTrolley(wallAInner, stackX - wallAInnerBoundsTopLeft.x, stackTopY - wallAInnerBoundsTopLeft.y)
    : wallAInner;

  const wallBStackY = stackTopY + (wallAInnerHeight > 0 ? wallAInnerHeight + INNER_TROLLEY_STACK_GAP : 0);
  const wallBInnerBoundsTopLeft = wallBInner.components.length > 0
    ? { x: Math.min(...wallBInner.components.map((c) => c.x)), y: Math.min(...wallBInner.components.map((c) => c.y)) }
    : null;
  const wallBInnerShifted = wallBInnerBoundsTopLeft
    ? translateInnerTrolley(wallBInner, stackX - wallBInnerBoundsTopLeft.x, wallBStackY - wallBInnerBoundsTopLeft.y)
    : wallBInner;

  // 4. Corner resolver — Corner Fix Patti only, per §0.1/§4.3 of the plan.
  const cornerResult = resolveLShapeCorner(lShape, corner, wallA);

  // 5. Merge every wall (main row + relocated Inner Trolley) + the corner
  //    into one flat set of arrays.
  let components = [...wallA.components, ...wallAInnerShifted.components, ...wallB.components, ...wallBInnerShifted.components, ...cornerResult.components];
  let dimReqs = [...wallA.dimensionRequests, ...wallAInnerShifted.dimensions, ...wallB.dimensionRequests, ...wallBInnerShifted.dimensions, ...cornerResult.dimensions];
  let lines = [...wallA.lines, ...wallAInnerShifted.lines, ...wallB.lines, ...wallBInnerShifted.lines, ...cornerResult.lines];
  let calloutRequests = [...wallA.calloutRequests, ...wallB.calloutRequests, ...cornerResult.calloutRequests];
  const issues: ValidationIssue[] = [...wallA.issues, ...wallB.issues, ...cornerResult.issues, ...validateLCorner(wallA, wallB, corner)];

  // 5b. Normalize into positive canvas space. Wall A is always anchored at
  // a fixed positive origin, but Wall B (rotated 90° around the corner) can
  // legitimately extend to negative X when wallBPosition is 'left' (its
  // real outer wall end lands to the LEFT of the corner) — a real, correct
  // geometric result, not a bug, but one that would draw off-canvas if left
  // as-is. Shift EVERYTHING (components, lines, callouts, dimension
  // requests, and the corner point itself) by whatever amount brings the
  // true minimum X/Y up to a safe positive margin — a pure translate
  // applied uniformly, so it changes nothing about the shape itself, only
  // where it sits on the canvas.
  const MARGIN = 60;
  const allX = [...components.map((c) => c.x), ...lines.flatMap((l) => [l.x1, l.x2]), ...dimReqs.flatMap((d) => [d.x1, d.x2]), ...calloutRequests.map((r) => r.componentBounds.x), corner.x];
  const allY = [...components.map((c) => c.y), ...lines.flatMap((l) => [l.y1, l.y2]), ...dimReqs.flatMap((d) => [d.y1, d.y2]), ...calloutRequests.map((r) => r.componentBounds.y), corner.y];
  const minX = Math.min(...allX);
  const minY = Math.min(...allY);
  const shiftX = minX < MARGIN ? MARGIN - minX : 0;
  const shiftY = minY < MARGIN ? MARGIN - minY : 0;
  if (shiftX !== 0 || shiftY !== 0) {
    components = components.map((c) => ({ ...c, x: c.x + shiftX, y: c.y + shiftY }));
    lines = lines.map((l) => ({ ...l, x1: l.x1 + shiftX, y1: l.y1 + shiftY, x2: l.x2 + shiftX, y2: l.y2 + shiftY }));
    dimReqs = dimReqs.map((d) => ({ ...d, x1: d.x1 + shiftX, y1: d.y1 + shiftY, x2: d.x2 + shiftX, y2: d.y2 + shiftY }));
    calloutRequests = calloutRequests.map((r) => ({
      ...r,
      componentBounds: { ...r.componentBounds, x: r.componentBounds.x + shiftX, y: r.componentBounds.y + shiftY },
      anchor: r.anchor ? { x: r.anchor.x + shiftX, y: r.anchor.y + shiftY } : undefined,
    }));
  }

  // 6. resolveDimensions / placeNoteBoxes are called ONCE on the merged
  //    lists (never once per wall) so their own collision-avoidance logic
  //    sees every dimension/callout on the final canvas at once — per
  //    LSHAPE_KITCHEN_PLAN.md §3.3.
  const maxComponentRight = Math.max(...components.map((c) => c.x + c.width));
  const maxComponentBottom = Math.max(...components.map((c) => c.y + c.height));
  const preWorldWidth = maxComponentRight + 60;
  const preWorldHeight = maxComponentBottom + 60;

  const dimensions = resolveDimensions(dimReqs);
  const noteBoxes = placeNoteBoxes(calloutRequests, { components, dimensions, lines, worldWidth: preWorldWidth, worldHeight: preWorldHeight });
  const worldWidth = Math.max(preWorldWidth, ...noteBoxes.map((nb) => nb.x + 190));
  const worldHeight = Math.max(preWorldHeight, ...noteBoxes.map((nb) => nb.y + 80));

  return {
    view: 'plan', productType: 'kitchen', designId: 'l-shape', designName: 'L-Shape Kitchen',
    worldWidth, worldHeight, components, dimensions, lines, noteBoxes,
    issues: [...issues, ...validateComponentBounds(components, worldWidth, worldHeight), ...validateDimensionIntegrity(dimensions)],
    formulaStatus: 'verified',
  };
}
