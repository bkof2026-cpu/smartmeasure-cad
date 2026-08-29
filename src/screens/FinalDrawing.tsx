import React, { useCallback, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { PlanView } from '../drawing/PlanView';
import { ElevationA } from '../drawing/ElevationA';
import { ElevationB } from '../drawing/ElevationB';

// ─── Project info title block ─────────────────────────────────────────────────
function TitleBlock() {
  const { model, geo } = useApp();
  const p = model.project;
  return (
    <div className="rounded-xl overflow-hidden border" style={{ background: '#131920', borderColor: '#243045' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: '#243045', background: '#1a2233' }}>
        <div>
          <div className="text-lg font-black tracking-tight" style={{ color: '#e2e8f0' }}>
            SmartMeasure <span style={{ color: '#3b82f6' }}>CAD</span>
          </div>
          <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>KITCHEN WORKING DRAWING SET</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold font-mono" style={{ color: '#60a5fa' }}>{p.projectId}</div>
          <div className="text-xs" style={{ color: '#4a5f7a' }}>Drawn: {p.date}</div>
        </div>
      </div>
      {/* Details grid */}
      <div className="grid gap-px" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', background: '#243045' }}>
        {[
          { label: 'Client', value: p.clientName },
          { label: 'Address', value: p.address },
          { label: 'Measured By', value: p.measuredBy },
          { label: 'Contact', value: p.contactNumber },
          { label: 'Kitchen Type', value: model.kitchen.type.toUpperCase() },
          { label: 'Wall A', value: `${model.kitchen.walls.find((w) => w.id === 'A')?.length ?? '-'} mm` },
          { label: 'Wall B', value: `${model.kitchen.walls.find((w) => w.id === 'B')?.length ?? 'N/A'} mm` },
          { label: 'Ceiling Height', value: `${model.kitchen.ceilingHeight} mm` },
        ].map(({ label, value }) => (
          <div key={label} className="px-4 py-2.5" style={{ background: '#131920' }}>
            <div className="text-xs font-bold tracking-widest uppercase mb-0.5" style={{ color: '#3d4f6a' }}>{label}</div>
            <div className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>{value || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Materials & hardware table ────────────────────────────────────────────────
function MaterialsTable() {
  const { model } = useApp();
  const materials = [
    { item: 'Carcass', spec: '18mm BWR Plywood / MDF', finish: 'As selected', note: 'DEMO — update with actual spec' },
    { item: 'Shutter', spec: '18mm HDF / Acrylic / PU', finish: 'As per schedule', note: 'DEMO — update' },
    { item: 'Counter Top', spec: 'Granite / Quartz / SS', finish: 'Polished', note: 'DEMO — confirm with client' },
    { item: 'Hardware', spec: 'Hettich / Hafele / Ebco', finish: 'SS/Matt', note: 'DEMO — confirm brand' },
    { item: 'Handles', spec: 'Aluminium D-Pull', finish: 'Matt Charcoal', note: 'DEMO — update' },
    { item: 'Skirting', spec: 'Aluminium kickboard', finish: 'As carcass', note: 'DEMO' },
    { item: 'Loft', spec: '18mm BWR Ply', finish: 'As main cabinet', note: 'DEMO' },
  ];
  return (
    <div className="rounded-xl overflow-hidden border" style={{ background: '#131920', borderColor: '#243045' }}>
      <div className="px-4 py-2 border-b" style={{ borderColor: '#243045', background: '#1a2233' }}>
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>Materials & Hardware — DEMO SCHEDULE</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: '#1a2233' }}>
              {['Item', 'Specification', 'Finish', 'Note'].map((h) => (
                <th key={h} className="px-4 py-2 text-left font-bold tracking-widest uppercase"
                  style={{ color: '#4a5f7a', borderBottom: '1px solid #243045' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {materials.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #1a2233' }}>
                <td className="px-4 py-2 font-bold font-mono" style={{ color: '#60a5fa' }}>{row.item}</td>
                <td className="px-4 py-2" style={{ color: '#94a3b8' }}>{row.spec}</td>
                <td className="px-4 py-2" style={{ color: '#94a3b8' }}>{row.finish}</td>
                <td className="px-4 py-2 italic" style={{ color: '#4a5f7a' }}>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Validation checklist ──────────────────────────────────────────────────────
function ValidationChecklist() {
  const { geo } = useApp();
  const checks = [
    { label: 'Project details', ok: true },
    { label: 'Wall A measured', ok: (geo.walls.find((w) => w.id === 'A')?.length ?? 0) > 0 },
    { label: 'Ceiling height recorded', ok: geo.ceilingHeight > 0 },
    { label: 'Cabinet modules configured', ok: geo.baseModules.length > 0 },
    { label: 'No width overflow', ok: geo.validationIssues.filter((i) => i.level === 'error').length === 0 },
    { label: 'Photo evidence captured', ok: true },
  ];
  const allOk = checks.every((c) => c.ok);
  return (
    <div className="rounded-xl overflow-hidden border" style={{ background: '#131920', borderColor: '#243045' }}>
      <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: '#243045', background: '#1a2233' }}>
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>Drawing Checklist</span>
        <span className="text-sm font-bold font-mono" style={{ color: '#60a5fa' }}>{geo.completionPercent}%</span>
      </div>
      <div className="px-4 py-3 flex flex-col gap-1.5">
        {checks.map(({ label, ok }) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            <span style={{ color: ok ? '#10b981' : '#f59e0b' }}>{ok ? '✓' : '⚠'}</span>
            <span style={{ color: ok ? '#94a3b8' : '#fcd34d' }}>{label}</span>
          </div>
        ))}
        {allOk && (
          <div className="mt-2 px-3 py-2 rounded-lg text-sm font-bold text-center"
            style={{ background: '#0c2a1a', color: '#6ee7b7', border: '1px solid #065f46' }}>
            ✅ READY FOR FINAL DRAWING
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Drawing sheet grid ────────────────────────────────────────────────────────
function DrawingSheet() {
  const { model, geo, selectedModuleId, setSelectedModuleId } = useApp();
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
      {/* Plan */}
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#243045' }}>
        <div className="px-3 py-1.5 border-b text-xs font-bold font-mono" style={{ background: '#1a2233', borderColor: '#243045', color: '#4a5f7a' }}>
          KITCHEN PLAN — TOP VIEW
        </div>
        <div style={{ height: 360, background: '#fff' }}>
          <PlanView geo={geo} projectId={model.project.projectId}
            selectedModuleId={selectedModuleId} onSelectModule={setSelectedModuleId} />
        </div>
      </div>
      {/* Elevation A */}
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#243045' }}>
        <div className="px-3 py-1.5 border-b text-xs font-bold font-mono" style={{ background: '#1a2233', borderColor: '#243045', color: '#4a5f7a' }}>
          ELEVATION A — FRONT VIEW (WALL A)
        </div>
        <div style={{ height: 360, background: '#fff' }}>
          <ElevationA geo={geo} projectId={model.project.projectId}
            selectedModuleId={selectedModuleId} onSelectModule={setSelectedModuleId} />
        </div>
      </div>
      {/* Elevation B */}
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#243045' }}>
        <div className="px-3 py-1.5 border-b text-xs font-bold font-mono" style={{ background: '#1a2233', borderColor: '#243045', color: '#4a5f7a' }}>
          ELEVATION B — SIDE VIEW (WALL B)
        </div>
        <div style={{ height: 360, background: '#fff' }}>
          <ElevationB geo={geo} projectId={model.project.projectId} />
        </div>
      </div>
      {/* Future views placeholder */}
      <div className="rounded-xl overflow-hidden border flex items-center justify-center" style={{ borderColor: '#243045', height: 360 }}>
        <div className="text-center" style={{ color: '#3d4f6a', fontFamily: "'DM Sans', sans-serif" }}>
          <div className="text-3xl mb-3">📐</div>
          <div className="text-sm font-semibold mb-1">Counter Plan / Section / Detail</div>
          <div className="text-xs">Coming in next version</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export const FinalDrawing: React.FC = () => {
  const { model, setScreen } = useApp();
  const sheetRef = useRef<HTMLDivElement>(null);

  const downloadSVG = useCallback(() => {
    const svgs = document.querySelectorAll('svg');
    if (!svgs.length) return;
    const combo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4000 6000">${Array.from(svgs).map((s, i) => `<g transform="translate(${i % 2 * 2000}, ${Math.floor(i / 2) * 3000})">${s.innerHTML}</g>`).join('')}</svg>`;
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([combo], { type: 'image/svg+xml' })),
      download: `${model.project.projectId}-final-drawing.svg`,
    });
    a.click();
  }, [model.project.projectId]);

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0d1117' }}>
      {/* Top bar */}
      <div className="flex items-center gap-4 px-5 py-3 border-b sticky top-0 z-10"
        style={{ background: '#0d1117', borderColor: '#243045' }}>
        <button onClick={() => setScreen('drawing')}
          className="px-4 py-2 rounded-xl text-sm font-bold"
          style={{ background: '#1a2233', color: '#94a3b8', border: '1px solid #243045' }}>
          ← Drawing
        </button>
        <h1 className="text-base font-bold" style={{ color: '#e2e8f0' }}>Final Drawing Set</h1>
        <div className="ml-auto flex gap-2">
          <button onClick={downloadSVG}
            className="px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: '#065f46', color: '#6ee7b7', border: '1px solid #065f46' }}>
            ↓ Download SVG
          </button>
          <button
            className="px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: '#1a2233', color: '#64748b', border: '1px solid #243045' }}
            title="PDF export — coming next"
          >
            ↓ PDF (soon)
          </button>
          <button
            className="px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: '#1a2233', color: '#64748b', border: '1px solid #243045' }}
            title="DXF export — coming next"
          >
            ↓ DXF (soon)
          </button>
        </div>
      </div>

      {/* Sheet content */}
      <div ref={sheetRef} className="flex flex-col gap-5 p-5">
        <TitleBlock />
        <DrawingSheet />
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <MaterialsTable />
          <ValidationChecklist />
        </div>
        {model.project.notes && (
          <div className="rounded-xl p-4 border" style={{ background: '#131920', borderColor: '#243045' }}>
            <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#4a5f7a' }}>Site Notes</p>
            <p className="text-sm" style={{ color: '#94a3b8' }}>{model.project.notes}</p>
          </div>
        )}
        <div className="text-center py-4 text-xs" style={{ color: '#243045', fontFamily: "'JetBrains Mono', monospace" }}>
          SmartMeasure CAD — PROTOTYPE · {model.project.projectId} · Generated {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
};
