import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { IShapeKitchenDrawing } from '../products/kitchen/IShapeKitchenDrawing';
import { LShapeKitchenDrawing } from '../products/kitchen/LShapeKitchenDrawing';
import type { KitchenWallConfig, WallSideKadappaOption } from '../store/types';
import { TROLLEY_TEMPLATES } from '../products/kitchen/trolleyTemplates';
import { buildKadappaSequence, buildClearSegments, resolveTrolleySectionId } from '../products/kitchen/iShapeKitchenGeometry';
import { calculateTrolleyDimensions } from '../products/kitchen/trolleyDimensions';
import { calculateSideSectionDoors, calculateInnerSectionDoors } from '../products/kitchen/sideSectionDoorCalc';
import { logDrawingEvent } from '../auth/authClient';
import { mountOffscreenSvgs } from '../pdf/mountOffscreen';
import { generateAndDownloadSingleProductPdf } from '../pdf/pdfEngine';
import { MyStatsPanel } from './ProductFlow';

// ─────────────────────────────────────────────────────────────────────────────
// The whole Kitchen product lives on ONE screen now — a simple
// MEASUREMENTS | DRAWING tab pair, same convention every other product
// (Bed, Wardrobe, ...) already uses via ProductFlow.tsx. Replaces the old
// two-SCREEN KitchenSteps.tsx -> LiveDrawing.tsx flow (which had no way
// back from the drawing to the wizard) and strips the old drawing
// screen's Measure/Evidence/AI panels, Cabinet Modules editor, Versions
// panel, Final Drawing button, and SVG export — per the user's explicit
// "I just want the drawing module and the new module of selecting the
// kitchen type, features and measurements" instruction. Applies to every
// Kitchen shape, not just I-Shape.
// ─────────────────────────────────────────────────────────────────────────────

type KitchenTab = 'measurements' | 'drawing' | 'evidence' | 'pdf' | 'history' | 'my-stats';

const TOTAL_STEPS = 3;
const STEP_LABELS = ['Kitchen Type', 'Trolley', 'Features'];

// Total Kitchen Height — per the user's explicit instruction, whatever is
// TYPED into this field has a fixed 15mm deducted immediately, and the
// FIELD ITSELF then holds and displays that adjusted value (not the raw
// entry) — the same single number is what every downstream formula reads
// as iShape.height, so there is no separate "raw vs adjusted" pair to
// track anywhere else in the Kitchen engine. Re-editing the field edits
// the adjusted value directly (typing the same number again deducts
// another 15mm), matching the user's own confirmed "the box just shows
// the adjusted value afterward" behaviour (originally applied to Width,
// corrected to Height per the user's own follow-up).
const TOTAL_KITCHEN_HEIGHT_DEDUCTION_MM = 15;

function StepHeader({ step, total }: { step: number; total: number }) {
  return (
    <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: '#2a3347' }}>
      <div className="flex items-center gap-2 mb-3">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1.5 rounded-full"
            style={{ background: i < step ? '#3b82f6' : i === step - 1 ? '#60a5fa' : '#2a3347' }}
          />
        ))}
      </div>
      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#64748b' }}>
        Step {step} of {total}
      </p>
      <h2 className="text-lg font-bold" style={{ color: '#e2e8f0' }}>
        {STEP_LABELS[step - 1]}
      </h2>
    </div>
  );
}

function BigButton({ label, selected, onClick, color }: { label: string; selected: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-5 rounded-xl font-bold text-base transition-all"
      style={{
        background: selected ? (color ?? '#1d4ed8') : '#1e2535',
        color: selected ? '#fff' : '#94a3b8',
        border: selected ? `2px solid ${color ?? '#3b82f6'}` : '2px solid #2a3347',
      }}
    >
      {label}
    </button>
  );
}

function NumInput({ label, value, onChange, unit = 'mm', note, required }: {
  label: string; value: number; onChange: (v: number) => void; unit?: string; note?: string; required?: boolean;
}) {
  // Tracks the field's own raw text so a user clearing it to type a new
  // value sees a genuinely empty box, rather than "0" reappearing on every
  // keystroke — but WITHOUT silently writing 0 into the stored measurement
  // (spec: "must be able to become empty ... do not silently insert 0").
  // Only syncs FROM the prop when it's not actively being edited (e.g. the
  // model was updated from elsewhere — Trolley change resetting spoValues,
  // demo load, etc.) so external updates still show up correctly.
  const [draft, setDraft] = React.useState<string | null>(null);
  const displayValue = draft !== null ? draft : (value || value === 0 ? String(value || '') : '');
  const isEmpty = displayValue === '';
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center justify-between gap-1">
        <label className="text-[10px] font-bold tracking-widest uppercase truncate" style={{ color: '#94a3b8' }}>{label}</label>
        <span className="text-[10px] font-mono shrink-0" style={{ color: '#475569' }}>{unit}</span>
      </div>
      <input
        type="number"
        inputMode="numeric"
        value={displayValue}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          if (raw === '') return; // do NOT write 0 while the field is genuinely empty
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => setDraft(null)}
        onWheel={(e) => e.currentTarget.blur()}
        placeholder="0"
        className="w-full min-w-0 rounded-lg px-2 py-2.5 text-base font-mono font-bold outline-none border focus:ring-2 focus:ring-blue-500 text-center"
        style={{ background: '#1e2535', border: `2px solid ${required && isEmpty ? '#dc2626' : '#2a3347'}`, color: '#60a5fa' }}
      />
      {required && isEmpty && (
        <p className="text-xs mt-0.5" style={{ color: '#f87171' }}>⚠ Required</p>
      )}
      {note && <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{note}</p>}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: '#2a3347' }}>
      <span className="text-base font-medium" style={{ color: '#e2e8f0' }}>{label}</span>
      <div className="flex gap-2">
        <BigButton label="YES" selected={value} onClick={() => onChange(true)} color="#065f46" />
        <BigButton label="NO" selected={!value} onClick={() => onChange(false)} color="#7f1d1d" />
      </div>
    </div>
  );
}

// ─── Step 1: Kitchen Type ──────────────────────────────────────────────────────

function Step1({ onNext }: { onNext: () => void }) {
  const { model, setKitchenType } = useApp();
  const types = [
    { id: 'straight', label: 'I-Shape Kitchen', active: true },
    { id: 'l-shape', label: 'L-Shape Kitchen', active: true },
    { id: 'u-shape', label: 'U-Shape Kitchen', active: false },
    { id: 'parallel', label: 'Parallel Kitchen', active: false },
  ] as const;
  const effectiveType = types.find((t) => t.id === model.kitchen.type && t.active) ? model.kitchen.type : 'straight';
  return (
    <div className="flex flex-col gap-4 p-6">
      <p className="text-sm" style={{ color: '#64748b' }}>Select the kitchen shape</p>
      <div className="grid grid-cols-2 gap-3">
        {types.map((t) => (
          <button
            key={t.id}
            disabled={!t.active}
            onClick={() => t.active && setKitchenType(t.id)}
            className="py-5 rounded-xl font-bold text-base transition-all relative"
            style={{
              background: effectiveType === t.id ? '#1d4ed8' : '#1e2535',
              color: effectiveType === t.id ? '#fff' : t.active ? '#94a3b8' : '#374151',
              border: effectiveType === t.id ? '2px solid #3b82f6' : '2px solid #2a3347',
              cursor: t.active ? 'pointer' : 'not-allowed',
            }}
          >
            {t.label}
            {!t.active && (
              <span className="absolute top-1 right-1 text-xs px-1 rounded" style={{ background: '#1e2535', color: '#475569' }}>Soon</span>
            )}
          </button>
        ))}
      </div>
      <button onClick={onNext} className="mt-4 w-full py-4 rounded-xl font-bold text-base" style={{ background: '#3b82f6', color: '#fff' }}>
        Next →
      </button>
    </div>
  );
}

// ─── Step 3: Features ──────────────────────────────────────────────────────────

function WallSideOptionButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-3 rounded-lg font-bold text-sm transition-all"
      style={{
        background: selected ? '#1d4ed8' : '#161b27',
        color: selected ? '#fff' : '#64748b',
        border: `1.5px solid ${selected ? '#3b82f6' : '#2a3347'}`,
      }}
    >
      {label}
    </button>
  );
}

/** §27/§29 validation: sum of Kadappa widths + Clear widths must equal
 * Total Kitchen Width — surfaced here as a live hint so the user sees the
 * mismatch while editing, not just as a drawing-side issue after the fact.
 * Never auto-corrects the user's entered values. */
function WidthSumHint({ iShape, sequence, clearSegments }: {
  iShape: ReturnType<typeof useApp>['model']['kitchen']['iShape'];
  sequence: ReturnType<typeof buildKadappaSequence>;
  clearSegments: ReturnType<typeof buildClearSegments>;
}) {
  const sumKadappa = sequence.reduce((s, k) => s + (k.width || 0), 0);
  const sumClear = clearSegments.reduce((s, seg) => s + (iShape.clearWidths[seg.index] || 0), 0);
  const computed = sumKadappa + sumClear;
  const diff = computed - iShape.width;
  if (Math.abs(diff) <= 1) {
    return <p className="text-xs mt-0.5" style={{ color: '#059669' }}>✓ {Math.round(computed)} mm matches Total Kitchen Width</p>;
  }
  return (
    <p className="text-xs mt-0.5" style={{ color: '#fbbf24' }}>
      ⚠ Kadappa + Clear widths sum to {Math.round(computed)} mm, {diff > 0 ? 'exceeds' : 'is short of'} Total Kitchen Width ({Math.round(iShape.width)} mm) by {Math.round(Math.abs(diff))} mm
    </p>
  );
}

/**
 * The full "measurements + Kadappa layout + Trolley Section/Dimensions +
 * Side Section Doors + Fix Patti" form for ONE kitchen wall — extracted so
 * both I-Shape (a single wall) and L-Shape (Wall A and Wall B, each an
 * independent instance of this exact same form) can reuse it verbatim
 * (LSHAPE_KITCHEN_PLAN.md §10.2: "a prop extraction, not a rewrite of the
 * form bodies"). `iShape` here is a plain KitchenWallConfig — the prop name
 * is kept for continuity with every existing sub-component's own prop type. */
function WallFeaturesForm({ iShape, updateIShapeConfig }: {
  iShape: KitchenWallConfig;
  updateIShapeConfig: (patch: Partial<KitchenWallConfig>) => void;
}) {
  const wallSideOptions: WallSideKadappaOption[] = ['None', 'Left', 'Right', 'Both'];
  const sequence = buildKadappaSequence(iShape);
  const clearSegments = buildClearSegments(iShape, sequence);

  // Keep clearWidths' length in sync with the live segment count whenever
  // the Kadappa configuration changes (§20/§30/§31 — fields must always
  // match the actual physical components, no phantom leftover segments,
  // no missing ones). Existing values are preserved by segment INDEX
  // (best-effort — a removed segment in the middle does shift indices for
  // segments after it, same as removing a Kadappa reconnects the chain).
  React.useEffect(() => {
    if (iShape.clearWidths.length !== clearSegments.length) {
      const next = clearSegments.map((_, i) => iShape.clearWidths[i] ?? 0);
      updateIShapeConfig({ clearWidths: next });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSegments.length]);

  // If the previously selected Trolley Section no longer exists (Kadappa
  // configuration changed), clear it rather than silently moving the
  // Trolley to a different section (§24/§25: never guess a replacement).
  React.useEffect(() => {
    if (iShape.trolleySectionId !== null && !clearSegments.some((s) => s.index === iShape.trolleySectionId)) {
      updateIShapeConfig({ trolleySectionId: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSegments.map((s) => s.index).join(',')]);

  // Kadappa's own WIDTH fields (never a distance) — collected so they
  // render packed 2-per-row instead of each claiming a full-width row.
  // Wall Side (Left/Right) width fields sit right under the Wall Side
  // Kadappa selector they belong to; Inner width fields are kept separate
  // so they can render AFTER "Number of Inner Side Kadappa" instead of
  // appearing above the Yes/No toggle that controls whether they exist.
  const wallKadappaWidthFields: { key: string; label: string; value: number; onChange: (v: number) => void }[] = [];
  if (iShape.wallSideKadappa === 'Left' || iShape.wallSideKadappa === 'Both') {
    wallKadappaWidthFields.push({
      key: 'left-wall', label: 'Kadappa A — Width', value: iShape.leftWallKadappaWidth,
      onChange: (v) => updateIShapeConfig({ leftWallKadappaWidth: v }),
    });
  }
  if (iShape.wallSideKadappa === 'Right' || iShape.wallSideKadappa === 'Both') {
    wallKadappaWidthFields.push({
      key: 'right-wall', label: `Kadappa ${sequence.length > 0 ? sequence[sequence.length - 1].letter : ''} — Width`,
      value: iShape.rightWallKadappaWidth,
      onChange: (v) => updateIShapeConfig({ rightWallKadappaWidth: v }),
    });
  }

  const innerKadappaWidthFields = sequence.filter((s) => s.kind === 'inner').map((slot) => ({
    key: `inner-${slot.innerIndex}`, label: `Kadappa ${slot.letter} — Width`,
    value: iShape.innerKadappaWidths[slot.innerIndex!] ?? 0,
    onChange: (v: number) => {
      const widths = [...iShape.innerKadappaWidths];
      widths[slot.innerIndex!] = v;
      updateIShapeConfig({ innerKadappaWidths: widths });
    },
  }));

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <NumInput
          label="Total Kitchen Height"
          value={iShape.height}
          onChange={(v) => updateIShapeConfig({ height: Math.max(0, v - TOTAL_KITCHEN_HEIGHT_DEDUCTION_MM) })}
          note={iShape.height > 0 ? `Height −${TOTAL_KITCHEN_HEIGHT_DEDUCTION_MM}mm applied — entered value became ${Math.round(iShape.height)}mm.` : undefined}
          required
        />
        <NumInput
          label="Total Kitchen Width"
          value={iShape.width}
          onChange={(v) => updateIShapeConfig({ width: v })}
          required
        />
        <NumInput
          label="Total Kitchen Depth"
          value={iShape.depth}
          onChange={(v) => updateIShapeConfig({ depth: v })}
        />
      </div>

      <div className="h-px" style={{ background: '#2a3347' }} />
      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>Pani Patti</p>
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="Pani Patti Height" value={iShape.paniPattiHeight} onChange={(v) => updateIShapeConfig({ paniPattiHeight: v })} />
      </div>

      <div className="h-px" style={{ background: '#2a3347' }} />
      <div className="py-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-base font-medium" style={{ color: '#e2e8f0' }}>Wall Side Kadappa</span>
        </div>
        <div className="flex gap-2">
          {wallSideOptions.map((opt) => (
            <WallSideOptionButton
              key={opt}
              label={opt}
              selected={iShape.wallSideKadappa === opt}
              onClick={() => updateIShapeConfig({ wallSideKadappa: opt })}
            />
          ))}
        </div>
      </div>

      {wallKadappaWidthFields.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {wallKadappaWidthFields.map((f) => (
            <NumInput key={f.key} label={f.label} value={f.value} onChange={f.onChange} />
          ))}
        </div>
      )}

      <Toggle
        label="Inner Side Kadappa"
        value={iShape.hasInnerKadappa}
        onChange={(v) => updateIShapeConfig({
          hasInnerKadappa: v,
          ...(v && iShape.innerKadappaWidths.length === 0
            ? { innerKadappaCount: iShape.innerKadappaCount || 2, innerKadappaWidths: Array(iShape.innerKadappaCount || 2).fill(0) }
            : {}),
        })}
      />
      {iShape.hasInnerKadappa && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <NumInput
              label="Number of Inner Side Kadappa"
              value={iShape.innerKadappaCount}
              unit="count"
              onChange={(count) => {
                const safeCount = Math.max(1, Math.round(count) || 1);
                const widths = Array.from({ length: safeCount }, (_, i) => iShape.innerKadappaWidths[i] ?? 0);
                updateIShapeConfig({ innerKadappaCount: safeCount, innerKadappaWidths: widths });
              }}
            />
          </div>
          {innerKadappaWidthFields.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {innerKadappaWidthFields.map((f) => (
                <NumInput key={f.key} label={f.label} value={f.value} onChange={f.onChange} />
              ))}
            </div>
          )}
        </>
      )}

      {clearSegments.length > 0 && (
        <>
          <div className="h-px" style={{ background: '#2a3347' }} />
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#059669' }}>Clear / Inside Width</p>
          <div className="grid grid-cols-2 gap-3">
            {clearSegments.map((seg) => (
              <NumInput
                key={seg.index}
                label={seg.label}
                value={iShape.clearWidths[seg.index] ?? 0}
                onChange={(v) => {
                  const next = [...iShape.clearWidths];
                  next[seg.index] = v;
                  updateIShapeConfig({ clearWidths: next });
                }}
              />
            ))}
          </div>
          <WidthSumHint iShape={iShape} sequence={sequence} clearSegments={clearSegments} />
        </>
      )}

      <SideSectionDoorsFrame iShape={iShape} clearSegments={clearSegments} updateIShapeConfig={updateIShapeConfig} />

      <FixPattiFrame iShape={iShape} updateIShapeConfig={updateIShapeConfig} />

      {iShape.trolleyTemplateId && (
        <TrolleySectionPicker iShape={iShape} clearSegments={clearSegments} updateIShapeConfig={updateIShapeConfig} />
      )}

      {iShape.trolleyTemplateId && (
        <TrolleyDimensionsFrame iShape={iShape} clearSegments={clearSegments} updateIShapeConfig={updateIShapeConfig} />
      )}
    </>
  );
}

/** I-Shape's own Step 3 — a single WallFeaturesForm bound straight to
 * model.kitchen.iShape, plus the wizard's own Back/Finish navigation. */
function Step3Features({ onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  const { model, updateIShapeConfig } = useApp();
  return (
    <div className="flex flex-col gap-4 p-6">
      <p className="text-sm" style={{ color: '#64748b' }}>Kitchen measurements and Kadappa layout</p>
      <WallFeaturesForm iShape={model.kitchen.iShape} updateIShapeConfig={updateIShapeConfig} />
      <div className="flex gap-3 mt-2">
        <button onClick={onBack} className="flex-1 py-4 rounded-xl font-bold border" style={{ background: 'transparent', border: '2px solid #2a3347', color: '#94a3b8' }}>← Back</button>
        <button onClick={onFinish} className="flex-1 py-4 rounded-xl font-bold" style={{ background: '#1d4ed8', color: '#fff' }}>View Drawing →</button>
      </div>
    </div>
  );
}

/** Side Section Doors — read-only calculated door count/width for EVERY
 * non-Trolley Clear-Width section, per sideSectionDoorCalc.ts: the two
 * OUTER (wall-adjacent) sections plus any INNER section (between two
 * Kadappa) — per the user's explicit "no trolley kitchen -> only door"
 * correction, an inner section is no longer left with nothing to
 * configure. Only the door COUNT is editable (an override input,
 * defaulting to the auto-recommendation); the door WIDTH is always
 * derived, never a separate field — same "auto-recommended but editable
 * count, always-derived width" pattern as the Loft's own door engine.
 * Never shown for the section the Trolley itself occupies (that section's
 * content is the Trolley Panel, not a plain door). */
function SideSectionDoorsFrame({ iShape, clearSegments, updateIShapeConfig }: {
  iShape: ReturnType<typeof useApp>['model']['kitchen']['iShape'];
  clearSegments: ReturnType<typeof buildClearSegments>;
  updateIShapeConfig: ReturnType<typeof useApp>['updateIShapeConfig'];
}) {
  const resolvedTrolleySectionId = resolveTrolleySectionId(iShape, clearSegments);
  const doorSections = clearSegments.filter((seg) => seg.index !== resolvedTrolleySectionId);
  if (doorSections.length === 0) return null;

  return (
    <>
      <div className="h-px" style={{ background: '#2a3347' }} />
      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#0891b2' }}>Side Section Doors</p>
      <div className="flex flex-col gap-3">
        {doorSections.map((seg) => {
          const isOuter = seg.fromLetter === null || seg.toLetter === null;
          const side: 'left' | 'right' | 'inner' = isOuter ? (seg.fromLetter === null ? 'left' : 'right') : 'inner';
          const override = side === 'inner' ? (iShape.innerSideDoorCountOverrides?.[seg.index] ?? null) : (side === 'left' ? iShape.leftSideDoorCountOverride : iShape.rightSideDoorCountOverride);
          const doors = side === 'inner' ? calculateInnerSectionDoors(iShape, seg, override) : calculateSideSectionDoors(iShape, seg, side, override);
          return (
            <div key={seg.index} className="rounded-xl p-3" style={{ background: '#101825', border: '1px solid #1e2a3d' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold" style={{ color: '#67e8f9' }}>{seg.label} ({Math.round(doors.sectionWidth)}mm){side === 'inner' ? ' — inner' : ''}</span>
                {!doors.valid && <span className="text-xs" style={{ color: '#f87171' }}>⚠ invalid</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumInput
                  label="Number of Doors"
                  value={doors.doorCount}
                  onChange={(v) => updateIShapeConfig(
                    side === 'inner'
                      ? { innerSideDoorCountOverrides: { ...iShape.innerSideDoorCountOverrides, [seg.index]: v } }
                      : (side === 'left' ? { leftSideDoorCountOverride: v } : { rightSideDoorCountOverride: v })
                  )}
                  note={override === null ? `Auto-recommended (${doors.recommendedDoorCount})` : undefined}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>Door Width</label>
                  <div className="rounded-lg px-2 py-2.5 text-base font-mono font-bold text-center" style={{ background: '#1e2535', border: '2px solid #2a3347', color: '#67e8f9' }}>
                    {Math.round(doors.doorWidth)} mm
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                    {side === 'inner'
                      ? `${doors.sectionWidth} − ${doors.leftDeductionMm}mm (Kadappa) − ${doors.rightDeductionMm}mm (Kadappa)`
                      : `${doors.sectionWidth} − 2mm (inner) − ${doors.wallDeductionMm}mm (${doors.hasWallKadappa ? 'wall Kadappa' : 'wall'})`}
                    {doors.doorCount > 1 ? ` − ${(doors.doorCount - 1) * 2}mm (gaps) ÷ ${doors.doorCount}` : ''}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Fix Patti — a real vertical panel attached to the OUTSIDE of the
 * kitchen box, on the chosen side(s). Per the user's explicit spec: a
 * Position selector (None/Left/Right/Both) plus manually-entered Height ×
 * Width per side — defaults shown are Height = Total Kitchen Height,
 * Width = 40mm, but both stay fully editable, never derived. */
function FixPattiFrame({ iShape, updateIShapeConfig }: {
  iShape: ReturnType<typeof useApp>['model']['kitchen']['iShape'];
  updateIShapeConfig: ReturnType<typeof useApp>['updateIShapeConfig'];
}) {
  const positions: { value: typeof iShape.fixPattiPosition; label: string }[] = [
    { value: 'none', label: 'None' }, { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' }, { value: 'both', label: 'Both' },
  ];
  const showLeft = iShape.fixPattiPosition === 'left' || iShape.fixPattiPosition === 'both';
  const showRight = iShape.fixPattiPosition === 'right' || iShape.fixPattiPosition === 'both';

  return (
    <>
      <div className="h-px" style={{ background: '#2a3347' }} />
      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#16a34a' }}>Fix Patti</p>
      <div className="flex gap-2">
        {positions.map((opt) => (
          <WallSideOptionButton
            key={opt.value}
            label={opt.label}
            selected={iShape.fixPattiPosition === opt.value}
            onClick={() => updateIShapeConfig({ fixPattiPosition: opt.value })}
          />
        ))}
      </div>
      {(showLeft || showRight) && (
        <div className="grid grid-cols-2 gap-3 mt-2">
          {showLeft && (
            <>
              <NumInput
                label="Left Fix Patti Height"
                value={iShape.fixPattiLeftHeight || iShape.height}
                onChange={(v) => updateIShapeConfig({ fixPattiLeftHeight: v })}
              />
              <NumInput
                label="Left Fix Patti Width"
                value={iShape.fixPattiLeftWidth || 40}
                onChange={(v) => updateIShapeConfig({ fixPattiLeftWidth: v })}
              />
            </>
          )}
          {showRight && (
            <>
              <NumInput
                label="Right Fix Patti Height"
                value={iShape.fixPattiRightHeight || iShape.height}
                onChange={(v) => updateIShapeConfig({ fixPattiRightHeight: v })}
              />
              <NumInput
                label="Right Fix Patti Width"
                value={iShape.fixPattiRightWidth || 40}
                onChange={(v) => updateIShapeConfig({ fixPattiRightWidth: v })}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}

/** §3/§20/§29-§32: which open Kitchen section gets the Trolley — a real,
 * required, independent choice from Trolley Type, generated dynamically
 * from the actual Kadappa sections. Auto-selects only when exactly one
 * section exists (no ambiguity); otherwise requires an explicit pick and
 * shows the current selection's real Clear Width read-only (§21 — never a
 * duplicate editable field, the site measurement stays the source of
 * truth). */
function TrolleySectionPicker({ iShape, clearSegments, updateIShapeConfig }: {
  iShape: ReturnType<typeof useApp>['model']['kitchen']['iShape'];
  clearSegments: ReturnType<typeof buildClearSegments>;
  updateIShapeConfig: ReturnType<typeof useApp>['updateIShapeConfig'];
}) {
  const resolvedId = resolveTrolleySectionId(iShape, clearSegments);

  if (clearSegments.length === 0) {
    return (
      <>
        <div className="h-px" style={{ background: '#2a3347' }} />
        <p className="text-xs mt-2 px-1" style={{ color: '#fbbf24' }}>
          ⚠ No open Kitchen section is available to place the Trolley in.
        </p>
      </>
    );
  }

  return (
    <>
      <div className="h-px" style={{ background: '#2a3347' }} />
      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#b45309' }}>Trolley Section</p>
      <p className="text-xs" style={{ color: '#64748b' }}>Which Kitchen section should contain the Trolley?</p>
      <div className="flex flex-col gap-2">
        {clearSegments.map((seg) => {
          const isSelected = resolvedId === seg.index;
          return (
            <button
              key={seg.index}
              onClick={() => updateIShapeConfig({ trolleySectionId: seg.index })}
              className="text-left py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-between"
              style={{
                background: isSelected ? '#78350f' : '#161b27',
                color: isSelected ? '#fff' : '#64748b',
                border: `1.5px solid ${isSelected ? '#b45309' : '#2a3347'}`,
              }}
            >
              <span>{seg.label}</span>
              <span className="text-xs font-mono" style={{ color: isSelected ? '#fed7aa' : '#475569' }}>
                {Math.round(iShape.clearWidths[seg.index] ?? 0)} mm
              </span>
            </button>
          );
        })}
      </div>
      {clearSegments.length > 1 && resolvedId === null && (
        <p className="text-xs mt-1 px-1" style={{ color: '#f87171' }}>⚠ Please select the Kitchen section where the Trolley will be installed.</p>
      )}
    </>
  );
}

const DEPTH_DEDUCTION_OPTIONS = [10, 20];

/** Small inline-editable number used inside the compact Trolley Dimensions
 * rows (e.g. Floor Ceiling Patti Height, Final Trolley Depth override) —
 * same "don't silently insert 0 while the box is empty" behavior as
 * NumInput, but sized to sit inline in a single row instead of its own
 * labeled block. */
function InlineNumEdit({ value, onChange, prefix = '', suffix = ' mm' }: {
  value: number; onChange: (v: number) => void; prefix?: string; suffix?: string;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const displayValue = draft !== null ? draft : (value || value === 0 ? String(value) : '');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2 }}>
      {prefix}
      <input
        type="number"
        inputMode="numeric"
        value={displayValue}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          if (raw === '') return;
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => setDraft(null)}
        onWheel={(e) => e.currentTarget.blur()}
        placeholder="0"
        className="text-right font-mono font-bold outline-none rounded"
        style={{ width: 56, background: '#1e2535', border: '1px solid #2a3347', color: '#fbbf24', fontSize: 12, padding: '1px 4px' }}
      />
      {suffix}
    </span>
  );
}

/** The "TROLLEY DIMENSIONS" frame — shows the full Height/Width/Depth
 * calculation chain (source measurement → deduction → final value) with
 * nothing hidden, per the user's explicit "do not hide the deductions"
 * instruction. Uses calculateTrolleyDimensions — the SAME function the
 * drawing engine calls — so this frame and the CAD/PDF can never diverge. */
function TrolleyDimensionsFrame({ iShape, clearSegments, updateIShapeConfig }: {
  iShape: ReturnType<typeof useApp>['model']['kitchen']['iShape'];
  clearSegments: ReturnType<typeof buildClearSegments>;
  updateIShapeConfig: ReturnType<typeof useApp>['updateIShapeConfig'];
}) {
  const resolvedId = resolveTrolleySectionId(iShape, clearSegments);
  const resolvedSection = clearSegments.find((s) => s.index === resolvedId) ?? null;
  const dims = calculateTrolleyDimensions(iShape, resolvedSection);

  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 };
  const labelStyle: React.CSSProperties = { color: '#94a3b8', fontSize: 12 };
  const valueStyle: React.CSSProperties = { color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace' };
  const manualTag = <span style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700, letterSpacing: 1 }}>MANUAL</span>;
  const autoTag = <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, letterSpacing: 1 }}>AUTO</span>;

  return (
    <div className="mt-3 rounded-xl p-4" style={{ background: '#12161f', border: '1.5px solid #2a3347' }}>
      <p className="text-sm font-bold tracking-wide" style={{ color: '#e2e8f0' }}>TROLLEY DIMENSIONS</p>
      <p className="text-xs mb-3" style={{ color: '#64748b' }}>Calculated from Kitchen + Selected Section measurements</p>

      {/* HEIGHT */}
      <div className="flex flex-col gap-1 py-2 border-t" style={{ borderColor: '#2a3347' }}>
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#b45309' }}>Height</p>
        <div style={rowStyle}><span style={labelStyle}>Total Kitchen Height {manualTag}</span><span style={valueStyle}>{Math.round(iShape.height)} mm</span></div>
        <div style={rowStyle}><span style={labelStyle}>Pani Patti Height {manualTag}</span><span style={valueStyle}>− {Math.round(iShape.paniPattiHeight)} mm</span></div>
        <div style={rowStyle}>
          <span style={labelStyle}>Floor Ceiling Patti {manualTag}</span>
          <span style={valueStyle}>
            −{' '}
            <InlineNumEdit
              value={iShape.floorCeilingPattiHeight}
              onChange={(v) => updateIShapeConfig({ floorCeilingPattiHeight: v })}
            />
          </span>
        </div>
        <div style={rowStyle}><span style={labelStyle}>Trolley Height Clearance</span><span style={valueStyle}>− 30 mm</span></div>
        <div style={{ ...rowStyle, marginTop: 2, paddingTop: 4, borderTop: '1px dashed #2a3347' }}>
          <span style={{ ...labelStyle, color: '#e2e8f0', fontWeight: 700 }}>Final Trolley Height {autoTag}</span>
          <span style={{ ...valueStyle, color: '#fbbf24', fontWeight: 700 }}>{Math.round(dims.finalHeight)} mm</span>
        </div>
        {!dims.heightValid && <p className="text-xs" style={{ color: '#f87171' }}>⚠ Final Trolley Height must be greater than 0.</p>}
      </div>

      {/* WIDTH */}
      <div className="flex flex-col gap-1 py-2 border-t" style={{ borderColor: '#2a3347' }}>
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#b45309' }}>Width</p>
        <div style={rowStyle}><span style={labelStyle}>Trolley Section</span><span style={valueStyle}>{resolvedSection ? resolvedSection.label : '— none selected —'}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Section Inside/Clear Width {manualTag}</span><span style={valueStyle}>{dims.sectionInsideWidth !== null ? `${Math.round(dims.sectionInsideWidth)} mm` : '—'}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Trolley Fit Deduction</span><span style={valueStyle}>− 30 mm</span></div>
        <div style={{ ...rowStyle, marginTop: 2, paddingTop: 4, borderTop: '1px dashed #2a3347' }}>
          <span style={{ ...labelStyle, color: '#e2e8f0', fontWeight: 700 }}>Final Trolley Width {autoTag}</span>
          <span style={{ ...valueStyle, color: '#fbbf24', fontWeight: 700 }}>{dims.finalWidth !== null ? `${Math.round(dims.finalWidth)} mm` : '—'}</span>
        </div>
        {!dims.widthValid && dims.widthInvalidReason && <p className="text-xs" style={{ color: '#f87171' }}>⚠ {dims.widthInvalidReason}</p>}
      </div>

      {/* DEPTH */}
      <div className="flex flex-col gap-1 py-2 border-t" style={{ borderColor: '#2a3347' }}>
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#b45309' }}>Depth</p>
        <div style={rowStyle}><span style={labelStyle}>Total Kitchen Depth {manualTag}</span><span style={valueStyle}>{Math.round(iShape.depth)} mm</span></div>
        <div style={rowStyle}>
          <span style={labelStyle}>Depth Deduction</span>
          <div className="flex gap-1">
            {DEPTH_DEDUCTION_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => updateIShapeConfig({ depthDeduction: d })}
                className="px-2 py-0.5 rounded text-xs font-bold"
                style={{
                  background: (iShape.depthDeduction || 20) === d ? '#b45309' : '#1e2535',
                  color: (iShape.depthDeduction || 20) === d ? '#fff' : '#64748b',
                  border: `1px solid ${(iShape.depthDeduction || 20) === d ? '#b45309' : '#2a3347'}`,
                }}
              >
                {d} mm
              </button>
            ))}
          </div>
        </div>
        <div style={{ ...rowStyle, marginTop: 2, paddingTop: 4, borderTop: '1px dashed #2a3347' }}>
          <span style={{ ...labelStyle, color: '#e2e8f0', fontWeight: 700 }}>
            Final Trolley Depth {iShape.trolleyDepthOverride !== null ? manualTag : autoTag}
          </span>
          <span style={{ ...valueStyle, color: '#fbbf24', fontWeight: 700, display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
            <InlineNumEdit
              value={Math.round(dims.finalDepth)}
              onChange={(v) => updateIShapeConfig({ trolleyDepthOverride: v })}
            />
            {iShape.trolleyDepthOverride !== null && (
              <button
                onClick={() => updateIShapeConfig({ trolleyDepthOverride: null })}
                className="text-xs font-bold"
                style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                title="Reset to calculated value"
              >
                reset
              </button>
            )}
          </span>
        </div>
        {!dims.depthValid && dims.depthInvalidReason && <p className="text-xs" style={{ color: '#f87171' }}>⚠ {dims.depthInvalidReason}</p>}
      </div>

      {/* FINAL SUMMARY */}
      <div className="mt-3 rounded-lg p-3 text-center" style={{ background: '#1c1408', border: '1.5px solid #b45309' }}>
        <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#b45309' }}>Final Trolley Size</p>
        <p className="text-lg font-mono font-bold" style={{ color: '#fbbf24' }}>
          H {Math.round(dims.finalHeight)} × W {dims.finalWidth !== null ? Math.round(dims.finalWidth) : '—'} × D {Math.round(dims.finalDepth)} mm
        </p>
      </div>
    </div>
  );
}

// ─── Step 2: Trolley Type ──────────────────────────────────────────────────────

/** Trolley Type selector for ONE kitchen wall — extracted (same pattern as
 * WallFeaturesForm above) so L-Shape's Wall A / Wall B each get their own
 * independent Trolley Type choice via this exact same form
 * (LSHAPE_KITCHEN_PLAN.md §10.2/§11: each wall's Trolley selection is fully
 * independent, reusing the same 9-template registry unmodified). */
function WallTrolleyTypeForm({ iShape, updateIShapeConfig }: {
  iShape: KitchenWallConfig;
  updateIShapeConfig: (patch: Partial<KitchenWallConfig>) => void;
}) {
  const templates = Object.values(TROLLEY_TEMPLATES);
  const selected = iShape.trolleyTemplateId ? TROLLEY_TEMPLATES[iShape.trolleyTemplateId] ?? null : null;

  const selectTemplate = (id: string | null) => {
    // Switching Trolley Type never carries old SPO values into the new
    // template's (possibly differently-keyed) fields.
    updateIShapeConfig({ trolleyTemplateId: id, spoValues: {} });
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => selectTemplate(null)}
          className="text-left py-3 px-4 rounded-lg font-bold text-sm transition-all"
          style={{
            background: iShape.trolleyTemplateId === null ? '#1d4ed8' : '#161b27',
            color: iShape.trolleyTemplateId === null ? '#fff' : '#64748b',
            border: `1.5px solid ${iShape.trolleyTemplateId === null ? '#3b82f6' : '#2a3347'}`,
          }}
        >
          No Trolley
        </button>
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => selectTemplate(t.id)}
            className="text-left py-3 px-4 rounded-lg font-bold text-sm transition-all relative"
            style={{
              background: iShape.trolleyTemplateId === t.id ? '#1d4ed8' : '#161b27',
              color: iShape.trolleyTemplateId === t.id ? '#fff' : '#64748b',
              border: `1.5px solid ${iShape.trolleyTemplateId === t.id ? '#3b82f6' : '#2a3347'}`,
            }}
          >
            {t.name}
            {t.incomplete && (
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: '#3f2d0a', color: '#fbbf24' }}>
                Incomplete — no dimensions yet
              </span>
            )}
          </button>
        ))}
      </div>

      {selected && selected.incomplete && (
        <p className="text-xs mt-2 px-1" style={{ color: '#fbbf24' }}>
          ⚠ {selected.name} has no confirmed dimensions yet — its drawing will show a placeholder until real measurements are provided.
        </p>
      )}

      {selected && selected.spoFields.length > 0 && (
        <div className="flex flex-col gap-3 mt-3 p-3 rounded-lg" style={{ background: '#161b27', border: '1px solid #2a3347' }}>
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#9333ea' }}>SPO Measurements</p>
          <div className="grid grid-cols-2 gap-3">
            {selected.spoFields.map((f) => (
              <NumInput
                key={f.key}
                label={f.label}
                value={iShape.spoValues?.[f.key] ?? f.default}
                onChange={(v) => updateIShapeConfig({ spoValues: { ...iShape.spoValues, [f.key]: v } })}
                note={f.min && f.max ? `${f.min}–${f.max}mm` : `default ${f.default}mm`}
              />
            ))}
          </div>
        </div>
      )}

      {iShape.trolleyTemplateId && (
        <p className="text-xs mt-2 px-1" style={{ color: '#64748b' }}>
          You'll choose which Kitchen section the Trolley goes in on the next step (Features).
        </p>
      )}
    </>
  );
}

/** I-Shape's own Step 2 — a single WallTrolleyTypeForm bound straight to
 * model.kitchen.iShape, plus the wizard's own Back/Next navigation. */
function Step2Trolley({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { model, updateIShapeConfig } = useApp();
  return (
    <div className="flex flex-col gap-2 p-6">
      <p className="text-sm mb-2" style={{ color: '#64748b' }}>Select the Trolley Type for this kitchen</p>
      <WallTrolleyTypeForm iShape={model.kitchen.iShape} updateIShapeConfig={updateIShapeConfig} />
      <div className="flex gap-3 mt-4">
        <button onClick={onBack} className="flex-1 py-4 rounded-xl font-bold border" style={{ background: 'transparent', border: '2px solid #2a3347', color: '#94a3b8' }}>← Back</button>
        <button onClick={onNext} className="flex-1 py-4 rounded-xl font-bold" style={{ background: '#3b82f6', color: '#fff' }}>Next →</button>
      </div>
    </div>
  );
}

// ─── L-Shape wizard steps — Wall A / Wall B tabs over the SAME forms ───────────
//
// Per LSHAPE_KITCHEN_PLAN.md §10.2: a small Wall A / Wall B tab selector
// sits above the exact same WallTrolleyTypeForm/WallFeaturesForm I-Shape
// uses, parametrized to read/write model.kitchen.lShape.wallA or .wallB
// depending on which tab is active. Wall A and Wall B are fully
// independent — switching tabs never resets the other wall's values, since
// each tab is just choosing which half of the model the SAME form is bound
// to (updateLShapeWallConfig always targets exactly one of them).

function WallTabSelector({ active, onChange }: { active: 'A' | 'B'; onChange: (w: 'A' | 'B') => void }) {
  return (
    <div className="flex gap-2 mb-2">
      {(['A', 'B'] as const).map((w) => (
        <button
          key={w}
          onClick={() => onChange(w)}
          className="flex-1 py-2.5 rounded-lg font-bold text-sm transition-all"
          style={{
            background: active === w ? '#1d4ed8' : '#161b27',
            color: active === w ? '#fff' : '#64748b',
            border: `1.5px solid ${active === w ? '#3b82f6' : '#2a3347'}`,
          }}
        >
          Wall {w}
        </button>
      ))}
    </div>
  );
}

function LShapeStep2Trolley({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { model, updateLShapeWallConfig } = useApp();
  const [activeWall, setActiveWall] = useState<'A' | 'B'>('A');
  const lShape = model.kitchen.lShape;
  const wallConfig = activeWall === 'A' ? lShape.wallA : lShape.wallB;
  return (
    <div className="flex flex-col gap-2 p-6">
      <p className="text-sm mb-2" style={{ color: '#64748b' }}>Select the Trolley Type for each wall — independently</p>
      <WallTabSelector active={activeWall} onChange={setActiveWall} />
      {/* key={activeWall} — same fresh-remount fix as LShapeStep3Features's
          own WallFeaturesForm below, needed here too since this form's SPO
          width field also uses NumInput's own uncommitted draft state. */}
      <WallTrolleyTypeForm
        key={activeWall}
        iShape={wallConfig}
        updateIShapeConfig={(patch) => updateLShapeWallConfig(activeWall, patch)}
      />
      <div className="flex gap-3 mt-4">
        <button onClick={onBack} className="flex-1 py-4 rounded-xl font-bold border" style={{ background: 'transparent', border: '2px solid #2a3347', color: '#94a3b8' }}>← Back</button>
        <button onClick={onNext} className="flex-1 py-4 rounded-xl font-bold" style={{ background: '#3b82f6', color: '#fff' }}>Next →</button>
      </div>
    </div>
  );
}

/** Wall B Position — Left/Right selector, plus the optional Corner Fix
 * Patti frame (LSHAPE_KITCHEN_PLAN.md §0.1: a real physical panel at the
 * shared corner, independent of and never conflated with a normal Wall A/
 * Wall B Fix Patti). Shown once, above the Wall A/B tabs, since both are
 * whole-kitchen (not per-wall) settings. */
function LShapeCornerFrame() {
  const { model, updateLShapeConfig } = useApp();
  const lShape = model.kitchen.lShape;
  return (
    <>
      <div className="h-px" style={{ background: '#2a3347' }} />
      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>Wall B Position</p>
      <div className="flex gap-2">
        {(['left', 'right'] as const).map((pos) => (
          <WallSideOptionButton
            key={pos}
            label={pos === 'left' ? 'Left' : 'Right'}
            selected={lShape.wallBPosition === pos}
            onClick={() => updateLShapeConfig({ wallBPosition: pos })}
          />
        ))}
      </div>

      <div className="h-px mt-2" style={{ background: '#2a3347' }} />
      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#16a34a' }}>Corner Fix Patti</p>
      <div className="flex gap-2">
        <WallSideOptionButton label="None" selected={!lShape.corner.fixPattiEnabled} onClick={() => updateLShapeConfig({ corner: { ...lShape.corner, fixPattiEnabled: false } })} />
        <WallSideOptionButton label="Yes" selected={lShape.corner.fixPattiEnabled} onClick={() => updateLShapeConfig({ corner: { ...lShape.corner, fixPattiEnabled: true } })} />
      </div>
      {lShape.corner.fixPattiEnabled && (
        <div className="grid grid-cols-2 gap-3 mt-2">
          <NumInput
            label="Corner Fix Patti Height"
            value={lShape.corner.fixPattiHeight || lShape.kitchenHeight}
            onChange={(v) => updateLShapeConfig({ corner: { ...lShape.corner, fixPattiHeight: v } })}
          />
          <NumInput
            label="Corner Fix Patti Width"
            value={lShape.corner.fixPattiWidth || 40}
            onChange={(v) => updateLShapeConfig({ corner: { ...lShape.corner, fixPattiWidth: v } })}
          />
        </div>
      )}
    </>
  );
}

function LShapeStep3Features({ onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  const { model, updateLShapeConfig, updateLShapeWallConfig } = useApp();
  const [activeWall, setActiveWall] = useState<'A' | 'B'>('A');
  const lShape = model.kitchen.lShape;
  const wallConfig = activeWall === 'A' ? lShape.wallA : lShape.wallB;
  return (
    <div className="flex flex-col gap-4 p-6">
      <p className="text-sm" style={{ color: '#64748b' }}>Kitchen measurements shared by both walls</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <NumInput
          label="Total Kitchen Height"
          value={lShape.kitchenHeight}
          onChange={(v) => updateLShapeConfig({ kitchenHeight: Math.max(0, v - TOTAL_KITCHEN_HEIGHT_DEDUCTION_MM) })}
          note={lShape.kitchenHeight > 0 ? `Height −${TOTAL_KITCHEN_HEIGHT_DEDUCTION_MM}mm applied — entered value became ${Math.round(lShape.kitchenHeight)}mm.` : undefined}
          required
        />
        <NumInput label="Total Kitchen Depth" value={lShape.kitchenDepth} onChange={(v) => updateLShapeConfig({ kitchenDepth: v })} />
        <NumInput label="Pani Patti Height" value={lShape.paniPattiHeight} onChange={(v) => updateLShapeConfig({ paniPattiHeight: v })} />
      </div>

      <LShapeCornerFrame />

      <div className="h-px" style={{ background: '#2a3347' }} />
      <p className="text-sm" style={{ color: '#64748b' }}>Wall A / Wall B measurements and Kadappa layout — fully independent</p>
      <WallTabSelector active={activeWall} onChange={setActiveWall} />
      {/* key={activeWall} forces a fresh remount (and fresh NumInput draft
          state) on every Wall A <-> Wall B switch — without it, React
          reuses the same NumInput instances across walls, so a value typed
          into a field on one wall could still be showing in its own
          uncommitted `draft` string when the same field slot re-renders
          for the OTHER wall, even though the real underlying model data
          was always correctly separate the whole time (confirmed via a
          full audit: this was a pure display-only staleness bug, never a
          data bug). */}
      <WallFeaturesForm
        key={activeWall}
        iShape={wallConfig}
        updateIShapeConfig={(patch) => updateLShapeWallConfig(activeWall, patch)}
      />

      <div className="flex gap-3 mt-2">
        <button onClick={onBack} className="flex-1 py-4 rounded-xl font-bold border" style={{ background: 'transparent', border: '2px solid #2a3347', color: '#94a3b8' }}>← Back</button>
        <button onClick={onFinish} className="flex-1 py-4 rounded-xl font-bold" style={{ background: '#1d4ed8', color: '#fff' }}>View Drawing →</button>
      </div>
    </div>
  );
}

// ─── Measurements tab (the wizard) ─────────────────────────────────────────────

function MeasurementsTab({ onDone }: { onDone: () => void }) {
  const { model, completeStep, setStep } = useApp();
  const step = Math.min(TOTAL_STEPS, Math.max(1, model.currentStep || 1));
  const goNext = () => { completeStep(step); setStep(step + 1); };
  const goBack = () => setStep(Math.max(1, step - 1));
  const finish = () => { completeStep(step); onDone(); };
  const isLShape = model.kitchen.type === 'l-shape';

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0d1117' }}>
      <StepHeader step={step} total={TOTAL_STEPS} />
      {step === 1 && <Step1 onNext={goNext} />}
      {step === 2 && (isLShape
        ? <LShapeStep2Trolley onNext={goNext} onBack={goBack} />
        : <Step2Trolley onNext={goNext} onBack={goBack} />)}
      {step === 3 && (isLShape
        ? <LShapeStep3Features onFinish={finish} onBack={goBack} />
        : <Step3Features onFinish={finish} onBack={goBack} />)}
    </div>
  );
}

// ─── Drawing tab — just the drawing, nothing else ──────────────────────────────
//
// I-Shape and L-Shape are the only Kitchen shapes a user can actually pick
// (Step1 still disables U-Shape/Parallel as "Soon"). The old generic
// Plan/Elevation A/B views (no Kadappa awareness — used the old freeform
// cabinet-module list) were a leftover fallback for unreachable shapes and
// could surface by mistake whenever `model.kitchen.type` held a stale/demo
// value; removed per the user's explicit report of the old drawing popping
// up on Kitchen click. Any type other than 'l-shape' still falls back to
// I-Shape's own drawing, matching that original fallback behavior.

function DrawingTab() {
  const { model } = useApp();
  return (
    <div className="flex-1 overflow-auto p-3" style={{ background: '#e8eaf0' }}>
      <div className="rounded-xl shadow-2xl p-4" style={{ background: '#fff' }}>
        {model.kitchen.type === 'l-shape'
          ? <LShapeKitchenDrawing lShape={model.kitchen.lShape} />
          : <IShapeKitchenDrawing iShape={model.kitchen.iShape} />}
      </div>
    </div>
  );
}

// A single stable measurementId for Kitchen's own Evidence Note/History
// snapshot — mirrors ProductFlow.tsx's own `measurementId === selectedId`
// convention (there, selectedId is the active ProductId string) so both
// screens' Evidence Notes live in the exact same model.evidence array
// without ever colliding with a real ProductId.
const KITCHEN_MEASUREMENT_ID = 'kitchen';
const KITCHEN_PRODUCT_NAME = 'Kitchen';

// ─── Evidence tab — same free-text note convention every other product uses ────
// Reuses AppContext's setEvidenceNote directly (a plain measurementId+text
// store write, no product-specific coupling) — this note is included at the
// bottom of the downloaded Kitchen PDF, same as every other product's.

function EvidenceTab() {
  const { model, setEvidenceNote } = useApp();
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const existing = model.evidence.find((item) => item.measurementId === KITCHEN_MEASUREMENT_ID && item.type === 'note');
    setDraft(existing?.caption ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setEvidenceNote(KITCHEN_MEASUREMENT_ID, draft), 500);
    return () => window.clearTimeout(timer);
  }, [draft, setEvidenceNote]);

  return (
    <div className="flex-1 overflow-auto p-5" style={{ background: '#0d1117' }}>
      <div className="max-w-3xl rounded-xl border p-5" style={{ background: '#111827', borderColor: '#243045' }}>
        <div className="mb-4">
          <div className="text-sm font-bold uppercase tracking-wide" style={{ color: '#60a5fa' }}>Evidence</div>
          <div className="text-xs" style={{ color: '#64748b' }}>{KITCHEN_PRODUCT_NAME} · {model.project.projectId} · {model.employeeName || 'Employee'}</div>
        </div>
        <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#64748b' }}>Evidence Note</label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. Site condition is good. Kitchen wall measurement taken after checking the existing structure."
          rows={5}
          className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none resize-y"
          style={{ background: '#1e2535', border: '1px solid #2a3347', color: '#e2e8f0' }}
        />
        <div className="mt-2 text-[10px]" style={{ color: '#475569' }}>
          Saved automatically with this measurement — included at the bottom-right of the downloaded PDF.
        </div>
      </div>
    </div>
  );
}

// ─── PDF tab — real .pdf export via the SAME engine every other product uses ───
// Downloads exactly what the Drawing tab currently shows (I-Shape or
// L-Shape, whichever is active) through mountOffscreenSvgs +
// generateAndDownloadSingleProductPdf — the identical pipeline
// ProductFlow.tsx's handleDownloadPDF uses, so Kitchen's PDF is a real
// vector .pdf, not a second, different export path.

function PdfTab() {
  const { model, updateProject } = useApp();
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const clientMissing = !model.project.clientName.trim();

  const handleDownload = async () => {
    if (clientMissing) { setPdfError('Client Name is required before a PDF can be generated.'); return; }
    setPdfError(null);
    setPdfBusy(true);
    try {
      const drawingElement = model.kitchen.type === 'l-shape'
        ? <LShapeKitchenDrawing lShape={model.kitchen.lShape} />
        : <IShapeKitchenDrawing iShape={model.kitchen.iShape} />;
      const { svgs, cleanup } = await mountOffscreenSvgs([drawingElement]);
      const svgEl = svgs[0];
      if (!svgEl) { setPdfError('Unable to render the Kitchen drawing for PDF export.'); cleanup(); return; }

      const evidenceNote = model.evidence.find((item) => item.measurementId === KITCHEN_MEASUREMENT_ID && item.type === 'note')?.caption;
      const result = await generateAndDownloadSingleProductPdf(
        KITCHEN_PRODUCT_NAME,
        [{ label: model.kitchen.type === 'l-shape' ? 'L-Shape' : 'I-Shape', svgEl }],
        [], // Kitchen has no per-component cutlist table yet — drawing-only PDF, same as any product with computeCutlist returning [].
        {
          projectId: model.project.projectId,
          clientName: model.project.clientName,
          employeeName: model.employeeName || '',
          products: [KITCHEN_PRODUCT_NAME],
        },
        evidenceNote,
      );
      cleanup();
      if (!result.ok) { setPdfError(result.error ?? 'Unable to generate PDF.'); return; }
      logDrawingEvent({
        productCategory: 'Kitchen',
        productName: KITCHEN_PRODUCT_NAME,
        projectId: model.project.projectId,
        clientName: model.project.clientName,
        pdfGenerated: true,
        measurements: model.kitchen.type === 'l-shape' ? model.kitchen.lShape : model.kitchen.iShape,
      });
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-5" style={{ background: '#0d1117' }}>
      <div className="max-w-3xl rounded-xl border p-5" style={{ background: '#111827', borderColor: '#243045' }}>
        <div className="text-sm font-bold uppercase tracking-wide" style={{ color: '#60a5fa' }}>Project Details</div>
        <div className="mt-1 text-xs" style={{ color: '#64748b' }}>The same live drawing shown in Drawing will be included.</div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#64748b' }}>Project ID</label>
            <input
              value={model.project.projectId}
              onChange={(e) => updateProject({ projectId: e.target.value })}
              placeholder="Enter Project ID"
              className="rounded-lg px-3 py-2 text-sm font-mono outline-none"
              style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #243045' }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: clientMissing ? '#f87171' : '#64748b' }}>Client Name *</label>
            <input
              value={model.project.clientName}
              onChange={(e) => { updateProject({ clientName: e.target.value }); if (e.target.value.trim()) setPdfError(null); }}
              placeholder="Enter Client Name"
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: '#0f172a', color: '#e2e8f0', border: `1px solid ${clientMissing ? '#7f1d1d' : '#243045'}` }}
            />
            {clientMissing && <span className="text-[10px]" style={{ color: '#f87171' }}>❌ Client Name is required.</span>}
          </div>

          <div className="rounded-lg px-3 py-2" style={{ background: '#0f172a', border: '1px solid #243045' }}>
            <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#64748b' }}>Employee</div>
            {model.employeeName ? (
              <div className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>{model.employeeName}</div>
            ) : (
              <div className="text-sm font-semibold" style={{ color: '#f87171' }}>⚠ Employee session not found.</div>
            )}
          </div>

          <div className="rounded-lg px-3 py-2" style={{ background: '#0f172a', border: '1px solid #243045' }}>
            <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#64748b' }}>Product</div>
            <div className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>🍳 {KITCHEN_PRODUCT_NAME} ({model.kitchen.type === 'l-shape' ? 'L-Shape' : 'I-Shape'})</div>
          </div>
        </div>

        {pdfError && (
          <div className="mt-4 rounded-lg border px-3 py-2 text-xs" style={{ background: '#3b0d0d', color: '#fca5a5', borderColor: '#7f1d1d' }}>
            ⚠ {pdfError}
          </div>
        )}

        <div className="mt-5">
          <button onClick={handleDownload} disabled={pdfBusy} className="rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-60" style={{ background: '#1d4ed8', color: '#fff' }}>
            {pdfBusy ? '⏳ Generating…' : '⬇ Download Kitchen Drawing PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── History tab — 10-day recall, same store data every other product uses ─────
// Reads model.measurementHistory directly (populated by saveMeasurementSnapshot,
// which nothing in KitchenFlow currently calls — see the Measurements tab's
// own periodic-save effect added below) and restores a snapshot straight
// into the active Kitchen config on Recover.

function HistoryTab() {
  const { model, updateIShapeConfig, updateLShapeConfig } = useApp();
  const recentHistory = (model.measurementHistory ?? []).filter((entry) => {
    if (entry.productId !== KITCHEN_MEASUREMENT_ID) return false;
    const diff = Date.now() - new Date(entry.timestamp).getTime();
    return diff <= 10 * 24 * 60 * 60 * 1000;
  });

  const recover = (entry: typeof recentHistory[number]) => {
    // dims is a plain Record<string, number|string> snapshot of whichever
    // shape's config was active when it was saved — restored back into
    // that same shape's config (never guessed/merged across shapes).
    if (model.kitchen.type === 'l-shape') {
      updateLShapeConfig(entry.dims as never);
    } else {
      updateIShapeConfig(entry.dims as never);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-5" style={{ background: '#0d1117' }}>
      <div className="max-w-3xl rounded-xl border p-5" style={{ background: '#111827', borderColor: '#243045' }}>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-bold uppercase tracking-wide" style={{ color: '#60a5fa' }}>10-Day History</div>
          <span className="text-xs" style={{ color: '#64748b' }}>{recentHistory.length} record(s)</span>
        </div>
        <div className="flex flex-col gap-2">
          {recentHistory.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 rounded-lg border p-3" style={{ background: '#0f172a', borderColor: '#243045' }}>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold" style={{ color: '#e2e8f0' }}>{entry.productName}</div>
                <div className="text-xs" style={{ color: '#64748b' }}>{entry.projectId} · {entry.employeeName} · {new Date(entry.timestamp).toLocaleString('en-IN')}</div>
              </div>
              <button onClick={() => recover(entry)} className="rounded-lg px-3 py-2 text-xs font-bold" style={{ background: '#1d4ed8', color: '#fff' }}>Recover</button>
            </div>
          ))}
          {recentHistory.length === 0 && (
            <div className="rounded-lg border px-4 py-4 text-sm" style={{ borderColor: '#243045', color: '#64748b' }}>No Kitchen measurements saved in the last 10 days.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Kitchen screen ────────────────────────────────────────────────────────

const KITCHEN_TAB_LABELS: Record<KitchenTab, string> = {
  measurements: 'Measurements', drawing: 'Drawing', evidence: 'Evidence',
  pdf: 'PDF', history: 'History', 'my-stats': 'My Stats',
};
const KITCHEN_TABS: KitchenTab[] = ['measurements', 'drawing', 'evidence', 'pdf', 'history', 'my-stats'];

export const KitchenFlow: React.FC = () => {
  const { model, saveMeasurementSnapshot } = useApp();
  // Starts on Measurements whenever a project's own wizard step hasn't
  // been fully completed yet (currentStep <= TOTAL_STEPS); once finished,
  // opens straight on the Drawing — same "resume where it makes sense"
  // behaviour the old auto-redirect had, but as a same-screen tab switch
  // instead of a screen change with no way back.
  const [tab, setTab] = useState<KitchenTab>(
    (model.currentStep || 1) > TOTAL_STEPS ? 'drawing' : 'measurements',
  );

  // Periodic snapshot save — same 500ms-debounced pattern ProductFlow.tsx
  // uses for every other product, so Kitchen's own History tab has real
  // data to show and My Stats/the KPI dashboard see Kitchen activity too.
  // Snapshots whichever shape's config is currently active; never both at
  // once (only one is ever "the" Kitchen config for a given project).
  useEffect(() => {
    const activeConfig = model.kitchen.type === 'l-shape' ? model.kitchen.lShape : model.kitchen.iShape;
    const timer = window.setTimeout(() => {
      saveMeasurementSnapshot({
        productId: KITCHEN_MEASUREMENT_ID,
        productName: KITCHEN_PRODUCT_NAME,
        projectId: model.project.projectId,
        employeeName: model.employeeName || 'Employee',
        dims: activeConfig as unknown as Record<string, number | string>,
        notes: `${KITCHEN_PRODUCT_NAME} measurement capture (${model.kitchen.type === 'l-shape' ? 'L-Shape' : 'I-Shape'})`,
      });
      logDrawingEvent({
        productCategory: 'Kitchen',
        productName: KITCHEN_PRODUCT_NAME,
        projectId: model.project.projectId,
        clientName: model.project.clientName,
        pdfGenerated: false,
        measurements: activeConfig,
      });
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.kitchen.type, model.kitchen.iShape, model.kitchen.lShape, model.project.projectId, model.employeeName, model.project.clientName]);

  return (
    <div className="flex flex-col h-full" style={{ background: '#0d1117' }}>
      <div className="flex border-b overflow-x-auto" style={{ borderColor: '#243045', background: '#131920' }}>
        {KITCHEN_TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-3 px-2 text-xs font-bold tracking-widest uppercase whitespace-nowrap flex-shrink-0"
            style={{
              color: tab === t ? '#60a5fa' : '#3d4f6a',
              borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
            }}>
            {KITCHEN_TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'measurements' && <MeasurementsTab onDone={() => setTab('drawing')} />}
        {tab === 'drawing' && <DrawingTab />}
        {tab === 'evidence' && <EvidenceTab />}
        {tab === 'pdf' && <PdfTab />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'my-stats' && <MyStatsPanel />}
      </div>
    </div>
  );
};

export default KitchenFlow;
