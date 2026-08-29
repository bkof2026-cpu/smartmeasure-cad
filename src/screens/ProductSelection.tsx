import React from 'react';
import { useApp } from '../store/AppContext';

const PRODUCTS = [
  { id: 'kitchen', name: 'Kitchen', icon: '🍳', active: true },
  { id: 'bedroom', name: 'Bedroom', icon: '🛏️', active: false },
  { id: 'wardrobe', name: 'Wardrobe', icon: '👔', active: false },
  { id: 'tv-unit', name: 'TV Unit', icon: '📺', active: false },
  { id: 'loft', name: 'Loft', icon: '🪜', active: false },
  { id: 'crockery', name: 'Crockery Unit', icon: '🥣', active: false },
  { id: 'study', name: 'Study Unit', icon: '📚', active: false },
  { id: 'shoe-rack', name: 'Shoe Rack', icon: '👟', active: false },
  { id: 'living-room', name: 'Living Room', icon: '🛋️', active: false },
  { id: '1bhk', name: '1 BHK', icon: '🏠', active: false },
  { id: '2bhk', name: '2 BHK', icon: '🏡', active: false },
  { id: '3bhk', name: '3 BHK', icon: '🏘️', active: false },
];

export const ProductSelection: React.FC = () => {
  const { setScreen } = useApp();

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0d1117' }}>
      <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: '#2a3347' }}>
        <h1 className="text-xl font-bold mb-1" style={{ color: '#e2e8f0' }}>Select Product</h1>
        <p className="text-sm" style={{ color: '#64748b' }}>Choose the furniture type to measure</p>
      </div>

      <div className="grid grid-cols-2 gap-4 p-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {PRODUCTS.map((p) => (
          <button
            key={p.id}
            onClick={() => p.active && setScreen('kitchen-steps')}
            disabled={!p.active}
            className="relative flex flex-col items-center justify-center gap-3 rounded-2xl p-6 transition-all"
            style={{
              background: p.active ? '#1e2535' : '#161b27',
              border: p.active ? '2px solid #3b82f6' : '2px solid #2a3347',
              cursor: p.active ? 'pointer' : 'not-allowed',
              minHeight: 130,
            }}
          >
            <span className="text-4xl">{p.icon}</span>
            <span className="font-semibold text-sm" style={{ color: p.active ? '#e2e8f0' : '#475569' }}>
              {p.name}
            </span>
            {!p.active && (
              <span
                className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-bold"
                style={{ background: '#1e2535', color: '#475569' }}
              >
                Soon
              </span>
            )}
            {p.active && (
              <span
                className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-bold"
                style={{ background: '#1d4ed8', color: '#bfdbfe' }}
              >
                ACTIVE
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
