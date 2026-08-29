import React, { useState, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import { PlanView } from '../drawing/PlanView';
import { ElevationA } from '../drawing/ElevationA';
import { ElevationB } from '../drawing/ElevationB';
import { openRutujaDemo } from '../App';
import type { CabinetModule, ModuleType } from '../store/types';

type DrawTab = 'plan' | 'elev-a' | 'elev-b';
type PanelTab = 'measure' | 'drawing' | 'evidence' | 'ai';

// ─── Small shared helpers ──────────────────────────────────────────────────────

const Tag = ({ children, color = '#1e2535', text = '#94a3b8' }: {
  children: React.ReactNode; color?: string; text?: string;
}) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono"
    style={{ background: color, color: text }}>{children}</span>
);

const InlineNum = ({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) => (
  <input type="number" inputMode="numeric" value={value || ''} min={min} max={max}
    onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) onChange(v); }}
    className="w-24 rounded px-2 py-1 text-sm font-mono font-bold text-right outline-none"
    style={{ background: '#0d1117', border: '1.5px solid #2a3347', color: '#60a5fa' }}
  />
);

// ─── Wall measurement rows ────────────────────────────────────────────────────

function WallsPanel() {
  const { model, geo, updateWall, setCeilingHeight } = useApp();
  return (
    <div className="px-4 py-3 border-b" style={{ borderColor: '#243045' }}>
      <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#4a5f7a' }}>Site Dimensions</p>
      {model.kitchen.walls.map((w) => (
        <div key={w.id} className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-bold w-14" style={{ color: '#60a5fa' }}>Wall {w.id}</span>
          <input type="number" inputMode="numeric" value={w.length || ''}
            onChange={(e) => updateWall(w.id, Number(e.target.value))}
            className="flex-1 rounded-lg px-3 py-2.5 text-lg font-mono font-bold text-right outline-none"
            style={{ background: '#1a2233', border: '2px solid #243045', color: '#60a5fa' }} />
          <span className="text-xs w-8" style={{ color: '#3d4f6a' }}>mm</span>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-bold w-14" style={{ color: '#60a5fa' }}>Height</span>
        <input type="number" inputMode="numeric" value={model.kitchen.ceilingHeight || ''}
          onChange={(e) => setCeilingHeight(Number(e.target.value))}
          className="flex-1 rounded-lg px-3 py-2.5 text-lg font-mono font-bold text-right outline-none"
          style={{ background: '#1a2233', border: '2px solid #243045', color: '#60a5fa' }} />
        <span className="text-xs w-8" style={{ color: '#3d4f6a' }}>mm</span>
      </div>
    </div>
  );
}

// ─── Computed heights summary ──────────────────────────────────────────────────

function HeightsPanel() {
  const { geo } = useApp();
  const rows = [
    { label: 'Platform (Kadappa)', val: geo.kadappaHeight, color: '#d97706' },
    { label: 'Base Cabinet', val: geo.baseHeight, color: '#64748b' },
    { label: 'Counter Height', val: geo.counterHeight, color: '#3b82f6' },
    { label: 'Wall Cab Bottom', val: geo.wallCabBottom, color: '#64748b' },
    { label: 'Wall Cab Height', val: geo.wallCabHeight, color: '#64748b' },
    { label: 'Loft Bottom', val: geo.loftBottom, color: '#64748b' },
    { label: 'Loft Height', val: geo.loftHeight, color: '#78716c' },
  ];
  return (
    <div className="px-4 py-3 border-b" style={{ borderColor: '#243045' }}>
      <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#4a5f7a' }}>Computed Heights</p>
      {rows.map(({ label, val, color }) => (
        <div key={label} className="flex justify-between items-center py-0.5">
          <span className="text-xs" style={{ color: '#4a5f7a' }}>{label}</span>
          <span className="text-xs font-mono font-bold" style={{ color }}>{val} mm</span>
        </div>
      ))}
    </div>
  );
}

// ─── Module list panel ─────────────────────────────────────────────────────────

const MODULE_TYPE_COLORS: Record<ModuleType, { bg: string; text: string }> = {
  base: { bg: '#1a2a3a', text: '#60a5fa' },
  wall: { bg: '#1a2535', text: '#818cf8' },
  loft: { bg: '#262018', text: '#d97706' },
  trolley: { bg: '#2a1f0a', text: '#fbbf24' },
  'open-box': { bg: '#0a2218', text: '#34d399' },
  'tall-unit': { bg: '#1f1a2a', text: '#c084fc' },
  corner: { bg: '#1a2020', text: '#2dd4bf' },
};

function ModulesPanel() {
  const { model, geo, addModule, updateModule, removeModule } = useApp();
  const [editId, setEditId] = useState<string | null>(null);

  const addBase = (wallId: string) => addModule({
    id: `BASE-${wallId}-${Date.now()}`, type: 'base', wallId, position: -1,
    width: 700, height: 750, depth: 600, shutterRequired: true, hasDrawer: false, hasShelf: true, isFixed: false,
  });

  const addTrolley = (wallId: string, width: number) => addModule({
    id: `TROLL-${wallId}-${Date.now()}`, type: 'trolley', wallId, position: -1,
    width, height: 750, depth: 600, shutterRequired: false, hasDrawer: false, hasShelf: false, isFixed: true,
  });

  return (
    <div className="px-4 py-3 border-b" style={{ borderColor: '#243045' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#4a5f7a' }}>Cabinet Modules</p>
      </div>

      {model.kitchen.walls.map((wall) => {
        const wallMods = model.modules.filter((m) => m.wallId === wall.id);
        const avail = geo.availableWidth[wall.id] ?? 0;
        const used = geo.usedWidth[wall.id] ?? 0;
        const pct = avail > 0 ? Math.min(100, (used / avail) * 100) : 0;
        const overflow = used > avail + 5;
        return (
          <div key={wall.id} className="mb-4">
            {/* Wall header */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold font-mono" style={{ color: '#e2e8f0' }}>Wall {wall.id}</span>
              <span className="text-xs font-mono" style={{ color: overflow ? '#ef4444' : '#10b981' }}>
                {Math.round(used)}/{Math.round(avail)} mm
              </span>
              {overflow && <span className="text-xs font-bold" style={{ color: '#ef4444' }}>OVERFLOW</span>}
            </div>
            {/* Distribution bar */}
            <div className="h-1.5 rounded-full mb-2 overflow-hidden" style={{ background: '#1a2233' }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: overflow ? '#ef4444' : '#3b82f6' }} />
            </div>

            {/* Module rows */}
            {wallMods.map((mod) => {
              const computed = geo.baseModules.find((c) => c.id === mod.id);
              const colors = MODULE_TYPE_COLORS[mod.type] ?? MODULE_TYPE_COLORS.base;
              return (
                <div key={mod.id} className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 mb-1"
                  style={{ background: colors.bg, border: '1px solid #243045' }}>
                  <Tag color={colors.bg} text={colors.text}>{computed?.label ?? mod.type.slice(0, 2).toUpperCase()}</Tag>
                  <span className="text-xs flex-1 truncate" style={{ color: '#64748b' }}>{mod.type}</span>
                  {editId === mod.id ? (
                    <input type="number" inputMode="numeric" value={mod.width} autoFocus
                      onChange={(e) => updateModule(mod.id, { width: Number(e.target.value) })}
                      onBlur={() => setEditId(null)} onKeyDown={(e) => e.key === 'Enter' && setEditId(null)}
                      className="w-20 rounded px-2 py-1 text-sm font-mono text-center outline-none"
                      style={{ background: '#0d1117', border: '2px solid #3b82f6', color: '#60a5fa' }}
                    />
                  ) : (
                    <button onClick={() => setEditId(mod.id)}
                      className="px-2 py-1 rounded text-xs font-mono font-bold transition-all"
                      style={{ background: '#0d1117', color: '#60a5fa', border: '1px solid #2a3347' }}>
                      {mod.width}
                    </button>
                  )}
                  <span className="text-xs" style={{ color: '#3d4f6a' }}>mm</span>
                  <button onClick={() => removeModule(mod.id)} className="text-xs px-1.5 py-1 rounded ml-1"
                    style={{ background: '#450a0a', color: '#fca5a5' }}>✕</button>
                </div>
              );
            })}

            {/* Add buttons */}
            <div className="flex gap-1.5 mt-1.5">
              <button onClick={() => addBase(wall.id)} className="flex-1 py-2 rounded-lg text-xs font-bold"
                style={{ background: '#0c2a1a', color: '#34d399', border: '1px solid #065f46' }}>
                + Base
              </button>
              {model.kitchen.trolleyRequired && [450, 600].map((tw) => (
                <button key={tw} onClick={() => addTrolley(wall.id, tw)}
                  className="px-3 py-2 rounded-lg text-xs font-bold"
                  style={{ background: '#2a1f0a', color: '#fbbf24', border: '1px solid #92400e' }}>
                  T-{tw}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Version control panel ────────────────────────────────────────────────────

function VersionPanel() {
  const { model, saveVersion } = useApp();
  const [name, setName] = useState('');
  return (
    <div className="px-4 py-3 border-b" style={{ borderColor: '#243045' }}>
      <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#4a5f7a' }}>Versions</p>
      <div className="flex gap-2 mb-2">
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder={`V${model.versions.length + 1} — description`}
          className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
          style={{ background: '#1a2233', border: '1.5px solid #243045', color: '#e2e8f0' }} />
        <button onClick={() => { saveVersion(name || `V${model.versions.length + 1}`, ''); setName(''); }}
          className="px-3 py-2 rounded-lg font-bold text-xs"
          style={{ background: '#1d4ed8', color: '#fff' }}>Save</button>
      </div>
      {model.versions.slice(-4).reverse().map((v) => (
        <div key={v.id} className="flex items-center gap-2 text-xs py-0.5">
          <span className="font-mono font-bold w-8" style={{ color: '#60a5fa' }}>{v.id}</span>
          <span className="flex-1 truncate" style={{ color: '#64748b' }}>{v.name}</span>
          <span style={{ color: '#3d4f6a' }}>{new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Evidence panel ────────────────────────────────────────────────────────────

function EvidencePanel() {
  const { model, addEvidence } = useApp();
  const mockCapture = (type: 'photo' | 'video', label: string, measurementId: string) =>
    addEvidence({ id: `EV-${Date.now()}`, measurementId, label, type, caption: `${type} — ${label}`, timestamp: new Date().toISOString() });

  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto h-full">
      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#4a5f7a' }}>Photo / Video Evidence</p>
      <div className="flex flex-col gap-2">
        {model.kitchen.walls.map((w) => (
          <div key={w.id} className="flex items-center gap-2 rounded-lg px-3 py-2.5"
            style={{ background: '#1a2233', border: '1px solid #243045' }}>
            <span className="text-xs font-mono font-bold flex-1" style={{ color: '#94a3b8' }}>
              Wall {w.id} — {w.length} mm
            </span>
            <button onClick={() => mockCapture('photo', `Wall ${w.id}`, w.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#1d4ed8', color: '#fff' }}>📷</button>
            <button onClick={() => mockCapture('video', `Wall ${w.id}`, w.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#4c1d95', color: '#ddd6fe' }}>🎬</button>
          </div>
        ))}
        {model.openings.map((op) => (
          <div key={op.id} className="flex items-center gap-2 rounded-lg px-3 py-2.5"
            style={{ background: '#1a2233', border: '1px solid #243045' }}>
            <span className="text-xs font-mono font-bold flex-1" style={{ color: '#94a3b8' }}>{op.id}</span>
            <button onClick={() => mockCapture('photo', op.id, op.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#1d4ed8', color: '#fff' }}>📷</button>
          </div>
        ))}
      </div>
      <p className="text-xs font-bold tracking-widest uppercase mt-2" style={{ color: '#4a5f7a' }}>Gallery ({model.evidence.length})</p>
      {model.evidence.length === 0 && (
        <p className="text-sm py-4 text-center" style={{ color: '#3d4f6a' }}>No evidence yet</p>
      )}
      {model.evidence.map((ev) => (
        <div key={ev.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5"
          style={{ background: '#1a2233', border: '1px solid #243045' }}>
          <span className="text-xl">{ev.type === 'photo' ? '📷' : ev.type === 'video' ? '🎬' : '📝'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-mono font-bold" style={{ color: '#60a5fa' }}>{ev.label}</div>
            <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>{ev.caption}</div>
            <div className="text-xs mt-1" style={{ color: '#3d4f6a' }}>{new Date(ev.timestamp).toLocaleTimeString()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── AI assistant ──────────────────────────────────────────────────────────────

function AIPanel() {
  const { model, updateWall, setCeilingHeight, updateModule } = useApp();
  const wallALen = model.kitchen.walls.find((w) => w.id === 'A')?.length ?? 0;
  const [msgs, setMsgs] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    { role: 'assistant', text: `Wall A = ${wallALen} mm. Is there any window, door or obstacle on Wall A? Describe its position and size.` },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const q = input.trim(); if (!q) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    let reply = "I've noted that. Anything else to record?";
    const lo = q.toLowerCase();
    const wa = lo.match(/wall\s+a\s*[=is:]+\s*(\d+)/);
    const wb = lo.match(/wall\s+b\s*[=is:]+\s*(\d+)/);
    const ht = lo.match(/(?:height|ceiling)\s*[=:is]+\s*(\d+)/);
    const tr = lo.match(/trolley\s*[=:to]+\s*(\d+)/);
    if (wa) { updateWall('A', +wa[1]); reply = `✓ Wall A → ${wa[1]} mm. Drawing updated.`; }
    else if (wb) { updateWall('B', +wb[1]); reply = `✓ Wall B → ${wb[1]} mm. Plan view updated.`; }
    else if (ht) { setCeilingHeight(+ht[1]); reply = `✓ Ceiling height → ${ht[1]} mm. Elevations recalculated.`; }
    else if (tr) {
      const t = model.modules.find((m) => m.type === 'trolley');
      if (t) { updateModule(t.id, { width: +tr[1] }); reply = `✓ Trolley → ${tr[1]} mm. Cabinet distribution recalculated.`; }
      else reply = "No trolley found — add one in the Modules section.";
    } else if (lo.includes('help')) {
      reply = "Try: 'Wall A = 3200' · 'trolley = 600' · 'height 2700' · 'wall B = 3000'";
    }
    setMsgs((m) => [...m, { role: 'assistant', text: reply }]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b" style={{ borderColor: '#243045' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            style={{ background: '#1d4ed8' }}>🤖</div>
          <div>
            <p className="text-sm font-bold" style={{ color: '#e2e8f0' }}>Measurement Assistant</p>
            <p className="text-xs" style={{ color: '#3d4f6a' }}>Mock AI · Claude API ready via backend</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="rounded-2xl px-3 py-2 text-sm max-w-[80%]"
              style={{
                background: m.role === 'user' ? '#1d4ed8' : '#1a2233',
                color: '#e2e8f0',
                borderBottomRightRadius: m.role === 'user' ? 4 : undefined,
                borderBottomLeftRadius: m.role === 'assistant' ? 4 : undefined,
              }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-3 py-2 text-sm" style={{ background: '#1a2233', color: '#4a5f7a' }}>
              Analysing…
            </div>
          </div>
        )}
      </div>
      <div className="p-3 border-t" style={{ borderColor: '#243045' }}>
        <p className="text-xs mb-1.5" style={{ color: '#3d4f6a' }}>
          Try: "Wall A = 3200" · "trolley = 600" · "height 2700"
        </p>
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Enter measurement in plain English…"
            className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: '#1a2233', border: '1.5px solid #243045', color: '#e2e8f0' }} />
          <button onClick={send} disabled={loading}
            className="px-4 rounded-xl font-bold text-sm"
            style={{ background: '#3b82f6', color: '#fff' }}>↑</button>
        </div>
      </div>
    </div>
  );
}

// ─── Validation & completion bar ──────────────────────────────────────────────

function ValidationBar() {
  const { geo } = useApp();
  const errors = geo.validationIssues.filter((i) => i.level === 'error').length;
  const warnings = geo.validationIssues.filter((i) => i.level === 'warning').length;
  return (
    <div className="border-t px-4 py-2.5" style={{ borderColor: '#243045', background: '#0d1117', flexShrink: 0 }}>
      <div className="flex items-center gap-3 mb-1.5">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1a2233' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${geo.completionPercent}%`, background: '#3b82f6' }} />
        </div>
        <span className="text-xs font-mono font-bold" style={{ color: '#60a5fa' }}>{geo.completionPercent}%</span>
        {errors > 0 && <span className="text-xs" style={{ color: '#ef4444' }}>🔴 {errors}</span>}
        {warnings > 0 && <span className="text-xs" style={{ color: '#f59e0b' }}>🟡 {warnings}</span>}
        {errors === 0 && warnings === 0 && <span className="text-xs" style={{ color: '#10b981' }}>✓ OK</span>}
      </div>
      <div className="flex flex-col gap-0.5 max-h-16 overflow-y-auto">
        {geo.validationIssues.slice(0, 3).map((iss) => (
          <div key={iss.id} className="text-xs truncate"
            style={{ color: iss.level === 'error' ? '#fca5a5' : '#fcd34d' }}>
            {iss.level === 'error' ? '🔴' : '🟡'} {iss.message}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Left measurement panel ────────────────────────────────────────────────────

function LeftPanel({ panelTab, setPanelTab }: { panelTab: PanelTab; setPanelTab: (t: PanelTab) => void }) {
  return (
    <div className="flex flex-col h-full" style={{ background: '#0d1117' }}>
      {/* Sub-tabs inside left panel */}
      <div className="flex border-b" style={{ borderColor: '#243045', background: '#131920' }}>
        {(['measure', 'evidence', 'ai'] as PanelTab[]).map((t) => (
          <button key={t} onClick={() => setPanelTab(t)}
            className="flex-1 py-2.5 text-xs font-bold tracking-widest uppercase"
            style={{
              color: panelTab === t ? '#60a5fa' : '#3d4f6a',
              borderBottom: panelTab === t ? '2px solid #3b82f6' : '2px solid transparent',
            }}>
            {t === 'measure' ? 'Measure' : t === 'evidence' ? 'Evidence' : 'AI'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {panelTab === 'measure' && (
          <>
            <WallsPanel />
            <HeightsPanel />
            <ModulesPanel />
            <VersionPanel />
          </>
        )}
        {panelTab === 'evidence' && <EvidencePanel />}
        {panelTab === 'ai' && <AIPanel />}
      </div>

      <ValidationBar />
    </div>
  );
}

// ─── Drawing canvas area ───────────────────────────────────────────────────────

const DRAW_TABS: { id: DrawTab; label: string; active: boolean }[] = [
  { id: 'plan', label: 'PLAN', active: true },
  { id: 'elev-a', label: 'ELEVATION A', active: true },
  { id: 'elev-b', label: 'ELEVATION B', active: true },
];
const FUTURE_TABS = ['COUNTER PLAN', 'SECTION', 'DETAIL'];

function DrawingCanvas() {
  const { model, geo, selectedModuleId, setSelectedModuleId, setScreen } = useApp();
  const [drawTab, setDrawTab] = useState<DrawTab>('elev-a');

  const exportSVG = useCallback(() => {
    const svg = document.getElementById('main-drawing-svg');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `${model.project.projectId}-${drawTab}.svg`,
    });
    a.click();
  }, [model.project.projectId, drawTab]);

  return (
    <div className="flex flex-col h-full" style={{ background: '#1a1f2e' }}>
      {/* Drawing toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b" style={{ background: '#131920', borderColor: '#243045' }}>
        {DRAW_TABS.map((tab) => (
          <button key={tab.id} onClick={() => setDrawTab(tab.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono tracking-widest transition-all"
            style={{
              background: drawTab === tab.id ? '#1d4ed8' : 'transparent',
              color: drawTab === tab.id ? '#fff' : '#3d4f6a',
            }}>
            {tab.label}
          </button>
        ))}
        {FUTURE_TABS.map((t) => (
          <button key={t} disabled
            className="px-3 py-1.5 rounded-lg text-xs font-mono tracking-widest"
            style={{ color: '#243045', cursor: 'not-allowed' }}>{t}</button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {model.isDemoData && (
            <button
              onClick={openRutujaDemo}
              className="px-3 py-1 rounded text-xs font-bold transition-all"
              style={{ background: '#0c2a1a', color: '#6ee7b7', border: '1.5px solid #065f46', cursor: 'pointer' }}
              title="View Rutuja Joshi 2D PDF Drawing">
              📋 DEMO — View Full 2D Drawing
            </button>
          )}
          <button onClick={() => setScreen('final')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: '#065f46', color: '#6ee7b7', border: '1px solid #065f46' }}>
            📄 Final Drawing
          </button>
          <button onClick={exportSVG}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: '#1a2233', color: '#94a3b8', border: '1px solid #243045' }}>
            ↓ SVG
          </button>
        </div>
      </div>

      {/* SVG area */}
      <div className="flex-1 overflow-hidden p-3" style={{ background: '#e8eaf0' }}>
        <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl" style={{ background: '#fff' }}>
          {drawTab === 'plan' && (
            <PlanView geo={geo} projectId={model.project.projectId}
              selectedModuleId={selectedModuleId} onSelectModule={setSelectedModuleId} />
          )}
          {drawTab === 'elev-a' && (
            <ElevationA geo={geo} projectId={model.project.projectId}
              selectedModuleId={selectedModuleId} onSelectModule={setSelectedModuleId} />
          )}
          {drawTab === 'elev-b' && (
            <ElevationB geo={geo} projectId={model.project.projectId}
              selectedModuleId={selectedModuleId} onSelectModule={setSelectedModuleId} />
          )}
        </div>
      </div>

      {/* Selected module info */}
      {selectedModuleId && (() => {
        const m = [...geo.baseModules, ...geo.wallModules, ...geo.loftModules].find((m) => m.id === selectedModuleId);
        return m ? (
          <div className="flex items-center gap-4 px-4 py-2 border-t text-xs font-mono"
            style={{ background: '#131920', borderColor: '#243045' }}>
            <span className="font-bold" style={{ color: '#60a5fa' }}>{m.label}</span>
            <span style={{ color: '#4a5f7a' }}>x={m.x} · w={m.width} · h={m.height} · d={m.depth} · {m.shutterDivisions} shutter(s)</span>
            <button onClick={() => setSelectedModuleId(null)} className="ml-auto" style={{ color: '#3d4f6a' }}>✕</button>
          </div>
        ) : null;
      })()}
    </div>
  );
}

// ─── Main LiveDrawing screen ───────────────────────────────────────────────────

export const LiveDrawing: React.FC = () => {
  const [panelTab, setPanelTab] = useState<PanelTab>('measure');
  const [mobileTab, setMobileTab] = useState<'left' | 'drawing'>('drawing');

  return (
    <div className="flex flex-col h-full" style={{ background: '#0d1117' }}>
      {/* Mobile tab strip */}
      <div className="flex border-b lg:hidden" style={{ borderColor: '#243045', background: '#131920' }}>
        {(['measure', 'drawing', 'evidence', 'ai'] as PanelTab[]).map((t) => (
          <button key={t}
            onClick={() => { setPanelTab(t); setMobileTab(t === 'drawing' ? 'drawing' : 'left'); }}
            className="flex-1 py-3 text-xs font-bold tracking-widest uppercase"
            style={{
              color: (t === 'drawing' ? mobileTab === 'drawing' : panelTab === t && mobileTab === 'left') ? '#60a5fa' : '#3d4f6a',
              borderBottom: (t === 'drawing' ? mobileTab === 'drawing' : panelTab === t && mobileTab === 'left') ? '2px solid #3b82f6' : '2px solid transparent',
            }}>
            {t === 'measure' ? 'Measure' : t === 'drawing' ? 'Drawing' : t === 'evidence' ? 'Evidence' : 'AI'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="border-r flex flex-col overflow-hidden"
          style={{ borderColor: '#243045', width: 340, minWidth: 340, flexShrink: 0,
            display: mobileTab === 'left' ? 'flex' : 'none' }}
          data-desktop-always-visible>
          <LeftPanel panelTab={panelTab} setPanelTab={setPanelTab} />
        </div>

        {/* Drawing */}
        <div className="flex-1 overflow-hidden flex flex-col"
          style={{ display: mobileTab === 'drawing' ? 'flex' : 'none' }}>
          <DrawingCanvas />
        </div>
      </div>

      {/* Desktop: always show both — override mobile display */}
      <style>{`
        @media (min-width: 1024px) {
          [data-desktop-always-visible] { display: flex !important; }
          .flex-1.overflow-hidden.flex.flex-col { display: flex !important; }
        }
      `}</style>
    </div>
  );
};
