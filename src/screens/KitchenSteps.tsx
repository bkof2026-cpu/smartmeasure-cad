import React from 'react';
import { useApp } from '../store/AppContext';
import type { WallSideKadappaOption } from '../store/types';
import { TROLLEY_TEMPLATES } from '../products/kitchen/trolleyTemplates';
import { buildKadappaSequence } from '../products/kitchen/iShapeKitchenGeometry';

// Steps 3-7 of the old generic wizard (Wall Measurements/Openings/Existing
// Conditions/Cabinet Modules/Review) were removed per the user's explicit
// instruction. A NEW Step 3 (Trolley Type) was added back per the
// "SMARTMEASURE CAD — FINAL I-SHAPE KITCHEN UPDATE" spec's own flow
// (Kitchen Type → Kadappa → Trolley Type → Drawing) — this is a distinct,
// purpose-built step for the I-Shape Trolley system, not a revival of any
// deleted generic step.
const TOTAL_STEPS = 3;

const STEP_LABELS = [
  'Kitchen Type',
  'Features',
  'Trolley',
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
  const sequence = buildKadappaSequence(iShape);
  const gapCountNeeded = Math.max(0, sequence.length - 1);

  // Keeps gapWidths sized to (sequence.length - 1) — the array is derived
  // from wallSideKadappa/hasInnerKadappa/innerKadappaCount, all set above
  // in this same step, so this reconciles it live as those change.
  // Existing gap values are preserved by position; new slots start at 0,
  // extra ones are dropped.
  React.useEffect(() => {
    if (iShape.gapWidths.length !== gapCountNeeded) {
      const resized = Array.from({ length: gapCountNeeded }, (_, i) => iShape.gapWidths[i] ?? 0);
      updateIShapeConfig({ gapWidths: resized });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gapCountNeeded]);

  return (
    <div className="flex flex-col gap-5 p-6">
      <p className="text-sm" style={{ color: '#64748b' }}>Kitchen measurements and Kadappa layout</p>

      <NumInput
        label="Total Kitchen Height"
        value={iShape.height}
        onChange={(v) => updateIShapeConfig({ height: v })}
      />
      <NumInput
        label="Total Kitchen Width"
        value={iShape.width}
        onChange={(v) => updateIShapeConfig({ width: v })}
      />

      <div className="h-px" style={{ background: '#2a3347' }} />
      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>Pani Patti</p>
      {/* Pani Patti Width is never independently entered — it always
          spans the same Total Kitchen Width, per the user's explicit
          instruction. Only Height is a real, separate input. */}
      <NumInput label="Pani Patti Height" value={iShape.paniPattiHeight} onChange={(v) => updateIShapeConfig({ paniPattiHeight: v })} />

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
      {(iShape.wallSideKadappa === 'Left' || iShape.wallSideKadappa === 'Both') && (
        <NumInput
          label="Left Kadappa (A) Width"
          value={iShape.leftWallKadappaWidth}
          onChange={(v) => updateIShapeConfig({ leftWallKadappaWidth: v })}
          note={`Height = Total Kitchen Height (${iShape.height} mm) — automatic`}
        />
      )}
      {(iShape.wallSideKadappa === 'Right' || iShape.wallSideKadappa === 'Both') && (
        <NumInput
          label="Right Kadappa Width"
          value={iShape.rightWallKadappaWidth}
          onChange={(v) => updateIShapeConfig({ rightWallKadappaWidth: v })}
          note={`Height = Total Kitchen Height (${iShape.height} mm) — automatic`}
        />
      )}

      <Toggle
        label="Inner Side Kadappa"
        value={iShape.hasInnerKadappa}
        onChange={(v) => updateIShapeConfig({
          hasInnerKadappa: v,
          // Seed a real count + width array the first time this is turned
          // on (default count = 2, per the spec), so this step always has
          // real fields to show rather than an empty list.
          ...(v && iShape.innerKadappaWidths.length === 0
            ? { innerKadappaCount: iShape.innerKadappaCount || 2, innerKadappaWidths: Array(iShape.innerKadappaCount || 2).fill(0) }
            : {}),
        })}
      />
      {iShape.hasInnerKadappa && (
        <div className="flex flex-col gap-3">
          <NumInput
            label="Number of Inner Side Kadappa"
            value={iShape.innerKadappaCount}
            unit="count"
            onChange={(count) => {
              const safeCount = Math.max(1, Math.round(count) || 1);
              // Resize innerKadappaWidths to match the new count — keep
              // existing entries in place, pad new ones with 0, truncate
              // extra ones. gapWidths resizes itself via the effect above
              // once the sequence length changes as a result.
              const widths = Array.from({ length: safeCount }, (_, i) => iShape.innerKadappaWidths[i] ?? 0);
              updateIShapeConfig({ innerKadappaCount: safeCount, innerKadappaWidths: widths });
            }}
          />
          {sequence.filter((s) => s.kind === 'inner').map((slot) => (
            <NumInput
              key={slot.letter}
              label={`Inner Kadappa ${slot.letter} Width`}
              value={iShape.innerKadappaWidths[slot.innerIndex!] ?? 0}
              onChange={(v) => {
                const widths = [...iShape.innerKadappaWidths];
                widths[slot.innerIndex!] = v;
                updateIShapeConfig({ innerKadappaWidths: widths });
              }}
              note={`Height = Total Kitchen Height (${iShape.height} mm) — automatic`}
            />
          ))}
        </div>
      )}

      {sequence.length > 1 && (
        <>
          <div className="h-px" style={{ background: '#2a3347' }} />
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>Gap Between Kadappas</p>
          {sequence.slice(1).map((slot, i) => {
            const prevLetter = sequence[i].letter;
            return (
              <NumInput
                key={`gap-${i}`}
                label={`Width from Kadappa ${prevLetter} to ${slot.letter}`}
                value={iShape.gapWidths[i] ?? 0}
                onChange={(v) => {
                  const gaps = Array.from({ length: gapCountNeeded }, (_, gi) => iShape.gapWidths[gi] ?? 0);
                  gaps[i] = v;
                  updateIShapeConfig({ gapWidths: gaps });
                }}
                note="Open wall space between these two Kadappas — separate from either Kadappa's own Width"
              />
            );
          })}
        </>
      )}

      <div className="flex gap-3 mt-2">
        <button onClick={onBack} className="flex-1 py-4 rounded-xl font-bold border" style={{ background: 'transparent', border: '2px solid #2a3347', color: '#94a3b8' }}>← Back</button>
        <button onClick={onNext} className="flex-1 py-4 rounded-xl font-bold" style={{ background: '#3b82f6', color: '#fff' }}>Next →</button>
      </div>
    </div>
  );
}

// ─── Step 3: Trolley Type ──────────────────────────────────────────────────────
// Per the spec's own flow (Kitchen Type → Kadappa → Trolley Type →
// Drawing). Dropdown-style button list of every registered
// TROLLEY_TEMPLATES entry — currently just "Free Door Trolley," the one
// real, fully worked template. The selected id is passed straight to the
// I-Shape drawing engine, which inserts that template's Outer Panel into
// the first Inner Side Kadappa section.

function Step3({ onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  const { model, updateIShapeConfig } = useApp();
  const iShape = model.kitchen.iShape;
  const templates = Object.values(TROLLEY_TEMPLATES);

  return (
    <div className="flex flex-col gap-2 p-6">
      <p className="text-sm mb-2" style={{ color: '#64748b' }}>Select the Trolley Type for this kitchen</p>

      <div className="flex flex-col gap-2">
        <button
          onClick={() => updateIShapeConfig({ trolleyTemplateId: null })}
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
            onClick={() => updateIShapeConfig({ trolleyTemplateId: t.id })}
            className="text-left py-3 px-4 rounded-lg font-bold text-sm transition-all"
            style={{
              background: iShape.trolleyTemplateId === t.id ? '#1d4ed8' : '#161b27',
              color: iShape.trolleyTemplateId === t.id ? '#fff' : '#64748b',
              border: `1.5px solid ${iShape.trolleyTemplateId === t.id ? '#3b82f6' : '#2a3347'}`,
            }}
          >
            {t.name}
          </button>
        ))}
      </div>

      {iShape.trolleyTemplateId && !iShape.hasInnerKadappa && (
        <p className="text-xs mt-2 px-1" style={{ color: '#fbbf24' }}>
          ⚠ This trolley needs an Inner Side Kadappa to sit in — go back to Features and add one.
        </p>
      )}

      <div className="flex gap-3 mt-4">
        <button onClick={onBack} className="flex-1 py-4 rounded-xl font-bold border" style={{ background: 'transparent', border: '2px solid #2a3347', color: '#94a3b8' }}>← Back</button>
        <button onClick={onFinish} className="flex-1 py-4 rounded-xl font-bold" style={{ background: '#1d4ed8', color: '#fff' }}>Open Live Drawing →</button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const KitchenSteps: React.FC = () => {
  const { model, completeStep, setStep, setScreen } = useApp();
  // A project saved (or the demo project) under an older, shorter wizard
  // can have currentStep pointing PAST the current last step — that used
  // to mean "already finished the wizard, ready to review/draw." Rather
  // than clamp it into re-showing an earlier step's form, skip the wizard
  // entirely and go straight to the drawing — the same real destination
  // that state used to lead to.
  React.useEffect(() => {
    if ((model.currentStep || 1) > TOTAL_STEPS) setScreen('drawing');
  }, [model.currentStep, setScreen]);
  const step = Math.min(TOTAL_STEPS, Math.max(1, model.currentStep || 1));
  const goNext = () => { completeStep(step); setStep(step + 1); };
  const goBack = () => setStep(Math.max(1, step - 1));
  // Step 3 (Trolley Type) is the last step — its own "Open Live Drawing →"
  // button goes straight to the live drawing.
  const finish = () => { completeStep(step); setScreen('drawing'); };

  if ((model.currentStep || 1) > TOTAL_STEPS) return null;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0d1117' }}>
      <StepHeader step={step} total={TOTAL_STEPS} />
      {step === 1 && <Step1 onNext={goNext} />}
      {step === 2 && <Step2 onNext={goNext} onBack={goBack} />}
      {step === 3 && <Step3 onFinish={finish} onBack={goBack} />}
    </div>
  );
};
