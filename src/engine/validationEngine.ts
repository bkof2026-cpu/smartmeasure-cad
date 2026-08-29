import type { ComponentSpec, DimensionLine, MeasurementValues, ValidationIssue } from './types';
import { verifyDimensionsMatchGeometry } from './dimensionEngine';

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export interface MeasurementFieldLike {
  key: string;
  label: string;
  min?: number;
  max?: number;
}

/** Positive-dimension + min/max checks against the fields a design declares. */
export function validateMeasurements(values: MeasurementValues, fields: MeasurementFieldLike[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const field of fields) {
    const value = values[field.key];
    if (value === undefined || !Number.isFinite(value)) {
      issues.push({ id: nextId('val'), severity: 'CRITICAL', code: 'MISSING_VALUE', message: `${field.label} is missing or not a number.` });
      continue;
    }
    if (value <= 0) {
      issues.push({ id: nextId('val'), severity: 'CRITICAL', code: 'NON_POSITIVE', message: `${field.label} must be greater than zero (got ${value}).` });
    }
    if (field.min !== undefined && value < field.min) {
      issues.push({ id: nextId('val'), severity: 'ERROR', code: 'BELOW_MIN', message: `${field.label} (${value}) is below the minimum of ${field.min}.` });
    }
    if (field.max !== undefined && value > field.max) {
      issues.push({ id: nextId('val'), severity: 'ERROR', code: 'ABOVE_MAX', message: `${field.label} (${value}) exceeds the maximum of ${field.max}.` });
    }
  }
  return issues;
}

/**
 * Component-sum-equals-overall identity check: components positioned inside
 * a view must not extend past the declared world bounds. Catches the
 * "wardrobe section widths exceed overall width" class of error before PDF.
 */
export function validateComponentBounds(components: ComponentSpec[], worldWidth: number, worldHeight: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const TOLERANCE = 1; // mm
  for (const c of components) {
    if (!c.visible) continue;
    if (c.x < -TOLERANCE || c.y < -TOLERANCE || c.x + c.width > worldWidth + TOLERANCE || c.y + c.height > worldHeight + TOLERANCE) {
      issues.push({
        id: nextId('val'),
        severity: 'CRITICAL',
        code: 'COMPONENT_OUT_OF_BOUNDS',
        message: `${c.label} (${c.type}) extends outside the overall drawing bounds — check its formula/position.`,
      });
    }
  }
  return issues;
}

/** Runs the dimension-geometry identity check and reports any mismatch as CRITICAL. */
export function validateDimensionIntegrity(dims: DimensionLine[]): ValidationIssue[] {
  return verifyDimensionsMatchGeometry(dims).map((message) => ({
    id: nextId('val'),
    severity: 'CRITICAL' as const,
    code: 'DIMENSION_GEOMETRY_MISMATCH',
    message,
  }));
}

/** True when any CRITICAL issue exists — this is what must block PDF generation. */
export function hasCriticalIssues(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'CRITICAL');
}

export function notConfiguredIssue(productType: string, designId: string): ValidationIssue {
  return {
    id: nextId('val'),
    severity: 'CRITICAL',
    code: 'NOT_CONFIGURED',
    message: `No verified design definition exists for ${productType} / "${designId}" yet. Showing this design would require guessing its construction — refusing rather than inventing one.`,
  };
}
