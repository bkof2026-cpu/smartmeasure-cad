import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import type { Opening, CabinetModule } from '../store/types';

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

function Step1({ onNext }: { onNext: () => void }) {
  const { model, setKitchenType } = useApp();
  const types = [
    { id: 'straight', label: 'Straight', active: true },
    { id: 'l-shape', label: 'L Shape', active: true },
    { id: 'u-shape', label: 'U Shape', active: false },
    { id: 'parallel', label: 'Parallel', active: false },
    { id: 'island', label: 'Island', active: false },
    { id: 'custom', label: 'Custom', active: false },
  ] as const;
  return (
    <div className="flex flex-col gap-4 p-6">
      <p className="text-sm" style={{ color: '#64748b' }}>Select the kitchen layout type</p>
      <div className="grid grid-cols-2 gap-3">
        {types.map((t) => (
          <button
            key={t.id}
            disabled={!t.active}
            onClick={() => t.active && setKitchenType(t.id)}
            className="py-5 rounded-xl font-bold text-base transition-all relative"
            style={{
              background: model.kitchen.type === t.id ? '#1d4ed8' : '#1e2535',
              color: model.kitchen.type === t.id ? '#fff' : t.active ? '#94a3b8' : '#374151',
              border: model.kitchen.type === t.id ? '2px solid #3b82f6' : '2px solid #2a3347',
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

function Step2({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { model, updateKitchenConfig } = useApp();
  const k = model.kitchen;
  const cfg = (key: keyof typeof k) => (v: boolean) => updateKitchenConfig({ [key]: v });
  return (
    <div className="flex flex-col gap-2 p-6">
      <p className="text-sm mb-2" style={{ color: '#64748b' }}>What does this kitchen require?</p>
      <Toggle label="Existing Kadappa / Platform" value={k.hasKadappa} onChange={cfg('hasKadappa')} />
      <Toggle label="Existing Skirting" value={k.hasSkirting} onChange={cfg('hasSkirting')} />
      <Toggle label="Loft Required" value={k.loftRequired} onChange={cfg('loftRequired')} />
      <Toggle label="Wall Cabinets Required" value={k.wallCabinetsRequired} onChange={cfg('wallCabinetsRequired')} />
      <Toggle label="Base Cabinets Required" value={k.baseCabinetsRequired} onChange={cfg('baseCabinetsRequired')} />
      <Toggle label="Trolley Required" value={k.trolleyRequired} onChange={cfg('trolleyRequired')} />
      <Toggle label="Open Box Required" value={k.openBoxRequired} onChange={cfg('openBoxRequired')} />
      <Toggle label="Tall Unit Required" value={k.tallUnitRequired} onChange={cfg('tallUnitRequired')} />
      <Toggle label="Corner Unit Required" value={k.cornerUnitRequired} onChange={cfg('cornerUnitRequired')} />
      <div className="flex gap-3 mt-4">
        <button onClick={onBack} className="flex-1 py-4 rounded-xl font-bold border" style={{ background: 'transparent', border: '2px solid #2a3347', color: '#94a3b8' }}>← Back</button>
        <button onClick={onNext} className="flex-1 py-4 rounded-xl font-bold" style={{ background: '#3b82f6', color: '#fff' }}>Next →</button>
      </div>
    </div>
  );
}

// ─── Step 3: Wall Measurements ────────────────────────────────────────────────

function Step3({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { model, updateWall, setCeilingHeight } = useApp();
  const k = model.kitchen;
  const wallA = k.walls.find((w) => w.id === 'A');
  const wallB = k.walls.find((w) => w.id === 'B');
  return (
    <div className="flex flex-col gap-5 p-6">
      <p className="text-sm" style={{ color: '#64748b' }}>Enter all wall dimensions in mm</p>
      <NumInput
        label="Wall A Length (Main Wall)"
        value={wallA?.length ?? 0}
        onChange={(v) => updateWall('A', v)}
        note="Measure from corner to corner along the main wall"
      />
      {k.type === 'l-shape' && (
        <NumInput
          label="Wall B Length (Side Wall)"
          value={wallB?.length ?? 0}
          onChange={(v) => updateWall('B', v)}
          note="Perpendicular wall from the same corner"
        />
      )}
      <NumInput
        label="Floor to Ceiling Height"
        value={k.ceilingHeight ?? 0}
        onChange={setCeilingHeight}
        note="Measure at multiple points — use the lowest value"
      />
      {k.hasKadappa && (
        <>
          <div className="h-px" style={{ background: '#2a3347' }} />
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>Existing Kadappa / Platform</p>
          <NumInput label="Kadappa Height" value={k.kadappa?.height ?? 0} onChange={(v) => updateWall('A', v)} />
          <NumInput label="Kadappa Depth" value={k.kadappa?.depth ?? 0} onChange={(v) => {}} />
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
