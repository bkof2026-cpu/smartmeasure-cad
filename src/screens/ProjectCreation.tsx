import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import { openRutujaDemo } from '../App';

export const ProjectCreation: React.FC = () => {
  const { model, updateProject, setScreen, loadDemo, newProject } = useApp();
  const [saved, setSaved] = useState(false);

  const field = (label: string, key: keyof typeof model.project, type = 'text', placeholder = '') => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#94a3b8' }}>
        {label}
      </label>
      <input
        type={type}
        value={(model.project[key] as string) ?? ''}
        placeholder={placeholder}
        onChange={(e) => { updateProject({ [key]: e.target.value }); setSaved(false); }}
        className="rounded-lg px-4 py-3 text-base font-mono outline-none border focus:ring-2 focus:ring-blue-500"
        style={{ background: '#1e2535', border: '1.5px solid #2a3347', color: '#e2e8f0' }}
      />
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0d1117' }}>
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: '#2a3347' }}>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">📐</span>
          <h1 className="text-xl font-bold" style={{ color: '#e2e8f0' }}>New Project</h1>
        </div>
        <p className="text-sm" style={{ color: '#64748b' }}>Enter project details before starting measurement</p>
      </div>

      <div className="flex flex-col gap-5 p-6 max-w-lg">
        {field('Client Name', 'clientName', 'text', 'e.g. Sharma Residence')}
        {field('Project ID', 'projectId', 'text', 'e.g. PRJ-2024-001')}
        {field('Site Address', 'address', 'text', '42, Park Avenue, Hyderabad')}
        {field('Measurement Person', 'measuredBy', 'text', 'Your name')}
        {field('Date', 'date', 'date')}
        {field('Contact Number', 'contactNumber', 'tel', '+91 98765 43210')}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#94a3b8' }}>Notes</label>
          <textarea
            value={model.project.notes}
            onChange={(e) => { updateProject({ notes: e.target.value }); setSaved(false); }}
            rows={3}
            className="rounded-lg px-4 py-3 text-base outline-none border focus:ring-2 focus:ring-blue-500 resize-none"
            style={{ background: '#1e2535', border: '1.5px solid #2a3347', color: '#e2e8f0' }}
            placeholder="Any site notes..."
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-2">
          <button
            onClick={() => { setSaved(true); setScreen('products'); }}
            className="w-full py-4 rounded-xl font-bold text-base tracking-wide transition-all"
            style={{ background: '#3b82f6', color: '#fff' }}
          >
            START MEASUREMENT →
          </button>

          <div className="flex gap-3">
            <button
              onClick={loadDemo}
              className="flex-1 py-3 rounded-xl font-semibold text-sm border transition-all"
              style={{ background: 'transparent', border: '1.5px solid #2a3347', color: '#94a3b8' }}
            >
              Load Demo
            </button>
            <button
              onClick={newProject}
              className="flex-1 py-3 rounded-xl font-semibold text-sm border transition-all"
              style={{ background: 'transparent', border: '1.5px solid #2a3347', color: '#94a3b8' }}
            >
              New Project
            </button>
          </div>

          {/* Rutuja Joshi real project demo */}
          <div className="rounded-xl p-4 border" style={{ background: '#0c1a2a', borderColor: '#1a3a5a' }}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: 20 }}>📋</span>
              <div>
                <div className="text-sm font-bold" style={{ color: '#60a5fa' }}>Real Project Demo</div>
                <div className="text-xs" style={{ color: '#4a6a8a' }}>Arc. Rutuja Joshi · Best Kitchennet · Nashik</div>
              </div>
              <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded" style={{ background: '#1a3a2a', color: '#6ee7b7' }}>
                PDF IMPORTED
              </span>
            </div>
            <p className="text-xs mb-3" style={{ color: '#4a6a8a' }}>
              L-Shape kitchen · Wall A 3085mm · Wall B 2560mm · Ceiling 2750mm ·
              Olivilya finish · Fluted glass crockery · Rolling shutter storage · Hettich hardware
            </p>
            <button
              onClick={openRutujaDemo}
              className="w-full py-3 rounded-xl font-bold text-sm"
              style={{ background: '#1e4a80', color: '#93c5fd', border: '1.5px solid #2563eb' }}
            >
              View 2D Drawing with All Measurements →
            </button>
          </div>
        </div>

        {saved && (
          <p className="text-sm text-center" style={{ color: '#10b981' }}>✓ Auto-saved</p>
        )}
      </div>
    </div>
  );
};
