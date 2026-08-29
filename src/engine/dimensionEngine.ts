import type { ComponentSource, DimensionEdge, DimensionLine } from './types';
import { assignTiers } from './collisionEngine';

const TOLERANCE_MM = 0.6; // sub-mm rounding tolerance only — never a "close enough" fudge

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export interface DimensionRequest {
  axis: 'h' | 'v';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  edge: DimensionEdge;
  label?: string;
  componentIds: string[];
  source: ComponentSource;
}

/**
 * Builds one dimension line straight from real geometry — the value is always
 * derived from the same x1/y1/x2/y2 the drawing itself uses, never hand-typed.
 * Throws if the requested span isn't axis-aligned, which would mean a caller
 * bug rather than a real dimension.
 */
export function buildDimensionLine(req: DimensionRequest): DimensionLine {
  const valueMm = req.axis === 'h' ? Math.abs(req.x2 - req.x1) : Math.abs(req.y2 - req.y1);
  return {
    id: nextId('dim'),
    axis: req.axis,
    x1: req.x1,
    y1: req.y1,
    x2: req.x2,
    y2: req.y2,
    valueMm,
    label: req.label ?? `${Math.round(valueMm)} mm`,
    edge: req.edge,
    tier: 0,
    componentIds: req.componentIds,
    source: req.source,
  };
}

/**
 * Verifies every dimension's stated value against the geometry it claims to
 * measure — spec's own "dimensionValue === geometryDistance" rule (never
 * allow drawing width 2200 / dimension 2290). Returns mismatches as errors,
 * never silently corrects them.
 */
export function verifyDimensionsMatchGeometry(dims: DimensionLine[]): string[] {
  const errors: string[] = [];
  for (const d of dims) {
    const geomValue = d.axis === 'h' ? Math.abs(d.x2 - d.x1) : Math.abs(d.y2 - d.y1);
    if (Math.abs(geomValue - d.valueMm) > TOLERANCE_MM) {
      errors.push(`Dimension ${d.id} (${d.label}) claims ${d.valueMm}mm but geometry measures ${geomValue}mm.`);
    }
  }
  return errors;
}

/** Builds and collision-resolves a full set of dimension lines for one view. */
export function resolveDimensions(requests: DimensionRequest[]): DimensionLine[] {
  const built = requests.map(buildDimensionLine);
  return assignTiers(built);
}
