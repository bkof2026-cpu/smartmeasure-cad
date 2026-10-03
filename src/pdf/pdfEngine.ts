import { jsPDF } from 'jspdf';
import 'svg2pdf.js';

// ─────────────────────────────────────────────────────────────────────────────
// Real PDF generation — one .pdf file, one download, no HTML/JSON side-file.
// Renders each product's REAL SVG (the same canonical drawing shown on
// screen) as true vector content via svg2pdf.js, never a rasterized image
// or a re-simplified redraw. Replaces the old approach (download an .html
// file with an embedded window.print() call), which never produced an
// actual .pdf at all — the file the app handed the user WAS an .html file.
// ─────────────────────────────────────────────────────────────────────────────

export interface PdfDrawingItem {
  id: string;
  name: string;
  caption: string;
  roomCategory?: string;
  /** A real, currently-mounted SVG element — svg2pdf.js requires a live DOM
   * node (it does not work against a plain HTML string or JSDOM), so the
   * caller renders each product's drawing into an off-screen container
   * first and hands the resulting <svg> element here. */
  svgEl: SVGSVGElement;
  /** This product's own Evidence Note, selected per-product in the Combined
   * PDF tab (see ProductFlow.tsx's evidence-note-per-product picker) —
   * drawn inside THIS item's own bordered cell, bottom-right corner, never
   * the page's. Absent/blank draws nothing and reserves no space. */
  evidenceNote?: string;
}

export interface PdfProjectInfo {
  projectId: string;
  clientName: string;
  employeeName: string;
  products: string[];
}

// ─── Evidence Note (per-item, bottom-right of its own box) ─────────────────
// A short free-text note tied to a product/measurement (see the Evidence
// tab in ProductFlow.tsx). In the Combined PDF it is drawn inside that
// product's own cell (drawCellEvidenceNote, below); in the single-product
// PDF it replaces the Component Table's own Formula/Note column instead
// (see noteColumnText/drawComponentTable) — no separate page-corner drawer
// is needed there.
const CELL_NOTE_FONT_SIZE = 6.5;
const CELL_NOTE_LINE_HEIGHT = 8;
const CELL_NOTE_LABEL_GAP = 3;
const CELL_NOTE_PAD = 4;

/** How tall a cell-scoped Evidence Note block needs to be, for a given
 * available width inside that cell — used by drawItemCell to shrink the
 * drawing area by exactly this much before rendering the SVG, so the note
 * never overlaps it. 0 when the note is empty. */
function cellEvidenceNoteHeight(doc: jsPDF, note: string | undefined, maxWidth: number): number {
  if (!note || !note.trim()) return 0;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(CELL_NOTE_FONT_SIZE);
  const lines = doc.splitTextToSize(note.trim(), Math.max(20, maxWidth - CELL_NOTE_PAD * 2));
  const textH = lines.length * CELL_NOTE_LINE_HEIGHT;
  const labelH = CELL_NOTE_LINE_HEIGHT + CELL_NOTE_LABEL_GAP;
  return CELL_NOTE_PAD * 2 + labelH + textH;
}

/** Draws one product's own Evidence Note pinned to the BOTTOM-RIGHT corner
 * of that product's own bordered cell in the Combined PDF grid — never the
 * page's corner, since a page can hold several products' cells. No-op when
 * the note is empty. */
function drawCellEvidenceNote(doc: jsPDF, note: string | undefined, cell: { x: number; y: number; w: number; h: number }) {
  if (!note || !note.trim()) return;
  const trimmed = note.trim();
  const maxWidth = cell.w - CELL_NOTE_PAD * 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(CELL_NOTE_FONT_SIZE);
  const lines = doc.splitTextToSize(trimmed, maxWidth - CELL_NOTE_PAD * 2);
  const blockH = cellEvidenceNoteHeight(doc, trimmed, cell.w);
  const rightX = cell.x + cell.w - CELL_NOTE_PAD;
  const y = cell.y + cell.h - CELL_NOTE_PAD - blockH;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(CELL_NOTE_FONT_SIZE);
  doc.setTextColor(100, 100, 100);
  doc.text('Evidence Note', rightX, y + CELL_NOTE_PAD + CELL_NOTE_FONT_SIZE - 1, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(CELL_NOTE_FONT_SIZE);
  doc.setTextColor(60, 60, 60);
  const textY = y + CELL_NOTE_PAD + CELL_NOTE_LINE_HEIGHT + CELL_NOTE_LABEL_GAP - 1;
  doc.text(lines, rightX, textY, { align: 'right', lineHeightFactor: CELL_NOTE_LINE_HEIGHT / CELL_NOTE_FONT_SIZE });
}

// Page geometry — standard A4 PORTRAIT in points (jsPDF's 'pt' unit), per
// the user's explicit instruction: every generated PDF (single-product and
// combined) uses this same page size now, replacing the old A3 landscape.
const PAGE_W = 595.28; // A4 portrait width in pt
const PAGE_H = 841.89; // A4 portrait height in pt
const MARGIN = 24; // ~8.5mm — slightly tighter than the old A3 margin, since A4 has much less width to spend
// Header now spans the FULL page width (not a narrow top-left box) and is
// split into two side-by-side columns — per the user's explicit PDF-layout
// request: less vertical header space frees more room for the drawing,
// without losing any of the existing project/product metadata. The exact
// height is computed per-call from however many rows actually exist in each
// column (see drawInfoBlock/infoBlockHeight below) rather than a fixed
// constant, since e.g. a single-product PDF has one fewer "Products" line
// of wrapping than a many-product combined one.
const INFO_BLOCK_W = PAGE_W - MARGIN * 2;

/** Sanitizes a string for use as a filesystem filename: strips characters
 * invalid on Windows/macOS/Linux, collapses whitespace to a single
 * underscore, trims leading/trailing separators. Never returns empty. */
export function sanitizeFilenamePart(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '') // filesystem-invalid characters
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'Project';
}

/** Client-name-based filename per spec §3 — "Kunal_Meheta.pdf", falling
 * back to a generic name only when Client Name is genuinely empty (the
 * caller already blocks PDF generation without a Client Name, so this is
 * a defensive fallback, not the normal path). Appends the Project ID as a
 * suffix so two different projects for the same client never collide —
 * flagged as a deliberate deviation from the single-name example, per the
 * spec's own instruction to flag rather than silently decide when this
 * might conflict with an existing convention (no existing convention did
 * this before; the previous filenames were never client-name-based). */
export function pdfClientFileName(clientName: string, projectId: string): string {
  const client = sanitizeFilenamePart(clientName || 'Client');
  const project = sanitizeFilenamePart(projectId || '');
  return project && project !== 'Project' ? `${client}_${project}` : client;
}

// Two-column header layout constants — a title band, then two equal
// columns of label/value rows. Label column width is fixed (short labels
// like "Employee"/"Date" never need more); the value wraps within
// whatever's left of that column's own half-width, so a long client name
// or product list wraps inside ITS column rather than colliding with the
// other column or running off the page edge.
const HEADER_TITLE_H = 18;
const HEADER_ROW_H = 11; // one line of label:value
const HEADER_ROW_GAP = 2;
const HEADER_COL_LABEL_W = 56;
const HEADER_COL_GAP = 14;
const HEADER_PAD = 10;

/** Splits the project/product metadata into the two columns the spec asks
 * for (left: identity — Project ID/Client/Employee/Product; right: timing +
 * anything else) — a fixed, logical split since these are the only fields
 * this app's PDFs have ever carried; a future field would be a deliberate
 * addition to one list below, not a dynamic "whatever's left over" guess. */
function headerColumns(info: PdfProjectInfo): { left: [string, string][]; right: [string, string][] } {
  const left: [string, string][] = [
    ['Project ID', info.projectId || '—'],
    ['Client', info.clientName || '—'],
    ['Employee', info.employeeName || '—'],
    [info.products.length > 1 ? 'Products' : 'Product', info.products.join(', ') || '—'],
  ];
  const right: [string, string][] = [
    ['Date', new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })],
    ['Time', new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })],
  ];
  return { left, right };
}

/** How many lines a column's rows will actually wrap to, at the header's
 * own fixed font size — used both to size the header box up front (so the
 * drawing area below it is computed correctly) and to position each row
 * while drawing, so the two never disagree. */
function columnRowLineCounts(doc: jsPDF, rows: [string, string][], colW: number): number[] {
  const valueW = Math.max(20, colW - HEADER_COL_LABEL_W);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  return rows.map(([, value]) => Math.max(1, doc.splitTextToSize(value, valueW).length));
}

/** The header block's real total height for this specific info (dynamic —
 * never a fixed constant — per the spec's "work dynamically even when some
 * fields are missing" requirement): title band + the taller of the two
 * columns' own real wrapped-row heights + padding. Callers use this to lay
 * out everything below the header (drawing area, table) against the header's
 * ACTUAL height, not a guess, so freed space is real, not approximate. */
function infoBlockHeight(doc: jsPDF, info: PdfProjectInfo): number {
  const colW = (INFO_BLOCK_W - HEADER_PAD * 2 - HEADER_COL_GAP) / 2;
  const { left, right } = headerColumns(info);
  const leftLines = columnRowLineCounts(doc, left, colW);
  const rightLines = columnRowLineCounts(doc, right, colW);
  const colH = (lines: number[]) => lines.reduce((sum, n) => sum + n * HEADER_ROW_H + HEADER_ROW_GAP, 0);
  const tallestColH = Math.max(colH(leftLines), colH(rightLines));
  return HEADER_PAD + HEADER_TITLE_H + tallestColH + HEADER_PAD * 0.6;
}

/** Draws the compact, two-column project-info header spanning the FULL page
 * width, PINNED to the top of the CURRENT page — real PDF drawing calls
 * (rect/text at fixed coordinates), not HTML/CSS layout, so there is no
 * flex/centering ambiguity possible: this always lands at exactly (MARGIN,
 * MARGIN) with a height derived from infoBlockHeight(), which every caller
 * MUST call first (and use the SAME result) to lay out the content below it
 * — the two are a matched pair by construction, never two independent
 * height guesses that could silently drift apart. */
function drawInfoBlock(doc: jsPDF, info: PdfProjectInfo, pageNum: number, pageCount: number, blockH: number) {
  const x = MARGIN, y = MARGIN;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.75);
  doc.rect(x, y, INFO_BLOCK_W, blockH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(29, 78, 216);
  doc.text('SmartMeasure CAD', x + HEADER_PAD, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(102, 102, 102);
  doc.text(`Page ${pageNum} of ${pageCount}`, x + INFO_BLOCK_W - HEADER_PAD, y + 14, { align: 'right' });

  const colW = (INFO_BLOCK_W - HEADER_PAD * 2 - HEADER_COL_GAP) / 2;
  const { left, right } = headerColumns(info);
  const colTop = y + HEADER_TITLE_H + 6;

  function drawColumn(rows: [string, string][], colX: number) {
    const valueX = colX + HEADER_COL_LABEL_W;
    const valueW = Math.max(20, colW - HEADER_COL_LABEL_W);
    let rowY = colTop;
    for (const [label, value] of rows) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(136, 136, 136);
      doc.text(label, colX, rowY + 7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 17, 17);
      const wrapped = doc.splitTextToSize(value, valueW);
      doc.text(wrapped, valueX, rowY + 7);
      rowY += wrapped.length * HEADER_ROW_H + HEADER_ROW_GAP;
    }
  }

  drawColumn(left, x + HEADER_PAD);
  drawColumn(right, x + HEADER_PAD + colW + HEADER_COL_GAP);
}

function drawCategoryHeading(doc: jsPDF, heading: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text(heading.toUpperCase(), MARGIN, y);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(1);
  doc.line(MARGIN, y + 4, PAGE_W - MARGIN, y + 4);
  return y + 20;
}

/** Draws one item's card (border, title, caption) and its real SVG scaled
 * to fit inside (cell.x, cell.y, cell.w, cell.h) without distortion —
 * preserves the drawing's own real aspect ratio (from its live viewBox),
 * never stretching it, matching the spec's "never distort a drawing" rule
 * (carried over from the earlier multi-product-PDF work this session). */
/** svg2pdf.js reads each element's own font-family directly off the SVG at
 * conversion time — the app's own on-screen drawings use web fonts
 * (JetBrains Mono, DM Sans) that have no embedded equivalent in the PDF,
 * and a long, steeply-rotated label in an unrecognized font was observed
 * rendering as garbled/vertically-stacked characters (confirmed via a
 * real generated PDF during this feature's own verification). Fixed by
 * cloning the SVG and rewriting every font-family to one of jsPDF's own
 * built-in, always-embedded fonts before handing it to svg2pdf.js — the
 * LIVE on-screen SVG (the original element, never mutated) is completely
 * unaffected, since this operates on a clone. */
// jsPDF's base-14 fonts (Courier/Helvetica, the only ones pdfSafeSvgClone
// ever rewrites font-family to) cover plain ASCII only — a label text node
// containing a character outside that range (e.g. the "→" U+2192 arrow
// used in Kitchen's own "300 mm (A → B)" Kadappa-segment labels) has no
// glyph to fall back to and renders as garbled null-byte text in the PDF
// (confirmed via a real generated Kitchen PDF during this feature's own
// verification) — entirely a PDF-export-layer issue, the on-screen SVG
// renders it correctly via a real web font that DOES have the glyph. Fixed
// by substituting each such character for its closest plain-ASCII
// equivalent in the CLONE's own text content only, never the live
// on-screen SVG and never the underlying label/formula data a component
// carries — purely a presentation substitution for jsPDF's limited font
// coverage.
const PDF_UNSAFE_CHAR_SUBSTITUTIONS: [RegExp, string][] = [
  [/→/g, '->'],
  [/←/g, '<-'],
  [/×/g, 'x'],
  [/–/g, '-'], // en dash
  [/—/g, '-'], // em dash
  [/′/g, "'"], // prime
  [/″/g, '"'], // double prime
];

function pdfSafeText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of PDF_UNSAFE_CHAR_SUBSTITUTIONS) out = out.replace(pattern, replacement);
  return out;
}

function pdfSafeSvgClone(svgEl: SVGSVGElement): SVGSVGElement {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const monoSafe = 'Courier';
  const sansSafe = 'Helvetica';
  const rewrite = (value: string): string => (/mono/i.test(value) ? monoSafe : sansSafe);

  const all = [clone, ...Array.from(clone.querySelectorAll('*'))];
  for (const el of all) {
    const attr = el.getAttribute('font-family');
    if (attr) el.setAttribute('font-family', rewrite(attr));
    const styleAttr = el.getAttribute('style');
    if (styleAttr && /font-family/i.test(styleAttr)) {
      const rewritten = styleAttr.replace(/font-family\s*:\s*[^;]+/i, (m) => `font-family:${rewrite(m)}`);
      el.setAttribute('style', rewritten);
    }
  }

  // Walk every real text node (not attributes — <text>/<tspan> content) and
  // substitute any character the base-14 fonts above can't render.
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent) node.textContent = pdfSafeText(node.textContent);
    node = walker.nextNode();
  }
  return clone;
}

async function drawItemCell(doc: jsPDF, item: PdfDrawingItem, cell: { x: number; y: number; w: number; h: number }) {
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.75);
  doc.rect(cell.x, cell.y, cell.w, cell.h);

  const pad = 8;
  let titleY = cell.y + pad + 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(item.name.toUpperCase(), cell.x + cell.w / 2, titleY, { align: 'center', maxWidth: cell.w - pad * 2 });

  let captionH = 0;
  if (item.caption) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(102, 102, 102);
    doc.text(item.caption, cell.x + cell.w / 2, titleY + 10, { align: 'center', maxWidth: cell.w - pad * 2 });
    captionH = 12;
  }

  // Reserve room at the bottom of THIS cell for its own Evidence Note (if
  // any) before sizing the drawing, so the two never overlap — same
  // "compute the note's real height first, then shrink the content area by
  // exactly that much" approach as the single-product PDF's page-level note.
  const noteH = cellEvidenceNoteHeight(doc, item.evidenceNote, cell.w);

  const svgAreaY = titleY + 6 + captionH;
  const svgAreaH = cell.y + cell.h - pad - svgAreaY - noteH;
  const svgAreaW = cell.w - pad * 2;
  if (svgAreaW <= 4 || svgAreaH <= 4) {
    if (noteH > 0) drawCellEvidenceNote(doc, item.evidenceNote, cell);
    return;
  }

  const vb = item.svgEl.getAttribute('viewBox');
  const [, , vbW, vbH] = (vb ? vb.split(/\s+/).map(Number) : [0, 0, 100, 100]);
  const realW = vbW > 0 ? vbW : 100;
  const realH = vbH > 0 ? vbH : 100;
  const scale = Math.min(svgAreaW / realW, svgAreaH / realH);
  const drawW = realW * scale;
  const drawH = realH * scale;
  const drawX = cell.x + pad + (svgAreaW - drawW) / 2;
  const drawY = svgAreaY + (svgAreaH - drawH) / 2;

  // The clone must be attached (off-screen) for svg2pdf.js to correctly
  // read computed font metrics — a fully detached node can measure text
  // incorrectly, the same reasoning mountOffscreenSvgs() already applies
  // to the original mount.
  const safeSvg = pdfSafeSvgClone(item.svgEl);
  safeSvg.style.position = 'fixed';
  safeSvg.style.left = '-99999px';
  safeSvg.style.top = '0';
  document.body.appendChild(safeSvg);
  try {
    await doc.svg(safeSvg, { x: drawX, y: drawY, width: drawW, height: drawH });
  } finally {
    safeSvg.remove();
  }

  if (noteH > 0) drawCellEvidenceNote(doc, item.evidenceNote, cell);
}

/** Real, aspect-ratio-derived size classification (spec §2 "Grouping"):
 * "large/complex" when the drawing's own real bounding box would need
 * more than roughly half the usable page width or height to stay legible
 * at a normal multi-up scale — not a hardcoded per-product list, so a
 * product not explicitly known about still classifies correctly from its
 * own real geometry. */
function isLargeDrawing(item: PdfDrawingItem): boolean {
  const vb = item.svgEl.getAttribute('viewBox');
  if (!vb) return false;
  const [, , vbW, vbH] = vb.split(/\s+/).map(Number);
  if (!vbW || !vbH) return false;
  const usableW = PAGE_W - MARGIN * 2;
  // packPages (this function's only caller) runs before any jsPDF `doc`
  // exists, so the header's real dynamic height (infoBlockHeight, which
  // needs a doc to measure text wrapping) isn't available yet — a
  // conservative typical-header estimate is fine here since this is only a
  // size-classification heuristic (large vs. small drawing), not a layout
  // measurement that has to be pixel-exact.
  const TYPICAL_HEADER_H_ESTIMATE = 60;
  const usableH = PAGE_H - MARGIN * 2 - TYPICAL_HEADER_H_ESTIMATE - 20;
  // A drawing whose own real aspect ratio, scaled to the FULL usable page,
  // would still occupy more than ~35% of that page's area reads as
  // "large/complex" — this is scale-independent (a huge Width but tiny
  // Height, or vice-versa, both correctly read as needing more room than a
  // simple single box), unlike a raw width/height threshold.
  const fitScale = Math.min(usableW / vbW, usableH / vbH);
  const areaFraction = (vbW * fitScale * vbH * fitScale) / (usableW * usableH);
  return areaFraction > 0.35;
}

interface PackedPage {
  items: PdfDrawingItem[];
  heading?: string;
  cols: number;
  rows: number;
}

/** The real packing algorithm (spec §2): Kitchen items always page-
 * separate from everything else; Master Bedroom + Living Room items
 * merge into one shared pool. ≤5 combined items pack onto a single page
 * in a responsive grid; >5 splits into a "small items" grid page (or
 * pages, if still too many) and a separate "large/complex" page (1–2 per
 * page). A category heading only appears on a page's FIRST section run
 * for that category-group, and a page is never created with a heading and
 * no drawings (every page pushed here always carries ≥1 item). */
function packPages(items: PdfDrawingItem[]): PackedPage[] {
  const kitchen = items.filter((it) => it.roomCategory === 'Kitchen');
  const bedroomLiving = items.filter((it) => it.roomCategory === 'Master Bedroom' || it.roomCategory === 'Living Room');
  const other = items.filter((it) => it.roomCategory !== 'Kitchen' && it.roomCategory !== 'Master Bedroom' && it.roomCategory !== 'Living Room');

  const pages: PackedPage[] = [];

  function gridFor(count: number): { cols: number; rows: number } {
    if (count <= 1) return { cols: 1, rows: 1 };
    if (count === 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    return { cols: 3, rows: 3 };
  }

  function pushGridPages(group: PdfDrawingItem[], heading: string | undefined, maxPerPage: number) {
    for (let i = 0; i < group.length; i += maxPerPage) {
      const slice = group.slice(i, i + maxPerPage);
      pages.push({ items: slice, heading: i === 0 ? heading : undefined, ...gridFor(slice.length) });
    }
  }

  // Master Bedroom + Living Room — merged pool, packed per §2's rule.
  if (bedroomLiving.length > 0) {
    if (bedroomLiving.length <= 5) {
      pages.push({ items: bedroomLiving, heading: 'Master Bedroom + Living Room', ...gridFor(bedroomLiving.length) });
    } else {
      const small = bedroomLiving.filter((it) => !isLargeDrawing(it));
      const large = bedroomLiving.filter((it) => isLargeDrawing(it));
      if (small.length > 0) pushGridPages(small, 'Master Bedroom + Living Room', 6);
      if (large.length > 0) pushGridPages(large, small.length > 0 ? undefined : 'Master Bedroom + Living Room', 2);
    }
  }

  // Kitchen — always its own dedicated page(s), same small/large packing.
  if (kitchen.length > 0) {
    if (kitchen.length <= 5) {
      pages.push({ items: kitchen, heading: 'Kitchen', ...gridFor(kitchen.length) });
    } else {
      const small = kitchen.filter((it) => !isLargeDrawing(it));
      const large = kitchen.filter((it) => isLargeDrawing(it));
      if (small.length > 0) pushGridPages(small, 'Kitchen', 6);
      if (large.length > 0) pushGridPages(large, small.length > 0 ? undefined : 'Kitchen', 2);
    }
  }

  // Any product with no room category (whole-room/apartment layout items)
  // — never silently dropped, packed the same way as its own trailing group.
  if (other.length > 0) {
    if (other.length <= 5) {
      pages.push({ items: other, ...gridFor(other.length) });
    } else {
      pushGridPages(other, undefined, 6);
    }
  }

  return pages;
}

/** Generates one real, single-file PDF from the given items and triggers
 * exactly one file download (doc.save) — no HTML/JSON side-file is ever
 * created. Returns ok:false with a reason instead of throwing, matching
 * the calling screen's existing error-surfacing convention. */
export async function generateAndDownloadPdf(
  items: PdfDrawingItem[],
  info: PdfProjectInfo,
): Promise<{ ok: boolean; error?: string }> {
  if (items.length === 0) return { ok: false, error: 'No product drawings to include.' };
  if (!info.clientName.trim()) return { ok: false, error: 'Client Name is required before a PDF can be generated.' };

  const pages = packPages(items);
  if (pages.length === 0) return { ok: false, error: 'No product drawings to include.' };

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [PAGE_W, PAGE_H] });

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    if (pageIdx > 0) doc.addPage([PAGE_W, PAGE_H], 'portrait');

    const blockH = infoBlockHeight(doc, info);
    drawInfoBlock(doc, info, pageIdx + 1, pages.length, blockH);

    let contentTop = MARGIN + blockH + 14;
    if (page.heading) contentTop = drawCategoryHeading(doc, page.heading, contentTop) + 6;

    const gridX = MARGIN;
    const gridY = contentTop;
    const gridW = PAGE_W - MARGIN * 2;
    const gridH = PAGE_H - MARGIN - gridY;
    const gap = 10;
    const cellW = (gridW - gap * (page.cols - 1)) / page.cols;
    const cellH = (gridH - gap * (page.rows - 1)) / page.rows;

    for (let i = 0; i < page.items.length; i++) {
      const col = i % page.cols;
      const row = Math.floor(i / page.cols);
      const cell = {
        x: gridX + col * (cellW + gap),
        y: gridY + row * (cellH + gap),
        w: cellW,
        h: cellH,
      };
      // eslint-disable-next-line no-await-in-loop -- svg2pdf.js renders
      // one SVG at a time onto the same jsPDF document instance; parallel
      // calls would race on shared drawing state.
      await drawItemCell(doc, page.items[i], cell);
    }
  }

  const filename = `${pdfClientFileName(info.clientName, info.projectId)}.pdf`;
  doc.save(filename);
  return { ok: true };
}

// ─── Single-product PDF (one product's views + its real component table) ──

export interface PdfCutRow {
  component: string;
  width: number;
  height: number;
  qty: number;
  thickness?: number;
  remark?: string;
}

export interface PdfViewItem {
  label: string;
  svgEl: SVGSVGElement;
}

// Narrower column proportions than the old A3-landscape table — the "Sr."/
// "Qty"/"Thk" columns barely need any room, freeing width for Component and
// the last column, which now carries the Evidence Note (see below) rather
// than each row's own formula text — kept the SAME width share so a long
// note still wraps sensibly rather than being squeezed into a slim column.
const COMPONENT_TABLE_COLS = [
  { key: 'sr', label: 'Sr.', w: 0.045 },
  { key: 'component', label: 'Component', w: 0.235 },
  { key: 'width', label: 'Width (mm)', w: 0.13 },
  { key: 'height', label: 'Height (mm)', w: 0.13 },
  { key: 'qty', label: 'Qty', w: 0.07 },
  { key: 'thk', label: 'Thk (mm)', w: 0.09 },
  { key: 'remark', label: 'Evidence Note', w: 0.30 },
];

/** Per the user's explicit instruction: the single-product PDF's Component
 * Table no longer shows each row's real formula/derivation text in its last
 * column — that column becomes the Evidence Note instead, repeated on every
 * row so it reads clearly next to each component regardless of which row a
 * reader's eye lands on. Bold, in the label row's own dark ink (not the
 * muted grey the old formula text used) so it reads as a note, not
 * secondary metadata. Returns '' when there is no note, so the column is
 * simply blank rather than showing anything invented. */
function noteColumnText(evidenceNote: string | undefined): string {
  return evidenceNote?.trim() || '';
}

/** Computes the table's real total height without drawing anything — lets
 * the caller size the drawing/table split (65/35) using the table's actual
 * content, not a guess. */
function componentTableHeight(doc: jsPDF, rows: PdfCutRow[], tableWidth: number, evidenceNote: string | undefined): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const noteText = noteColumnText(evidenceNote);
  const rowsH = rows.reduce((sum, r) => {
    const values = [String(1), r.component, String(Math.round(r.width)), String(Math.round(r.height)), String(r.qty), r.thickness ? String(r.thickness) : '', noteText];
    const rowLines = values.map((v, ci) => doc.splitTextToSize(v, tableWidth * COMPONENT_TABLE_COLS[ci].w - 6));
    return sum + Math.max(11, ...rowLines.map((l) => l.length * 8));
  }, 0);
  return 14 + rowsH; // header row (14) + every data row
}

function drawComponentTable(doc: jsPDF, rows: PdfCutRow[], startY: number, tableWidth: number, evidenceNote: string | undefined): number {
  const x = MARGIN;
  const w = tableWidth;
  const cols = COMPONENT_TABLE_COLS;
  let colX: number[] = [];
  let acc = x;
  for (const c of cols) { colX.push(acc); acc += w * c.w; }
  const noteText = noteColumnText(evidenceNote);
  const noteColIndex = cols.length - 1;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(17, 17, 17);
  doc.setFillColor(240, 240, 240);
  doc.rect(x, startY, w, 14, 'F');
  cols.forEach((c, i) => doc.text(c.label, colX[i] + 3, startY + 10));

  let y = startY + 14;
  rows.forEach((r, i) => {
    const values = [String(i + 1), r.component, String(Math.round(r.width)), String(Math.round(r.height)), String(r.qty), r.thickness ? String(r.thickness) : '', noteText];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const rowLines = values.map((v, ci) => doc.splitTextToSize(v, w * cols[ci].w - 6));
    const rowH = Math.max(11, ...rowLines.map((l) => l.length * 8));
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.rect(x, y, w, rowH);
    values.forEach((_, ci) => {
      if (ci === noteColIndex && noteText) {
        // The Evidence Note reads as a NOTE, not routine table data — bold,
        // slightly darker ink than the rest of the row, per the user's
        // explicit "bold and proper visible format like notes" request.
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(17, 17, 17);
      }
      doc.text(rowLines[ci], colX[ci] + 3, y + 8);
    });
    y += rowH;
  });
  return y;
}

/** Generates one real, single-file, SINGLE-PAGE PDF for one product: its
 * own view(s) stacked above its real per-component table — per the user's
 * explicit instruction, a single product always fits on exactly one A4
 * page, drawing occupying ~65% of the usable height and the table the
 * remaining ~35%, rather than a separate page per view/table as before.
 * The Evidence Note (when present) replaces every row's Formula/Note
 * column content — the real per-part formula text this column used to show
 * is intentionally no longer included there, per the user's own explicit
 * confirmation of that trade-off. */
export async function generateAndDownloadSingleProductPdf(
  productName: string,
  views: PdfViewItem[],
  cutlist: PdfCutRow[],
  info: PdfProjectInfo,
  evidenceNote?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (views.length === 0) return { ok: false, error: 'No drawing to include.' };
  if (!info.clientName.trim()) return { ok: false, error: 'Client Name is required before a PDF can be generated.' };

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [PAGE_W, PAGE_H] });
  const blockH = infoBlockHeight(doc, info);
  drawInfoBlock(doc, info, 1, 1, blockH);

  const contentTop = MARGIN + blockH + 12;
  const contentBottom = PAGE_H - MARGIN;
  const usableH = contentBottom - contentTop;
  const tableW = PAGE_W - MARGIN * 2;

  const hasTable = cutlist.length > 0;
  // Per the PDF-layout spec: give the drawing whatever's left over after
  // the Component Table's own REAL measured height (not a fixed 65/35
  // split) — a short cutlist now hands almost all the freed vertical space
  // straight to the drawing, maximizing it exactly the way a single-product
  // PDF is supposed to ("use the available page area more aggressively"),
  // while a long cutlist still reserves enough real room for itself rather
  // than being squeezed into an arbitrary 35%.
  const tableGap = hasTable ? 8 : 0; // gap between the drawing zone and the "Component Table" label
  const tableHeadingOffset = hasTable ? 8 : 0; // label-to-grid offset — matches drawComponentTable's own (tableZoneTop + 8) call below
  const measuredTableH = hasTable ? componentTableHeight(doc, cutlist, tableW, evidenceNote) : 0;
  // Never let the table eat MORE than 45% of the usable height even if its
  // real content is taller than that — an unusually long cutlist still
  // overflows past the reserved zone exactly as the pre-existing comment
  // below already documents (jsPDF has no hard page boundary mid-draw), but
  // the DRAWING above it should never shrink below a sane minimum (55%)
  // just because of a long table — preserves this function's own original
  // floor on drawing prominence while removing the opposite problem (a
  // short table wastefully reserving a fixed 35% it doesn't need).
  const reservedTableH = hasTable ? Math.min(usableH * 0.45, tableGap + tableHeadingOffset + measuredTableH) : 0;
  const drawingH = hasTable ? usableH - reservedTableH : usableH;
  const tableZoneTop = contentTop + drawingH + tableGap;

  // Drawing zone: N views laid out side-by-side across the full width (every
  // real product has exactly one view; a rare multi-view product — e.g. the
  // out-of-scope room/floor-plan composite — still fits by sharing the row
  // instead of spilling onto a second page).
  const viewGap = 8;
  const viewW = (tableW - viewGap * (views.length - 1)) / views.length;
  for (let i = 0; i < views.length; i++) {
    const cell = { x: MARGIN + i * (viewW + viewGap), y: contentTop, w: viewW, h: drawingH };
    // eslint-disable-next-line no-await-in-loop -- svg2pdf.js renders one
    // SVG at a time onto the same jsPDF document instance.
    await drawItemCell(doc, { id: `view-${i}`, name: views.length > 1 ? `${productName} — ${views[i].label}` : productName, caption: '', svgEl: views[i].svgEl }, cell);
  }

  if (hasTable) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text('Component Table', MARGIN, tableZoneTop - 2);
    // Table height is sized from its OWN real measured content
    // (measuredTableH above) — the reserved zone already accounts for it,
    // so this normally fits exactly; an unusually long cutlist can still
    // overflow past the capped 45%-of-usable-height reservation (jsPDF has
    // no hard page boundary mid-draw) — extremely unlikely at normal
    // component counts and preferable to silently truncating real part data.
    drawComponentTable(doc, cutlist, tableZoneTop + 8, tableW, evidenceNote);
  }

  const filename = `${pdfClientFileName(info.clientName, info.projectId)}.pdf`;
  doc.save(filename);
  return { ok: true };
}
