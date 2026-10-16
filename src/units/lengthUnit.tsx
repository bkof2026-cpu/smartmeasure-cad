import React, { useSyncExternalStore } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Measurement entry unit — MM or Inch. ONE shared preference for every
// measurement field of every product: picking Inch on any field's unit
// dropdown switches every other field to Inch too. Only the form's DISPLAY
// and ENTRY change — every stored measurement (dims, addonDims, kitchen
// model), formula, drawing, cutlist and PDF stays in millimetres, so
// switching units never alters a saved value or a calculation.
// ─────────────────────────────────────────────────────────────────────────────

export type LengthUnit = 'mm' | 'in';

export const MM_PER_INCH = 25.4;
const STORAGE_KEY = 'smartmeasure.lengthUnit';

function readStored(): LengthUnit {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'in' ? 'in' : 'mm';
  } catch {
    return 'mm';
  }
}

let current: LengthUnit = typeof window === 'undefined' ? 'mm' : readStored();
const listeners = new Set<() => void>();

export function getLengthUnit(): LengthUnit {
  return current;
}

export function setLengthUnit(unit: LengthUnit): void {
  if (unit === current) return;
  current = unit;
  try {
    localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    // Storage unavailable (private mode etc.) — the choice still applies for this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current shared entry unit; re-renders the caller whenever any field changes it. */
export function useLengthUnit(): LengthUnit {
  return useSyncExternalStore(subscribe, getLengthUnit, () => 'mm');
}

/** Rounds away float noise (e.g. 72 × 25.4 = 1828.8000000000002) without hiding real decimals. */
function clean(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

/** A stored millimetre value → the number shown in the field for `unit`. */
export function mmToDisplay(mm: number, unit: LengthUnit): number {
  if (!Number.isFinite(mm)) return mm;
  return unit === 'in' ? clean(mm / MM_PER_INCH, 2) : clean(mm, 2);
}

/** A number typed in `unit` → the millimetre value that gets stored. */
export function displayToMm(value: number, unit: LengthUnit): number {
  if (!Number.isFinite(value)) return value;
  return unit === 'in' ? clean(value * MM_PER_INCH, 2) : value;
}

export function unitLabel(unit: LengthUnit): string {
  return unit === 'in' ? 'inch' : 'mm';
}

/** "1828.8 mm" / "72 inch" — a read-only millimetre value shown in the current unit. */
export function formatLength(mm: number, unit: LengthUnit, decimals = 1): string {
  const v = unit === 'in' ? mm / MM_PER_INCH : mm;
  return `${clean(v, unit === 'in' ? 2 : decimals)} ${unitLabel(unit)}`;
}

/** A millimetre value as an inch label: 2 decimals at most, trailing zeros trimmed, plain ASCII `"` (the PDF fonts are ASCII-only). */
export function inchLabel(mm: number): string {
  return `${clean(mm / MM_PER_INCH, 2)}"`;
}

const NUM = String.raw`(\d+(?:\.\d+)?)`;
const toIn = (s: string) => inchLabel(Number(s));

/**
 * Rewrites a drawing label's millimetre numbers into inches when `unit` is
 * 'in' (unchanged for 'mm'). Every drawing label is generated in mm by the
 * product geometry engines; this is the single display-time conversion the
 * shared renderer applies, so all products switch together. Only numbers
 * that are lengths are converted — counts such as "2 Drawers", "Doors : 2",
 * "6 DOORS", "Box 1" are left alone:
 *   "1800×2000 mm" / "900 × 1800"  → both sides of a size pair
 *   "1000 mm (W)", "(H = 436mm)"   → any number followed by mm
 *   "2000 (W)", "1143"             → a label that starts with a bare number
 *   "H : 400"                      → H/W/D/L note-box rows
 *   "Box 1 — 330", "(298 ea.)"     → per-box / per-door widths
 */
export function convertLabelUnits(label: string, unit: LengthUnit): string {
  if (unit !== 'in' || !label || !/\d/.test(label)) return label;
  return label
    .replace(new RegExp(`${NUM}(\\s*[×x]\\s*)${NUM}(?:\\s*mm\\b)?`, 'g'), (_m, a, sep, b) => `${toIn(a)}${sep}${toIn(b)}`)
    .replace(new RegExp(`${NUM}\\s*mm\\b`, 'g'), (_m, a) => toIn(a))
    .replace(new RegExp(`^${NUM}(?=\\s*\\(|$)`), (_m, a) => toIn(a))
    .replace(new RegExp(`\\b([HWDL])\\s*:\\s*${NUM}(?!["\\d])`, 'g'), (_m, k, a) => `${k} : ${toIn(a)}`)
    .replace(new RegExp(`—\\s*${NUM}$`), (_m, a) => `— ${toIn(a)}`)
    .replace(new RegExp(`\\(${NUM} ea\\.\\)`, 'g'), (_m, a) => `(${toIn(a)} ea.)`);
}

/**
 * The per-field unit dropdown that replaces the old static "mm" badge.
 * Every instance is bound to the same shared preference, so changing one
 * changes them all.
 */
export function UnitSelect({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const unit = useLengthUnit();
  return (
    <select
      value={unit}
      onChange={(e) => setLengthUnit(e.target.value === 'in' ? 'in' : 'mm')}
      aria-label="Measurement unit"
      title="Measurement unit — applies to every field"
      className={className ?? 'text-xs px-1 rounded outline-none cursor-pointer'}
      style={style ?? { background: '#131b27', color: '#94a3b8', border: '1px solid #243045' }}
    >
      <option value="mm">mm</option>
      <option value="in">inch</option>
    </select>
  );
}
