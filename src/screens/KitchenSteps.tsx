import React from 'react';
import { useApp } from '../store/AppContext';
import type { WallSideKadappaOption } from '../store/types';

// Steps 3-7 (Wall Measurements/Kadappa entry, Openings, Existing
// Conditions, Cabinet Modules, Review) removed per the user's explicit
// instruction — the Kitchen flow is now just Kitchen Type + Kadappa
// layout choices, then straight to the live drawing. Their old
// component functions (Step3-Step7), the Opening/CabinetModule-typed
// UI, and buildKadappaSequence/KadappaSlot lived here; none of that
// logic is used anywhere else, so it's deleted rather than kept unused
// (the drawing itself, computeGeometry, and AppContext's store actions
// are untouched — this only removes the removed steps' own UI).
const TOTAL_STEPS = 2;

const STEP_LABELS = [
  'Kitchen Type',
  'Features',
];

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

function NumInput({ label, value, onChange, unit = 'mm', note }: {
  label: string; value: number; onChange: (v: number) => void; unit?: string; note?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>{label}</label>
        <span className="text-xs font-mono" style={{ color: '#475569' }}>{unit}</span>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder="0"
          className="flex-1 rounded-lg px-4 py-4 text-2xl font-mono font-bold outline-none border focus:ring-2 focus:ring-blue-500 text-center"
          style={{ background: '#1e2535', border: '2px solid #2a3347', color: '#60a5fa' }}
        />
      </div>
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

// Kitchen Shape — per the SmartMeasure CAD Kitchen Model spec (Phase 1):
// I-Shape Kitchen is being fully rebuilt from scratch (new Kadappa/Pani
// Patti measurement + drawing system, replacing the old "Straight" type's
// drawing entirely). L-Shape/U-Shape/Parallel stay visible in the
// dropdown for future phases per the spec's own "other shapes should
// remain available... for future implementation" instruction — the old
// L-Shape implementation is retired along with Straight's, not carried
// forward, since this is a from-scratch rebuild of the whole Kitchen
// drawing system, not an addition alongside the old one.
function Step1({ onNext }: { onNext: () => void }) {
  const { model, setKitchenType } = useApp();
  const types = [
    { id: 'straight', label: 'I-Shape Kitchen', active: true },
    { id: 'l-shape', label: 'L-Shape Kitchen', active: false },
    { id: 'u-shape', label: 'U-Shape Kitchen', active: false },
    { id: 'parallel', label: 'Parallel Kitchen', active: false },
  ] as const;
  // A project saved before this rebuild (old L-Shape system) may still
  // have model.kitchen.type set to a now-inactive/retired shape — never
  // show that as "selected" (it would read as a live, pickable option
  // despite being disabled). Only I-Shape can be the real selection now.
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

// ─── Step 2: Features ──────────────────────────────────────────────────────────
// Rebuilt from scratch for I-Shape Kitchen (Phase 1 of the Kitchen Model
// spec) — only the two Kadappa layout questions remain. The old generic
// feature toggles (Existing Kadappa/Platform, Skirting, Loft, Wall/Base
// Cabinets, Trolley, Open Box, Tall Unit, Corner Unit) belonged to the
// retired cabinet-module system and are removed per the user's own
// instruction to strip this step down to just the new Kadappa options.

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

function Step2({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { model, updateIShapeConfig } = useApp();
  const iShape = model.kitchen.iShape;

  const wallSideOptions: WallSideKadappaOption[] = ['None', 'Left', 'Right', 'Both'];

  return (
    <div className="flex flex-col gap-2 p-6">
      <p className="text-sm mb-2" style={{ color: '#64748b' }}>Kadappa layout for this kitchen</p>

      <div className="py-3 border-b" style={{ borderColor: '#2a3347' }}>
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

      <Toggle
        label="Inner Side Kadappa"
        value={iShape.hasInnerKadappa}
        onChange={(v) => updateIShapeConfig({
          hasInnerKadappa: v,
          // Seed a real count + width array the first time this is turned
          // on (default count = 2, per the spec), so the measurement step
          // always has real values to show rather than an empty list.
          ...(v && iShape.innerKadappaWidths.length === 0
            ? { innerKadappaCount: iShape.innerKadappaCount || 2, innerKadappaWidths: Array(iShape.innerKadappaCount || 2).fill(0) }
            : {}),
        })}
      />
      {iShape.hasInnerKadappa && (
        <div className="py-3 flex flex-col gap-2">
          <NumInput
            label="Number of Inner Side Kadappa"
            value={iShape.innerKadappaCount}
            unit="count"
            onChange={(count) => {
              const safeCount = Math.max(1, Math.round(count) || 1);
              // Resize innerKadappaWidths to match the new count — keep
              // existing entries in place, pad new ones with 0, truncate
              // extra ones. gapWidths is resized later (measurement step)
              // once the total Kadappa count for this configuration is
              // known there.
              const widths = Array.from({ length: safeCount }, (_, i) => iShape.innerKadappaWidths[i] ?? 0);
              updateIShapeConfig({ innerKadappaCount: safeCount, innerKadappaWidths: widths });
            }}
          />
        </div>
      )}

      <div className="flex gap-3 mt-4">
        <button onClick={onBack} className="flex-1 py-4 rounded-xl font-bold border" style={{ background: 'transparent', border: '2px solid #2a3347', color: '#94a3b8' }}>← Back</button>
        <button onClick={onNext} className="flex-1 py-4 rounded-xl font-bold" style={{ background: '#1d4ed8', color: '#fff' }}>Open Live Drawing →</button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const KitchenSteps: React.FC = () => {
  const { model, completeStep, setStep, setScreen } = useApp();
  // A project saved (or the demo project) before Steps 3-7 were removed
  // can have currentStep pointing PAST the new last step — that used to
  // mean "already finished Wall Measurements/Openings/etc., ready to
  // review/draw," which the new 2-step wizard has no equivalent screen
  // for. Rather than clamp it into re-showing Step 2's Kadappa form (an
  // I-Shape-only editor, meaningless for an already-configured L-Shape
  // demo project), skip the wizard entirely and go straight to the
  // drawing — the same real destination that state used to lead to.
  React.useEffect(() => {
    if ((model.currentStep || 1) > TOTAL_STEPS) setScreen('drawing');
  }, [model.currentStep, setScreen]);
  const step = Math.min(TOTAL_STEPS, Math.max(1, model.currentStep || 1));
  const goNext = () => { completeStep(step); setStep(step + 1); };
  const goBack = () => setStep(Math.max(1, step - 1));
  // Step 2 is now the last step — its own "Next →" button goes straight
  // to the live drawing (see Step2's onNext prop below) instead of
  // advancing to a step 3 that no longer exists.
  const finish = () => { completeStep(step); setScreen('drawing'); };

  if ((model.currentStep || 1) > TOTAL_STEPS) return null;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0d1117' }}>
      <StepHeader step={step} total={TOTAL_STEPS} />
      {step === 1 && <Step1 onNext={goNext} />}
      {step === 2 && <Step2 onNext={finish} onBack={goBack} />}
    </div>
  );
};
