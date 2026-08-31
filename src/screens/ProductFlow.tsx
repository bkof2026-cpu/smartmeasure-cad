import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import { PRODUCT_REGISTRY, getProduct } from '../products/productRegistry';
import { PRODUCT_ADDONS, FIELD_GROUPS } from '../products/addons';
import type { ProductId, ProductTemplate } from '../products/productTypes';
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

/** Renders one React element to a standalone <svg ...>...</svg> string. */
function svgHtmlOf(el: React.ReactElement): string {
  const markup = renderToStaticMarkup(<>{el}</>);
  const holder = document.createElement('div');
  holder.innerHTML = markup;
  const svg = holder.querySelector('svg');
  return svg ? svg.outerHTML : '';
}

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

interface CombinedPdfItem { id: ProductId; name: string; icon: string; caption: string; svgHTML: string; }

// Products the layout engine gives the bigger (half-page) slot to when
// they're combined with smaller ones — per the user's own worked example
// (Wardrobe = half page, Bed/Shoe Rack = quarter page each). A product with
// no entry here defaults to the small/quarter slot.
const LARGE_PDF_PRODUCTS = new Set<ProductId>(['openable-wardrobe', 'sliding-wardrobe']);

function pdfSectionHTML(it: CombinedPdfItem, sizeClass: string): string {
  return `<div class="pdf-section ${sizeClass}">
    <div class="section-title">${it.icon} ${it.name}</div>
    ${it.caption ? `<div class="section-caption">${it.caption}</div>` : ''}
    <div class="section-svg-wrap">${it.svgHTML}</div>
  </div>`;
}

/**
 * The exactly-2-products layout: two equal-width columns split by a plain
 * vertical rule, each headed by a simple underlined product name (no icon,
 * no caption line, no card border) — matching the user's own reference
 * layout for "these products together are one project," as distinct from
 * the weighted half/quarter treatment used for 3+ products.
 */
function pdfSectionHTMLColumn(it: CombinedPdfItem): string {
  return `<div class="pdf-section size-column">
    <div class="section-title-plain">${it.name}</div>
    <div class="section-svg-wrap">${it.svgHTML}</div>
  </div>`;
}

/**
 * One page's worth of sections (at most 4), arranged per the user's own
 * spec: 1 product = full page; 2 = two equal side-by-side columns split by
 * a vertical rule (their own reference layout — "one complete project" on
 * one page); 3 = one half-page "large" product (if any is flagged) over
 * two quarter-page ones; 4 = an even 2x2 grid. This is the actual layout
 * decision — expressed as a CSS grid template per page rather than
 * hand-computed pixel coordinates, which is a correct, robust way to
 * implement "automatically choose the most appropriate layout" in an
 * HTML/print document.
 */
function pdfPageHTML(pageItems: CombinedPdfItem[], pageNum: number, pageCount: number, projectId: string, employeeName: string): string {
  const n = pageItems.length;
  let gridClass: string;
  let sectionsHTML: string;
  if (n === 1) {
    gridClass = 'grid-1';
    sectionsHTML = pdfSectionHTML(pageItems[0], 'size-full');
  } else if (n === 2) {
    gridClass = 'grid-2col';
    sectionsHTML = pageItems.map((it) => pdfSectionHTMLColumn(it)).join('');
  } else if (n === 3) {
    gridClass = 'grid-3';
    const largeIdx = pageItems.findIndex((it) => LARGE_PDF_PRODUCTS.has(it.id));
    const big = largeIdx >= 0 ? pageItems[largeIdx] : pageItems[0];
    const rest = pageItems.filter((it) => it !== big);
    sectionsHTML = pdfSectionHTML(big, 'size-half-top') + rest.map((it) => pdfSectionHTML(it, 'size-quarter')).join('');
  } else {
    gridClass = 'grid-4';
    sectionsHTML = pageItems.map((it) => pdfSectionHTML(it, 'size-quarter')).join('');
  }
  return `<div class="pdf-page">
    <div class="page-header">
      <div><strong>SmartMeasure CAD</strong> — Combined 2D Drawings</div>
      <div>Project: ${projectId} &nbsp;·&nbsp; Employee: ${employeeName} &nbsp;·&nbsp; ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
      <div>Page ${pageNum} of ${pageCount}</div>
    </div>
    <div class="page-grid ${gridClass}">${sectionsHTML}</div>
  </div>`;
}

/**
 * One PDF, every selected product's REAL drawing (same canonical SVG as its
 * own on-screen view — never a re-simplified redraw) laid out with the
 * half/quarter-page weighting from the user's own spec, paginated at a
 * maximum of 4 sections per page.
 */
function downloadCombinedPDF(items: CombinedPdfItem[], projectId: string, employeeName: string) {
  if (items.length === 0) return;
  const pages: CombinedPdfItem[][] = [];
  for (let i = 0; i < items.length; i += 4) pages.push(items.slice(i, i + 4));
  const pagesHTML = pages.map((page, i) => pdfPageHTML(page, i + 1, pages.length, projectId, employeeName)).join('\n');
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Combined 2D Drawings — ${items.length} Products</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: white; font-family: 'Segoe UI', system-ui, sans-serif; }
    .pdf-page { padding: 8mm; page-break-after: always; display: flex; flex-direction: column; min-height: 190mm; }
    .pdf-page:last-child { page-break-after: auto; }
    .page-header { padding-bottom: 6px; border-bottom: 2px solid #333; margin-bottom: 8px; font-size: 9px; color: #666; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px; }
    .page-header strong { color: #222; font-size: 12px; }
    .page-grid { flex: 1; display: grid; gap: 6mm; min-height: 0; }
    .grid-1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
    .grid-2 { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
    .grid-2col { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; gap: 0; }
    .grid-3 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
    .grid-3 .size-half-top { grid-column: 1 / 3; grid-row: 1; }
    .grid-3 .size-quarter { grid-row: 2; }
    .grid-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
    .pdf-section { border: 1px solid #ccc; border-radius: 4px; padding: 6px; display: flex; flex-direction: column; overflow: hidden; page-break-inside: avoid; min-height: 0; min-width: 0; }
    .section-title { font-size: 11px; font-weight: 800; text-align: center; text-transform: uppercase; letter-spacing: 0.02em; color: #222; flex-shrink: 0; }
    .section-caption { font-size: 9px; color: #666; text-align: center; margin: 2px 0 4px; font-family: 'JetBrains Mono', monospace; flex-shrink: 0; }
    .section-svg-wrap { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; min-height: 0; }
    .section-svg-wrap svg { max-width: 100%; max-height: 100%; width: auto; height: auto; }
    /* Exactly-2-products layout: two equal columns, one plain vertical
       rule between them (not a bordered card each) — the two drawings
       read as one combined project sheet rather than two separate tiles. */
    .pdf-section.size-column { border: none; border-radius: 0; padding: 10px 22px; }
    .grid-2col .pdf-section.size-column:first-child { border-right: 1.5px solid #222; }
    .section-title-plain { font-size: 13px; font-weight: 700; font-style: italic; text-align: center; text-decoration: underline; text-underline-offset: 4px; color: #111; flex-shrink: 0; margin-bottom: 6px; }
    @page { size: A3 landscape; margin: 0; }
  </style>
</head>
<body>
  ${pagesHTML}
  <script>window.onload = () => { setTimeout(() => window.print(), 300); }</script>
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Combined-2D-Drawings-${items.length}-Products.html`;
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
  // Multi-product PDF: pick several products at once and download one PDF
  // with every selected product's diagram laid out on the same page(s) —
  // separate from the single-product selectedId above, which still drives
  // the Measure/Drawing/Evidence workspace as normal.
  const [multiSelectIds, setMultiSelectIds] = useState<Set<ProductId>>(() => new Set());
  const [showMultiPanel, setShowMultiPanel] = useState(false);
  // One entry per product ever visited or ticked — each product's own
  // measurements/add-ons/status, entirely isolated from every other
  // product's (never mixed), restored exactly when its product is reopened.
  const [productSessions, setProductSessions] = useState<Partial<Record<ProductId, ProductSessionData>>>({});
  const [completeErrors, setCompleteErrors] = useState<string[] | null>(null);
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
    }, 500);

    return () => window.clearTimeout(timer);
  }, [product, dims, activeView, model.project.projectId, model.employeeName, saveMeasurementSnapshot]);

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

    const cutlist: PdfCutRow[] = selectedId === 'bed'
      ? simpleBedCutlist({ W: n(dims.W), L: n(dims.L), H: n(dims.H), headboardEnabled: Number(dims.hasHeadboard ?? 1) === 1, headboardH: n(dims.headboardH) || 900, lst: bedLST, rst: bedRST, profileShutter: bedProfileShutter }).map((r) => ({ component: r.component, width: r.width, height: r.height, qty: r.qty, remark: r.remark }))
      : isWardrobe
      ? simpleWardrobeCutlist({ W: n(dims.W), H: n(dims.H), D: n(dims.D), dressing: wardrobeDressing, sidePanel: wardrobeSidePanel, loft: wardrobeLoft }).map((r) => ({ component: r.component, width: r.width, height: r.height, qty: r.qty, remark: r.remark }))
      : isShoeRack
      ? shoeRackCutlist({ twoDoor: shoeRackTwoDoor, singleDoor: shoeRackSingleDoor }).map((r) => ({ component: r.component, width: r.width, height: r.height, qty: r.qty, remark: r.remark }))
      : product.computeCutlist(dims).map((r) => ({ component: r.component, width: r.width, height: r.height, qty: r.qty, thickness: r.thickness, remark: r.remark }));

    downloadPDF(product.name, views, cutlist);
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

  // Selected products, in the order they were ticked — the Todo order.
  const todoProducts = PRODUCT_REGISTRY.filter((p) => multiSelectIds.has(p.id));
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

  const handleDownloadCombinedPDF = () => {
    // The product currently on screen may have unsaved live edits that
    // haven't been written back into productSessions yet (that only
    // happens on switch) — fold them in here so the PDF always reflects
    // exactly what's on screen right now for the active product too.
    const liveSessions: Partial<Record<ProductId, ProductSessionData>> = {
      ...productSessions,
      [selectedId]: { dims, selectedAddons, addonDims, status: productSessions[selectedId]?.status ?? 'not-started' },
    };
    const items: CombinedPdfItem[] = todoProducts
      .map((p) => {
        const session = liveSessions[p.id] ?? freshSession(p);
        const { element } = elementAndIssuesForSession(p, session);
        return { id: p.id, name: p.name, icon: p.icon, caption: captionForSession(p, session.dims), svgHTML: svgHtmlOf(element) };
      })
      .filter((it) => it.svgHTML);
    downloadCombinedPDF(items, model.project.projectId, model.employeeName || 'Employee');
    setShowMultiPanel(false);
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
      {/* Top bar: product dropdown + title */}
      <div className="flex items-center gap-4 px-5 py-3 flex-shrink-0"
        style={{ background: '#0d1117', borderBottom: '1px solid #1e293b' }}>
        <div className="relative min-w-0">
          <button
            onClick={() => setShowMultiPanel((prev) => !prev)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold outline-none"
            style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #243045', minWidth: 200 }}
          >
            <span className="text-2xl flex-shrink-0">{product.icon}</span>
            <span className="flex-1 text-left truncate">{product.name}</span>
            {multiSelectIds.size > 0 && (
              <span className="text-xs rounded-full px-1.5 py-0.5 flex-shrink-0" style={{ background: '#4338ca', color: '#fff' }}>{multiSelectIds.size}</span>
            )}
            <span className="flex-shrink-0" style={{ color: '#64748b' }}>▾</span>
          </button>

          {/* One dropdown does both jobs: click a row to open that product
              (same as the old <select>), tick its checkbox to include it in
              a combined multi-product PDF — no second "multi-product"
              control, per the user's explicit direction. */}
          {showMultiPanel && (
            <div className="absolute left-0 top-full mt-2 w-80 rounded-xl border p-3 z-20" style={{ background: '#111827', borderColor: '#243045' }}>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#64748b' }}>
                Click a product to open it · tick to include in a combined PDF
              </div>
              <div className="max-h-64 overflow-auto flex flex-col gap-1 mb-3">
                {PRODUCT_REGISTRY.map((p) => {
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
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMultiSelect(p.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 flex-shrink-0"
                      />
                      <button
                        onClick={() => { switchToProduct(p.id); setShowMultiPanel(false); }}
                        className="flex-1 flex items-center gap-2 text-left"
                      >
                        <span className="text-base flex-shrink-0">{p.icon}</span>
                        <span className="text-sm" style={{ color: '#e2e8f0' }}>{p.name}</span>
                        {checked && <span className="text-xs ml-auto flex-shrink-0" style={{ color: statusColor }}>{statusIcon}</span>}
                        {active && <span className="text-[10px]" style={{ color: '#60a5fa' }}>open</span>}
                      </button>
                    </div>
                  );
                })}
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
                    className="w-full rounded-lg px-3 py-2 text-sm font-bold"
                    style={{ background: allCompleted ? '#16a34a' : '#4338ca', color: '#fff' }}
                  >
                    {allCompleted ? `✓ Download Combined PDF (${multiSelectIds.size})` : `⬇ Download Draft PDF (${multiSelectIds.size})`}
                  </button>
                </>
              )}
            </div>
          )}
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
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: '#16a34a', color: '#fff' }}
              >
                ✓ Download Combined PDF ({todoProducts.length})
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
          <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0 flex-wrap"
            style={{ background: '#0d1117', borderBottom: '1px solid #1e293b' }}>
            {product.views.map((v) => (
              <button key={v} onClick={() => setActiveView(v)}
                className="px-3 py-1 rounded-md text-xs font-semibold capitalize"
                style={{ background: activeView === v ? '#1d4ed8' : '#1e293b', color: activeView === v ? '#fff' : '#64748b' }}>
                {v.replace(/-/g, ' ')}
              </button>
            ))}
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
