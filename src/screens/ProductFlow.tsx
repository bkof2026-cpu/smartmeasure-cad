import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import { PRODUCT_REGISTRY, getProduct } from '../products/productRegistry';
import { PRODUCT_ADDONS, FIELD_GROUPS } from '../products/addons';
import type { ProductId, ProductTemplate, RoomCategory } from '../products/productTypes';
import type { AddonDef } from '../products/addons';
import WardrobeDesignSelection, { type WardrobeDesign } from './WardrobeDesignSelection';
import { SimpleBedDrawing } from '../products/bed/SimpleBedDrawing';
import { simpleBedCutlist, resolveSimpleBedPlan, type SimpleSideTableInput, type ProfileShutterInput, type ProfileShutterSide } from '../products/bed/simpleBedGeometry';
import { SimpleWardrobeDrawing } from '../products/wardrobe/SimpleWardrobeDrawing';
import { simpleWardrobeCutlist, resolveSimpleWardrobePlan, type WardrobeSide, type WardrobeDressingInput, type WardrobeSidePanelInput, type WardrobeLoftInput } from '../products/wardrobe/simpleWardrobeGeometry';
import { WardrobeTechnicalDrawing, wardrobeDimsFrom } from '../products/wardrobe/WardrobeTechnicalDrawing';
import { getWardrobeDesignDef } from '../products/wardrobe/wardrobeDesigns';
import { computeWardrobeCutlist } from '../products/wardrobe/wardrobeGeometry';
import { SimpleShoeRackDrawing } from '../products/shoeRack/SimpleShoeRackDrawing';
import { shoeRackCutlist, resolveShoeRackPlan, type ShoeRackBoxInput } from '../products/shoeRack/shoeRackGeometry';
import { fetchMyStats, logDrawingEvent, type MyStats } from '../auth/authClient';
import { mountOffscreenSvgs } from '../pdf/mountOffscreen';
import {
  generateAndDownloadPdf, generateAndDownloadSingleProductPdf,
  type PdfDrawingItem, type PdfViewItem, type PdfCutRow,
} from '../pdf/pdfEngine';

const n = (v: number | string) => Number(v);
type WorkspaceTab = 'measure' | 'drawing' | 'evidence' | 'validation' | 'pdf' | 'history' | 'my-stats';

// Product Categories spec — fixed display order (§19), independent of
// PRODUCT_REGISTRY's own array order, so reordering the registry later
// never silently reorders the category dropdown/PDF sections.
const ROOM_CATEGORY_ORDER: RoomCategory[] = ['Master Bedroom', 'Living Room', 'Kitchen'];

/** Groups the product library by roomCategory, in the spec's fixed
 * category order, each group's own products kept in PRODUCT_REGISTRY's
 * order (§19) — Kitchen is always included even with zero products, so it
 * can show its "no products yet" placeholder (§21). Products with no
 * roomCategory set (whole-room/apartment layout products, plus any
 * pre-existing product the categories spec doesn't mention — e.g. Shoe
 * Rack — never silently dropped from the dropdown) land in a trailing
 * "Other Products" group instead of vanishing from the UI entirely. */
function groupProductsByRoomCategory(registry: ProductTemplate[]): { category: string; products: ProductTemplate[] }[] {
  const groups = ROOM_CATEGORY_ORDER.map((category) => ({
    category: category as string,
    products: registry.filter((p) => p.roomCategory === category),
  }));
  const uncategorized = registry.filter((p) => !p.roomCategory);
  return uncategorized.length > 0 ? [...groups, { category: 'Other Products', products: uncategorized }] : groups;
}

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
// Real .pdf generation now lives in src/pdf/pdfEngine.ts (jsPDF + svg2pdf.js
// — true vector SVG content, one real .pdf file, one download, no HTML/JSON
// side-file). This file only builds the per-product data (real drawing
// elements, cutlists, captions) and hands it to that engine.

// Real project identity carried into every generated PDF (single or
// combined) — never a hardcoded/demo value. `products` is the ordered
// list of product names the PDF actually covers (one entry for a single
// download, every selected product's name in selection order for a
// combined one).
interface PdfProjectInfo {
  projectId: string;
  clientName: string;
  employeeName: string;
  products: string[];
}

// ─── Per-product addon-input derivation (pure, no component state) ────────────
// Extracted so the SAME logic that drives the live on-screen drawing also
// reconstructs any OTHER selected product's inputs from its own saved
// session data — used by the multi-product combined PDF, which needs every
// selected product's real drawing, not just whichever one is on screen.

function deriveBedAddonInputs(productId: ProductId, selectedAddons: Set<string>, addonDims: Record<string, Record<string, number>>) {
  const lst: SimpleSideTableInput = {
    enabled: productId === 'bed' && selectedAddons.has('side-table-left'),
    depthMm: (addonDims['side-table-left']?.D) ?? 460, widthMm: (addonDims['side-table-left']?.W) ?? 560,
  };
  const rst: SimpleSideTableInput = {
    enabled: productId === 'bed' && selectedAddons.has('side-table-right'),
    depthMm: (addonDims['side-table-right']?.D) ?? 460, widthMm: (addonDims['side-table-right']?.W) ?? 560,
  };
  const PS_SIDE_OPTS: ProfileShutterSide[] = ['left', 'right'];
  const profileShutter: ProfileShutterInput = {
    enabled: productId === 'bed' && selectedAddons.has('profile-shutter'),
    side: PS_SIDE_OPTS[(addonDims['profile-shutter']?.side) ?? 0] ?? 'left',
    heightMm: (addonDims['profile-shutter']?.H) ?? 150,
    light: ((addonDims['profile-shutter']?.light) ?? 0) === 1,
  };
  return { lst, rst, profileShutter };
}

function deriveWardrobeAddonInputs(productId: ProductId, dims: Record<string, number | string>, selectedAddons: Set<string>, addonDims: Record<string, Record<string, number>>) {
  const isWardrobe = productId === 'openable-wardrobe' || productId === 'sliding-wardrobe';
  const SIDE_OPTS: WardrobeSide[] = ['left', 'right', 'both'];
  const dressing: WardrobeDressingInput = {
    enabled: isWardrobe && selectedAddons.has('dressing'),
    side: SIDE_OPTS[(addonDims['dressing']?.side) ?? 0] ?? 'left',
    widthMm: (addonDims['dressing']?.W) ?? 400,
  };
  const sidePanel: WardrobeSidePanelInput = {
    enabled: isWardrobe && selectedAddons.has('side-panel'),
    side: SIDE_OPTS[(addonDims['side-panel']?.side) ?? 0] ?? 'left',
    widthMm: (addonDims['side-panel']?.W) ?? 80,
    depthMm: (addonDims['side-panel']?.D) ?? 600,
  };
  const loft: WardrobeLoftInput = {
    enabled: isWardrobe && selectedAddons.has('loft'),
    mode: ((addonDims['loft']?.mode) ?? 0) === 1 ? 'box' : 'door',
    widthMm: n(dims.W ?? 0),
    heightMm: (addonDims['loft']?.H) ?? 400,
    depthMm: (addonDims['loft']?.D) ?? 350,
    doorCount: (addonDims['loft']?.doors) ?? 2,
  };
  return { dressing, sidePanel, loft };
}

function deriveShoeRackAddonInputs(productId: ProductId, selectedAddons: Set<string>, addonDims: Record<string, Record<string, number>>) {
  const isShoeRack = productId === 'shoe-rack';
  const twoDoor: ShoeRackBoxInput = {
    enabled: isShoeRack && selectedAddons.has('two-door-box'),
    heightMm: (addonDims['two-door-box']?.H) ?? 1500, widthMm: (addonDims['two-door-box']?.W) ?? 1050, depthMm: (addonDims['two-door-box']?.D) ?? 450,
  };
  const singleDoor: ShoeRackBoxInput = {
    enabled: isShoeRack && selectedAddons.has('single-door-box'),
    heightMm: (addonDims['single-door-box']?.H) ?? 750, widthMm: (addonDims['single-door-box']?.W) ?? 450, depthMm: (addonDims['single-door-box']?.D) ?? 450,
  };
  return { twoDoor, singleDoor };
}

// svgHtmlOf() (renderToStaticMarkup → HTML string) retired — svg2pdf.js
// needs a real, currently-mounted DOM <svg> element, not a detached HTML
// string, so PDF generation now uses mountOffscreenSvgs() instead (see
// handleDownloadPDF / handleDownloadCombinedPDF below).

// ─── Multi-product session ─────────────────────────────────────────────────
// One Project/site visit can cover several products — each keeps its own
// measurements/add-ons entirely isolated (never mixed with another
// product's), and switching the active product never loses what was
// already entered for the one left behind.

export type ProductTodoStatus = 'not-started' | 'in-progress' | 'completed';

export interface ProductSessionData {
  dims: Record<string, number | string>;
  selectedAddons: Set<string>;
  addonDims: Record<string, Record<string, number>>;
  status: ProductTodoStatus;
}

function freshSession(product: ProductTemplate): ProductSessionData {
  return { dims: { ...product.demoDimensions }, selectedAddons: new Set(), addonDims: {}, status: 'not-started' };
}

/**
 * The real drawing element AND that product's own CRITICAL validation
 * issues, built from one saved session — not from whichever product is
 * currently open on screen. Bed/Wardrobe/Shoe Rack resolve through the
 * same real geometry engine the live screen uses (so a completed product's
 * combined-PDF diagram is never a simplified re-draw); everything else
 * uses its registry DrawingComponent, which has no CRITICAL-issue
 * infrastructure yet, so it's treated as always completable.
 */
function elementAndIssuesForSession(product: ProductTemplate, session: ProductSessionData): { element: React.ReactElement; criticalIssues: string[] } {
  const { dims, selectedAddons, addonDims } = session;
  if (product.id === 'bed') {
    const { lst, rst, profileShutter } = deriveBedAddonInputs(product.id, selectedAddons, addonDims);
    const headboardEnabled = Number(dims.hasHeadboard ?? 1) === 1;
    const drawing = resolveSimpleBedPlan({ W: n(dims.W ?? 0), L: n(dims.L ?? 0), H: n(dims.H ?? 0), headboardEnabled, headboardH: n(dims.headboardH ?? 0) || 900, lst, rst, profileShutter });
    return {
      element: <SimpleBedDrawing dims={dims} lst={lst} rst={rst} profileShutter={profileShutter} />,
      criticalIssues: drawing.issues.filter((i) => i.severity === 'CRITICAL').map((i) => i.message),
    };
  }
  if (product.id === 'openable-wardrobe' || product.id === 'sliding-wardrobe') {
    const { dressing, sidePanel, loft } = deriveWardrobeAddonInputs(product.id, dims, selectedAddons, addonDims);
    const loftWithWidth = { ...loft, widthMm: loft.widthMm || n(dims.W ?? 0) };
    const drawing = resolveSimpleWardrobePlan({ W: n(dims.W ?? 0), H: n(dims.H ?? 0), D: n(dims.D ?? 0), dressing, sidePanel, loft: loftWithWidth });
    return {
      element: <SimpleWardrobeDrawing dims={dims} dressing={dressing} sidePanel={sidePanel} loft={loft} />,
      criticalIssues: drawing.issues.filter((i) => i.severity === 'CRITICAL').map((i) => i.message),
    };
  }
  if (product.id === 'shoe-rack') {
    const { twoDoor, singleDoor } = deriveShoeRackAddonInputs(product.id, selectedAddons, addonDims);
    const drawing = resolveShoeRackPlan({ twoDoor, singleDoor });
    return {
      element: <SimpleShoeRackDrawing twoDoor={twoDoor} singleDoor={singleDoor} />,
      criticalIssues: drawing.issues.filter((i) => i.severity === 'CRITICAL').map((i) => i.message),
    };
  }
  return { element: <product.DrawingComponent dims={dims} activeView={product.views[0]} />, criticalIssues: [] };
}

/** A short "W:1800mm H:2000mm ..." line under each PDF section's title, from that product's own real measurement fields. */
function captionForSession(product: ProductTemplate, dims: Record<string, number | string>): string {
  return product.measurementFields
    .filter((f) => f.unit === 'mm')
    .slice(0, 4)
    .map((f) => `${f.label.replace(/^(Bed|Wardrobe|Table)\s+/i, '').split(' ')[0]}: ${Math.round(n(dims[f.key] ?? f.defaultValue))}mm`)
    .join('   ');
}

// Combined-PDF item building, packing, and rendering now live in
// src/pdf/pdfEngine.ts (generateAndDownloadPdf) — real .pdf pages via
// jsPDF + svg2pdf.js, Kitchen always page-separate from Master Bedroom +
// Living Room, small/large-drawing packing, a pinned top-left info block
// on every page. See handleDownloadCombinedPDF below.

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

// ─── My Stats — employee's own self-service profile view ──────────────────
// Server enforces that this can ONLY ever return the calling employee's own
// counts (the employee id comes from their session token, never a client
// parameter) — see api/profile/my-stats.ts. This panel just renders it.
type StatsRange = 'month' | 'all';

function MyStatsPanel() {
  const [range, setRange] = useState<StatsRange>('month');
  const [stats, setStats] = useState<MyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const from = range === 'month' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString() : new Date(2020, 0, 1).toISOString();
    fetchMyStats(from, new Date().toISOString()).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) { setError(result.error); return; }
      setStats(result.data);
    });
    return () => { cancelled = true; };
  }, [range]);

  const maxCount = stats ? Math.max(1, ...stats.byProduct.map((p) => p.count)) : 1;

  return (
    <div className="flex-1 overflow-auto p-5" style={{ background: '#0d1117' }}>
      <div className="max-w-3xl rounded-xl border p-5" style={{ background: '#111827', borderColor: '#243045' }}>
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm font-bold uppercase tracking-wide" style={{ color: '#60a5fa' }}>My Stats</div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setRange('month')}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase"
              style={{ background: range === 'month' ? '#1d4ed8' : '#1e293b', color: range === 'month' ? '#fff' : '#64748b' }}
            >
              This Month
            </button>
            <button
              onClick={() => setRange('all')}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase"
              style={{ background: range === 'all' ? '#1d4ed8' : '#1e293b', color: range === 'all' ? '#fff' : '#64748b' }}
            >
              All Time
            </button>
          </div>
        </div>

        {loading && <div className="text-xs" style={{ color: '#64748b' }}>Loading…</div>}
        {error && (
          <div className="rounded-lg border px-3 py-2 text-xs" style={{ background: '#3b0d0d', color: '#fca5a5', borderColor: '#7f1d1d' }}>
            ⚠ {error}
          </div>
        )}

        {stats && !loading && (
          <>
            <div className="mb-5 rounded-xl px-4 py-3" style={{ background: '#0f172a' }}>
              <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#64748b' }}>Total Drawings</div>
              <div className="text-2xl font-black" style={{ color: '#e2e8f0' }}>{stats.total}</div>
            </div>

            <div className="flex flex-col gap-2">
              {stats.byProduct.map((p) => (
                <div key={p.product_name} className="flex items-center gap-3">
                  <div className="w-28 flex-shrink-0 text-xs truncate" style={{ color: '#94a3b8' }} title={p.product_name}>{p.product_name}</div>
                  <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: '#1a2233' }}>
                    <div className="h-full rounded-full" style={{ width: `${(p.count / maxCount) * 100}%`, background: '#3b82f6' }} />
                  </div>
                  <div className="w-8 flex-shrink-0 text-right text-xs font-bold" style={{ color: '#e2e8f0' }}>{p.count}</div>
                </div>
              ))}
              {stats.byProduct.length === 0 && (
                <div className="rounded-lg border px-4 py-4 text-sm" style={{ borderColor: '#243045', color: '#64748b' }}>
                  No drawings logged in this range yet.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
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
  // The History panel is `position: fixed` (see the render below) and its
  // on-screen coordinates are computed from the button's own real
  // getBoundingClientRect() each time it opens (and kept in sync on
  // resize/scroll while open) — never a fixed `right-0`/`left-0` CSS
  // anchor, which assumed the button always sits flush against its
  // container's true right edge. On narrow/mobile widths this row wraps
  // (see the comment above it) and the button can land anywhere, so a
  // static anchor let the panel's left edge run off-screen. Nothing about
  // the panel's own markup, styling, or content changes — only where it
  // is placed.
  const historyBtnRef = useRef<HTMLButtonElement>(null);
  const historyPanelRef = useRef<HTMLDivElement>(null);
  // Starts off-screen (never visible mid-flight) rather than un-positioned —
  // the layout effect below immediately replaces this with the button's
  // real, clamped coordinates before the next paint, so this default is
  // never actually seen.
  const [historyPanelStyle, setHistoryPanelStyle] = useState<React.CSSProperties>({ position: 'fixed', top: -9999, left: -9999 });
  // Multi-product PDF: pick several products at once and download one PDF
  // with every selected product's diagram laid out on the same page(s) —
  // separate from the single-product selectedId above, which still drives
  // the Measure/Drawing/Evidence workspace as normal.
  const [multiSelectIds, setMultiSelectIds] = useState<Set<ProductId>>(() => new Set());
  const [showMultiPanel, setShowMultiPanel] = useState(false);
  // Combined PDF's per-product Evidence Note picker (PDF tab, multi-product
  // case only) — which ticked product's note is currently being edited.
  // Reuses the exact same setEvidenceNote/model.evidence store as the
  // single-product Evidence tab, just picked by product here instead of by
  // whichever product happens to be open.
  const [combinedNoteProductId, setCombinedNoteProductId] = useState<ProductId | null>(null);
  const [combinedNoteDraft, setCombinedNoteDraft] = useState('');
  // One entry per product ever visited or ticked — each product's own
  // measurements/add-ons/status, entirely isolated from every other
  // product's (never mixed), restored exactly when its product is reopened.
  const [productSessions, setProductSessions] = useState<Partial<Record<ProductId, ProductSessionData>>>({});
  const [completeErrors, setCompleteErrors] = useState<string[] | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceTab>('measure');
  const [wardrobeDesign, setWardrobeDesign] = useState<WardrobeDesign | null>(null);
  const [previousProductId, setPreviousProductId] = useState<ProductId>('bed');
  // Evidence Note — one persistent free-text note per product/measurement
  // (replaces the old per-photo caption + tag + photo/video upload, per the
  // user's explicit instruction: the Evidence page is now just this note,
  // which is what the PDF module includes). Local draft state so typing
  // feels instant; committed to the store (and thus localStorage) via
  // setEvidenceNote on every change, same "auto-save locally" promise the
  // rest of the app already makes.
  const [evidenceNoteDraft, setEvidenceNoteDraft] = useState('');
  // PDF page: Client Name is the one mandatory identity field — nothing
  // downloads (single or combined) until it's actually entered. Kept as
  // its own error state (not reused from completeErrors) since it guards
  // a different action and shouldn't be cleared by Mark Complete.
  const [pdfError, setPdfError] = useState<string | null>(null);
  // Real PDF generation (jsPDF + svg2pdf.js) is async — this disables the
  // Download PDF button(s) mid-generation so a second click can't start an
  // overlapping doc.save() on the same jsPDF instance.
  const [pdfBusy, setPdfBusy] = useState(false);
  const drawingRef = useRef<HTMLDivElement>(null);
  // The workspace tab strip scrolls horizontally on narrow screens (never
  // the whole page) — this keeps whichever tab is active scrolled fully
  // into view, so switching tabs (including programmatically, e.g. after
  // Mark Complete) never leaves the active tab half-hidden off the edge.
  const activeTabRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeWorkspace]);
  const { model, setEvidenceNote, saveMeasurementSnapshot, updateProject } = useApp();
  const product = getProduct(selectedId);
  const addons = PRODUCT_ADDONS[selectedId] ?? [];
  const groups = FIELD_GROUPS[selectedId] ?? [];

  // Marks the CURRENTLY active product in-progress the moment its
  // measurements/add-ons are first touched — never merely because its
  // measurement form was opened (that stays "not started" until edited).
  const markInProgress = useCallback(() => {
    setProductSessions((prev) => {
      const cur = prev[selectedId];
      if (cur && cur.status !== 'not-started') return prev;
      if (!product) return prev;
      return { ...prev, [selectedId]: cur ? { ...cur, status: 'in-progress' } : { ...freshSession(product), status: 'in-progress' } };
    });
  }, [selectedId, product]);

  // The one place selectedId ever changes — saves the product being left
  // (its live dims/add-ons, exactly as they stand) into its own session
  // entry, then restores whichever session the next product already has
  // (or a fresh one, seeded from its own demo dimensions, if this is the
  // first time it's been opened this session). No product's data is ever
  // read into another's, and nothing is lost switching back and forth.
  const switchToProduct = useCallback((nextId: ProductId) => {
    if (nextId === selectedId) return;
    if (nextId === 'openable-wardrobe' || nextId === 'sliding-wardrobe') {
      setPreviousProductId(selectedId);
    }
    setWardrobeDesign(null);
    const nextProduct = getProduct(nextId);
    if (!nextProduct) return;
    // nextId's own entry is never touched by anything that could have run
    // just before this (e.g. handleMarkComplete only ever writes the
    // OUTGOING product's own entry), so reading it from the closure here is
    // safe — but the outgoing product's STATUS must come from the
    // functional updater's own `prev`, not this closure, since
    // handleMarkComplete calling switchToProduct immediately after marking
    // the outgoing product "completed" would otherwise have that fresh
    // status clobbered by a stale "in-progress" read from before it landed.
    const nextSession = productSessions[nextId] ?? freshSession(nextProduct);
    setProductSessions((prev) => ({
      ...prev,
      [selectedId]: { dims, selectedAddons, addonDims, status: prev[selectedId]?.status ?? 'not-started' },
      [nextId]: nextSession,
    }));
    setDims(nextSession.dims);
    setSelectedAddons(nextSession.selectedAddons);
    setAddonDims(nextSession.addonDims);
    setActiveView(nextProduct.views[0]);
    setActiveWorkspace('measure');
    setCompleteErrors(null);
    setSelectedId(nextId);
  }, [selectedId, dims, selectedAddons, addonDims, productSessions]);

  const handleDimChange = useCallback((key: string, val: number | string) => {
    setDims((prev) => ({ ...prev, [key]: val }));
    markInProgress();
  }, [markInProgress]);

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
    markInProgress();
  }, [markInProgress]);

  const handleAddonDimChange = useCallback((addonId: string, key: string, val: number) => {
    markInProgress();
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
      // Server-side log for the KPI dashboard/My Stats — in ADDITION to the
      // existing localStorage save above, never instead of it. Best-effort
      // (logDrawingEvent never throws), so a network hiccup here can't
      // break the employee-facing save that already worked for months.
      logDrawingEvent({
        productCategory: product.roomCategory ?? 'Uncategorized',
        productName: product.name,
        projectId: model.project.projectId,
        clientName: model.project.clientName,
        pdfGenerated: false,
        measurements: dims,
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [product, dims, activeView, model.project.projectId, model.employeeName, model.project.clientName, saveMeasurementSnapshot]);

  const recentHistory = (model.measurementHistory ?? []).filter((entry) => {
    const diff = Date.now() - new Date(entry.timestamp).getTime();
    return diff <= 10 * 24 * 60 * 60 * 1000;
  });

  const loadHistoryEntry = useCallback((entry: typeof recentHistory[number]) => {
    switchToProduct(entry.productId as ProductId);
    setDims(entry.dims);
    setActiveView('front');
    setSelectedAddons(new Set());
    setAddonDims({});
    setShowHistory(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [switchToProduct]);

  // Keeps the History panel fully inside the viewport (spec: never clipped
  // left/right/top/bottom, repositions itself, works at any screen size) —
  // measures the button and the panel's own real rendered size, then picks
  // fixed left/top coordinates that fit. Recomputes on open, and while
  // open on resize/scroll so it never goes stale (e.g. rotating a phone,
  // or scrolling a long page) — panel content/markup is untouched, only
  // its position.
  useLayoutEffect(() => {
    if (!showHistory) return;

    const GAP = 8; // px between the button and the panel — matches the old `mt-2`
    const EDGE_MARGIN = 8; // px minimum breathing room from any viewport edge

    const reposition = () => {
      const btn = historyBtnRef.current;
      const panel = historyPanelRef.current;
      if (!btn || !panel) return;
      const btnRect = btn.getBoundingClientRect();
      const panelWidth = panel.offsetWidth;
      const panelHeight = panel.offsetHeight;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      // Horizontal: default to right-aligned under the button (its old
      // `right-0` look), but clamp so neither edge ever leaves the
      // viewport — sliding the panel left when it would overflow right,
      // and never past EDGE_MARGIN on the left either.
      let left = btnRect.right - panelWidth;
      left = Math.min(left, viewportW - panelWidth - EDGE_MARGIN);
      left = Math.max(left, EDGE_MARGIN);

      // Vertical: default to below the button (its old `top-full`), but
      // flip above it when there isn't enough room below — same "reposition
      // based on available space" behaviour, still clamped to the viewport.
      let top = btnRect.bottom + GAP;
      const fitsBelow = top + panelHeight + EDGE_MARGIN <= viewportH;
      if (!fitsBelow) {
        const topAbove = btnRect.top - GAP - panelHeight;
        top = topAbove >= EDGE_MARGIN ? topAbove : Math.max(EDGE_MARGIN, viewportH - panelHeight - EDGE_MARGIN);
      }

      setHistoryPanelStyle({
        position: 'fixed',
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        // Caps height too, so on very short viewports the panel's own
        // internal `max-h-64 overflow-auto` list area still fits on screen
        // instead of the whole card being pushed past the bottom edge.
        maxHeight: `${Math.max(120, viewportH - EDGE_MARGIN * 2)}px`,
      });
    };

    // Two rAFs: one for the panel's first paint (so offsetWidth/Height are
    // real, not 0 from an unmounted-until-now node), one more so the
    // resulting layout has settled before reading it back.
    let raf1 = 0, raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(reposition);
    });

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [showHistory, recentHistory.length]);

  const validationIssues = (product?.measurementFields ?? []).flatMap((field) => {
    const value = Number(dims[field.key] ?? field.defaultValue);
    if (!Number.isFinite(value)) return [{ level: 'error' as const, message: `${field.label} must be a number.` }];
    if (field.min !== undefined && value < field.min) return [{ level: 'error' as const, message: `${field.label} is below the minimum of ${field.min} ${field.unit}.` }];
    if (field.max !== undefined && value > field.max) return [{ level: 'error' as const, message: `${field.label} exceeds the maximum of ${field.max} ${field.unit}.` }];
    return [];
  });

  // Loads the currently-selected product's own saved Evidence Note into the
  // draft whenever the product changes, so switching products (or the PDF
  // reading it later) never shows a different product's note.
  useEffect(() => {
    const existing = model.evidence.find((item) => item.measurementId === selectedId && item.type === 'note');
    setEvidenceNoteDraft(existing?.caption ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Debounced save — same 500ms pattern as saveMeasurementSnapshot above,
  // so rapid typing doesn't spam the store/localStorage on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEvidenceNote(selectedId, evidenceNoteDraft);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [selectedId, evidenceNoteDraft, setEvidenceNote]);

  // Combined PDF's per-product note picker — same load-on-select /
  // debounced-save pattern as the single-product Evidence tab above, keyed
  // by whichever ticked product is currently selected in the picker rather
  // than by selectedId.
  useEffect(() => {
    if (!combinedNoteProductId) { setCombinedNoteDraft(''); return; }
    const existing = model.evidence.find((item) => item.measurementId === combinedNoteProductId && item.type === 'note');
    setCombinedNoteDraft(existing?.caption ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combinedNoteProductId]);

  useEffect(() => {
    if (!combinedNoteProductId) return;
    const timer = window.setTimeout(() => {
      setEvidenceNote(combinedNoteProductId, combinedNoteDraft);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [combinedNoteProductId, combinedNoteDraft, setEvidenceNote]);

  // Map field key → group colour
  const fieldColor: Record<string, string> = {};
  groups.forEach((g) => g.keys.forEach((k) => { fieldColor[k] = g.color; }));

  // Composite drawing logic
  const hasCompositeAddons = selectedAddons.size > 0 && addons.some((a) => selectedAddons.has(a.id) && a.placement === 'composite');

  // Bed's LST/RST/Profile Shutter, Wardrobe's Dressing/Side Panel/Loft, and
  // Shoe Rack's two boxes — the same pure derivation used to reconstruct
  // any OTHER selected product's inputs from its own saved session (see
  // elementAndIssuesForSession above), called here with the live state for
  // whichever product is currently active on screen.
  const { lst: bedLST, rst: bedRST, profileShutter: bedProfileShutter } = deriveBedAddonInputs(selectedId, selectedAddons, addonDims);
  const isWardrobe = selectedId === 'openable-wardrobe' || selectedId === 'sliding-wardrobe';
  const { dressing: wardrobeDressing, sidePanel: wardrobeSidePanel, loft: wardrobeLoft } = deriveWardrobeAddonInputs(selectedId, dims, selectedAddons, addonDims);
  const isShoeRack = selectedId === 'shoe-rack';
  const { twoDoor: shoeRackTwoDoor, singleDoor: shoeRackSingleDoor } = deriveShoeRackAddonInputs(selectedId, selectedAddons, addonDims);

  // Accepts an explicit view so the PDF exporter can render Front/Plan/Side
  // (or Internal) in turn without touching the on-screen activeView state —
  // defaults to the currently-selected tab for normal on-screen rendering.
  const renderMainDrawing = (viewOverride?: string) => {
    if (!product) return null;
    const view = viewOverride ?? activeView;

    // Bed — single simplified plan view; LST/RST height always auto-fetched
    // from the Bed's own H field, never independently entered.
    if (selectedId === 'bed') {
      return <SimpleBedDrawing dims={dims} lst={bedLST} rst={bedRST} profileShutter={bedProfileShutter} />;
    }

    // Wardrobe — single simplified plan view, same real site-measurement
    // treatment as the Bed: a plain W x H carcass with Depth shown as the
    // "/" diagonal leader, plus optional Side Dressing / Side Panel / Loft.
    if (isWardrobe) {
      return <SimpleWardrobeDrawing dims={dims} dressing={wardrobeDressing} sidePanel={wardrobeSidePanel} loft={wardrobeLoft} />;
    }

    // Shoe Rack — no base dims; entirely the two optional boxes.
    if (isShoeRack) {
      return <SimpleShoeRackDrawing twoDoor={shoeRackTwoDoor} singleDoor={shoeRackSingleDoor} />;
    }

    // Standard drawing
    return <product.DrawingComponent dims={dims} activeView={view} />;
  };

  // Re-renders every applicable view off-screen (via renderMainDrawing's
  // viewOverride) and pulls the real per-component cutlist, so the PDF
  // always contains Front/Plan/Side (or Internal) together with the full
  // component table — never just whichever single tab was open on screen.
  const handleDownloadPDF = async () => {
    if (!product) return;
    if (!model.project.clientName.trim()) {
      setPdfError('Client Name is required before a PDF can be generated.');
      return;
    }
    setPdfError(null);
    setPdfBusy(true);
    try {
      const { svgs, cleanup } = await mountOffscreenSvgs(product.views.map((v) => renderMainDrawing(v)));
      const views: PdfViewItem[] = product.views
        .map((v, i) => ({ label: v.replace(/-/g, ' '), svgEl: svgs[i] }))
        .filter((v): v is PdfViewItem => !!v.svgEl);

      const cutlist: PdfCutRow[] = selectedId === 'bed'
        ? simpleBedCutlist({ W: n(dims.W), L: n(dims.L), H: n(dims.H), headboardEnabled: Number(dims.hasHeadboard ?? 1) === 1, headboardH: n(dims.headboardH) || 900, lst: bedLST, rst: bedRST, profileShutter: bedProfileShutter }).map((r) => ({ component: r.component, width: r.width, height: r.height, qty: r.qty, remark: r.remark }))
        : isWardrobe
        ? simpleWardrobeCutlist({ W: n(dims.W), H: n(dims.H), D: n(dims.D), dressing: wardrobeDressing, sidePanel: wardrobeSidePanel, loft: wardrobeLoft }).map((r) => ({ component: r.component, width: r.width, height: r.height, qty: r.qty, remark: r.remark }))
        : isShoeRack
        ? shoeRackCutlist({ twoDoor: shoeRackTwoDoor, singleDoor: shoeRackSingleDoor }).map((r) => ({ component: r.component, width: r.width, height: r.height, qty: r.qty, remark: r.remark }))
        : product.computeCutlist(dims).map((r) => ({ component: r.component, width: r.width, height: r.height, qty: r.qty, thickness: r.thickness, remark: r.remark }));

      // The Evidence Note is keyed by measurementId === selectedId (same
      // product/measurement this PDF is for) — reading it straight from
      // model.evidence here means the PDF always reflects whatever is
      // currently saved for THIS product, never another one's note.
      const evidenceNote = model.evidence.find((item) => item.measurementId === selectedId && item.type === 'note')?.caption;

      const result = await generateAndDownloadSingleProductPdf(product.name, views, cutlist, {
        projectId: model.project.projectId,
        clientName: model.project.clientName,
        employeeName: model.employeeName || '',
        products: [product.name],
      }, evidenceNote);
      cleanup();
      if (!result.ok) {
        setPdfError(result.error ?? 'Unable to generate PDF.');
        return;
      }
      logDrawingEvent({
        productCategory: product.roomCategory ?? 'Uncategorized',
        productName: product.name,
        projectId: model.project.projectId,
        clientName: model.project.clientName,
        pdfGenerated: true,
        measurements: dims,
      });
    } finally {
      setPdfBusy(false);
    }
  };

  // Ticking a product seeds its session immediately (so the Todo list shows
  // it as "Not Started" with its own real demo dims right away) rather than
  // waiting until it's first opened.
  const toggleMultiSelect = useCallback((id: ProductId) => {
    setMultiSelectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setProductSessions((prev) => {
      if (prev[id]) return prev;
      const p = getProduct(id);
      return p ? { ...prev, [id]: freshSession(p) } : prev;
    });
  }, []);

  // Selected products, in the order they were TICKED — not registry order.
  // A JS Set iterates in insertion order, so mapping over multiSelectIds
  // directly (rather than filtering PRODUCT_REGISTRY) preserves "user
  // selected Bed, then Wardrobe, then Shoe Rack" exactly, and this same
  // order then drives the PDF page's product list and the combined PDF's
  // section order, per the user's explicit requirement that they match.
  const todoProducts = [...multiSelectIds].map((id) => getProduct(id)).filter((p): p is ProductTemplate => !!p);
  const statusOf = (id: ProductId): ProductTodoStatus => (id === selectedId ? (productSessions[id]?.status ?? 'not-started') : (productSessions[id]?.status ?? 'not-started'));
  const completedCount = todoProducts.filter((p) => statusOf(p.id) === 'completed').length;
  const allCompleted = todoProducts.length > 0 && completedCount === todoProducts.length;
  const activeTodoIndex = todoProducts.findIndex((p) => p.id === selectedId);

  const gotoAdjacentProduct = useCallback((dir: 1 | -1) => {
    const idx = todoProducts.findIndex((p) => p.id === selectedId);
    if (idx === -1) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= todoProducts.length) return;
    switchToProduct(todoProducts[nextIdx].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todoProducts, selectedId, switchToProduct]);

  // A product is only completable once its own real drawing resolves with
  // no CRITICAL validation issue — never merely because the form was
  // opened. On success, auto-advances to the next not-yet-completed
  // selected product (looping back to the first one if the rest of the
  // list, in order, is already done).
  const handleMarkComplete = useCallback(() => {
    if (!product) return;
    const session: ProductSessionData = { dims, selectedAddons, addonDims, status: 'in-progress' };
    const { criticalIssues } = elementAndIssuesForSession(product, session);
    if (criticalIssues.length > 0) {
      setCompleteErrors(criticalIssues);
      return;
    }
    setCompleteErrors(null);
    setProductSessions((prev) => ({ ...prev, [selectedId]: { ...session, status: 'completed' } }));
    const idx = todoProducts.findIndex((p) => p.id === selectedId);
    const rest = [...todoProducts.slice(idx + 1), ...todoProducts.slice(0, idx)];
    const next = rest.find((p) => (p.id === selectedId ? 'completed' : productSessions[p.id]?.status ?? 'not-started') !== 'completed');
    if (next) switchToProduct(next.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, dims, selectedAddons, addonDims, selectedId, todoProducts, productSessions, switchToProduct]);

  const handleDownloadCombinedPDF = async () => {
    // Step 1 of the required validation order: Client Name, before doing
    // any of the (heavier) drawing-resolution work below.
    if (!model.project.clientName.trim()) {
      setPdfError('Client Name is required before a PDF can be generated.');
      return;
    }
    if (!model.employeeName) {
      setPdfError('Employee session not found — please log in again.');
      return;
    }
    setPdfBusy(true);
    try {
      // The product currently on screen may have unsaved live edits that
      // haven't been written back into productSessions yet (that only
      // happens on switch) — fold them in here so the PDF always reflects
      // exactly what's on screen right now for the active product too.
      const liveSessions: Partial<Record<ProductId, ProductSessionData>> = {
        ...productSessions,
        [selectedId]: { dims, selectedAddons, addonDims, status: productSessions[selectedId]?.status ?? 'not-started' },
      };
      const elements = todoProducts.map((p) => {
        const session = liveSessions[p.id] ?? freshSession(p);
        return elementAndIssuesForSession(p, session).element;
      });
      const { svgs, cleanup } = await mountOffscreenSvgs(elements);
      const items: PdfDrawingItem[] = todoProducts
        .map((p, i): PdfDrawingItem | null => {
          const session = liveSessions[p.id] ?? freshSession(p);
          const svgEl = svgs[i];
          if (!svgEl) return null;
          // Each product's own note, picked via the PDF tab's per-product
          // picker above — never another product's, since it's looked up
          // by this exact product's id.
          const evidenceNote = model.evidence.find((item) => item.measurementId === p.id && item.type === 'note')?.caption;
          return { id: p.id, name: p.name, caption: captionForSession(p, session.dims), roomCategory: p.roomCategory, svgEl, evidenceNote };
        })
        .filter((it): it is PdfDrawingItem => it !== null);

      const result = await generateAndDownloadPdf(items, {
        projectId: model.project.projectId,
        clientName: model.project.clientName,
        employeeName: model.employeeName,
        products: todoProducts.map((p) => p.name),
      });
      cleanup();
      if (!result.ok) {
        setPdfError(result.error ?? 'Unable to generate Combined PDF.');
        return;
      }
      // One drawing event per product included in the combined PDF — each
      // still gets its own row (same as generating them individually would),
      // so the dashboard's per-product counts are accurate either way.
      for (const p of todoProducts) {
        const session = liveSessions[p.id] ?? freshSession(p);
        logDrawingEvent({
          productCategory: p.roomCategory ?? 'Uncategorized',
          productName: p.name,
          projectId: model.project.projectId,
          clientName: model.project.clientName,
          pdfGenerated: true,
          measurements: session.dims,
        });
      }
      setPdfError(null);
      setShowMultiPanel(false);
    } finally {
      setPdfBusy(false);
    }
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
      (selectedId === 'bed' && (a.id === 'side-table-left' || a.id === 'side-table-right' || a.id === 'profile-shutter')) ||
      (isWardrobe && (a.id === 'dressing' || a.id === 'side-panel' || a.id === 'loft')) ||
      (isShoeRack && (a.id === 'two-door-box' || a.id === 'single-door-box'))
    )
  );

  const allSeparate = [...separateAddons, ...compositeAddonsAsSeparate];

  if (!product) return null;

  // Wardrobe used to require picking one of 25 design-catalog cards before
  // showing any measurement fields — simplified per the user's real
  // site-measurement workflow (2026-08-30) to go straight to measurements,
  // same as every other product. WardrobeDesignSelection.tsx is kept intact
  // for a future "fabrication detail" mode.

  return (
    <div className="flex-1 overflow-hidden flex flex-col" style={{ background: '#0d1117' }}>
      {/* Top bar: product dropdown + title.
          Mobile (<sm): stacks into two rows — dropdown full-width on its own
          row, then the category/formula badges + action buttons wrap onto
          the next — matching the spec's "Row 1: Product · Row 2: Actions"
          layout instead of forcing everything onto one line, which used to
          push Download PDF behind the History button (confirmed via a real
          360px screenshot: only a sliver of the blue Download PDF button
          was visible, clipped by History). Desktop/tablet (sm+) keeps the
          original single-row layout unchanged. */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4 px-2.5 sm:px-5 py-1.5 sm:py-3 flex-shrink-0"
        style={{ background: '#0d1117', borderBottom: '1px solid #1e293b' }}>
        <div className="relative min-w-0 w-full sm:w-auto">
          <button
            onClick={() => setShowMultiPanel((prev) => !prev)}
            className="flex w-full sm:w-auto items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold outline-none sm:min-w-[200px]"
            style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #243045' }}
          >
            <span className="text-base sm:text-2xl flex-shrink-0">{product.icon}</span>
            <span className="flex-1 text-left truncate">{product.name}</span>
            {multiSelectIds.size > 0 && (
              <span className="text-[10px] sm:text-xs rounded-full px-1.5 py-0.5 flex-shrink-0" style={{ background: '#4338ca', color: '#fff' }}>{multiSelectIds.size}</span>
            )}
            <span className="flex-shrink-0" style={{ color: '#64748b' }}>▾</span>
          </button>

          {/* One dropdown does both jobs: click a row to open that product
              (same as the old <select>), tick its checkbox to include it in
              a combined multi-product PDF — no second "multi-product"
              control, per the user's explicit direction. Width is capped
              against the viewport (not a fixed 320px) so it can never
              extend past a narrow phone's right edge. */}
          {showMultiPanel && (
            <div className="absolute left-0 top-full mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border p-3 z-20" style={{ background: '#111827', borderColor: '#243045' }}>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#64748b' }}>
                Click a product to open it · tick to include in a combined PDF
              </div>
              <div className="max-h-80 overflow-auto flex flex-col gap-1 mb-3">
                {groupProductsByRoomCategory(PRODUCT_REGISTRY).map(({ category, products }) => (
                  <div key={category} className="mb-1">
                    <div className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#7dd3fc' }}>
                      {category}
                    </div>
                    {products.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs italic" style={{ color: '#475569' }}>No products available yet</div>
                    ) : (
                      products.map((p) => {
                        const checked = multiSelectIds.has(p.id);
                        const active = p.id === selectedId;
                        const status = statusOf(p.id);
                        const statusIcon = status === 'completed' ? '✓' : status === 'in-progress' ? '●' : '○';
                        const statusColor = status === 'completed' ? '#4ade80' : status === 'in-progress' ? '#fbbf24' : '#475569';
                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                            style={{ background: active ? '#1d3a5f' : checked ? '#1e1b4b' : '#0f172a' }}
                          >
                            {/* The visible box stays 16px (unchanged theme), but
                                its tap target is padded out toward the ~44px
                                comfortable-touch minimum — a bare 16px checkbox
                                is genuinely hard to hit accurately on a phone. */}
                            <label className="flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, margin: -6 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleMultiSelect(p.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4"
                              />
                            </label>
                            <button
                              onClick={() => { switchToProduct(p.id); setShowMultiPanel(false); }}
                              className="flex-1 flex items-center gap-2 text-left py-1"
                            >
                              <span className="text-base flex-shrink-0">{p.icon}</span>
                              <span className="text-sm" style={{ color: '#e2e8f0' }}>{p.name}</span>
                              {checked && <span className="text-xs ml-auto flex-shrink-0" style={{ color: statusColor }}>{statusIcon}</span>}
                              {active && <span className="text-[10px]" style={{ color: '#60a5fa' }}>open</span>}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                ))}
              </div>
              {multiSelectIds.size > 0 && (
                <>
                  <div className="text-[10px] mb-2" style={{ color: '#475569' }}>
                    {allCompleted
                      ? 'Every ticked product is completed — the PDF uses each one’s real entered measurements.'
                      : `Uses each product's own real entered measurements as they stand now (${completedCount}/${todoProducts.length} marked complete) — untouched products fall back to standard/demo values.`}
                  </div>
                  <button
                    onClick={handleDownloadCombinedPDF}
                    disabled={pdfBusy}
                    className="w-full rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-60"
                    style={{ background: allCompleted ? '#16a34a' : '#4338ca', color: '#fff' }}
                  >
                    {pdfBusy ? '⏳ Generating PDF…' : allCompleted ? `✓ Download Combined PDF (${multiSelectIds.size})` : `⬇ Download Draft PDF (${multiSelectIds.size})`}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Badges + action buttons: their own wrapping group so on mobile
            they form row 2 under the full-width dropdown (row 1) instead of
            fighting the dropdown for space on one line — that's what was
            clipping Download PDF behind History before. Unchanged on sm+:
            ml-auto pushes this whole group right, same as the old layout. */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:ml-auto sm:flex-nowrap">
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
            disabled={pdfBusy}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold flex-shrink-0 disabled:opacity-60"
            style={{ background: '#1d4ed8', color: '#fff' }}>
            {pdfBusy ? '⏳ Generating…' : '⬇ Download PDF'}
          </button>

          <div className="relative">
            <button
              ref={historyBtnRef}
              onClick={() => setShowHistory((prev) => !prev)}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold flex-shrink-0"
              style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #243045' }}
            >
              🕘 10-Day History
            </button>

            {showHistory && recentHistory.length > 0 && (
              // `fixed` + historyPanelStyle (computed in the useLayoutEffect
              // above from the button's real position) replaces the old
              // `absolute right-0 top-full mt-2`, which assumed this button
              // always sat flush against the container's true right edge —
              // not reliable once the header row wraps on narrow screens.
              // Same width cap, same rounded/border/background/padding as
              // before; only how it's placed has changed.
              <div
                ref={historyPanelRef}
                className="w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border p-2 z-20"
                style={{ background: '#111827', borderColor: '#243045', ...historyPanelStyle }}>
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
      </div>

      {/* Multi-product Todo/progress bar — only appears once 2+ products are
          ticked; a single product (or none ticked) behaves exactly like the
          plain single-product workflow, unchanged. */}
      {todoProducts.length > 1 && (
        <div className="flex items-center gap-3 px-5 py-2 flex-shrink-0 flex-wrap" style={{ background: '#0b0f17', borderBottom: '1px solid #1e293b' }}>
          <span className="text-xs font-bold uppercase tracking-wide flex-shrink-0" style={{ color: '#64748b' }}>
            Product {activeTodoIndex + 1} of {todoProducts.length}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {todoProducts.map((p) => {
              const status = statusOf(p.id);
              const icon = status === 'completed' ? '✓' : status === 'in-progress' ? '●' : '○';
              const color = status === 'completed' ? '#4ade80' : status === 'in-progress' ? '#fbbf24' : '#475569';
              const active = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  onClick={() => switchToProduct(p.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                  style={{ background: active ? '#1d3a5f' : '#1e293b', color: active ? '#e2e8f0' : '#94a3b8', border: active ? '1px solid #3b82f6' : '1px solid transparent' }}
                >
                  <span style={{ color }}>{icon}</span>
                  <span>{p.icon} {p.name}</span>
                </button>
              );
            })}
          </div>
          <span className="text-xs font-mono flex-shrink-0" style={{ color: allCompleted ? '#4ade80' : '#64748b' }}>
            {allCompleted ? '✓ All products completed' : `${completedCount} / ${todoProducts.length} completed`}
          </span>
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => gotoAdjacentProduct(-1)}
              disabled={activeTodoIndex <= 0}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: '#1e293b', color: activeTodoIndex <= 0 ? '#334155' : '#cbd5e1', cursor: activeTodoIndex <= 0 ? 'not-allowed' : 'pointer' }}
            >
              ← Previous
            </button>
            {allCompleted ? (
              // Every ticked product is done — the natural next click right
              // here is the combined PDF, not another "Mark Complete" (there
              // is nothing left to complete). The dropdown panel still has
              // the same button too, but this is the one a user actually
              // sees immediately after finishing the last product, which is
              // exactly where it was being missed (they were reaching for
              // the single-product "Download PDF" button instead).
              <button
                onClick={handleDownloadCombinedPDF}
                disabled={pdfBusy}
                className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60"
                style={{ background: '#16a34a', color: '#fff' }}
              >
                {pdfBusy ? '⏳ Generating…' : `✓ Download Combined PDF (${todoProducts.length})`}
              </button>
            ) : (
              <button
                onClick={handleMarkComplete}
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: '#16a34a', color: '#fff' }}
              >
                ✓ Mark Complete{activeTodoIndex < todoProducts.length - 1 ? ' & Next →' : ''}
              </button>
            )}
          </div>
        </div>
      )}
      {completeErrors && completeErrors.length > 0 && (
        <div className="px-5 py-2 flex-shrink-0 text-xs" style={{ background: '#3b0d0d', color: '#fca5a5', borderBottom: '1px solid #7f1d1d' }}>
          <strong>Can't mark {product?.name} complete yet:</strong> {completeErrors.join(' · ')}
        </div>
      )}

      {/* Operational workflow tabs — a horizontally-scrollable strip (never
          the whole page) so MEASURE/DRAWING/EVIDENCE/VALIDATION/PDF/HISTORY
          stay tappable and legible on a narrow phone instead of being
          squeezed unreadably small to force all six onto one line.
          flex-shrink-0 on each button keeps labels from being crushed;
          whitespace-nowrap keeps them one line each. */}
      <div className="flex items-center gap-1 px-2.5 sm:px-4 py-1 sm:py-2 flex-shrink-0 overflow-x-auto" style={{ background: '#111827', borderBottom: '1px solid #1e293b' }}>
        {([
          ['measure', 'Measure'],
          ['drawing', 'Drawing'],
          ['evidence', 'Evidence'],
          ['validation', 'Validation'],
          ['pdf', 'PDF'],
          ['history', 'History'],
          ['my-stats', 'My Stats'],
        ] as [WorkspaceTab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            ref={activeWorkspace === tab ? activeTabRef : undefined}
            onClick={() => setActiveWorkspace(tab)}
            className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-wide flex-shrink-0 whitespace-nowrap"
            style={{ background: activeWorkspace === tab ? '#1d4ed8' : '#1e293b', color: activeWorkspace === tab ? '#fff' : '#64748b' }}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto whitespace-nowrap text-[10px] sm:text-xs flex-shrink-0" style={{ color: '#475569' }}>
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
                                <label className="text-xs font-semibold" style={{ color: '#a78bfa' }}>{field.label}{!field.options && field.kind !== 'checkbox' && ' (mm)'}</label>
                                {field.kind === 'checkbox' ? (
                                  <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer"
                                    style={{ background: '#1e293b', border: '1px solid #3b1f6a', color: '#e2e8f0' }}>
                                    <input
                                      type="checkbox"
                                      checked={(adDims[field.key] ?? field.defaultValue) === 1}
                                      onChange={(e) => handleAddonDimChange(addon.id, field.key, e.target.checked ? 1 : 0)}
                                      className="w-4 h-4"
                                    />
                                    {(adDims[field.key] ?? field.defaultValue) === 1 ? 'Yes' : 'No'}
                                  </label>
                                ) : field.options ? (
                                  <select
                                    value={adDims[field.key] ?? field.defaultValue}
                                    onChange={(e) => handleAddonDimChange(addon.id, field.key, Number(e.target.value))}
                                    className="px-2 py-1.5 rounded-lg text-sm font-mono outline-none"
                                    style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #3b1f6a' }}>
                                    {field.options.map((opt, i) => <option key={opt} value={i}>{opt}</option>)}
                                  </select>
                                ) : (
                                  <>
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
                                  </>
                                )}
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
                            {addon.id === 'dressing' && (
                              <div className="flex flex-col gap-0.5 mt-2">
                                <label className="text-xs font-semibold" style={{ color: '#a78bfa' }}>Height (mm)</label>
                                <div className="rounded-lg px-2 py-1.5 text-sm font-mono" style={{ background: '#131b27', color: '#94a3b8', border: '1px dashed #3b1f6a' }}>
                                  {Number(dims.H ?? 0)} mm
                                </div>
                                <span className="text-xs" style={{ color: '#334155' }}>Auto-fetched from Wardrobe Height</span>
                              </div>
                            )}
                            {addon.id === 'profile-shutter' && (() => {
                              const onLeft = (adDims['side'] ?? 0) === 0;
                              const target = onLeft ? bedLST : bedRST;
                              return (
                                <div className="flex flex-col gap-0.5 mt-2">
                                  <label className="text-xs font-semibold" style={{ color: '#a78bfa' }}>Width (mm)</label>
                                  <div className="rounded-lg px-2 py-1.5 text-sm font-mono" style={{ background: '#131b27', color: '#94a3b8', border: '1px dashed #3b1f6a' }}>
                                    {Math.round(target.widthMm)} mm
                                  </div>
                                  <span className="text-xs" style={{ color: target.enabled ? '#334155' : '#f59e0b' }}>
                                    {target.enabled
                                      ? `Auto-fetched from ${onLeft ? 'LST' : 'RST'} Width`
                                      : `⚠ ${onLeft ? 'Left' : 'Right'} Side Table isn't added yet — enable it too`}
                                  </span>
                                  <label className="text-xs font-semibold mt-1" style={{ color: '#a78bfa' }}>Depth (mm)</label>
                                  <div className="rounded-lg px-2 py-1.5 text-sm font-mono" style={{ background: '#131b27', color: '#94a3b8', border: '1px dashed #3b1f6a' }}>
                                    {Math.round(target.depthMm)} mm
                                  </div>
                                  <span className="text-xs" style={{ color: target.enabled ? '#334155' : '#f59e0b' }}>
                                    {target.enabled ? `Auto-fetched from ${onLeft ? 'LST' : 'RST'} Depth` : ' '}
                                  </span>
                                </div>
                              );
                            })()}
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
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1 sm:py-2 flex-shrink-0 flex-wrap"
            style={{ background: '#0d1117', borderBottom: '1px solid #1e293b' }}>
            {product.views.map((v) => (
              <button key={v} onClick={() => setActiveView(v)}
                className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-semibold capitalize"
                style={{ background: activeView === v ? '#1d4ed8' : '#1e293b', color: activeView === v ? '#fff' : '#64748b' }}>
                {v.replace(/-/g, ' ')}
              </button>
            ))}
            <span className="ml-auto text-[10px] sm:text-xs" style={{ color: '#334155' }}>
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
              {/* The drawing keeps a real minimum width so dimension text
                  never shrinks to unreadable — on a phone narrower than
                  that, the OUTER wrapper here scrolls horizontally on its
                  own (overflow-x-auto), never the page itself; the inner
                  minWidth div is what's allowed to be wider than the
                  screen. The SVG inside already scales via viewBox, so
                  this only kicks in on the very narrowest phones where
                  320px genuinely doesn't fit. */}
              <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{ minWidth: 320 }}>
                  {renderMainDrawing()}
                </div>
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
                  <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <div style={{ minWidth: 280 }}>
                      {renderSeparateAddon(addon)}
                    </div>
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
            </div>
            <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#64748b' }}>Evidence Note</label>
            <textarea
              value={evidenceNoteDraft}
              onChange={(e) => setEvidenceNoteDraft(e.target.value)}
              placeholder="e.g. Site condition is good. Wall measurement taken after checking the existing structure."
              rows={5}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none resize-y"
              style={{ background: '#1e2535', border: '1px solid #2a3347', color: '#e2e8f0' }}
            />
            <div className="mt-2 text-[10px]" style={{ color: '#475569' }}>
              Saved automatically with this measurement — included at the bottom-right of the downloaded PDF.
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

      {activeWorkspace === 'pdf' && (() => {
        const hasMultiple = todoProducts.length > 1;
        const clientMissing = !model.project.clientName.trim();
        return (
          <div className="flex-1 overflow-auto p-5" style={{ background: '#0d1117' }}>
            <div className="max-w-3xl rounded-xl border p-5" style={{ background: '#111827', borderColor: '#243045' }}>
              <div className="text-sm font-bold uppercase tracking-wide" style={{ color: '#60a5fa' }}>Project Details</div>
              <div className="mt-1 text-xs" style={{ color: '#64748b' }}>The same live SVG scene shown in Drawing will be included.</div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {/* Project ID — editable, never mandatory, never a fake default. */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#64748b' }}>Project ID</label>
                  <input
                    value={model.project.projectId}
                    onChange={(e) => updateProject({ projectId: e.target.value })}
                    placeholder="Enter Project ID"
                    className="rounded-lg px-3 py-2 text-sm font-mono outline-none"
                    style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #243045' }}
                  />
                </div>

                {/* Client Name — editable AND mandatory; the only field that blocks PDF generation. */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: clientMissing ? '#f87171' : '#64748b' }}>Client Name *</label>
                  <input
                    value={model.project.clientName}
                    onChange={(e) => { updateProject({ clientName: e.target.value }); if (e.target.value.trim()) setPdfError(null); }}
                    placeholder="Enter Client Name"
                    className="rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: '#0f172a', color: '#e2e8f0', border: `1px solid ${clientMissing ? '#7f1d1d' : '#243045'}` }}
                  />
                  {clientMissing && <span className="text-[10px]" style={{ color: '#f87171' }}>❌ Client Name is required.</span>}
                </div>

                {/* Employee — read-only, straight from the login session. Never editable here. */}
                <div className="rounded-lg px-3 py-2" style={{ background: '#0f172a', border: '1px solid #243045' }}>
                  <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#64748b' }}>Employee</div>
                  {model.employeeName ? (
                    <div className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>{model.employeeName}</div>
                  ) : (
                    <div className="text-sm font-semibold" style={{ color: '#f87171' }}>⚠ Employee session not found.</div>
                  )}
                </div>

                {/* Product(s) — auto-populated from the real product selection,
                    never manually typed, never a bare count. Single product
                    shows its name; multiple show every selected product in
                    the exact order they were selected, matching the combined
                    PDF's own section order. */}
                <div className="rounded-lg px-3 py-2" style={{ background: '#0f172a', border: '1px solid #243045' }}>
                  <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#64748b' }}>{hasMultiple ? 'Products' : 'Product'}</div>
                  {hasMultiple ? (
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      {todoProducts.map((p, i) => (
                        <div key={p.id} className="text-sm font-semibold flex items-center gap-1.5" style={{ color: '#e2e8f0' }}>
                          <span style={{ color: statusOf(p.id) === 'completed' ? '#4ade80' : '#475569' }}>{statusOf(p.id) === 'completed' ? '✓' : `${i + 1}.`}</span>
                          {p.icon} {p.name}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>{product.name}</div>
                  )}
                </div>
              </div>

              {hasMultiple && (
                <div className="mt-5 rounded-lg border p-3" style={{ background: '#0f172a', borderColor: '#243045' }}>
                  <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#64748b' }}>
                    Evidence Note per product
                  </div>
                  <div className="mt-0.5 text-[10px]" style={{ color: '#475569' }}>
                    Pick a product below to add its own note — shown in the bottom-right corner of that product's box in the Combined PDF.
                  </div>
                  <select
                    value={combinedNoteProductId ?? ''}
                    onChange={(e) => setCombinedNoteProductId((e.target.value || null) as ProductId | null)}
                    className="mt-2 w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: '#1e2535', border: '1px solid #2a3347', color: '#e2e8f0' }}
                  >
                    <option value="">Select a product…</option>
                    {todoProducts.map((p) => {
                      const hasNote = model.evidence.some((item) => item.measurementId === p.id && item.type === 'note' && item.caption.trim());
                      return (
                        <option key={p.id} value={p.id}>{p.icon} {p.name}{hasNote ? ' — note added' : ''}</option>
                      );
                    })}
                  </select>
                  {combinedNoteProductId && (
                    <textarea
                      value={combinedNoteDraft}
                      onChange={(e) => setCombinedNoteDraft(e.target.value)}
                      placeholder={`e.g. Site condition is good for ${getProduct(combinedNoteProductId)?.name ?? 'this product'}...`}
                      rows={3}
                      className="mt-2 w-full rounded-lg px-3 py-2 text-sm outline-none resize-y"
                      style={{ background: '#1e2535', border: '1px solid #2a3347', color: '#e2e8f0' }}
                    />
                  )}
                </div>
              )}

              {pdfError && (
                <div className="mt-4 rounded-lg border px-3 py-2 text-xs" style={{ background: '#3b0d0d', color: '#fca5a5', borderColor: '#7f1d1d' }}>
                  ⚠ {pdfError}
                </div>
              )}

              {/* Buttons stack vertically on narrow screens (mobile), sit
                  side by side once there's room — never forced onto one
                  cramped row. Combined PDF becomes the visually primary
                  action once multiple products are selected, matching the
                  Todo bar's own convention, but "Download Current Drawing
                  PDF" (the single active product) always stays available —
                  neither button replaces the other. */}
              <div className="mt-5 flex flex-col sm:flex-row gap-2">
                <button onClick={handleDownloadPDF} disabled={pdfBusy} className="rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-60" style={{ background: hasMultiple ? '#1e293b' : '#1d4ed8', color: hasMultiple ? '#cbd5e1' : '#fff', border: hasMultiple ? '1px solid #243045' : 'none' }}>
                  {pdfBusy ? '⏳ Generating…' : '⬇ Download Current Drawing PDF'}
                </button>
                {hasMultiple && (
                  <button onClick={handleDownloadCombinedPDF} disabled={pdfBusy} className="rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-60" style={{ background: allCompleted ? '#16a34a' : '#4338ca', color: '#fff' }}>
                    {pdfBusy ? '⏳ Generating…' : allCompleted ? `✓ Download Combined PDF (${todoProducts.length})` : `⬇ Download Draft PDF (${todoProducts.length})`}
                  </button>
                )}
              </div>
              {hasMultiple && !allCompleted && (
                <div className="mt-2 text-[10px]" style={{ color: '#64748b' }}>
                  ⚠ {todoProducts.length - completedCount} product{todoProducts.length - completedCount === 1 ? '' : 's'} not yet completed — Combined PDF above uses each product's current entered measurements as a draft; complete every product in the Todo bar for the final version.
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {activeWorkspace === 'history' && (
        <div className="flex-1 overflow-auto p-5" style={{ background: '#0d1117' }}>
          <div className="max-w-3xl rounded-xl border p-5" style={{ background: '#111827', borderColor: '#243045' }}>
            <div className="mb-4 flex items-center justify-between"><div className="text-sm font-bold uppercase tracking-wide" style={{ color: '#60a5fa' }}>10-Day History</div><span className="text-xs" style={{ color: '#64748b' }}>{recentHistory.length} record(s)</span></div>
            <div className="flex flex-col gap-2">{recentHistory.map((entry) => <div key={entry.id} className="flex items-center gap-3 rounded-lg border p-3" style={{ background: '#0f172a', borderColor: '#243045' }}><div className="min-w-0 flex-1"><div className="text-sm font-bold" style={{ color: '#e2e8f0' }}>{entry.productName}</div><div className="text-xs" style={{ color: '#64748b' }}>{entry.projectId} · {entry.employeeName} · {new Date(entry.timestamp).toLocaleString('en-IN')}</div></div><button onClick={() => loadHistoryEntry(entry)} className="rounded-lg px-3 py-2 text-xs font-bold" style={{ background: '#1d4ed8', color: '#fff' }}>Recover</button></div>)}{recentHistory.length === 0 && <div className="rounded-lg border px-4 py-4 text-sm" style={{ borderColor: '#243045', color: '#64748b' }}>No measurements saved in the last 10 days.</div>}</div>
          </div>
        </div>
      )}

      {activeWorkspace === 'my-stats' && <MyStatsPanel />}
    </div>
  );
};

export default ProductFlow;
