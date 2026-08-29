import React from 'react';

export interface WardrobeDesign {
  id: string;
  name: string;
  type: 'Openable' | 'Sliding' | 'Combination' | 'Internal';
  shutterCount?: number;
  internalConfiguration: string;
}

export const WARDROBE_DESIGNS: WardrobeDesign[] = [
  ...[2, 3, 4, 5, 6].map((count) => ({ id: `hinged-${count}`, name: `${count} Door Openable`, type: 'Openable' as const, shutterCount: count, internalConfiguration: 'Hanging + Shelf + Drawer' })),
  { id: 'wardrobe_openable_6door_loft_mixed_storage', name: '6 Door Openable — Loft + Mixed Storage', type: 'Openable' as const, shutterCount: 6, internalConfiguration: 'Left Storage + Central Drawer/Shelf Tower + Right Hanging Storage' },
  ...[2, 3, 4].map((count) => ({ id: `sliding-${count}`, name: `${count} Shutter Sliding`, type: 'Sliding' as const, shutterCount: count, internalConfiguration: 'Hanging + Shelf' })),
  { id: 'hinged-niche', name: 'Hinged + Open Niche', type: 'Combination', shutterCount: 4, internalConfiguration: 'Hanging + Open Niche' },
  { id: 'sliding-niche', name: 'Sliding + Open Niche', type: 'Combination', shutterCount: 3, internalConfiguration: 'Hanging + Open Niche' },
  { id: 'hinged-drawer', name: 'Hinged + Drawer Tower', type: 'Combination', shutterCount: 4, internalConfiguration: 'Hanging + Drawer' },
  { id: 'sliding-drawer', name: 'Sliding + Drawer Tower', type: 'Combination', shutterCount: 3, internalConfiguration: 'Hanging + Drawer' },
  { id: 'hinged-loft', name: 'Hinged + Loft', type: 'Combination', shutterCount: 4, internalConfiguration: 'Hanging + Shelf + Loft' },
  { id: 'sliding-loft', name: 'Sliding + Loft', type: 'Combination', shutterCount: 3, internalConfiguration: 'Hanging + Shelf + Loft' },
  { id: 'hinged-dressing', name: 'Hinged + Dressing Section', type: 'Combination', shutterCount: 4, internalConfiguration: 'Hanging + Open Section' },
  { id: 'sliding-dressing', name: 'Sliding + Dressing Section', type: 'Combination', shutterCount: 3, internalConfiguration: 'Hanging + Open Section' },
  ...[
    'Full Hanging', 'Hanging + Shelf', 'Hanging + Drawer', 'Hanging + Shelf + Drawer',
    'Double Hanging', 'Long Hanging', 'Shelves + Drawers', 'Custom Internal Configuration',
  ].map((configuration, index) => ({ id: `internal-${index + 1}`, name: configuration, type: 'Internal' as const, internalConfiguration: configuration })),
];

export default function WardrobeDesignSelection({ onSelect, onBack }: { onSelect: (design: WardrobeDesign) => void; onBack: () => void }) {
  const groups: WardrobeDesign['type'][] = ['Openable', 'Sliding', 'Combination', 'Internal'];

  return (
    <div className="flex h-full flex-col overflow-y-auto" style={{ background: '#0d1117' }}>
      <div className="border-b px-6 pb-4 pt-5" style={{ borderColor: '#243045' }}>
        <div className="flex items-start gap-4">
          <button onClick={onBack} className="rounded-lg px-3 py-2 text-xs font-bold" style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155' }}>← Back</button>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: '#a855f7' }}>Wardrobe Product</div>
            <h1 className="mt-1 text-xl font-bold" style={{ color: '#e2e8f0' }}>Wardrobe Design</h1>
            <p className="mt-1 text-sm" style={{ color: '#64748b' }}>Select the wardrobe structure before entering measurements.</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 p-5 xl:grid-cols-4 md:grid-cols-2">
        {groups.map((group) => (
          <section key={group} className="min-w-0">
            <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: '#60a5fa' }}>{group} Designs</div>
            <div className="flex flex-col gap-3">
              {WARDROBE_DESIGNS.filter((design) => design.type === group).map((design) => (
                <div key={design.id} className="rounded-xl border p-3" style={{ background: '#111827', borderColor: '#243045' }}>
                  <div className="text-sm font-bold" style={{ color: '#e2e8f0' }}>{design.name}</div>
                  <div className="mt-1 text-xs" style={{ color: '#64748b' }}>{design.shutterCount ? `${design.shutterCount} shutters · ` : ''}{design.internalConfiguration}</div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => onSelect(design)} className="flex-1 rounded-lg px-2 py-2 text-xs font-bold" style={{ background: '#1e293b', color: '#93c5fd', border: '1px solid #334155' }}>View 2D</button>
                    <button onClick={() => onSelect(design)} className="flex-1 rounded-lg px-2 py-2 text-xs font-bold" style={{ background: '#7c3aed', color: '#fff' }}>Select Design</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
