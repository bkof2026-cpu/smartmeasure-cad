import React from 'react';
import { PRODUCT_REGISTRY } from '../products/productRegistry';
import { openProductViewer } from '../products/viewerBus';
import { useApp } from '../store/AppContext';
import { openRutujaDemo } from '../App';
import type { ProductTemplate } from '../products/productTypes';

type Category = 'all' | 'furniture' | 'room' | 'apartment';

const CATEGORY_COLORS: Record<ProductTemplate['category'], { bg: string; text: string; border: string }> = {
  furniture: { bg: '#0d2a1a', text: '#4ade80', border: '#065f46' },
  room:      { bg: '#0d1a2a', text: '#60a5fa', border: '#1d4ed8' },
  apartment: { bg: '#1a0d2a', text: '#c084fc', border: '#7c3aed' },
};

function CategoryBadge({ category }: { category: ProductTemplate['category'] }) {
  const c = CATEGORY_COLORS[category];
  return (
    <span className="px-2 py-0.5 rounded text-xs font-semibold capitalize"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {category}
    </span>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span className="px-2 py-0.5 rounded text-xs font-semibold"
      style={{
        background: verified ? '#14532d' : '#1a1000',
        color: verified ? '#86efac' : '#fcd34d',
        border: `1px solid ${verified ? '#166534' : '#713f12'}`,
      }}>
      {verified ? '✓ Formula Verified' : '~ Demo Data'}
    </span>
  );
}

// ── Kitchen card (links to existing Kitchen flow) ─────────────────────────────
function KitchenCard({ onKitchenFlow }: { onKitchenFlow: () => void }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden"
      style={{ background: '#0e1e30', border: '1.5px solid #1a4060' }}>
      <div className="absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded"
        style={{ background: '#0d2a1a', color: '#4ade80', border: '1px solid #065f46' }}>
        LIVE
      </div>
      <div className="flex items-start gap-3">
        <span className="text-3xl">🍳</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm" style={{ color: '#e2e8f0' }}>Modular Kitchen</div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <CategoryBadge category="furniture" />
            <span className="px-2 py-0.5 rounded text-xs font-semibold"
              style={{ background: '#14532d', color: '#86efac', border: '1px solid #166534' }}>
              ✓ Full CAD Engine
            </span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {['L-Shape', '3085mm', '2560mm', '2750mm'].map((tag) => (
              <span key={tag} className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{ background: '#0d1117', color: '#475569', border: '1px solid #1e293b' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs" style={{ color: '#4a5f7a' }}>
        Full parametric CAD — walls, cabinets, openings, loft, counter, elevation drawings and final PDF.
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={onKitchenFlow}
          className="flex-1 py-2 rounded-lg text-xs font-bold"
          style={{ background: '#1d4ed8', color: '#fff', minWidth: 90 }}>
          Open Kitchen CAD
        </button>
        <button onClick={openRutujaDemo}
          className="flex-1 py-2 rounded-lg text-xs font-semibold"
          style={{ background: '#0c2a1a', color: '#6ee7b7', border: '1px solid #065f46', minWidth: 90 }}>
          PDF Demo ↗
        </button>
      </div>
    </div>
  );
}

// ── Generic product card ──────────────────────────────────────────────────────
function ProductCard({ product }: { product: ProductTemplate }) {
  const views = product.views;
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: '#0e1624', border: '1px solid #1e293b' }}>
      <div className="flex items-start gap-3">
        <span className="text-3xl">{product.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm" style={{ color: '#e2e8f0' }}>{product.name}</div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <CategoryBadge category={product.category} />
            <VerifiedBadge verified={product.isFormulaVerified} />
          </div>
        </div>
      </div>

      {/* Dimension chips */}
      <div className="flex flex-wrap gap-1">
        {Object.entries(product.demoDimensions)
          .filter(([, v]) => typeof v === 'number' && Number(v) > 0)
          .slice(0, 4)
          .map(([k, v]) => (
            <span key={k} className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ background: '#131b27', color: '#3d4f6a', border: '1px solid #1e293b' }}>
              {k}={String(v)}
            </span>
          ))}
        <span className="text-xs ml-auto self-center" style={{ color: '#3d4f6a' }}>
          {product.measurementFields.length} inputs · {views.length} view{views.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* View chips */}
      <div className="flex flex-wrap gap-1">
        {views.map((v) => (
          <span key={v} className="text-xs px-2 py-0.5 rounded font-mono capitalize"
            style={{ background: '#131b27', color: '#475569', border: '1px solid #1e293b' }}>
            {v.replace(/-/g, ' ')}
          </span>
        ))}
      </div>

      <div className="flex gap-2 mt-auto">
        <button
          onClick={() => openProductViewer(product.id, 'measurements')}
          className="flex-1 py-2 rounded-lg text-xs font-semibold"
          style={{ background: '#131b27', color: '#94a3b8', border: '1px solid #1e293b' }}>
          Measurements
        </button>
        <button
          onClick={() => openProductViewer(product.id, 'drawing')}
          className="flex-1 py-2 rounded-lg text-xs font-bold"
          style={{ background: '#1d4ed8', color: '#fff' }}>
          View 2D Drawing
        </button>
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export const ProductDemos: React.FC = () => {
  const { setScreen } = useApp();
  const [activeCategory, setActiveCategory] = React.useState<Category>('all');

  const cats: { id: Category; label: string; count: number }[] = [
    { id: 'all',       label: 'All',       count: PRODUCT_REGISTRY.length + 1 },
    { id: 'furniture', label: 'Furniture', count: PRODUCT_REGISTRY.filter((p) => p.category === 'furniture').length + 1 },
    { id: 'room',      label: 'Room',      count: PRODUCT_REGISTRY.filter((p) => p.category === 'room').length },
    { id: 'apartment', label: 'Apartment', count: PRODUCT_REGISTRY.filter((p) => p.category === 'apartment').length },
  ];

  const showKitchen = activeCategory === 'all' || activeCategory === 'furniture';
  const filtered = activeCategory === 'all'
    ? PRODUCT_REGISTRY
    : PRODUCT_REGISTRY.filter((p) => p.category === activeCategory);

  const verifiedCount = PRODUCT_REGISTRY.filter((p) => p.isFormulaVerified).length + 1;
  const totalViews = PRODUCT_REGISTRY.reduce((s, p) => s + p.views.length, 0) + 5;

  return (
    <div className="flex-1 overflow-auto" style={{ background: '#0d1117' }}>
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🎨</span>
            <h1 className="text-2xl font-black" style={{ color: '#e2e8f0' }}>
              Products
            </h1>
          </div>
          <p className="text-sm" style={{ color: '#4a5f7a' }}>
            Parametric 2D drawings for all furniture and space types. All drawings update live when you change measurements.
          </p>

          {/* Stats */}
          <div className="flex gap-6 mt-4">
            {[
              { label: 'Products', value: String(PRODUCT_REGISTRY.length + 1), color: '#60a5fa' },
              { label: 'Formula Verified', value: String(verifiedCount), color: '#4ade80' },
              { label: 'Drawing Views', value: String(totalViews), color: '#c084fc' },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col">
                <span className="text-2xl font-black font-mono" style={{ color: stat.color }}>{stat.value}</span>
                <span className="text-xs" style={{ color: '#4a5f7a' }}>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {cats.map((cat) => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5"
              style={{
                background: activeCategory === cat.id ? '#1d4ed8' : '#131b27',
                color: activeCategory === cat.id ? '#fff' : '#64748b',
                border: `1px solid ${activeCategory === cat.id ? '#3b82f6' : '#1e293b'}`,
              }}>
              {cat.label}
              <span className="text-xs px-1 rounded font-mono"
                style={{ background: activeCategory === cat.id ? 'rgba(255,255,255,0.2)' : '#0d1117', color: 'inherit' }}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {showKitchen && (
            <KitchenCard onKitchenFlow={() => setScreen('kitchen-steps')} />
          )}
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 px-4 py-3 rounded-xl text-xs"
          style={{ background: '#0e1624', border: '1px solid #1e293b', color: '#4a5f7a' }}>
          ⚠ All dimensions shown are demo values. Formula-verified products use the company cutlist structure.
          Always verify measurements on site before fabrication.
        </div>
      </div>
    </div>
  );
};

export default ProductDemos;
