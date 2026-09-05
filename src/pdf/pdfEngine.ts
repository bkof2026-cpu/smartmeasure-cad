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
}

export interface PdfProjectInfo {
  projectId: string;
  clientName: string;
  employeeName: string;
  products: string[];
}

// ─── Evidence Note (bottom-right corner) ────────────────────────────────────
// A short free-text note tied to the current product/measurement (see the
// Evidence tab in ProductFlow.tsx), included on the single-product PDF only
// per the user's own request. Reserves space at the bottom-right of the
// LAST page only — never drawn on a page that has none, never overlapping
// the drawing/dimension/heading/footer content already on that page.
const NOTE_FONT_SIZE = 8;
const NOTE_LINE_HEIGHT = 10;
const NOTE_LABEL_GAP = 4; // px between the "Evidence Note" label and its text
const NOTE_BOX_PAD = 6;
const NOTE_MAX_WIDTH = 220; // pt — wide enough to read, narrow enough to stay clear of the drawing

/** How tall the reserved bottom-right strip needs to be for this note, in pt
 * — 0 when the note is empty/whitespace-only, so the caller can skip
 * reserving any space at all (spec: no empty section, no wasted space). */
function evidenceNoteBlockHeight(doc: jsPDF, note: string | undefined): number {
  if (!note || !note.trim()) return 0;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(NOTE_FONT_SIZE);
  const lines = doc.splitTextToSize(note.trim(), NOTE_MAX_WIDTH - NOTE_BOX_PAD * 2);
  const textH = lines.length * NOTE_LINE_HEIGHT;
  const labelH = NOTE_LINE_HEIGHT + NOTE_LABEL_GAP;
  return NOTE_BOX_PAD * 2 + labelH + textH;
}

/** Draws the Evidence Note label + wrapped text pinned to the page's own
 * bottom-right corner (inside MARGIN, never past it) — a no-op when the
 * note is empty, per spec §7. */
function drawEvidenceNote(doc: jsPDF, note: string | undefined) {
  if (!note || !note.trim()) return;
  const trimmed = note.trim();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(NOTE_FONT_SIZE);
  const lines = doc.splitTextToSize(trimmed, NOTE_MAX_WIDTH - NOTE_BOX_PAD * 2);
  const blockH = evidenceNoteBlockHeight(doc, trimmed);
  const boxW = NOTE_MAX_WIDTH;
  const x = PAGE_W - MARGIN - boxW;
  const y = PAGE_H - MARGIN - blockH;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(NOTE_FONT_SIZE);
  doc.setTextColor(100, 100, 100);
  doc.text('Evidence Note', x + boxW - NOTE_BOX_PAD, y + NOTE_BOX_PAD + NOTE_FONT_SIZE, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(NOTE_FONT_SIZE);
  doc.setTextColor(60, 60, 60);
  const textY = y + NOTE_BOX_PAD + NOTE_LINE_HEIGHT + NOTE_LABEL_GAP;
  doc.text(lines, x + boxW - NOTE_BOX_PAD, textY, { align: 'right', lineHeightFactor: NOTE_LINE_HEIGHT / NOTE_FONT_SIZE });
}

// Page geometry — A3 landscape in points (jsPDF's 'pt' unit), matching the
// paper size the previous HTML/print version used.
const PAGE_W = 1190.55; // A3 landscape width in pt
const PAGE_H = 841.89; // A3 landscape height in pt
const MARGIN = 28; // ~10mm
const INFO_BLOCK_W = 230;
const INFO_BLOCK_H = 92;

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

/** Draws the compact project-info block PINNED to the top-left of the
 * CURRENT page — real PDF drawing calls (rect/text at fixed coordinates),
 * not HTML/CSS layout, so there is no flex/centering ambiguity possible:
 * this always lands at exactly (MARGIN, MARGIN) with the exact same size
 * on every page. */
function drawInfoBlock(doc: jsPDF, info: PdfProjectInfo, pageNum: number, pageCount: number) {
  const x = MARGIN, y = MARGIN;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.75);
  doc.rect(x, y, INFO_BLOCK_W, INFO_BLOCK_H);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(29, 78, 216);
  doc.text('SmartMeasure CAD', x + 10, y + 16);

  const rows: [string, string][] = [
    ['Project ID', info.projectId || '—'],
    ['Client', info.clientName || '—'],
    ['Employee', info.employeeName || '—'],
    [info.products.length > 1 ? 'Products' : 'Product', info.products.join(', ') || '—'],
    ['Date', new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })],
    ['Time', new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })],
  ];
  doc.setFontSize(8);
  let rowY = y + 30;
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(136, 136, 136);
    doc.text(label, x + 10, rowY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 17, 17);
    // Wrap long values (e.g. many product names) within the block's own
    // width rather than overflowing past its right edge.
    const wrapped = doc.splitTextToSize(value, INFO_BLOCK_W - 68);
    doc.text(wrapped, x + 68, rowY);
    rowY += 9 * Math.max(1, wrapped.length);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(102, 102, 102);
  doc.text(`Page ${pageNum} of ${pageCount}`, PAGE_W - MARGIN, y + 12, { align: 'right' });
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

  const svgAreaY = titleY + 6 + captionH;
  const svgAreaH = cell.y + cell.h - pad - svgAreaY;
  const svgAreaW = cell.w - pad * 2;
  if (svgAreaW <= 4 || svgAreaH <= 4) return;

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
  const usableH = PAGE_H - MARGIN * 2 - INFO_BLOCK_H - 20;
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

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [PAGE_W, PAGE_H] });

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    if (pageIdx > 0) doc.addPage([PAGE_W, PAGE_H], 'landscape');

    drawInfoBlock(doc, info, pageIdx + 1, pages.length);

    let contentTop = MARGIN + INFO_BLOCK_H + 14;
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

const COMPONENT_TABLE_COLS = [
  { key: 'sr', label: 'Sr.', w: 0.05 },
  { key: 'component', label: 'Component', w: 0.28 },
  { key: 'width', label: 'Width (mm)', w: 0.12 },
  { key: 'height', label: 'Height (mm)', w: 0.12 },
  { key: 'qty', label: 'Qty', w: 0.08 },
  { key: 'thk', label: 'Thk (mm)', w: 0.1 },
  { key: 'remark', label: 'Formula / Note', w: 0.25 },
];

/** Computes the table's real total height without drawing anything —
 * lets the caller know exactly how far down the page it will reach, so it
 * can decide whether the Evidence Note still has clear room below it. */
function componentTableHeight(doc: jsPDF, rows: PdfCutRow[]): number {
  const w = PAGE_W - MARGIN * 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const rowsH = rows.reduce((sum, r) => {
    const values = [String(1), r.component, String(Math.round(r.width)), String(Math.round(r.height)), String(r.qty), r.thickness ? String(r.thickness) : '', r.remark ?? ''];
    const rowLines = values.map((v, ci) => doc.splitTextToSize(v, w * COMPONENT_TABLE_COLS[ci].w - 6));
    return sum + Math.max(11, ...rowLines.map((l) => l.length * 8));
  }, 0);
  return 14 + rowsH; // header row (14) + every data row
}

function drawComponentTable(doc: jsPDF, rows: PdfCutRow[], startY: number): void {
  const x = MARGIN;
  const w = PAGE_W - MARGIN * 2;
  const cols = COMPONENT_TABLE_COLS;
  let colX: number[] = [];
  let acc = x;
  for (const c of cols) { colX.push(acc); acc += w * c.w; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(17, 17, 17);
  doc.setFillColor(240, 240, 240);
  doc.rect(x, startY, w, 14, 'F');
  cols.forEach((c, i) => doc.text(c.label, colX[i] + 3, startY + 10));

  let y = startY + 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  rows.forEach((r, i) => {
    const values = [String(i + 1), r.component, String(Math.round(r.width)), String(Math.round(r.height)), String(r.qty), r.thickness ? String(r.thickness) : '', r.remark ?? ''];
    const rowLines = values.map((v, ci) => doc.splitTextToSize(v, w * cols[ci].w - 6));
    const rowH = Math.max(11, ...rowLines.map((l) => l.length * 8));
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.rect(x, y, w, rowH);
    values.forEach((_, ci) => doc.text(rowLines[ci], colX[ci] + 3, y + 8));
    y += rowH;
  });
}

/** Generates one real, single-file PDF for one product: its own view(s)
 * plus its real per-component table, exactly as the on-screen single-
 * product PDF tab already promises — never a re-simplified redraw. */
export async function generateAndDownloadSingleProductPdf(
  productName: string,
  views: PdfViewItem[],
  cutlist: PdfCutRow[],
  info: PdfProjectInfo,
  evidenceNote?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (views.length === 0) return { ok: false, error: 'No drawing to include.' };
  if (!info.clientName.trim()) return { ok: false, error: 'Client Name is required before a PDF can be generated.' };

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [PAGE_W, PAGE_H] });
  const totalPages = views.length + (cutlist.length > 0 ? 1 : 0);
  const lastViewIndex = views.length - 1;

  // Decide up front which single page (if any) gets the Evidence Note, so
  // it is drawn exactly once and only where there is real, provably clear
  // room below/beside the existing content — never guessed after the fact.
  // A blank/whitespace note needs 0pt, so a product with no note reserves
  // nothing anywhere and renders identically to before this feature existed.
  const noteBlockHeight = evidenceNoteBlockHeight(doc, evidenceNote);
  let noteOnTablePage = false;
  let noteOnLastViewPage = false;
  if (noteBlockHeight > 0) {
    if (cutlist.length > 0) {
      // The component table's own height is fully computable ahead of
      // drawing it — if the note fits below the table with room to spare,
      // it goes there (visually pairing "why the measurement is trusted"
      // with the parts list); otherwise it falls back to the last drawing
      // view page instead of ever overlapping the table.
      const tableContentTop = MARGIN + INFO_BLOCK_H + 14 + 10;
      const tableBottom = tableContentTop + componentTableHeight(doc, cutlist);
      const fitsBelowTable = tableBottom + 12 + noteBlockHeight <= PAGE_H - MARGIN;
      noteOnTablePage = fitsBelowTable;
      noteOnLastViewPage = !fitsBelowTable;
    } else {
      noteOnLastViewPage = true;
    }
  }

  for (let i = 0; i < views.length; i++) {
    if (i > 0) doc.addPage([PAGE_W, PAGE_H], 'landscape');
    drawInfoBlock(doc, info, i + 1, totalPages);

    const contentTop = MARGIN + INFO_BLOCK_H + 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(102, 102, 102);
    doc.text(`${views[i].label.toUpperCase()} VIEW`, MARGIN, contentTop);

    const reserveNote = i === lastViewIndex && noteOnLastViewPage ? noteBlockHeight : 0;
    const cell = { x: MARGIN, y: contentTop + 8, w: PAGE_W - MARGIN * 2, h: PAGE_H - MARGIN - (contentTop + 8) - reserveNote };
    await drawItemCell(doc, { id: `view-${i}`, name: productName, caption: '', svgEl: views[i].svgEl }, cell);
    if (reserveNote > 0) drawEvidenceNote(doc, evidenceNote);
  }

  if (cutlist.length > 0) {
    doc.addPage([PAGE_W, PAGE_H], 'landscape');
    drawInfoBlock(doc, info, totalPages, totalPages);
    const contentTop = MARGIN + INFO_BLOCK_H + 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text('Component Table — every part\'s real size, quantity and formula', MARGIN, contentTop);
    drawComponentTable(doc, cutlist, contentTop + 10);
    if (noteOnTablePage) drawEvidenceNote(doc, evidenceNote);
  }

  const filename = `${pdfClientFileName(info.clientName, info.projectId)}.pdf`;
  doc.save(filename);
  return { ok: true };
}
