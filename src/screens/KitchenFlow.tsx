import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import { PlanView } from '../drawing/PlanView';
import { ElevationA } from '../drawing/ElevationA';
import { ElevationB } from '../drawing/ElevationB';
import { IShapeKitchenDrawing } from '../products/kitchen/IShapeKitchenDrawing';
import type { WallSideKadappaOption } from '../store/types';
import { TROLLEY_TEMPLATES } from '../products/kitchen/trolleyTemplates';
import { buildKadappaSequence, buildClearSegments, resolveTrolleySectionId } from '../products/kitchen/iShapeKitchenGeometry';
import { calculateTrolleyDimensions } from '../products/kitchen/trolleyDimensions';

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

type KitchenTab = 'measurements' | 'drawing';

const TOTAL_STEPS = 3;
const STEP_LABELS = ['Kitchen Type', 'Trolley', 'Features'];

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
        className="w-full rounded-lg px-3 py-2.5 text-base font-mono font-bold outline-none border focus:ring-2 focus:ring-blue-500 text-center"
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
    { id: 'l-shape', label: 'L-Shape Kitchen', active: false },
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

function Step3Features({ onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  const { model, updateIShapeConfig } = useApp();
  const iShape = model.kitchen.iShape;

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
  const kadappaWidthFields: { key: string; label: string; value: number; onChange: (v: number) => void }[] = [];
  if (iShape.wallSideKadappa === 'Left' || iShape.wallSideKadappa === 'Both') {
    kadappaWidthFields.push({
      key: 'left-wall', label: 'Kadappa A — Width', value: iShape.leftWallKadappaWidth,
      onChange: (v) => updateIShapeConfig({ leftWallKadappaWidth: v }),
    });
  }
  sequence.filter((s) => s.kind === 'inner').forEach((slot) => {
    kadappaWidthFields.push({
      key: `inner-${slot.innerIndex}`, label: `Kadappa ${slot.letter} — Width`,
      value: iShape.innerKadappaWidths[slot.innerIndex!] ?? 0,
      onChange: (v) => {
        const widths = [...iShape.innerKadappaWidths];
        widths[slot.innerIndex!] = v;
        updateIShapeConfig({ innerKadappaWidths: widths });
      },
    });
  });
  if (iShape.wallSideKadappa === 'Right' || iShape.wallSideKadappa === 'Both') {
    kadappaWidthFields.push({
      key: 'right-wall', label: `Kadappa ${sequence.length > 0 ? sequence[sequence.length - 1].letter : ''} — Width`,
      value: iShape.rightWallKadappaWidth,
      onChange: (v) => updateIShapeConfig({ rightWallKadappaWidth: v }),
    });
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <p className="text-sm" style={{ color: '#64748b' }}>Kitchen measurements and Kadappa layout</p>

      <div className="grid grid-cols-2 gap-3">
        <NumInput
          label="Total Kitchen Height"
          value={iShape.height}
          onChange={(v) => updateIShapeConfig({ height: v })}
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

      {kadappaWidthFields.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {kadappaWidthFields.map((f) => (
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

      {iShape.trolleyTemplateId && (
        <TrolleySectionPicker iShape={iShape} clearSegments={clearSegments} updateIShapeConfig={updateIShapeConfig} />
      )}

      {iShape.trolleyTemplateId && (
        <TrolleyDimensionsFrame iShape={iShape} clearSegments={clearSegments} updateIShapeConfig={updateIShapeConfig} />
      )}

      <div className="flex gap-3 mt-2">
        <button onClick={onBack} className="flex-1 py-4 rounded-xl font-bold border" style={{ background: 'transparent', border: '2px solid #2a3347', color: '#94a3b8' }}>← Back</button>
        <button onClick={onFinish} className="flex-1 py-4 rounded-xl font-bold" style={{ background: '#1d4ed8', color: '#fff' }}>View Drawing →</button>
      </div>
    </div>
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
        <div style={rowStyle}><span style={labelStyle}>Gap</span><span style={valueStyle}>− 10 mm</span></div>
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
          <span style={{ ...labelStyle, color: '#e2e8f0', fontWeight: 700 }}>Final Trolley Depth {autoTag}</span>
          <span style={{ ...valueStyle, color: '#fbbf24', fontWeight: 700 }}>{Math.round(dims.finalDepth)} mm</span>
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

function Step2Trolley({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { model, updateIShapeConfig } = useApp();
  const iShape = model.kitchen.iShape;
  const templates = Object.values(TROLLEY_TEMPLATES);
  const selected = iShape.trolleyTemplateId ? TROLLEY_TEMPLATES[iShape.trolleyTemplateId] ?? null : null;

  const selectTemplate = (id: string | null) => {
    // Switching Trolley Type never carries old SPO values into the new
    // template's (possibly differently-keyed) fields.
    updateIShapeConfig({ trolleyTemplateId: id, spoValues: {} });
  };

  return (
    <div className="flex flex-col gap-2 p-6">
      <p className="text-sm mb-2" style={{ color: '#64748b' }}>Select the Trolley Type for this kitchen</p>

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

      <div className="flex gap-3 mt-4">
        <button onClick={onBack} className="flex-1 py-4 rounded-xl font-bold border" style={{ background: 'transparent', border: '2px solid #2a3347', color: '#94a3b8' }}>← Back</button>
        <button onClick={onNext} className="flex-1 py-4 rounded-xl font-bold" style={{ background: '#3b82f6', color: '#fff' }}>Next →</button>
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

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0d1117' }}>
      <StepHeader step={step} total={TOTAL_STEPS} />
      {step === 1 && <Step1 onNext={goNext} />}
      {step === 2 && <Step2Trolley onNext={goNext} onBack={goBack} />}
      {step === 3 && <Step3Features onFinish={finish} onBack={goBack} />}
    </div>
  );
}

// ─── Drawing tab — just the drawing, nothing else ──────────────────────────────

type GenericDrawTab = 'plan' | 'elev-a' | 'elev-b';

function DrawingTab() {
  const { model, geo, selectedModuleId, setSelectedModuleId } = useApp();
  const isIShape = model.kitchen.type === 'straight';
  const [genericTab, setGenericTab] = useState<GenericDrawTab>('elev-a');

  if (isIShape) {
    return (
      <div className="flex-1 overflow-auto p-3" style={{ background: '#e8eaf0' }}>
        <div className="rounded-xl shadow-2xl p-4" style={{ background: '#fff' }}>
          <IShapeKitchenDrawing iShape={model.kitchen.iShape} />
        </div>
      </div>
    );
  }

  // Other shapes stay on the old generic Plan/Elevation views (no
  // I-Shape/Kadappa awareness), still with their own small view switcher,
  // but without the Measure/Evidence/AI/Cabinet-Modules chrome.
  const tabs: { id: GenericDrawTab; label: string }[] = [
    { id: 'plan', label: 'PLAN' },
    { id: 'elev-a', label: 'ELEVATION A' },
    { id: 'elev-b', label: 'ELEVATION B' },
  ];
  return (
    <div className="flex flex-col h-full" style={{ background: '#1a1f2e' }}>
      <div className="flex items-center gap-1 px-3 py-1.5 border-b" style={{ background: '#131920', borderColor: '#243045' }}>
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setGenericTab(tab.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono tracking-widest transition-all"
            style={{
              background: genericTab === tab.id ? '#1d4ed8' : 'transparent',
              color: genericTab === tab.id ? '#fff' : '#3d4f6a',
            }}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden p-3" style={{ background: '#e8eaf0' }}>
        <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl" style={{ background: '#fff' }}>
          {genericTab === 'plan' && (
            <PlanView geo={geo} projectId={model.project.projectId}
              selectedModuleId={selectedModuleId} onSelectModule={setSelectedModuleId} />
          )}
          {genericTab === 'elev-a' && (
            <ElevationA geo={geo} projectId={model.project.projectId}
              selectedModuleId={selectedModuleId} onSelectModule={setSelectedModuleId} />
          )}
          {genericTab === 'elev-b' && (
            <ElevationB geo={geo} projectId={model.project.projectId}
              selectedModuleId={selectedModuleId} onSelectModule={setSelectedModuleId} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Kitchen screen ────────────────────────────────────────────────────────

export const KitchenFlow: React.FC = () => {
  const { model } = useApp();
  // Starts on Measurements whenever a project's own wizard step hasn't
  // been fully completed yet (currentStep <= TOTAL_STEPS); once finished,
  // opens straight on the Drawing — same "resume where it makes sense"
  // behaviour the old auto-redirect had, but as a same-screen tab switch
  // instead of a screen change with no way back.
  const [tab, setTab] = useState<KitchenTab>(
    (model.currentStep || 1) > TOTAL_STEPS ? 'drawing' : 'measurements',
  );

  return (
    <div className="flex flex-col h-full" style={{ background: '#0d1117' }}>
      <div className="flex border-b" style={{ borderColor: '#243045', background: '#131920' }}>
        {(['measurements', 'drawing'] as KitchenTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-3 text-xs font-bold tracking-widest uppercase"
            style={{
              color: tab === t ? '#60a5fa' : '#3d4f6a',
              borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
            }}>
            {t === 'measurements' ? 'Measurements' : 'Drawing'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'measurements' && <MeasurementsTab onDone={() => setTab('drawing')} />}
        {tab === 'drawing' && <DrawingTab />}
      </div>
    </div>
  );
};

export default KitchenFlow;
