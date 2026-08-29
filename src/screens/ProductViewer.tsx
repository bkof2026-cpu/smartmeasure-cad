import React from 'react';
import { getProduct } from '../products/productRegistry';
import type { ProductId } from '../products/productTypes';

type Tab = 'measurements' | 'drawing';

interface Props {
  productId: ProductId;
  initialTab?: Tab | string;
  onBack: () => void;
}

function MeasurementsTab({
  dims,
  fields,
  onChange,
}: {
  dims: Record<string, number | string>;
  fields: NonNullable<ReturnType<typeof getProduct>>['measurementFields'];
  onChange: (key: string, val: number | string) => void;
}) {
  return (
    <div className="p-5">
      <div className="mb-4">
        <p className="text-xs" style={{ color: '#4a5f7a' }}>
          Adjust measurements below — the 2D drawing updates in real-time.
        </p>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>
              {field.label}
              {field.unit !== 'select' && field.unit !== 'bool' && (
                <span className="ml-1 font-mono text-xs" style={{ color: '#3d4f6a' }}>({field.unit})</span>
              )}
            </label>
            {field.unit === 'select' ? (
              <select
                value={String(dims[field.key] ?? field.defaultValue)}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="px-3 py-2 rounded-lg text-sm font-mono"
                style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #243045', outline: 'none' }}>
                {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : field.unit === 'bool' ? (
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: '#1e293b', border: '1px solid #243045' }}>
                <button
                  onClick={() => onChange(field.key, Number(dims[field.key]) === 1 ? 0 : 1)}
                  className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                  style={{ background: Number(dims[field.key]) === 1 ? '#3b82f6' : '#334155' }}>
                  <span className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                    style={{ background: '#fff', left: Number(dims[field.key]) === 1 ? '22px' : '2px' }} />
                </button>
                <span className="text-sm font-mono" style={{ color: '#94a3b8' }}>
                  {Number(dims[field.key]) === 1 ? 'Yes' : 'No'}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                <input
                  type="number"
                  value={Number(dims[field.key] ?? field.defaultValue)}
                  min={field.min}
                  max={field.max}
                  step={field.step ?? 1}
                  onChange={(e) => onChange(field.key, Number(e.target.value))}
                  className="px-3 py-2 rounded-lg text-sm font-mono"
                  style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #243045', outline: 'none' }}
                />
                {(field.min !== undefined || field.max !== undefined) && (
                  <span className="text-xs font-mono" style={{ color: '#334155' }}>
                    {field.min ?? '—'} – {field.max ?? '—'} mm
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DrawingTab({
  DrawingComponent,
  dims,
  views,
  activeView,
  onViewChange,
}: {
  DrawingComponent: NonNullable<ReturnType<typeof getProduct>>['DrawingComponent'];
  dims: Record<string, number | string>;
  views: string[];
  activeView: string;
  onViewChange: (v: string) => void;
}) {
  const [fullscreen, setFullscreen] = React.useState(false);

  const drawing = (
    <div style={{ background: '#fff', borderRadius: fullscreen ? 0 : 12, overflow: 'hidden', width: '100%' }}>
      <DrawingComponent dims={dims} activeView={activeView} />
    </div>
  );

  return (
    <>
      {fullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f8f8f8' }}>
          {/* Fullscreen header */}
          <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
            style={{ background: '#0d1117', borderBottom: '1px solid #1e293b' }}>
            <div className="flex gap-1.5 flex-wrap">
              {views.map((v) => (
                <button key={v} onClick={() => onViewChange(v)}
                  className="px-3 py-1 rounded-md text-xs font-semibold capitalize"
                  style={{ background: activeView === v ? '#1d4ed8' : '#1e293b', color: activeView === v ? '#fff' : '#64748b' }}>
                  {v.replace(/-/g, ' ')}
                </button>
              ))}
            </div>
            <button onClick={() => setFullscreen(false)} className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: '#1e293b', color: '#94a3b8' }}>
              ✕ Close
            </button>
          </div>
          {/* Fullscreen drawing */}
          <div className="flex-1 overflow-auto flex items-start justify-center p-6">
            <div style={{ width: '100%', maxWidth: 1200 }}>{drawing}</div>
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* View sub-tabs + fullscreen toggle */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 flex-wrap flex-shrink-0" style={{ background: '#0d1117' }}>
          <div className="flex gap-1 flex-wrap flex-1">
            {views.map((v) => (
              <button key={v} onClick={() => onViewChange(v)}
                className="px-3 py-1 rounded-md text-xs font-semibold capitalize"
                style={{ background: activeView === v ? '#1d4ed8' : '#1e293b', color: activeView === v ? '#fff' : '#64748b' }}>
                {v.replace(/-/g, ' ')}
              </button>
            ))}
          </div>
          <button onClick={() => setFullscreen(true)}
            className="px-3 py-1 rounded-md text-xs font-semibold"
            style={{ background: '#1e293b', color: '#60a5fa', border: '1px solid #243045', flexShrink: 0 }}>
            ⛶ Full View
          </button>
        </div>

        {/* Drawing area */}
        <div className="flex-1 overflow-auto p-4">
          <div style={{ minWidth: 360 }}>
            {drawing}
          </div>
        </div>
      </div>
    </>
  );
}

export const ProductViewer: React.FC<Props> = ({ productId, initialTab = 'drawing', onBack }) => {
  const product = getProduct(productId);

  const resolvedInitialTab: Tab = (initialTab === 'measurements' || initialTab === 'drawing') ? initialTab : 'drawing';

  const [activeTab, setActiveTab] = React.useState<Tab>(resolvedInitialTab);
  const [dims, setDims] = React.useState<Record<string, number | string>>(
    product ? { ...product.demoDimensions } : {}
  );
  const [activeView, setActiveView] = React.useState<string>(product?.views[0] ?? '');

  React.useEffect(() => {
    if (product) {
      setDims({ ...product.demoDimensions });
      setActiveView(product.views[0]);
    }
  }, [productId]);

  React.useEffect(() => {
    const tab: Tab = (initialTab === 'measurements' || initialTab === 'drawing') ? initialTab : 'drawing';
    setActiveTab(tab);
  }, [initialTab]);

  if (!product) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: '#0d1117' }}>
        <div className="text-center" style={{ color: '#64748b' }}>
          <div className="text-3xl mb-2">❓</div>
          <div className="text-sm">Product not found: {productId}</div>
          <button onClick={onBack} className="mt-4 px-4 py-2 rounded-lg text-sm"
            style={{ background: '#1e293b', color: '#e2e8f0' }}>Back</button>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'measurements', label: 'Measurements' },
    { id: 'drawing', label: '2D Drawing' },
  ];

  const handleDimChange = (key: string, val: number | string) => {
    setDims((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#0d1117' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: '#0d1117', borderBottom: '1px solid #1e293b' }}>
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: '#1e293b', color: '#94a3b8' }}>
          ← Back
        </button>
        <span className="text-2xl">{product.icon}</span>
        <div>
          <div className="font-bold text-sm" style={{ color: '#e2e8f0' }}>{product.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs capitalize px-2 py-0.5 rounded font-semibold"
              style={{ background: '#1e293b', color: '#64748b' }}>{product.category}</span>
            <span className="text-xs px-2 py-0.5 rounded font-semibold"
              style={{
                background: product.isFormulaVerified ? '#14532d' : '#451a03',
                color: product.isFormulaVerified ? '#86efac' : '#fcd34d',
              }}>
              {product.isFormulaVerified ? '✓ Formula Verified' : '~ Demo Data'}
            </span>
          </div>
        </div>

        {/* Live dimension summary */}
        <div className="ml-auto hidden sm:flex gap-2 flex-wrap">
          {Object.entries(dims).filter(([, v]) => typeof v === 'number' && Number(v) > 0).slice(0, 4).map(([k, v]) => (
            <span key={k} className="px-2 py-0.5 rounded font-mono text-xs"
              style={{ background: '#131b27', color: '#60a5fa', border: '1px solid #1e293b' }}>
              {k}: {String(v)}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-shrink-0" style={{ background: '#0d1117', borderBottom: '1px solid #1e293b' }}>
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="px-6 py-3 text-sm font-semibold transition-colors"
            style={{
              color: activeTab === tab.id ? '#60a5fa' : '#4a5f7a',
              borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'measurements' && (
          <div className="flex-1 overflow-auto">
            <MeasurementsTab dims={dims} fields={product.measurementFields} onChange={handleDimChange} />
          </div>
        )}
        {activeTab === 'drawing' && (
          <DrawingTab
            DrawingComponent={product.DrawingComponent}
            dims={dims}
            views={product.views}
            activeView={activeView}
            onViewChange={setActiveView}
          />
        )}
      </div>
    </div>
  );
};

export default ProductViewer;
