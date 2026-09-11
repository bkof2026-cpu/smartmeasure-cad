import type { DimensionLine, DimensionEdge } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Stacked-offset collision avoidance for dimension lines.
//
// Every dimension line is already placed OUTSIDE the component bounds it
// measures (dimensionEngine.ts guarantees that). This engine's only job is:
// on a given edge, if two dimension lines' spans overlap, they cannot share
// the same offset tier (they'd draw on top of each other / their labels would
// collide) — so give the later one the next tier out. Non-overlapping spans
// on the same edge can safely share tier 0.
//
// This directly fixes the Bed screenshot bug: 1650 / 1200 / 450 all landed on
// the same right-edge offset with overlapping spans.
// ─────────────────────────────────────────────────────────────────────────────

function spanOf(line: DimensionLine): [number, number] {
  return line.axis === 'h'
    ? [Math.min(line.x1, line.x2), Math.max(line.x1, line.x2)]
    : [Math.min(line.y1, line.y2), Math.max(line.y1, line.y2)];
}

// The coordinate a dimension is OFFSET along (perpendicular to its own
// line): a horizontal dim is offset in Y, a vertical dim in X. Two dims
// on the same edge whose base positions here are far apart are physically
// nowhere near each other and must NOT tier against one another (e.g. the
// main Loft's left-edge "H" arrow vs an L-Shaped Wall B loft's own
// left-edge arrows several hundred mm further out).
function basePos(line: DimensionLine): number {
  return line.axis === 'h' ? (line.y1 + line.y2) / 2 : (line.x1 + line.x2) / 2;
}

function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

// A dimension is part of a "chain" (per-door width ticks etc.) if its
// label is a bare number — those are meant to sit edge-to-edge on one
// tier and must NOT be pushed apart by label-collision padding.
function isChainTick(line: DimensionLine): boolean {
  return /^[\d.]+$/.test(line.label.trim());
}

// Dims on the same edge but with base positions more than this far apart
// (world mm) are treated as separate clusters — each cluster tiers
// independently from tier 0.
const CLUSTER_GAP_MM = 140;

export function assignTiers(lines: DimensionLine[]): DimensionLine[] {
  const byEdge = new Map<DimensionEdge, DimensionLine[]>();
  for (const line of lines) {
    const list = byEdge.get(line.edge) ?? [];
    list.push(line);
    byEdge.set(line.edge, list);
  }

  const result: DimensionLine[] = [];
  for (const [, edgeGroup] of byEdge) {
    // Split the edge's dims into spatial clusters by their base position,
    // so a far-away group starts its own tier count from 0.
    const byBase = [...edgeGroup].sort((a, b) => basePos(a) - basePos(b));
    const clusters: DimensionLine[][] = [];
    for (const line of byBase) {
      const last = clusters[clusters.length - 1];
      if (last && Math.abs(basePos(line) - basePos(last[last.length - 1])) <= CLUSTER_GAP_MM) {
        last.push(line);
      } else {
        clusters.push([line]);
      }
    }
    for (const group of clusters) {
      // Sort by span start so tiering is deterministic and stable across re-renders.
      const sorted = [...group].sort((a, b) => spanOf(a)[0] - spanOf(b)[0]);
      const placedByTier: Array<Array<[number, number]>> = [];
      for (const line of sorted) {
        const raw = spanOf(line);
        // For a real (non-chain) labelled dimension, pad the span by
        // roughly half its label's rendered footprint on EACH side, so
        // two dims whose lines don't overlap but whose LABELS would
        // (near-adjacent small components — the "measurements behind each
        // other" case) get tiered apart. Chain ticks keep their raw span
        // so a per-door row stays on one tier.
        const pad = isChainTick(line) ? 0 : Math.min(line.label.length * 3 + 6, 70);
        const test: [number, number] = [raw[0] - pad, raw[1] + pad];
        let tier = 0;
        // First tier where this span doesn't overlap anything placed.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const placed = placedByTier[tier] ?? [];
          if (!placed.some((existing) => overlaps(existing, test))) {
            placed.push(test);
            placedByTier[tier] = placed;
            break;
          }
          tier++;
        }
        result.push({ ...line, tier });
      }
    }
  }
  return result;
}
