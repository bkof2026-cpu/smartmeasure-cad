import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import { RULE_LABELS, RULE_SECTIONS } from '../rules/defaultConfig';
import type { RuleParameters } from '../store/types';

export const AdminRules: React.FC = () => {
  const { rules, updateRule } = useApp();
  const [saved, setSaved] = useState(false);

  const handleChange = (key: keyof RuleParameters, val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      updateRule(key, num);
      setSaved(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0d1117' }}>
      <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: '#2a3347' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚙️</span>
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#e2e8f0' }}>Company Standards</h1>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Configure fabrication rules and dimensional standards</p>
          </div>
        </div>
        <div className="mt-3 rounded-lg px-4 py-3 flex items-center gap-3" style={{ background: '#451a03', border: '1px solid #92400e' }}>
          <span>⚠️</span>
          <p className="text-xs" style={{ color: '#fcd34d' }}>
            <strong>DEMO VALUES</strong> — All values below are placeholder/demo values only. Replace with your actual company standards. Changes apply immediately and affect all drawings.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-8 p-6 max-w-2xl">
        {RULE_SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#64748b' }}>
              {section.title}
            </h2>
            <div className="flex flex-col gap-1">
              {section.keys.map((key) => {
                const val = rules[key];
                if (typeof val !== 'number') return null;
                return (
                  <div key={key} className="flex items-center gap-4 py-3 border-b" style={{ borderColor: '#1e2535' }}>
                    <label className="flex-1 text-sm" style={{ color: '#94a3b8' }}>
                      {RULE_LABELS[key] ?? key}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={val}
                        onChange={(e) => handleChange(key, e.target.value)}
                        className="w-24 rounded-lg px-3 py-2 text-right font-mono font-bold outline-none"
                        style={{ background: '#1e2535', border: '1.5px solid #2a3347', color: '#60a5fa' }}
                      />
                      <span className="text-xs w-6" style={{ color: '#475569' }}>mm</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Trolley widths */}
        <div>
          <h2 className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#64748b' }}>
            Standard Trolley Widths
          </h2>
          <div className="flex gap-3 flex-wrap">
            {rules.trolleyStandardWidths.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="number"
                  value={w}
                  onChange={(e) => {
                    const next = [...rules.trolleyStandardWidths];
                    next[i] = Number(e.target.value);
                    updateRule('trolleyStandardWidths', next);
                  }}
                  className="w-24 rounded-lg px-3 py-2 text-right font-mono font-bold outline-none"
                  style={{ background: '#1e2535', border: '1.5px solid #2a3347', color: '#60a5fa' }}
                />
                <span className="text-xs" style={{ color: '#475569' }}>mm</span>
                <button
                  onClick={() => updateRule('trolleyStandardWidths', rules.trolleyStandardWidths.filter((_, j) => j !== i))}
                  className="text-xs px-2 py-1 rounded"
                  style={{ background: '#450a0a', color: '#fca5a5' }}
                >✕</button>
              </div>
            ))}
            <button
              onClick={() => updateRule('trolleyStandardWidths', [...rules.trolleyStandardWidths, 450])}
              className="px-4 py-2 rounded-lg text-sm font-bold"
              style={{ background: '#064e3b', color: '#6ee7b7', border: '1.5px solid #065f46' }}
            >
              + Add Width
            </button>
          </div>
        </div>

        {/* Rule engine note */}
        <div className="rounded-xl p-5" style={{ background: '#161b27', border: '1.5px solid #2a3347' }}>
          <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#64748b' }}>Rule Engine Architecture</p>
          <div className="flex flex-col gap-2 text-xs" style={{ color: '#475569' }}>
            <p>• Trolley reserved first → remaining width distributed to base cabinets</p>
            <p>• Shutter split when module width exceeds shutterDivisionMaxWidth</p>
            <p>• Kadappa height adds to counter height (base + kadappa = counter top)</p>
            <p>• Wall cabinet bottom = counter height + counterToWallGap</p>
            <p>• Loft height = ceiling height − loft bottom (calculated from ceiling down)</p>
            <p>• All rules are configurable here — no hard-coded values in drawing components</p>
          </div>
        </div>

        <button
          onClick={() => setSaved(true)}
          className="w-full py-4 rounded-xl font-bold"
          style={{ background: '#3b82f6', color: '#fff' }}
        >
          {saved ? '✓ Standards Saved' : 'Save Standards'}
        </button>
      </div>
    </div>
  );
};
