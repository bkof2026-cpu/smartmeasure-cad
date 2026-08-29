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
  return line.axis === 'h' ? [Math.min(line.x1, line.x2), Math.max(line.x1, line.x2)] : [Math.min(line.y1, line.y2), Math.max(line.y1, line.y2)];
}

function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

export function assignTiers(lines: DimensionLine[]): DimensionLine[] {
  const byEdge = new Map<DimensionEdge, DimensionLine[]>();
  for (const line of lines) {
    const list = byEdge.get(line.edge) ?? [];
    list.push(line);
    byEdge.set(line.edge, list);
  }

  const result: DimensionLine[] = [];
  for (const [, group] of byEdge) {
    // Sort by span start so tiering is deterministic and stable across re-renders.
    const sorted = [...group].sort((a, b) => spanOf(a)[0] - spanOf(b)[0]);
    const placedByTier: Array<Array<[number, number]>> = [];
    for (const line of sorted) {
      const span = spanOf(line);
      let tier = 0;
      // Find the first tier where this span doesn't overlap anything already placed.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const placed = placedByTier[tier] ?? [];
        if (!placed.some((existing) => overlaps(existing, span))) {
          placed.push(span);
          placedByTier[tier] = placed;
          break;
        }
        tier++;
      }
      result.push({ ...line, tier });
    }
  }
  return result;
}
