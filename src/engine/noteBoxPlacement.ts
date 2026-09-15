import type { AnnotationLine, ComponentSpec, DimensionLine, NoteBox } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Component callout box + free-space auto placement.
//
// A crowded small component (Storage Box, Open Box, Fix Patti, Khacha, a
// tight Loft door, ...) can't hold its own H/W/D text without the numbers
// overlapping each other, the component's own name, or a neighbouring
// component. Rather than hand-picking a fixed offset per component (which
// breaks the moment the composite gets denser — a callout drawn "170mm to
// the left" can land squarely on whatever else now happens to occupy that
// space once a Top Panel, another add-on, or a wider dimension chain grows
// into it), this module places every callout by REAL COLLISION DETECTION
// against every already-known drawing element, all in WORLD-mm space (so
// it stays correct at any eventual render scale / zoom / PDF export —
// never hand-tuned screen-px offsets).
//
// Usage: call `placeNoteBoxes` ONCE, after a product's geometry has
// resolved every component / dimension / line it will ever draw, passing
// the callouts it wants placed. Returns the finished NoteBox[] with real,
// collision-checked positions and a leader anchor on the component.
// ─────────────────────────────────────────────────────────────────────────────

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CalloutRequest {
  id: string;
  /** The component this callout describes — used both as an obstacle (so
   * later callouts don't land on it) and as the leader arrow's target. */
  componentBounds: Rect;
  /** Preferred anchor point on the component the leader arrow should
   * touch — defaults to the component bounds' own edge midpoint nearest
   * whichever side the callout ends up on. */
  anchor?: { x: number; y: number };
  title: string;
  lines: string[];
  color?: string;
}

// CanonicalSvg renders every label at a FIXED SCREEN-PX size regardless of
// the drawing's world-mm scale (dimension text, component names, and
// NoteBox rows alike) — see its own DIM_TIER_STEP_PX/PAD constants and
// NoteBox renderer. This module works entirely in world-mm (so placement
// stays correct at any zoom/PDF export), so every fixed-px metric below
// must be divided by the drawing's REAL render scale before use, or a
// dense drawing (small scale) reserves far too little world-mm space for
// what is actually a constant-size rendered label — exactly the bug this
// module exists to prevent. `computeRenderScale` reproduces CanonicalSvg's
// own scale formula exactly (see fitScale/TechnicalDrawingSvg) so the
// conversion is never a guess.
const LINE_H_PX = 9.5;
const PAD_X_PX = 5;
const PAD_Y_PX = 4;
const CHAR_W_PX = 4.2;
const DIM_TIER_STEP_PX = 18;
const DIM_PAD_PX = 60;
// Must stay in sync with CanonicalSvg's own TechnicalDrawingSvg default
// maxVw/maxVh — this module reproduces that renderer's scale formula
// exactly (see computeRenderScale below) so callout sizing/placement never
// drifts out of step with what actually gets drawn.
const DEFAULT_VIEWPORT_PX = { w: 1280, h: 960 };

/** CanonicalSvg's own world-mm → screen-px scale, computed the exact same
 * way TechnicalDrawingSvg does (fitScale + its dimRoom/titleRoom
 * reservations) — the single source of truth this module converts every
 * fixed-px metric through. */
export function computeRenderScale(worldWidth: number, worldHeight: number, maxTier: number, maxVw = DEFAULT_VIEWPORT_PX.w, maxVh = DEFAULT_VIEWPORT_PX.h): number {
  const rawDimRoom = DIM_PAD_PX + (maxTier + 1) * DIM_TIER_STEP_PX;
  const dimRoom = Math.min(rawDimRoom, Math.max(4, Math.min(maxVw, maxVh) * 0.22));
  const titleRoom = Math.min(26, maxVh * 0.18);
  const availW = Math.max(10, maxVw - dimRoom * 2);
  const availH = Math.max(10, maxVh - dimRoom * 2 - titleRoom);
  return Math.min(availW / Math.max(worldWidth, 1), availH / Math.max(worldHeight, 1));
}

function calloutSize(title: string, lines: string[], mmPerPx: number): { w: number; h: number } {
  const rows = [title, ...lines];
  const w = (Math.max(...rows.map((r) => r.length)) * CHAR_W_PX + PAD_X_PX * 2) * mmPerPx;
  const h = (rows.length * LINE_H_PX + PAD_Y_PX * 2) * mmPerPx;
  return { w, h };
}

function rectsOverlap(a: Rect, b: Rect, margin = 0): boolean {
  return (
    a.x < b.x + b.w + margin &&
    b.x < a.x + a.w + margin &&
    a.y < b.y + b.h + margin &&
    b.y < a.y + a.h + margin
  );
}

/** Does the segment (x1,y1)-(x2,y2) pass through rect r (expanded by
 * margin)? Used so a callout's own anchor→box leader LINE is never routed
 * straight across an already-placed box — rectsOverlap alone only checks
 * the box's own footprint, not the ink connecting it back to its
 * component, which a later callout could otherwise land clear of while
 * still crossing right through it. Coarse but sufficient here: samples
 * along the segment rather than a full line-clip, since these are short
 * leaders in a bounded drawing, not arbitrary geometry. */
function segmentHitsRect(x1: number, y1: number, x2: number, y2: number, r: Rect, margin = 0): boolean {
  const rx0 = r.x - margin, ry0 = r.y - margin, rx1 = r.x + r.w + margin, ry1 = r.y + r.h + margin;
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
    if (x >= rx0 && x <= rx1 && y >= ry0 && y <= ry1) return true;
  }
  return false;
}

/** A dimension line's own on-screen footprint: its span PLUS its label's
 * rendered box, offset out from the edge by its tier — same geometry
 * DimensionLineView actually draws (tier step is a FIXED screen-px
 * amount, so it's converted through mmPerPx here, not guessed in raw
 * world-mm) — so a callout box never gets placed on top of a dimension or
 * its text at any drawing density. */
function dimensionFootprint(d: DimensionLine, mmPerPx: number): Rect {
  const labelW = (d.label.length * CHAR_W_PX + PAD_X_PX) * mmPerPx;
  const labelH = LINE_H_PX * mmPerPx;
  const tierPad = (DIM_TIER_STEP_PX * (d.tier + 1) + 8) * mmPerPx;
  // The footprint must cover the FULL corridor from the dimension's base
  // edge out to its own tier — not just a thin band around the label —
  // because the extension/arrow lines connecting the base edge to a
  // higher tier are real ink too. A thin label-only band left a gap a
  // callout could slot into that visually sits on top of a lower-tier
  // dimension's extension line (e.g. between "1630(W)" tier 0 and
  // "2500(Total W)" tier 1 directly below it).
  if (d.axis === 'h') {
    const x0 = Math.min(d.x1, d.x2), x1 = Math.max(d.x1, d.x2);
    const yBase = (d.y1 + d.y2) / 2;
    const y = d.edge === 'top' ? yBase - tierPad - labelH : yBase;
    const h = tierPad + labelH;
    return { x: x0 - labelW / 2, y, w: x1 - x0 + labelW, h };
  }
  const y0 = Math.min(d.y1, d.y2), y1 = Math.max(d.y1, d.y2);
  const xBase = (d.x1 + d.x2) / 2;
  const x = d.edge === 'left' ? xBase - tierPad - labelW : xBase;
  const w = tierPad + labelW;
  return { x, y: y0 - labelH / 2, w, h: y1 - y0 + labelH };
}

/** An AnnotationLine with a label — its own leader/diagonal PLUS a rough
 * label footprint at its midpoint, matching how CanonicalSvg centres a
 * line's label on its own midpoint (also fixed-px, so scale-converted). */
function lineFootprint(l: AnnotationLine, mmPerPx: number): Rect | null {
  if (!l.label) return null;
  const mx = l.labelAtStart ? l.x1 : (l.x1 + l.x2) / 2;
  const my = l.labelAtStart ? l.y1 : (l.y1 + l.y2) / 2;
  const w = (l.label.length * CHAR_W_PX + PAD_X_PX * 2) * mmPerPx;
  const h = (LINE_H_PX + PAD_Y_PX) * mmPerPx;
  return { x: mx - w / 2, y: my - h / 2, w, h };
}

export interface PlacementContext {
  /** Every component already resolved for this drawing (used both as a
   * hard obstacle and to derive each one's own name-label footprint). */
  components: ComponentSpec[];
  /** Every dimension already resolved (span + label treated as obstacles). */
  dimensions: DimensionLine[];
  /** Every annotation line already queued (diagonal leaders, panel lines,
   * name leaders, ...) — labelled ones are treated as obstacles. */
  lines: AnnotationLine[];
  /** The drawing's own known extent so callouts prefer staying within it
   * rather than drifting arbitrarily far — not a hard limit (per the
   * "search a larger surrounding area" fallback), just the first choice. */
  worldWidth: number;
  worldHeight: number;
}

/** A component's own rendered NAME footprint. CanonicalSvg draws a small
 * component's name either centred inside its own box OR, when it's too
 * small, on a short leader out to EITHER side (whichever is nearer the
 * canvas centre) — this module doesn't replicate that leader-direction
 * logic exactly, so it conservatively reserves a footprint straddling
 * BOTH the component's own box and a margin band to each side, generous
 * enough to cover either real outcome. Scaled through mmPerPx since the
 * name always renders at the same fixed screen-px size CanonicalSvg uses
 * for its NoteBox/dimension text. */
function componentNameFootprint(c: ComponentSpec, mmPerPx: number): Rect | null {
  if (!c.label || !c.visible) return null;
  const first = c.label.split('\n')[0].trim();
  if (!first) return null;
  const nameW = (first.length * CHAR_W_PX + PAD_X_PX * 2) * mmPerPx;
  const nameH = (LINE_H_PX + PAD_Y_PX) * mmPerPx;
  const marginReach = (24 * 4.4 + 30) * mmPerPx; // CanonicalSvg's own small-component leader "STUB" reach, generously covered
  const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
  const halfW = Math.max(c.width / 2, nameW / 2) + marginReach;
  const halfH = Math.max(c.height / 2, nameH / 2);
  return { x: cx - halfW, y: cy - halfH, w: halfW * 2, h: halfH * 2 };
}

const CLEARANCE_PX = 10; // fixed screen-px breathing room kept around every obstacle

/** Split so a callout BOX is kept clear of everything (body, name,
 * dimension, line), but a leader LINE only ever gets vetoed for crossing
 * real component geometry (`bodyObstacles`) — the CORE RULE's "component
 * geometry must never be covered" — not for merely grazing a dimension's
 * label or another line's caption. Vetoing a leader against every
 * annotation too was far too strict: in a dense drawing almost any leader
 * of useful length grazes SOME label, so every nearby ring candidate got
 * rejected and callouts were pushed to a distant fallback with long ugly
 * leaders instead of the short, slightly-imperfect ones a real drafter
 * would accept. */
function buildObstacles(ctx: PlacementContext, exclude: Set<string>, mmPerPx: number): { bodyObstacles: Rect[]; boxObstacles: Rect[] } {
  const clearance = CLEARANCE_PX * mmPerPx;
  const bodyObstacles: Rect[] = [];
  const boxObstacles: Rect[] = [];
  for (const c of ctx.components) {
    if (!c.visible || exclude.has(c.id)) continue;
    const body = { x: c.x - clearance, y: c.y - clearance, w: c.width + clearance * 2, h: c.height + clearance * 2 };
    bodyObstacles.push(body);
    boxObstacles.push(body);
    const nameFp = componentNameFootprint(c, mmPerPx);
    if (nameFp) boxObstacles.push(nameFp);
  }
  for (const d of ctx.dimensions) boxObstacles.push(dimensionFootprint(d, mmPerPx));
  for (const l of ctx.lines) {
    const fp = lineFootprint(l, mmPerPx);
    if (fp) boxObstacles.push(fp);
  }
  return { bodyObstacles, boxObstacles };
}

/**
 * Places every requested callout box in genuinely free space, closest to
 * its own component first, searching outward (8-directional, then a wider
 * ring) until a collision-free spot is found against every obstacle
 * placed so far — including EARLIER callouts in this same call, so two
 * callouts never land on each other either.
 */
export function placeNoteBoxes(requests: CalloutRequest[], ctx: PlacementContext): NoteBox[] {
  // The REAL render scale this drawing will end up at — every fixed-px
  // metric (label sizes, dimension tier steps, clearance) is converted
  // through this, never assumed to already be in world-mm.
  const maxTier = Math.max(0, ...ctx.dimensions.map((d) => d.tier));
  const scale = computeRenderScale(ctx.worldWidth, ctx.worldHeight, maxTier);
  const mmPerPx = 1 / Math.max(scale, 1e-6);
  const clearance = CLEARANCE_PX * mmPerPx;

  const componentIds = new Set(requests.map((r) => r.id));
  const { bodyObstacles, boxObstacles } = buildObstacles(ctx, componentIds, mmPerPx);
  // Also treat every OTHER callout's own component as a hard obstacle
  // (already included above via ctx.components using their real ids —
  // callers pass the same ComponentSpec[] that contains these boxes).
  const placedCallouts: Rect[] = [];

  const results: NoteBox[] = [];
  for (const req of requests) {
    const { w: boxW, h: boxH } = calloutSize(req.title, req.lines, mmPerPx);
    const cb = req.componentBounds;
    const cx = cb.x + cb.w / 2, cy = cb.y + cb.h / 2;
    // Anchor defaults to the component's own centre; refined per-candidate
    // below to the edge nearest the chosen side.
    const baseAnchor = req.anchor ?? { x: cx, y: cy };

    // Candidate generation: 8 directions around the component at
    // increasing "rings" of distance, per the spec's own priority order
    // (beside → above/below → opposite → further out). Distance is
    // measured from the component's own edge, not its centre, so a
    // wide/tall component doesn't force an unnecessarily large gap.
    type Dir = { dx: number; dy: number; edge: 'left' | 'right' | 'top' | 'bottom' };
    const dirs: Dir[] = [
      { dx: 1, dy: 0, edge: 'right' },
      { dx: -1, dy: 0, edge: 'left' },
      { dx: 0, dy: 1, edge: 'bottom' },
      { dx: 0, dy: -1, edge: 'top' },
      { dx: 1, dy: 1, edge: 'right' },
      { dx: 1, dy: -1, edge: 'right' },
      { dx: -1, dy: 1, edge: 'left' },
      { dx: -1, dy: -1, edge: 'left' },
    ];
    const rings = [40, 80, 130, 200, 300, 450, 650, 900, 1300];

    // Two-tier search: prefer a candidate whose leader avoids crossing any
    // OTHER component's real body entirely, but in a dense composite (many
    // small components clustered together — Storage/Open Box/Top Panel/
    // Study Table's own Storage all crowding one corner) NO nearby ring
    // candidate may satisfy that in every direction, which used to fall
    // straight to the far-below fallback: every callout piling up well
    // past the whole drawing with very long, near-parallel leaders — a
    // much worse result than one short leader grazing a neighbour's edge.
    // requireCleanLeader:true is tried first (closest, cleanest); only if
    // it finds nothing across every ring does the loop retry the SAME
    // rings/directions with that requirement dropped, so a nearby-but-
    // imperfect placement always wins over a distant "clean" one.
    const tryFind = (requireCleanLeader: boolean): { x: number; y: number; anchor: { x: number; y: number } } | null => {
      for (const gap of rings) {
        for (const dir of dirs) {
          // Position the callout box's near corner `gap` world-mm past the
          // component's own edge in this direction.
          let bx: number, by: number;
          if (dir.dx === 1) bx = cb.x + cb.w + gap;
          else if (dir.dx === -1) bx = cb.x - gap - boxW;
          else bx = cx - boxW / 2;
          if (dir.dy === 1) by = cb.y + cb.h + gap;
          else if (dir.dy === -1) by = cb.y - gap - boxH;
          else by = cy - boxH / 2;

          const candidate: Rect = { x: bx, y: by, w: boxW, h: boxH };
          const collides =
            boxObstacles.some((o) => rectsOverlap(candidate, o)) ||
            placedCallouts.some((o) => rectsOverlap(candidate, o, clearance));
          if (collides) continue;

          // Anchor: the component edge point closest to the chosen box.
          const anchor =
            dir.edge === 'right' ? { x: cb.x + cb.w, y: Math.min(Math.max(by + boxH / 2, cb.y), cb.y + cb.h) } :
            dir.edge === 'left' ? { x: cb.x, y: Math.min(Math.max(by + boxH / 2, cb.y), cb.y + cb.h) } :
            dir.edge === 'bottom' ? { x: Math.min(Math.max(bx + boxW / 2, cb.x), cb.x + cb.w), y: cb.y + cb.h } :
            { x: Math.min(Math.max(bx + boxW / 2, cb.x), cb.x + cb.w), y: cb.y };

          // The leader line itself (anchor -> this box's own centre, same
          // point CanonicalSvg draws to) must never cut across any OTHER
          // already-placed callout box, or an earlier box's own leader
          // would read as pointing into/through this one — this check
          // always applies, in both tiers. Box-vs-box rect checks above
          // don't catch this on their own: a box can be placed clear of
          // every obstacle while the thin line connecting it to its
          // component still crosses right over a neighbour.
          const leaderHitsPlaced = placedCallouts.some((o) => segmentHitsRect(anchor.x, anchor.y, bx + boxW / 2, by + boxH / 2, o, clearance));
          if (leaderHitsPlaced) continue;

          // Only in the first tier: also require the leader avoid every
          // OTHER component's real body (never dimensions/names/lines —
          // those are thin annotation ink a short leader may reasonably
          // graze). This is the CORE RULE's actual concern (component
          // geometry never covered) — but treated as a preference, not an
          // absolute veto, since a dense cluster can leave no ring
          // candidate satisfying it at all. bodyObstacles already excludes
          // every requested component's own box (see buildObstacles'
          // `exclude`), so a leader is never rejected for crossing the
          // very component it points at.
          if (requireCleanLeader) {
            const leaderHitsBody = bodyObstacles.some((o) => segmentHitsRect(anchor.x, anchor.y, bx + boxW / 2, by + boxH / 2, o));
            if (leaderHitsBody) continue;
          }

          return { x: bx, y: by, anchor };
        }
      }
      return null;
    };

    let placed = tryFind(true) ?? tryFind(false);
    // Last-resort fallback (should be unreachable in practice given the
    // ring sizes above): keep the component's own preferred anchor and
    // push far below the whole drawing, still collision-checked against
    // callouts placed so far only (never silently on top of geometry).
    if (!placed) {
      let by = ctx.worldHeight + 40;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const candidate: Rect = { x: cx - boxW / 2, y: by, w: boxW, h: boxH };
        if (!placedCallouts.some((o) => rectsOverlap(candidate, o, clearance))) { placed = { x: candidate.x, y: candidate.y, anchor: baseAnchor }; break; }
        by += boxH + clearance;
      }
    }

    placedCallouts.push({ x: placed.x - clearance, y: placed.y - clearance, w: boxW + clearance * 2, h: boxH + clearance * 2 });
    // The leader line CanonicalSvg draws from the anchor point to this
    // box's own edge midpoint is real ink too — without reserving its own
    // thin corridor as an obstacle, a LATER callout in this same pass can
    // still be placed directly on top of an EARLIER callout's leader line
    // (both boxes individually collision-free, but the connecting line
    // between one of them and its component cuts straight through the
    // other). Reserve a thin rect around that segment, in the same units
    // as every other obstacle here, so later placements steer clear of it.
    const leaderMidX = placed.x + boxW / 2, leaderMidY = placed.y + boxH / 2;
    const lx0 = Math.min(placed.anchor.x, leaderMidX), lx1 = Math.max(placed.anchor.x, leaderMidX);
    const ly0 = Math.min(placed.anchor.y, leaderMidY), ly1 = Math.max(placed.anchor.y, leaderMidY);
    const leaderPad = clearance;
    placedCallouts.push({ x: lx0 - leaderPad, y: ly0 - leaderPad, w: (lx1 - lx0) + leaderPad * 2, h: (ly1 - ly0) + leaderPad * 2 });
    results.push({
      id: req.id, x: placed.x, y: placed.y, title: req.title, lines: req.lines, color: req.color,
      anchor: placed.anchor,
    });
  }
  return results;
}
