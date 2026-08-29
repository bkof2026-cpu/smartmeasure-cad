import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import { PRODUCT_REGISTRY, getProduct } from '../products/productRegistry';
import { PRODUCT_ADDONS, FIELD_GROUPS } from '../products/addons';
import type { ProductId } from '../products/productTypes';
import type { AddonDef } from '../products/addons';
import WardrobeDesignSelection, { type WardrobeDesign } from './WardrobeDesignSelection';
import { SimpleBedDrawing } from '../products/bed/SimpleBedDrawing';
import { simpleBedCutlist, type SimpleSideTableInput } from '../products/bed/simpleBedGeometry';
import { WardrobeTechnicalDrawing, wardrobeDimsFrom } from '../products/wardrobe/WardrobeTechnicalDrawing';
import { getWardrobeDesignDef } from '../products/wardrobe/wardrobeDesigns';
import { computeWardrobeCutlist } from '../products/wardrobe/wardrobeGeometry';
import { renderToStaticMarkup } from 'react-dom/server';

const n = (v: number | string) => Number(v);
type WorkspaceTab = 'measure' | 'drawing' | 'evidence' | 'validation' | 'pdf' | 'history';

const MIXED_WARDROBE_FIELDS = [
  { key: 'loftH', label: 'Loft Height', min: 250, max: 800, defaultValue: 450 },
  { key: 'loftShutters', label: 'Loft Shutter Count', min: 1, max: 6, defaultValue: 6 },
  { key: 'leftSectionW', label: 'Left Section Width', min: 300, max: 1800, defaultValue: 760 },
  { key: 'centerSectionW', label: 'Central Tower Width', min: 300, max: 1400, defaultValue: 760 },
  { key: 'rightSectionW', label: 'Right Section Width', min: 300, max: 1800, defaultValue: 760 },
  { key: 'leftShelves', label: 'Left Shelf Count', min: 0, max: 12, defaultValue: 2 },
  { key: 'leftDrawers', label: 'Left Drawer Count', min: 0, max: 6, defaultValue: 1 },
  { key: 'centerShelves', label: 'Central Shelf Count', min: 0, max: 12, defaultValue: 3 },
  { key: 'centerDrawers', label: 'Central Drawer Count', min: 0, max: 6, defaultValue: 3 },
  { key: 'rightShelves', label: 'Right Shelf Count', min: 0, max: 12, defaultValue: 1 },
  { key: 'rightDrawers', label: 'Right Drawer Count', min: 0, max: 6, defaultValue: 0 },
  { key: 'plinthH', label: 'Plinth Height', min: 50, max: 250, defaultValue: 100 },
];

// MixedWardrobeDrawing retired — the '6 Door Openable — Loft + Mixed
// Storage' design (and all 24 other wardrobe designs) now render through
// src/products/wardrobe/WardrobeTechnicalDrawing.tsx, which derives every
// zone from real CALC_OPEN_WARDROBE/CALC_SLIDE_WARDROBE formulas instead
// of being the one hand-authored special case. See renderMainDrawing().
// ─── PDF Download ─────────────────────────────────────────────────────────────

interface PdfCutRow { component: string; width: number; height: number; qty: number; thickness?: number; remark?: string; }
interface PdfView { label: string; svgHTML: string; }

/**
 * Every part's real formula/size/qty as a clean table — not leader-line
 * callouts scattered across the drawing (which gets congested fast once a
 * design has 20+ real components). This is the same information the
 * on-screen Drawing Inspector shows for one clicked component, just listed
 * for every component at once, the way a real fabrication drawing's
 * component/BOM table does.
 */
function componentTableHTML(rows: PdfCutRow[]): string {
  if (!rows.length) return '';
  const body = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.component}</td>
      <td>${Math.round(r.width)}</td>
      <td>${Math.round(r.height)}</td>
      <td>${r.qty}</td>
      <td>${r.thickness ?? ''}</td>
      <td>${r.remark ?? ''}</td>
    </tr>`).join('');
  return `
  <table class="comp-table">
    <thead><tr><th>Sr.</th><th>Component</th><th>Width (mm)</th><th>Height (mm)</th><th>Qty</th><th>Thk (mm)</th><th>Formula / Note</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

/**
 * One PDF, every applicable view (Front/Plan/Side, or Internal where a
 * product has it) — each view is re-rendered off-screen at its own view
 * value (see renderMainDrawing's viewOverride param), so the PDF is never
 * limited to whichever single tab happened to be open when Download was
 * clicked.
 */
function downloadPDF(productName: string, views: PdfView[], cutlist: PdfCutRow[]) {
  if (views.length === 0) return;
  // Each view gets its own page, forced with page-break-before so a view
  // never starts mid-page with too little room left — and the SVG itself
  // is height-capped to the printable page height (A3 landscape minus
  // margins minus header room), so a portrait-proportioned drawing (e.g.
  // a bed's Plan view) scales DOWN to fit one page instead of overflowing
  // and getting visually split across a page boundary.
  const svgHTML = views.map((v, i) => `<div class="view-block"${i > 0 ? ' style="page-break-before:always"' : ''}><div class="view-label">${v.label.toUpperCase()} VIEW</div>${v.svgHTML}</div>`).join('\n');
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${productName} — 2D Drawing</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: white; font-family: 'Segoe UI', system-ui, sans-serif; padding: 12mm; }
    .header { padding-bottom: 8px; border-bottom: 2px solid #333; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
    .header h1 { font-size: 16px; font-weight: 900; }
    .header p  { font-size: 10px; color: #666; }
    .view-block { page-break-inside: avoid; }
    .view-label { font-size: 10px; font-weight: 700; color: #666; letter-spacing: 0.06em; margin-bottom: 4px; }
    svg { max-width: 100%; max-height: 220mm; width: auto; height: auto; display: block; margin: 0 auto 16px; page-break-inside: avoid; }
    h2.section-title { font-size: 12px; font-weight: 900; margin: 18px 0 8px; padding-top: 10px; border-top: 2px solid #333; page-break-before: always; }
    table.comp-table { width: 100%; border-collapse: collapse; font-size: 9px; }
    table.comp-table th, table.comp-table td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
    table.comp-table th { background: #f0f0f0; font-weight: 700; }
    table.comp-table tr { page-break-inside: avoid; }
    table.comp-table td:nth-child(3), table.comp-table td:nth-child(4), table.comp-table td:nth-child(5), table.comp-table td:nth-child(6) { text-align: right; font-family: 'JetBrains Mono', monospace; }
    @page { size: A3 landscape; margin: 10mm; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${productName} — 2D Technical Drawing</h1>
      <p>Generated by SmartMeasure CAD • ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
    </div>
    <p style="font-size:9px;color:#999">All dimensions in millimetres (mm)</p>
  </div>
  ${svgHTML}
  ${cutlist.length ? `<h2 class="section-title">Component Table — every part's real size, quantity and formula</h2>${componentTableHTML(cutlist)}` : ''}
  <script>window.onload = () => { setTimeout(() => window.print(), 300); }</script>
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  // Direct file download to the device (no new tab / print-dialog step) —
  // an <a download> click is what actually saves a file in the browser;
  // window.open() only opened a viewable tab the user had to Ctrl+P from.
  const safeName = productName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'drawing';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}-2D-Drawing.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─── Add-on detail views (generic / not yet migrated to the real engine) ──────
// These render a standalone add-on that has its own W/H/D fields
// (src/products/addons.ts) but isn't itself a fully modeled product yet —
// a plain, real mm-scaled technical box, not a decorative placeholder.

function RectDetail({ W, H, D, label, color }: { W: number; H: number; D?: number; label: string; color: string }) {
  const pd = 46;
  const sc = Math.min(260 / Math.max(W, 1), 190 / Math.max(H, 1));
  const sw = W * sc, sh = H * sc;
  const vw = sw + pd * 2, vh = sh + pd * 2 + 22;
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width="100%" overflow="visible" style={{ background: '#fff', display: 'block' }}>
      <text x={vw / 2} y={16} textAnchor="middle" fontSize={9} fontFamily="'DM Sans',sans-serif" fontWeight={900} fill="#222">
        {label.toUpperCase()} — {Math.round(W)}×{Math.round(H)}{D ? `×${Math.round(D)}` : ''} mm
      </text>
      <rect x={pd} y={pd / 2 + 20} width={sw} height={sh} fill={`${color}22`} stroke={color} strokeWidth={1.5} />
      <text x={pd + sw / 2} y={pd / 2 + 20 + sh / 2} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontFamily="'DM Sans',sans-serif" fontWeight={700} fill={color}>{label}</text>
    </svg>
  );
}

function StorageBoxDetail({ W, H, D, label }: { W: number; H: number; D: number; label: string }) {
  const pd = 46;
  const sc = Math.min(260 / Math.max(W, 1), 190 / Math.max(H, 1));
  const sw = W * sc, sh = H * sc, thk = 18 * sc;
  const vw = sw + pd * 2, vh = sh + pd * 2 + 22;
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width="100%" overflow="visible" style={{ background: '#fff', display: 'block' }}>
      <text x={vw / 2} y={16} textAnchor="middle" fontSize={9} fontFamily="'DM Sans',sans-serif" fontWeight={900} fill="#222">
        {label.toUpperCase()} — {Math.round(W)}×{Math.round(H)}×{Math.round(D)} mm
      </text>
      <rect x={pd} y={pd / 2 + 20} width={sw} height={sh} fill="#f0eee8" stroke="#333" strokeWidth={1.5} />
      <rect x={pd} y={pd / 2 + 20} width={sw} height={thk} fill="#ddd" stroke="#aaa" strokeWidth={0.6} />
      <rect x={pd} y={pd / 2 + 20 + sh - thk} width={sw} height={thk} fill="#ddd" stroke="#aaa" strokeWidth={0.6} />
      <text x={pd + sw / 2} y={pd / 2 + 20 + sh / 2} textAnchor="middle" dominantBaseline="middle" fontSize={8} fontFamily="'DM Sans',sans-serif" fontWeight={700} fill="#555">{label}</text>
    </svg>
  );
}

function WardrobeDetail({ W, H, D }: { W: number; H: number; D: number }) {
  const pd = 46;
  const sc = Math.min(260 / Math.max(W, 1), 200 / Math.max(H, 1));
  const sw = W * sc, sh = H * sc;
  const vw = sw + pd * 2, vh = sh + pd * 2 + 22;
  const doors = 2;
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width="100%" overflow="visible" style={{ background: '#fff', display: 'block' }}>
      <text x={vw / 2} y={16} textAnchor="middle" fontSize={9} fontFamily="'DM Sans',sans-serif" fontWeight={900} fill="#222">
        WARDROBE — {Math.round(W)}×{Math.round(H)}×{Math.round(D)} mm
      </text>
      <rect x={pd} y={pd / 2 + 20} width={sw} height={sh} fill="#f0eee8" stroke="#333" strokeWidth={1.5} />
      {Array.from({ length: doors }).map((_, i) => (
        <rect key={i} x={pd + (sw / doors) * i + 2} y={pd / 2 + 22} width={sw / doors - 4} height={sh - 4} fill="#eee9e0" stroke="#888" strokeWidth={0.8} />
      ))}
    </svg>
  );
}

function WardrobeWithLoftFront({ wardW, wardH, sections, loftH, loftD, thk, isSliding }: {
  wardW: number; wardH: number; sections: number; loftH: number; loftD: number; thk: number; isSliding: boolean;
}) {
  const pd = 60;
  const sc = Math.min(320 / Math.max(wardW, 1), 240 / Math.max(wardH + loftH, 1));
  const sw = wardW * sc, sh = wardH * sc, slh = loftH * sc;
  const vw = sw + pd * 2 + 40, vh = slh + sh + pd * 2 + 40;
  const secW = sw / Math.max(1, sections);
  void loftD; void thk;
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width="100%" overflow="visible" style={{ background: '#fff', display: 'block' }}>
      <text x={vw / 2} y={18} textAnchor="middle" fontSize={10} fontFamily="'DM Sans',sans-serif" fontWeight={900} fill="#222">
        WARDROBE + LOFT — {Math.round(wardW)}×{Math.round(loftH + wardH)} mm
      </text>
      <rect x={pd} y={pd} width={sw} height={slh} fill="#dbe5f5" stroke="#64748b" strokeWidth={1} />
      <text x={pd + sw / 2} y={pd + slh / 2} textAnchor="middle" dominantBaseline="middle" fontSize={7} fontFamily="'DM Sans',sans-serif" fill="#475569">LOFT — {Math.round(loftH)}mm</text>
      <rect x={pd} y={pd + slh} width={sw} height={sh} fill="#f0eee8" stroke="#333" strokeWidth={1.5} />
      {Array.from({ length: sections }).map((_, i) => (
        <line key={i} x1={pd + secW * i} y1={pd + slh} x2={pd + secW * i} y2={pd + slh + sh} stroke="#888" strokeWidth={0.8} />
      ))}
      {isSliding && <line x1={pd} y1={pd + slh + 6} x2={pd + sw} y2={pd + slh + 6} stroke="#bbb" strokeWidth={2} />}
    </svg>
  );
}

// ─── Main ProductFlow Screen ──────────────────────────────────────────────────

export const ProductFlow: React.FC = () => {
  const [selectedId, setSelectedId] = useState<ProductId>('bed');
  // Seeded synchronously (not via effect) so the very first paint never
  // renders geometry off empty/zero dims — that transient zero-input state
  // was producing invalid (negative-width) SVG rects for a frame before the
  // demoDimensions effect below ran.
  const [dims, setDims] = useState<Record<string, number | string>>(() => ({ ...(getProduct('bed')?.demoDimensions ?? {}) }));
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [addonDims, setAddonDims] = useState<Record<string, Record<string, number>>>({});
  const [activeView, setActiveView] = useState<string>('front');
  const [showHistory, setShowHistory] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceTab>('measure');
  const [wardrobeDesign, setWardrobeDesign] = useState<WardrobeDesign | null>(null);
  const [previousProductId, setPreviousProductId] = useState<ProductId>('bed');
  const [evidenceCaption, setEvidenceCaption] = useState('');
  const [evidenceTag, setEvidenceTag] = useState('General site condition');
  const drawingRef = useRef<HTMLDivElement>(null);
  const { model, addEvidence, saveMeasurementSnapshot } = useApp();
  const product = getProduct(selectedId);
  const addons = PRODUCT_ADDONS[selectedId] ?? [];
  const groups = FIELD_GROUPS[selectedId] ?? [];

  // When product changes, reset dims + addons
  useEffect(() => {
    const p = getProduct(selectedId);
    if (p) {
      setDims({ ...p.demoDimensions });
      setActiveView(p.views[0]);
      setSelectedAddons(new Set());
      setAddonDims({});
      setActiveWorkspace('measure');
    }
  }, [selectedId]);

  const handleDimChange = useCallback((key: string, val: number | string) => {
    setDims((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleAddonToggle = useCallback((addonId: string, def: AddonDef) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(addonId)) {
        next.delete(addonId);
      } else {
        next.add(addonId);
        setAddonDims((d) => ({
          ...d,
          [addonId]: Object.fromEntries(def.fields.map((f) => [f.key, f.defaultValue])),
        }));
      }
      return next;
    });
  }, []);

  const handleAddonDimChange = useCallback((addonId: string, key: string, val: number) => {
    setAddonDims((prev) => ({
      ...prev,
      [addonId]: { ...(prev[addonId] ?? {}), [key]: val },
    }));
  }, []);

  useEffect(() => {
    if (!product) return;

    const timer = window.setTimeout(() => {
      saveMeasurementSnapshot({
        productId: product.id,
        productName: product.name,
        projectId: model.project.projectId,
        employeeName: model.employeeName || 'Employee',
        dims: { ...dims },
        notes: `${product.name} measurement capture (${activeView} view)`,
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [product, dims, activeView, model.project.projectId, model.employeeName, saveMeasurementSnapshot]);

  const recentHistory = (model.measurementHistory ?? []).filter((entry) => {
    const diff = Date.now() - new Date(entry.timestamp).getTime();
    return diff <= 10 * 24 * 60 * 60 * 1000;
  });

  const loadHistoryEntry = useCallback((entry: typeof recentHistory[number]) => {
    setSelectedId(entry.productId as ProductId);
    setDims(entry.dims);
    setActiveView('front');
    setSelectedAddons(new Set());
    setAddonDims({});
    setShowHistory(false);
  }, []);

  const validationIssues = (product?.measurementFields ?? []).flatMap((field) => {
    const value = Number(dims[field.key] ?? field.defaultValue);
    if (!Number.isFinite(value)) return [{ level: 'error' as const, message: `${field.label} must be a number.` }];
    if (field.min !== undefined && value < field.min) return [{ level: 'error' as const, message: `${field.label} is below the minimum of ${field.min} ${field.unit}.` }];
    if (field.max !== undefined && value > field.max) return [{ level: 'error' as const, message: `${field.label} exceeds the maximum of ${field.max} ${field.unit}.` }];
    return [];
  });

  const handleEvidenceFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      addEvidence({
        id: `EV-${Date.now()}`,
        measurementId: selectedId,
        label: evidenceTag,
        type: file.type.startsWith('video/') ? 'video' : 'photo',
        caption: evidenceCaption || file.name,
        dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
        timestamp: new Date().toISOString(),
      });
      setEvidenceCaption('');
      event.target.value = '';
    };
    reader.readAsDataURL(file);
  }, [addEvidence, evidenceCaption, evidenceTag, selectedId]);

  // Map field key → group colour
  const fieldColor: Record<string, string> = {};
  groups.forEach((g) => g.keys.forEach((k) => { fieldColor[k] = g.color; }));

  // Composite drawing logic
  const hasCompositeAddons = selectedAddons.size > 0 && addons.some((a) => selectedAddons.has(a.id) && a.placement === 'composite');
  const bedHasSTL = selectedId === 'bed' && selectedAddons.has('side-table-left');
  const bedHasSTR = selectedId === 'bed' && selectedAddons.has('side-table-right');
  const wardHasLoft = (selectedId === 'openable-wardrobe' || selectedId === 'sliding-wardrobe') && selectedAddons.has('loft');

  // Bed's LST/RST: D/W are user-entered addon fields, Height is always
  // auto-fetched from the Bed's own H field (never independently entered) —
  // shared by the on-screen drawing and the PDF's component table so they
  // can never disagree.
  const bedLST: SimpleSideTableInput = { enabled: bedHasSTL, depthMm: (addonDims['side-table-left']?.D) ?? 460, widthMm: (addonDims['side-table-left']?.W) ?? 560 };
  const bedRST: SimpleSideTableInput = { enabled: bedHasSTR, depthMm: (addonDims['side-table-right']?.D) ?? 460, widthMm: (addonDims['side-table-right']?.W) ?? 560 };

  // Accepts an explicit view so the PDF exporter can render Front/Plan/Side
  // (or Internal) in turn without touching the on-screen activeView state —
  // defaults to the currently-selected tab for normal on-screen rendering.
  const renderMainDrawing = (viewOverride?: string) => {
    if (!product) return null;
    const view = viewOverride ?? activeView;

    // Bed — single simplified plan view; LST/RST height always auto-fetched
    // from the Bed's own H field, never independently entered.
    if (selectedId === 'bed') {
      return <SimpleBedDrawing dims={dims} lst={bedLST} rst={bedRST} />;
    }

    // Wardrobe + loft composite (front view)
    if (wardHasLoft && (view === 'front' || view === 'elevation')) {
      const ld = addonDims['loft'] ?? {};
      return (
        <WardrobeWithLoftFront
          wardW={n(dims.W)} wardH={n(dims.H)}
          sections={(n(dims.verticals) || n(dims.shutters) || 2) + 1}
          loftH={ld.H ?? 400} loftD={ld.D ?? 350}
          thk={n(dims.thk) || 18}
          isSliding={selectedId === 'sliding-wardrobe'}
        />
      );
    }

    // Every wardrobe design (all 25 catalog entries) now goes through the
    // real zone-based engine — replacing the old special-case that only drew
    // 1 of 25 designs correctly (see docs/GAP_REPORT.md).
    if ((selectedId === 'openable-wardrobe' || selectedId === 'sliding-wardrobe') && wardrobeDesign) {
      return <WardrobeTechnicalDrawing designId={wardrobeDesign.id} dims={dims} activeView={view} />;
    }

    // Standard drawing
    return <product.DrawingComponent dims={dims} activeView={view} />;
  };

  // Re-renders every applicable view off-screen (via renderMainDrawing's
  // viewOverride) and pulls the real per-component cutlist, so the PDF
  // always contains Front/Plan/Side (or Internal) together with the full
  // component table — never just whichever single tab was open on screen.
  const handleDownloadPDF = () => {
    if (!product) return;
    const views: PdfView[] = product.views
      .map((v) => {
        const markup = renderToStaticMarkup(<>{renderMainDrawing(v)}</>);
        const holder = document.createElement('div');
        holder.innerHTML = markup;
        const svg = holder.querySelector('svg');
        return { label: v.replace(/-/g, ' '), svgHTML: svg ? svg.outerHTML : '' };
      })
      .filter((v) => v.svgHTML);

    const cutlist: PdfCutRow[] = wardrobeDesign && (selectedId === 'openable-wardrobe' || selectedId === 'sliding-wardrobe')
      ? computeWardrobeCutlist(wardrobeDesign.id, wardrobeDimsFrom(dims))
      : selectedId === 'bed'
      ? simpleBedCutlist({ W: n(dims.W), L: n(dims.L), H: n(dims.H), headboardH: n(dims.headboardH) || 900, lst: bedLST, rst: bedRST }).map((r) => ({ component: r.component, width: r.width, height: r.height, qty: r.qty, remark: r.remark }))
      : product.computeCutlist(dims).map((r) => ({ component: r.component, width: r.width, height: r.height, qty: r.qty, thickness: r.thickness, remark: r.remark }));

    downloadPDF(product.name, views, cutlist);
  };

  // Separate add-on detail drawings
  const separateAddons = addons.filter((a) => selectedAddons.has(a.id) && a.placement === 'separate');

  const renderSeparateAddon = (addon: AddonDef) => {
    const d = addonDims[addon.id] ?? {};
    if (addon.id === 'wardrobe') {
      return <WardrobeDetail key={addon.id} W={d.W ?? 1800} H={d.H ?? 2100} D={d.D ?? 600} />;
    }
    if (addon.id === 'storage-box' || addon.id === 'crockery-unit' || addon.id === 'bar-unit') {
      return <StorageBoxDetail key={addon.id} W={d.W ?? 600} H={d.H ?? 450} D={d.D ?? 350} label={addon.label} />;
    }
    if (addon.id === 'balcony' || addon.id === 'utility' || addon.id === 'study-room') {
      return <RectDetail key={addon.id} W={d.L ?? d.W ?? 3000} H={d.W ?? 1500} label={addon.label} color="#22c55e" />;
    }
    return (
      <RectDetail
        key={addon.id}
        W={d.W ?? d.L ?? 900}
        H={d.H ?? 750}
        D={d.D}
        label={addon.label}
        color="#a855f7"
      />
    );
  };

  // Composite-placement addons that are NOT handled by main composite logic → show as separate
  const compositeAddonsAsSeparate = addons.filter((a) =>
    selectedAddons.has(a.id) && a.placement === 'composite' &&
    !(
      (selectedId === 'bed' && (a.id === 'side-table-left' || a.id === 'side-table-right')) ||
      (wardHasLoft && a.id === 'loft')
    )
  );

  const allSeparate = [...separateAddons, ...compositeAddonsAsSeparate];

  if (!product) return null;

  if ((selectedId === 'openable-wardrobe' || selectedId === 'sliding-wardrobe') && !wardrobeDesign) {
    return (
      <WardrobeDesignSelection
        onBack={() => {
          setWardrobeDesign(null);
          setSelectedId(previousProductId);
        }}
        onSelect={(design) => {
          setWardrobeDesign(design);
          setActiveView('front');
          setActiveWorkspace('measure');
          setSelectedId(design.id.startsWith('sliding') ? 'sliding-wardrobe' : 'openable-wardrobe');
          const def = getWardrobeDesignDef(design.id);
          setDims((current) => ({
            ...current,
            shutters: design.shutterCount ?? current.shutters ?? 4,
            drawers: design.internalConfiguration.toLowerCase().includes('drawer') ? Math.max(2, Number(current.drawers) || 2) : 0,
            shelves: design.internalConfiguration.toLowerCase().includes('shelf') ? Math.max(4, Number(current.shelves) || 4) : 0,
            ...(def?.hasLoft ? { loftH: current.loftH ?? 450, loftShutters: current.loftShutters ?? (design.shutterCount ?? 4) } : {}),
            ...(def?.hasPlinth ? { plinthH: current.plinthH ?? 100 } : {}),
            ...(def?.useExplicitZoneWidths ? {
              leftSectionW: current.leftSectionW ?? Math.round(Number(current.W ?? 2290) / 3),
              centerSectionW: current.centerSectionW ?? Math.round(Number(current.W ?? 2290) / 3),
              rightSectionW: current.rightSectionW ?? Math.round(Number(current.W ?? 2290) / 3),
            } : {}),
          }));
        }}
      />
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col" style={{ background: '#0d1117' }}>
      {/* Top bar: product dropdown + title */}
      <div className="flex items-center gap-4 px-5 py-3 flex-shrink-0"
        style={{ background: '#0d1117', borderBottom: '1px solid #1e293b' }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl flex-shrink-0">{product.icon}</span>
          <select
            value={selectedId}
            onChange={(e) => {
              const nextId = e.target.value as ProductId;
              if (nextId === 'openable-wardrobe' || nextId === 'sliding-wardrobe') {
                setPreviousProductId(selectedId);
              }
              setWardrobeDesign(null);
              setSelectedId(nextId);
              // Reset dims/view/addons synchronously, in the same update as
              // selectedId — otherwise there's one render where the NEW
              // product's resolver runs against the OLD product's dims
              // (missing keys -> NaN geometry), before the selectedId-keyed
              // useEffect catches up a render later.
              const nextProduct = getProduct(nextId);
              if (nextProduct) {
                setDims({ ...nextProduct.demoDimensions });
                setActiveView(nextProduct.views[0]);
                setSelectedAddons(new Set());
                setAddonDims({});
                setActiveWorkspace('measure');
              }
            }}
            className="text-sm font-bold rounded-xl px-3 py-2 outline-none"
            style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #243045', minWidth: 200 }}>
            {PRODUCT_REGISTRY.map((p) => (
              <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
            ))}
          </select>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded font-semibold capitalize"
            style={{ background: '#1e293b', color: '#64748b' }}>{product.category}</span>
          <span className="text-xs px-2 py-0.5 rounded font-semibold"
            style={{
              background: product.isFormulaVerified ? '#14532d' : '#1a1000',
              color: product.isFormulaVerified ? '#86efac' : '#fcd34d',
            }}>
            {product.isFormulaVerified ? '✓ Formula Verified' : '~ Demo Data'}
          </span>
        </div>

        <button
          onClick={handleDownloadPDF}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0"
          style={{ background: '#1d4ed8', color: '#fff' }}>
          ⬇ Download PDF
        </button>

        <div className="relative">
          <button
            onClick={() => setShowHistory((prev) => !prev)}
            className="ml-2 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold flex-shrink-0"
            style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #243045' }}
          >
            🕘 10-Day History
          </button>

          {showHistory && recentHistory.length > 0 && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border p-2 z-20" style={{ background: '#111827', borderColor: '#243045' }}>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#64748b' }}>
                Recover previous measurements
              </div>
              <div className="max-h-64 overflow-auto flex flex-col gap-2">
                {recentHistory.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => loadHistoryEntry(entry)}
                    className="w-full rounded-lg border p-2 text-left"
                    style={{ background: '#0f172a', borderColor: '#243045', color: '#e2e8f0' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold">{entry.productName}</span>
                      <span className="text-[10px] font-mono" style={{ color: '#94a3b8' }}>{new Date(entry.timestamp).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className="mt-1 text-[10px]" style={{ color: '#64748b' }}>
                      {entry.employeeName} · {entry.projectId}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Operational workflow tabs from the prototype drawing workspace */}
      <div className="flex items-center gap-1 px-4 py-2 flex-shrink-0 overflow-x-auto" style={{ background: '#111827', borderBottom: '1px solid #1e293b' }}>
        {([
          ['measure', 'Measure'],
          ['drawing', 'Drawing'],
          ['evidence', 'Evidence'],
          ['validation', 'Validation'],
          ['pdf', 'PDF'],
          ['history', 'History'],
        ] as [WorkspaceTab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveWorkspace(tab)}
            className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide"
            style={{ background: activeWorkspace === tab ? '#1d4ed8' : '#1e293b', color: activeWorkspace === tab ? '#fff' : '#64748b' }}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto whitespace-nowrap text-xs" style={{ color: '#475569' }}>
          {model.lastSavedAt ? `Saved ${new Date(model.lastSavedAt).toLocaleTimeString('en-IN')}` : 'Not saved'}
        </span>
      </div>

      {/* Body: left measurements + right drawing */}
      <div className="flex flex-1 overflow-hidden" style={{ display: activeWorkspace === 'measure' || activeWorkspace === 'drawing' ? 'flex' : 'none' }}>

        {/* Left panel: measurements + add-ons */}
        <div className={`overflow-auto flex-shrink-0 w-full lg:w-[340px] ${activeWorkspace === 'measure' ? 'block' : 'hidden'}`} style={{ borderRight: '1px solid #1e293b', background: '#0d1117' }}>
          <div className="p-4 flex flex-col gap-5">

            {/* Measurements — grouped by colour */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#60a5fa' }}>
                Measurements
              </div>
              {groups.length > 0 ? groups.map((group) => (
                <div key={group.label} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-4 rounded-sm flex-shrink-0" style={{ background: group.color }} />
                    <span className="text-xs font-bold" style={{ color: group.color }}>{group.label}</span>
                  </div>
                  <div className="flex flex-col gap-2 pl-4">
                    {product.measurementFields
                      .filter((f) => group.keys.includes(f.key))
                      .map((field) => (
                        <div key={field.key} className="flex flex-col gap-0.5"
                          style={{ borderLeft: `2px solid ${group.color}40`, paddingLeft: 8 }}>
                          <label className="text-xs font-semibold" style={{ color: `${group.color}cc` }}>
                            {field.label}
                            {field.unit !== 'select' && field.unit !== 'bool' && (
                              <span className="ml-1 text-xs font-mono" style={{ color: '#475569' }}>({field.unit})</span>
                            )}
                          </label>
                          {field.unit === 'select' ? (
                            <select
                              value={String(dims[field.key] ?? field.defaultValue)}
                              onChange={(e) => handleDimChange(field.key, e.target.value)}
                              className="px-2 py-1.5 rounded-lg text-sm font-mono outline-none"
                              style={{ background: '#1e293b', color: '#e2e8f0', border: `1px solid ${group.color}40` }}>
                              {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : field.unit === 'bool' ? (
                            <button
                              onClick={() => handleDimChange(field.key, Number(dims[field.key]) === 1 ? 0 : 1)}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold w-full"
                              style={{ background: '#1e293b', color: '#94a3b8', border: `1px solid ${group.color}40` }}>
                              <span className="w-7 h-4 rounded-full relative flex-shrink-0"
                                style={{ background: Number(dims[field.key]) === 1 ? group.color : '#334155' }}>
                                <span className="absolute top-0.5 w-3 h-3 rounded-full"
                                  style={{ background: '#fff', transition: 'left .15s', left: Number(dims[field.key]) === 1 ? '14px' : '2px' }} />
                              </span>
                              {Number(dims[field.key]) === 1 ? 'Yes' : 'No'}
                            </button>
                          ) : (
                            <div className="flex gap-1">
                              <input
                                type="number"
                                value={Number(dims[field.key] ?? field.defaultValue)}
                                min={field.min} max={field.max} step={field.step ?? 1}
                                onChange={(e) => handleDimChange(field.key, Number(e.target.value))}
                                className="flex-1 px-2 py-1.5 rounded-lg text-sm font-mono outline-none"
                                style={{ background: '#1e293b', color: '#e2e8f0', border: `1px solid ${group.color}40` }}
                              />
                              <span className="flex items-center text-xs px-1.5 rounded"
                                style={{ background: '#131b27', color: '#475569' }}>mm</span>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )) : (
                // Fallback: ungrouped fields
                <div className="flex flex-col gap-2">
                  {product.measurementFields.map((field) => (
                    <div key={field.key} className="flex flex-col gap-0.5">
                      <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>
                        {field.label}
                        {field.unit !== 'select' && field.unit !== 'bool' && (
                          <span className="ml-1 text-xs font-mono" style={{ color: '#475569' }}>({field.unit})</span>
                        )}
                      </label>
                      {field.unit === 'bool' ? (
                        <button
                          onClick={() => handleDimChange(field.key, Number(dims[field.key]) === 1 ? 0 : 1)}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #243045' }}>
                          <span className="w-7 h-4 rounded-full relative flex-shrink-0"
                            style={{ background: Number(dims[field.key]) === 1 ? '#3b82f6' : '#334155' }}>
                            <span className="absolute top-0.5 w-3 h-3 rounded-full"
                              style={{ background: '#fff', transition: 'left .15s', left: Number(dims[field.key]) === 1 ? '14px' : '2px' }} />
                          </span>
                          {Number(dims[field.key]) === 1 ? 'Yes' : 'No'}
                        </button>
                      ) : field.unit === 'select' ? (
                        <select
                          value={String(dims[field.key] ?? field.defaultValue)}
                          onChange={(e) => handleDimChange(field.key, e.target.value)}
                          className="px-2 py-1.5 rounded-lg text-sm font-mono outline-none"
                          style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #243045' }}>
                          {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input
                          type="number"
                          value={Number(dims[field.key] ?? field.defaultValue)}
                          min={field.min} max={field.max} step={field.step ?? 1}
                          onChange={(e) => handleDimChange(field.key, Number(e.target.value))}
                          className="px-2 py-1.5 rounded-lg text-sm font-mono outline-none"
                          style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #243045' }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(() => {
              if (!wardrobeDesign) return null;
              const def = getWardrobeDesignDef(wardrobeDesign.id);
              if (!def || (!def.hasLoft && !def.useExplicitZoneWidths)) return null;
              const relevantKeys = new Set<string>([
                ...(def.hasLoft ? ['loftH', 'loftShutters'] : []),
                ...(def.hasPlinth ? ['plinthH'] : []),
                ...(def.useExplicitZoneWidths ? ['leftSectionW', 'centerSectionW', 'rightSectionW', 'leftShelves', 'leftDrawers', 'centerShelves', 'centerDrawers', 'rightShelves', 'rightDrawers'] : []),
              ]);
              const fields = MIXED_WARDROBE_FIELDS.filter((f) => relevantKeys.has(f.key));
              if (!fields.length) return null;
              return (
                <div>
                  <div className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: '#a855f7' }}>Design Configuration — {wardrobeDesign.name}</div>
                  <div className="flex flex-col gap-2">
                    {fields.map((field) => (
                      <div key={field.key} className="flex flex-col gap-0.5">
                        <label className="text-xs font-semibold" style={{ color: '#c084fc' }}>{field.label} <span className="font-mono" style={{ color: '#475569' }}>(mm / count)</span></label>
                        <input type="number" value={Number(dims[field.key] ?? field.defaultValue)} min={field.min} max={field.max} onChange={(e) => handleDimChange(field.key, Number(e.target.value))} className="rounded-lg px-2 py-1.5 text-sm font-mono outline-none" style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #3b1f6a' }} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Add Extra Items */}
            {addons.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#a855f7' }}>
                  Add Extra Items
                </div>
                <div className="flex flex-col gap-2">
                  {addons.map((addon) => {
                    const active = selectedAddons.has(addon.id);
                    const adDims = addonDims[addon.id] ?? {};
                    return (
                      <div key={addon.id} className="rounded-xl overflow-hidden"
                        style={{ border: `1px solid ${active ? '#7c3aed' : '#1e293b'}`, background: active ? '#13082a' : '#0e1624' }}>
                        {/* Addon header row */}
                        <button
                          onClick={() => handleAddonToggle(addon.id, addon)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                          <span className="text-xl flex-shrink-0">{addon.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold" style={{ color: active ? '#c084fc' : '#64748b' }}>{addon.label}</div>
                            <div className="text-xs truncate" style={{ color: '#334155' }}>{addon.description}</div>
                          </div>
                          <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: active ? '#7c3aed' : '#1e293b', color: active ? '#fff' : '#475569' }}>
                            {active ? '✓' : '+'}
                          </span>
                        </button>

                        {/* Addon fields */}
                        {active && (
                          <div className="px-3 pb-3 flex flex-col gap-2 border-t" style={{ borderColor: '#2d1f4a' }}>
                            {addon.fields.map((field) => (
                              <div key={field.key} className="flex flex-col gap-0.5 mt-2">
                                <label className="text-xs font-semibold" style={{ color: '#a78bfa' }}>{field.label} (mm)</label>
                                <div className="flex gap-1">
                                  <input
                                    type="number"
                                    value={adDims[field.key] ?? field.defaultValue}
                                    min={field.min} max={field.max} step={field.step ?? 1}
                                    onChange={(e) => handleAddonDimChange(addon.id, field.key, Number(e.target.value))}
                                    className="flex-1 px-2 py-1.5 rounded-lg text-sm font-mono outline-none"
                                    style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #3b1f6a' }}
                                  />
                                  <span className="flex items-center text-xs px-1.5 rounded"
                                    style={{ background: '#131b27', color: '#475569' }}>mm</span>
                                </div>
                                <span className="text-xs font-mono" style={{ color: '#334155' }}>
                                  {field.min}–{field.max}mm
                                </span>
                              </div>
                            ))}
                            {(addon.id === 'side-table-left' || addon.id === 'side-table-right') && (
                              <div className="flex flex-col gap-0.5 mt-2">
                                <label className="text-xs font-semibold" style={{ color: '#a78bfa' }}>Height (mm)</label>
                                <div className="rounded-lg px-2 py-1.5 text-sm font-mono" style={{ background: '#131b27', color: '#94a3b8', border: '1px dashed #3b1f6a' }}>
                                  {Number(dims.H ?? 0)} mm
                                </div>
                                <span className="text-xs" style={{ color: '#334155' }}>Auto-fetched from Bed Height</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Right panel: drawing canvas — hidden (not squeezed) on small
            screens while the Measure tab is active, since a 340px form panel
            left no usable width for the preview on a phone; the Drawing tab
            already gives it the full screen. Unchanged on desktop (lg+). */}
        <div className={`flex-1 flex-col overflow-hidden ${activeWorkspace === 'measure' ? 'hidden lg:flex' : 'flex'}`} style={{ background: '#0d1117' }}>

          {/* View selector */}
          <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0 flex-wrap"
            style={{ background: '#0d1117', borderBottom: '1px solid #1e293b' }}>
            {product.views.map((v) => (
              <button key={v} onClick={() => setActiveView(v)}
                className="px-3 py-1 rounded-md text-xs font-semibold capitalize"
                style={{ background: activeView === v ? '#1d4ed8' : '#1e293b', color: activeView === v ? '#fff' : '#64748b' }}>
                {v.replace(/-/g, ' ')}
              </button>
            ))}
            {/* Composite views */}
            {wardHasLoft && (
              <button onClick={() => setActiveView('front')}
                className="px-3 py-1 rounded-md text-xs font-bold"
                style={{ background: '#1e293b', color: '#a855f7', border: '1px solid #3b1f6a' }}>
                ✦ Front with Loft
              </button>
            )}
            <span className="ml-auto text-xs" style={{ color: '#334155' }}>
              All dims in mm
            </span>
          </div>

          {/* Drawing area — all SVGs captured for PDF */}
          <div className="flex-1 overflow-auto p-4" ref={drawingRef}>

            {/* Main product drawing */}
            <div className="rounded-xl overflow-hidden mb-4" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
              <div className="px-4 py-2 flex items-center gap-2"
                style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <span className="text-sm font-bold" style={{ color: '#1e293b' }}>{product.icon} {product.name}</span>
                <span className="text-xs px-2 py-0.5 rounded font-mono ml-auto"
                  style={{ background: '#e2e8f0', color: '#64748b' }}>
                  {activeView.replace(/-/g, ' ').toUpperCase()} VIEW
                </span>
              </div>
              <div style={{ minWidth: 320 }}>
                {renderMainDrawing()}
              </div>
            </div>

            {/* Separate add-on detail drawings */}
            {allSeparate.map((addon) => {
              const d = addonDims[addon.id] ?? {};
              return (
                <div key={addon.id} className="rounded-xl overflow-hidden mb-4"
                  style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                  <div className="px-4 py-2 flex items-center gap-2"
                    style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <span className="text-sm">{addon.icon}</span>
                    <span className="text-sm font-bold" style={{ color: '#1e293b' }}>{addon.label}</span>
                    <span className="text-xs px-2 py-0.5 rounded font-mono ml-auto"
                      style={{ background: '#ede9fe', color: '#7c3aed' }}>ADD-ON DETAIL</span>
                  </div>
                  <div style={{ minWidth: 280 }}>
                    {renderSeparateAddon(addon)}
                  </div>
                </div>
              );
            })}

            {/* Legend */}
            {groups.length > 0 && (
              <div className="rounded-xl px-4 py-3 mt-2 flex flex-wrap gap-3"
                style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                <span className="text-xs font-bold mr-1" style={{ color: '#64748b' }}>Part colours:</span>
                {groups.map((g) => (
                  <span key={g.label} className="flex items-center gap-1.5 text-xs font-semibold">
                    <span className="w-3 h-3 rounded-sm" style={{ background: g.color }} />
                    <span style={{ color: '#334155' }}>{g.label}</span>
                  </span>
                ))}
                {addons.filter((a) => selectedAddons.has(a.id)).length > 0 && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <span className="w-3 h-3 rounded-sm" style={{ background: '#a855f7' }} />
                    <span style={{ color: '#334155' }}>Add-ons</span>
                  </span>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {activeWorkspace === 'evidence' && (
        <div className="flex-1 overflow-auto p-5" style={{ background: '#0d1117' }}>
          <div className="max-w-3xl rounded-xl border p-5" style={{ background: '#111827', borderColor: '#243045' }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold uppercase tracking-wide" style={{ color: '#60a5fa' }}>Evidence</div>
                <div className="text-xs" style={{ color: '#64748b' }}>{product.name} · {model.project.projectId} · {model.employeeName || 'Employee'}</div>
              </div>
              <span className="text-xs font-mono" style={{ color: '#475569' }}>{model.evidence.length} item(s)</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={evidenceTag} onChange={(e) => setEvidenceTag(e.target.value)} className="rounded-lg px-3 py-2 text-sm outline-none" style={{ background: '#1e2535', border: '1px solid #2a3347', color: '#e2e8f0' }}>
                <option>General site condition</option>
                <option>Headboard / frame</option>
                <option>Side table position</option>
                <option>Wall / obstruction</option>
                <option>Client approval</option>
              </select>
              <input value={evidenceCaption} onChange={(e) => setEvidenceCaption(e.target.value)} placeholder="Evidence note" className="rounded-lg px-3 py-2 text-sm outline-none" style={{ background: '#1e2535', border: '1px solid #2a3347', color: '#e2e8f0' }} />
            </div>
            <label className="mt-3 flex cursor-pointer items-center justify-center rounded-lg border border-dashed px-4 py-5 text-sm font-bold" style={{ borderColor: '#3b82f6', color: '#60a5fa' }}>
              + Add Photo or Video
              <input type="file" accept="image/*,video/*" onChange={handleEvidenceFile} className="hidden" />
            </label>
            <div className="mt-5 flex flex-col gap-2">
              {model.evidence.filter((item) => item.measurementId === selectedId).map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3" style={{ background: '#0f172a', borderColor: '#243045' }}>
                  {item.dataUrl && item.type === 'photo' ? <img src={item.dataUrl} alt={item.label} className="h-12 w-12 rounded object-cover" /> : <span className="text-xl">{item.type === 'video' ? '🎥' : '📝'}</span>}
                  <div className="min-w-0"><div className="text-xs font-bold" style={{ color: '#e2e8f0' }}>{item.label}</div><div className="truncate text-xs" style={{ color: '#64748b' }}>{item.caption}</div></div>
                  <span className="ml-auto text-[10px] font-mono" style={{ color: '#475569' }}>{new Date(item.timestamp).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeWorkspace === 'validation' && (
        <div className="flex-1 overflow-auto p-5" style={{ background: '#0d1117' }}>
          <div className="max-w-3xl rounded-xl border p-5" style={{ background: '#111827', borderColor: '#243045' }}>
            <div className="mb-4 text-sm font-bold uppercase tracking-wide" style={{ color: '#60a5fa' }}>Validation / Review</div>
            {validationIssues.length === 0 ? (
              <div className="rounded-lg border px-4 py-4" style={{ background: '#0c2a1a', borderColor: '#10b981', color: '#6ee7b7' }}>✓ All {product.name} measurements are within the registered input ranges.</div>
            ) : (
              <div className="flex flex-col gap-2">{validationIssues.map((issue, index) => <div key={`${issue.message}-${index}`} className="rounded-lg border px-4 py-3 text-sm" style={{ background: '#450a0a', borderColor: '#ef4444', color: '#fca5a5' }}>⚠ {issue.message}</div>)}</div>
            )}
            <div className="mt-5 grid gap-2 md:grid-cols-2">{product.measurementFields.map((field) => <div key={field.key} className="rounded-lg px-3 py-2" style={{ background: '#0f172a' }}><span className="text-xs" style={{ color: '#94a3b8' }}>{field.label}</span><span className="float-right text-xs font-mono" style={{ color: '#60a5fa' }}>{String(dims[field.key] ?? field.defaultValue)} {field.unit}</span></div>)}</div>
          </div>
        </div>
      )}

      {activeWorkspace === 'pdf' && (
        <div className="flex-1 overflow-auto p-5" style={{ background: '#0d1117' }}>
          <div className="max-w-3xl rounded-xl border p-5" style={{ background: '#111827', borderColor: '#243045' }}>
            <div className="text-sm font-bold uppercase tracking-wide" style={{ color: '#60a5fa' }}>PDF Package</div>
            <div className="mt-1 text-xs" style={{ color: '#64748b' }}>The same live SVG scene shown in Drawing will be included.</div>
            <div className="mt-5 grid gap-2 md:grid-cols-2">{[['Project ID', model.project.projectId], ['Client', model.project.clientName || 'Not entered'], ['Employee', model.employeeName || 'Employee'], ['Product', product.name]].map(([label, value]) => <div key={label} className="rounded-lg px-3 py-2" style={{ background: '#0f172a' }}><div className="text-[10px] uppercase" style={{ color: '#64748b' }}>{label}</div><div className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>{value}</div></div>)}</div>
            <button onClick={handleDownloadPDF} className="mt-5 rounded-xl px-4 py-3 text-sm font-bold" style={{ background: '#1d4ed8', color: '#fff' }}>⬇ Download Current Drawing PDF</button>
          </div>
        </div>
      )}

      {activeWorkspace === 'history' && (
        <div className="flex-1 overflow-auto p-5" style={{ background: '#0d1117' }}>
          <div className="max-w-3xl rounded-xl border p-5" style={{ background: '#111827', borderColor: '#243045' }}>
            <div className="mb-4 flex items-center justify-between"><div className="text-sm font-bold uppercase tracking-wide" style={{ color: '#60a5fa' }}>10-Day History</div><span className="text-xs" style={{ color: '#64748b' }}>{recentHistory.length} record(s)</span></div>
            <div className="flex flex-col gap-2">{recentHistory.map((entry) => <div key={entry.id} className="flex items-center gap-3 rounded-lg border p-3" style={{ background: '#0f172a', borderColor: '#243045' }}><div className="min-w-0 flex-1"><div className="text-sm font-bold" style={{ color: '#e2e8f0' }}>{entry.productName}</div><div className="text-xs" style={{ color: '#64748b' }}>{entry.projectId} · {entry.employeeName} · {new Date(entry.timestamp).toLocaleString('en-IN')}</div></div><button onClick={() => loadHistoryEntry(entry)} className="rounded-lg px-3 py-2 text-xs font-bold" style={{ background: '#1d4ed8', color: '#fff' }}>Recover</button></div>)}{recentHistory.length === 0 && <div className="rounded-lg border px-4 py-4 text-sm" style={{ borderColor: '#243045', color: '#64748b' }}>No measurements saved in the last 10 days.</div>}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductFlow;
