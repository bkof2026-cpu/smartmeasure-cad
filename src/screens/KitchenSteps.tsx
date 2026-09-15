import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import type { Opening, CabinetModule, WallSideKadappaOption, KitchenProjectModel } from '../store/types';

const TOTAL_STEPS = 7;

const STEP_LABELS = [
  'Kitchen Type',
  'Features',
  'Wall Measurements',
  'Openings',
  'Existing Conditions',
  'Cabinet Modules',
  'Review',
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
        <button onClick={onNext} className="flex-1 py-4 rounded-xl font-bold" style={{ background: '#3b82f6', color: '#fff' }}>Next →</button>
      </div>
    </div>
  );
}

// ─── Step 3: Measurements (I-Shape Kitchen) ───────────────────────────────────
// Rebuilt from scratch per the Kitchen Model spec — Total Kitchen H/W,
// Pani Patti H/W (width defaults to Total Kitchen Width, stays editable),
// each Kadappa's own independently-entered Width (Wall Side + Inner
// Side), and the gap width between every consecutive pair of Kadappas —
// a genuinely separate measurement from any Kadappa's own width. Letters
// (A, B, C, D...) are assigned sequentially left-to-right across however
// many Kadappas are actually configured (see kadappaSequence below),
// matching the naming rule confirmed with the user directly.

/** One physical Kadappa in left-to-right order, with its resolved letter. */
interface KadappaSlot {
  letter: string;
  kind: 'wall-left' | 'inner' | 'wall-right';
  /** Index into iShape.innerKadappaWidths, only set when kind === 'inner'. */
  innerIndex?: number;
}

/** Builds the physical left-to-right Kadappa sequence and assigns
 * sequential letters — the single source of truth for naming, used by
 * both the measurement step and the drawing engine so they never
 * disagree on which letter belongs to which physical Kadappa. */
export function buildKadappaSequence(iShape: KitchenProjectModel['kitchen']['iShape']): KadappaSlot[] {
  const slots: KadappaSlot[] = [];
  if (iShape.wallSideKadappa === 'Left' || iShape.wallSideKadappa === 'Both') {
    slots.push({ kind: 'wall-left', letter: '' });
  }
  if (iShape.hasInnerKadappa) {
    for (let i = 0; i < iShape.innerKadappaCount; i++) {
      slots.push({ kind: 'inner', letter: '', innerIndex: i });
    }
  }
  if (iShape.wallSideKadappa === 'Right' || iShape.wallSideKadappa === 'Both') {
    slots.push({ kind: 'wall-right', letter: '' });
  }
  slots.forEach((s, i) => { s.letter = String.fromCharCode(65 + i); }); // A, B, C, D...
  return slots;
}

function kadappaSlotLabel(kind: KadappaSlot['kind']): string {
  if (kind === 'wall-left') return 'Left Side Wall Kadappa';
  if (kind === 'wall-right') return 'Right Side Wall Kadappa';
  return 'Inner Side Kadappa';
}

function Step3({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { model, updateIShapeConfig } = useApp();
  const iShape = model.kitchen.iShape;
  const sequence = buildKadappaSequence(iShape);

  // Keeps gapWidths sized to (sequence.length - 1) — the array is derived
  // from wallSideKadappa/hasInnerKadappa/innerKadappaCount, all set on
  // earlier steps, so this reconciles it here (rather than needing every
  // upstream setter to know the current total Kadappa count) whenever the
  // Kadappa sequence itself changes. Existing gap values are preserved by
  // position; new slots start at 0, extra ones are dropped.
  const gapCountNeeded = Math.max(0, sequence.length - 1);
  React.useEffect(() => {
    if (iShape.gapWidths.length !== gapCountNeeded) {
      const resized = Array.from({ length: gapCountNeeded }, (_, i) => iShape.gapWidths[i] ?? 0);
      updateIShapeConfig({ gapWidths: resized });
    }
    // Only re-run when the required COUNT changes, not on every gap edit
    // (gapWidths itself is intentionally excluded — including it would
    // re-run this effect on every keystroke into a gap field).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gapCountNeeded]);

  return (
    <div className="flex flex-col gap-5 p-6">
      <p className="text-sm" style={{ color: '#64748b' }}>Enter all kitchen dimensions in mm</p>

      <NumInput
        label="Total Kitchen Height"
        value={iShape.height}
        onChange={(v) => updateIShapeConfig({ height: v })}
        note="Full height from floor to the top of the kitchen wall structure"
      />
      <NumInput
        label="Total Kitchen Width"
        value={iShape.width}
        onChange={(v) => {
          // Pani Patti Width defaults to Total Kitchen Width — but only
          // while it hasn't been independently set, matching the same
          // "default until touched, then stays independent" convention
          // used elsewhere (TV Unit's Mandir/Partition Height).
          const patch: Partial<typeof iShape> = { width: v };
          if (iShape.paniPattiWidth === undefined) patch.paniPattiWidth = v;
          updateIShapeConfig(patch);
        }}
        note="Left wall to right wall — the complete kitchen span"
      />

      <div className="h-px" style={{ background: '#2a3347' }} />
      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>Pani Patti</p>
      <NumInput label="Pani Patti Height" value={iShape.paniPattiHeight} onChange={(v) => updateIShapeConfig({ paniPattiHeight: v })} />
      <NumInput
        label="Pani Patti Width"
        value={iShape.paniPattiWidth ?? iShape.width}
        onChange={(v) => updateIShapeConfig({ paniPattiWidth: v })}
        note={`Defaults to Total Kitchen Width (${iShape.width} mm) — editable`}
      />

      {sequence.length > 0 && (
        <>
          <div className="h-px" style={{ background: '#2a3347' }} />
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>Kadappa Widths</p>
          {sequence.map((slot) => (
            <NumInput
              key={slot.letter}
              label={`Kadappa ${slot.letter} — ${kadappaSlotLabel(slot.kind)}`}
              value={
                slot.kind === 'wall-left' ? iShape.leftWallKadappaWidth
                  : slot.kind === 'wall-right' ? iShape.rightWallKadappaWidth
                  : iShape.innerKadappaWidths[slot.innerIndex!] ?? 0
              }
              onChange={(v) => {
                if (slot.kind === 'wall-left') updateIShapeConfig({ leftWallKadappaWidth: v });
                else if (slot.kind === 'wall-right') updateIShapeConfig({ rightWallKadappaWidth: v });
                else {
                  const widths = [...iShape.innerKadappaWidths];
                  widths[slot.innerIndex!] = v;
                  updateIShapeConfig({ innerKadappaWidths: widths });
                }
              }}
              note={`Height = Total Kitchen Height (${iShape.height} mm) — automatic`}
            />
          ))}
        </>
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

// ─── Step 4: Openings ──────────────────────────────────────────────────────────

function Step4({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { model, addOpening, removeOpening } = useApp();
  const [type, setType] = useState<Opening['type']>('window');
  const [wallId, setWallId] = useState('A');
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [dist, setDist] = useState(0);
  const [sill, setSill] = useState(0);

  const addNew = () => {
    if (!width || !height) return;
    addOpening({
      id: `${type.toUpperCase()}-${Date.now()}`,
      type, wallId, width, height,
      distanceFromLeft: dist,
      sillHeight: type === 'window' ? sill : undefined,
    });
    setWidth(0); setHeight(0); setDist(0); setSill(0);
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <p className="text-sm" style={{ color: '#64748b' }}>Record all doors, windows and obstacles</p>

      {/* Existing openings */}
      {model.openings.length > 0 && (
        <div className="flex flex-col gap-2">
          {model.openings.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: '#1e2535', border: '1px solid #2a3347' }}>
              <div>
                <span className="text-sm font-bold font-mono" style={{ color: '#60a5fa' }}>{o.id}</span>
                <span className="text-xs ml-2" style={{ color: '#64748b' }}>Wall {o.wallId} · {o.width}×{o.height} mm · @{o.distanceFromLeft}mm</span>
              </div>
              <button onClick={() => removeOpening(o.id)} className="text-xs px-2 py-1 rounded" style={{ background: '#7f1d1d', color: '#fca5a5' }}>Remove</button>
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#1e2535', border: '1.5px solid #2a3347' }}>
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#64748b' }}>Add New Opening</p>
        <div className="grid grid-cols-2 gap-2">
          {(['window', 'door', 'column', 'beam', 'electrical', 'plumbing'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="py-2 rounded-lg text-sm font-semibold"
              style={{ background: type === t ? '#1d4ed8' : '#161b27', color: type === t ? '#fff' : '#64748b', border: `1.5px solid ${type === t ? '#3b82f6' : '#2a3347'}` }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {model.kitchen.walls.map((w) => (
            <button key={w.id} onClick={() => setWallId(w.id)} className="flex-1 py-2 rounded-lg text-sm font-bold"
              style={{ background: wallId === w.id ? '#1d4ed8' : '#161b27', color: wallId === w.id ? '#fff' : '#64748b', border: `1.5px solid ${wallId === w.id ? '#3b82f6' : '#2a3347'}` }}>
              Wall {w.id}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider" style={{ color: '#64748b' }}>Width (mm)</label>
            <input type="number" inputMode="numeric" value={width || ''} onChange={(e) => setWidth(Number(e.target.value))} className="rounded-lg px-3 py-3 text-xl font-mono font-bold text-center outline-none" style={{ background: '#161b27', border: '2px solid #2a3347', color: '#60a5fa' }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider" style={{ color: '#64748b' }}>Height (mm)</label>
            <input type="number" inputMode="numeric" value={height || ''} onChange={(e) => setHeight(Number(e.target.value))} className="rounded-lg px-3 py-3 text-xl font-mono font-bold text-center outline-none" style={{ background: '#161b27', border: '2px solid #2a3347', color: '#60a5fa' }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider" style={{ color: '#64748b' }}>Distance from Left (mm)</label>
            <input type="number" inputMode="numeric" value={dist || ''} onChange={(e) => setDist(Number(e.target.value))} className="rounded-lg px-3 py-3 text-xl font-mono font-bold text-center outline-none" style={{ background: '#161b27', border: '2px solid #2a3347', color: '#60a5fa' }} />
          </div>
          {type === 'window' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wider" style={{ color: '#64748b' }}>Sill Height (mm)</label>
              <input type="number" inputMode="numeric" value={sill || ''} onChange={(e) => setSill(Number(e.target.value))} className="rounded-lg px-3 py-3 text-xl font-mono font-bold text-center outline-none" style={{ background: '#161b27', border: '2px solid #2a3347', color: '#60a5fa' }} />
            </div>
          )}
        </div>
        <button onClick={addNew} className="w-full py-3 rounded-xl font-bold" style={{ background: '#064e3b', color: '#6ee7b7', border: '1.5px solid #065f46' }}>
          + Add {type.charAt(0).toUpperCase() + type.slice(1)}
        </button>
      </div>

      <div className="flex gap-3 mt-2">
        <button onClick={onBack} className="flex-1 py-4 rounded-xl font-bold border" style={{ background: 'transparent', border: '2px solid #2a3347', color: '#94a3b8' }}>← Back</button>
        <button onClick={onNext} className="flex-1 py-4 rounded-xl font-bold" style={{ background: '#3b82f6', color: '#fff' }}>Next →</button>
      </div>
    </div>
  );
}

// ─── Step 5: Existing Conditions ──────────────────────────────────────────────

function Step5({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { model, updateKitchenConfig } = useApp();
  const k = model.kitchen;
  return (
    <div className="flex flex-col gap-4 p-6">
      <p className="text-sm" style={{ color: '#64748b' }}>Record existing conditions on site</p>
      {k.hasKadappa && (
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#1e2535', border: '1.5px solid #2a3347' }}>
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>Existing Kadappa / Platform</p>
          <div className="grid grid-cols-3 gap-3">
            {(['height', 'depth', 'length'] as const).map((dim) => (
              <div key={dim} className="flex flex-col gap-1">
                <label className="text-xs uppercase tracking-wider" style={{ color: '#64748b' }}>{dim} (mm)</label>
                <input type="number" inputMode="numeric"
                  value={k.kadappa?.[dim] ?? ''}
                  onChange={(e) => updateKitchenConfig({ kadappa: { ...k.kadappa ?? { length: 0, depth: 0, height: 0 }, [dim]: Number(e.target.value) } })}
                  className="rounded-lg px-2 py-3 text-lg font-mono font-bold text-center outline-none"
                  style={{ background: '#161b27', border: '2px solid #2a3347', color: '#60a5fa' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {k.hasSkirting && (
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#1e2535', border: '1.5px solid #2a3347' }}>
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>Existing Skirting</p>
          <div className="grid grid-cols-2 gap-3">
            {(['height', 'depth'] as const).map((dim) => (
              <div key={dim} className="flex flex-col gap-1">
                <label className="text-xs uppercase tracking-wider" style={{ color: '#64748b' }}>{dim} (mm)</label>
                <input type="number" inputMode="numeric"
                  value={k.skirting?.[dim] ?? ''}
                  onChange={(e) => updateKitchenConfig({ skirting: { ...k.skirting ?? { height: 0, depth: 0 }, [dim]: Number(e.target.value) } })}
                  className="rounded-lg px-2 py-3 text-lg font-mono font-bold text-center outline-none"
                  style={{ background: '#161b27', border: '2px solid #2a3347', color: '#60a5fa' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {!k.hasKadappa && !k.hasSkirting && (
        <p className="text-sm py-8 text-center" style={{ color: '#475569' }}>No existing conditions selected in Step 2.</p>
      )}
      <div className="flex gap-3 mt-2">
        <button onClick={onBack} className="flex-1 py-4 rounded-xl font-bold border" style={{ background: 'transparent', border: '2px solid #2a3347', color: '#94a3b8' }}>← Back</button>
        <button onClick={onNext} className="flex-1 py-4 rounded-xl font-bold" style={{ background: '#3b82f6', color: '#fff' }}>Next →</button>
      </div>
    </div>
  );
}

// ─── Step 6: Cabinet Modules ──────────────────────────────────────────────────

function Step6({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { model, addModule, updateModule, removeModule, geo } = useApp();
  const [editId, setEditId] = useState<string | null>(null);

  const addBaseModule = (wallId: string) => {
    const newMod: CabinetModule = {
      id: `BASE-${wallId}-${Date.now()}`,
      type: 'base', wallId,
      position: -1,
      width: 700, height: 750, depth: 600,
      shutterRequired: true, hasDrawer: false, hasShelf: true,
      isFixed: false,
    };
    addModule(newMod);
  };

  const addTrolley = (wallId: string) => {
    addModule({
      id: `TROLL-${wallId}-${Date.now()}`,
      type: 'trolley', wallId, position: -1,
      width: 450, height: 750, depth: 600,
      shutterRequired: false, hasDrawer: false, hasShelf: false,
      isFixed: true,
    });
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <p className="text-sm" style={{ color: '#64748b' }}>Configure cabinet modules for each wall</p>

      {model.kitchen.walls.map((wall) => {
        const wallMods = model.modules.filter((m) => m.wallId === wall.id);
        const avail = geo.availableWidth[wall.id] ?? 0;
        const used = geo.usedWidth[wall.id] ?? 0;
        const overflow = used > avail;
        return (
          <div key={wall.id} className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#1e2535', border: `1.5px solid ${overflow ? '#ef4444' : '#2a3347'}` }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold" style={{ color: '#e2e8f0' }}>Wall {wall.id} — {wall.length} mm</p>
              <span className="text-xs font-mono" style={{ color: overflow ? '#ef4444' : '#10b981' }}>
                {Math.round(used)}/{Math.round(avail)} mm
              </span>
            </div>
            {wallMods.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#161b27', border: '1px solid #2a3347' }}>
                <span className="text-xs font-mono font-bold flex-1" style={{ color: '#60a5fa' }}>{m.id.split('-').slice(0, 2).join('-')}</span>
                <span className="text-xs" style={{ color: '#64748b' }}>{m.type}</span>
                {editId === m.id ? (
                  <input
                    type="number" inputMode="numeric"
                    value={m.width}
                    onChange={(e) => updateModule(m.id, { width: Number(e.target.value) })}
                    className="w-20 rounded px-2 py-1 text-sm font-mono text-center outline-none"
                    style={{ background: '#1e2535', border: '2px solid #3b82f6', color: '#60a5fa' }}
                    onBlur={() => setEditId(null)}
                    autoFocus
                  />
                ) : (
                  <button onClick={() => setEditId(m.id)} className="text-xs font-mono px-2 py-1 rounded" style={{ background: '#1e2535', color: '#60a5fa', border: '1px solid #2a3347' }}>
                    {m.width} mm
                  </button>
                )}
                <button onClick={() => removeModule(m.id)} className="text-xs px-2 py-1 rounded" style={{ background: '#450a0a', color: '#fca5a5' }}>✕</button>
              </div>
            ))}
            <div className="flex gap-2">
              <button onClick={() => addBaseModule(wall.id)} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: '#064e3b', color: '#6ee7b7', border: '1.5px solid #065f46' }}>
                + Base Cabinet
              </button>
              {model.kitchen.trolleyRequired && (
                <button onClick={() => addTrolley(wall.id)} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: '#78350f', color: '#fcd34d', border: '1.5px solid #92400e' }}>
                  + Trolley
                </button>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex gap-3 mt-2">
        <button onClick={onBack} className="flex-1 py-4 rounded-xl font-bold border" style={{ background: 'transparent', border: '2px solid #2a3347', color: '#94a3b8' }}>← Back</button>
        <button onClick={onNext} className="flex-1 py-4 rounded-xl font-bold" style={{ background: '#3b82f6', color: '#fff' }}>Next →</button>
      </div>
    </div>
  );
}

// ─── Step 7: Review ───────────────────────────────────────────────────────────

function Step7({ onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  const { model, geo, setScreen } = useApp();
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="rounded-xl p-4" style={{ background: '#1e2535', border: '1.5px solid #2a3347' }}>
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#64748b' }}>Measurement Completion</p>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 rounded-full h-3" style={{ background: '#161b27' }}>
            <div className="h-3 rounded-full" style={{ background: '#3b82f6', width: `${geo.completionPercent}%` }} />
          </div>
          <span className="text-xl font-bold font-mono" style={{ color: '#60a5fa' }}>{geo.completionPercent}%</span>
        </div>
      </div>

      {geo.validationIssues.map((issue) => (
        <div key={issue.id} className="flex gap-3 items-start rounded-lg px-4 py-3" style={{
          background: issue.level === 'error' ? '#450a0a' : issue.level === 'warning' ? '#451a03' : '#0c2a1a',
          border: `1px solid ${issue.level === 'error' ? '#ef4444' : issue.level === 'warning' ? '#f59e0b' : '#10b981'}`,
        }}>
          <span>{issue.level === 'error' ? '🔴' : issue.level === 'warning' ? '🟡' : '🟢'}</span>
          <span className="text-sm" style={{ color: '#e2e8f0' }}>{issue.message}</span>
        </div>
      ))}

      {geo.validationIssues.length === 0 && (
        <div className="flex gap-3 items-center rounded-lg px-4 py-4" style={{ background: '#0c2a1a', border: '1px solid #10b981' }}>
          <span>✅</span>
          <span className="text-sm font-bold" style={{ color: '#6ee7b7' }}>All measurements valid — READY FOR DRAWING</span>
        </div>
      )}

      <button onClick={() => setScreen('drawing')} className="w-full py-5 rounded-xl font-bold text-base mt-2" style={{ background: '#1d4ed8', color: '#fff' }}>
        Open Live Drawing →
      </button>
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-4 rounded-xl font-bold border" style={{ background: 'transparent', border: '2px solid #2a3347', color: '#94a3b8' }}>← Back</button>
        <button onClick={onFinish} className="flex-1 py-4 rounded-xl font-bold" style={{ background: '#3b82f6', color: '#fff' }}>Finish</button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const KitchenSteps: React.FC = () => {
  const { model, completeStep, setStep, setScreen } = useApp();
  const step = model.currentStep || 1;
  const goNext = () => { completeStep(step); setStep(step + 1); };
  const goBack = () => setStep(Math.max(1, step - 1));

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0d1117' }}>
      <StepHeader step={step} total={TOTAL_STEPS} />
      {step === 1 && <Step1 onNext={goNext} />}
      {step === 2 && <Step2 onNext={goNext} onBack={goBack} />}
      {step === 3 && <Step3 onNext={goNext} onBack={goBack} />}
      {step === 4 && <Step4 onNext={goNext} onBack={goBack} />}
      {step === 5 && <Step5 onNext={goNext} onBack={goBack} />}
      {step === 6 && <Step6 onNext={goNext} onBack={goBack} />}
      {step === 7 && <Step7 onBack={goBack} onFinish={() => setScreen('drawing')} />}
    </div>
  );
};
