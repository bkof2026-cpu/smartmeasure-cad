import React from 'react';
import type { ProductTemplate, CutlistRow, ProductId } from './productTypes';
import { SimpleBedDrawing } from './bed/SimpleBedDrawing';
import { simpleBedCutlist } from './bed/simpleBedGeometry';
// Old Side Table (Front/Plan/Side, drawer-front) and Loft Cabinet
// (box-count) engines are no longer wired to any live product entry —
// replaced by "Separate Side Table" (Mirror + Base Storage) and "Loft Box"
// (shutters + Top Panel) per the user's own Product Library spec. Their
// source files (sideTable/sideTableGeometry.ts, sideTable/
// sideTableFormulas.ts, loft/BoxTechnicalDrawing.tsx, loft/boxFormulas.ts)
// are left on disk, unimported, rather than deleted.
import { resolveSideTableFront, resolveSideTablePlan, resolveSideTableSide } from './sideTable/sideTableGeometry';
import { SeparateDressingDrawing } from './separateDressing/SeparateDressingDrawing';
import { separateDressingCutlist } from './separateDressing/separateDressingGeometry';
import { LabeledBoxDrawing } from './simpleBox/LabeledBoxDrawing';
import { labeledBoxCutlist, type LabeledBoxConfig } from './simpleBox/labeledBoxGeometry';
import { SeparateSideTableDrawing } from './separateSideTable/SeparateSideTableDrawing';
import { separateSideTableCutlist } from './separateSideTable/separateSideTableGeometry';
import { LoftBoxDrawing } from './loftBox/LoftBoxDrawing';
import { loftBoxCutlist } from './loftBox/loftBoxGeometry';
import { StudyTableDrawing } from './studyTable/StudyTableDrawing';
import { studyTableCutlist } from './studyTable/studyTableGeometry';
import { PartitionDrawing } from './partition/PartitionDrawing';
import { partitionCutlist } from './partition/partitionGeometry';
import { DiningTableDrawing2 } from './diningTable/DiningTableDrawing2';
import { diningTableCutlist } from './diningTable/diningTableGeometry';
import { DoorDrawing } from './door/DoorDrawing';
import { doorCutlist } from './door/doorGeometry';
import { KitchenCabinetDrawing } from './kitchenCabinet/KitchenCabinetDrawing';
import { kitchenCabinetCutlist } from './kitchenCabinet/kitchenCabinetGeometry';
import { TechnicalDrawingSvg } from '../engine/CanonicalSvg';
import { DrawingInspector } from '../engine/DrawingInspector';
import { SimpleWardrobeDrawing } from './wardrobe/SimpleWardrobeDrawing';
import { simpleWardrobeCutlist } from './wardrobe/simpleWardrobeGeometry';
import { SimpleShoeRackDrawing } from './shoeRack/SimpleShoeRackDrawing';
import { shoeRackCutlist } from './shoeRack/shoeRackGeometry';

// ─── cutlist row helper ───────────────────────────────────────────────────────
function row(
  srNo: number, component: string, material: string,
  w: number, h: number, qty: number, thk: number,
  groove = '', remark = '',
): CutlistRow {
  return { srNo, component, material, width: Math.round(w), height: Math.round(h), qty, thickness: thk, groove, remark };
}
const n = (v: number | string) => Number(v);

// ─── SVG drawing primitives ──────────────────────────────────────────────────

function SvgDefs() {
  return (
    <defs>
      <marker id="ad" markerWidth={7} markerHeight={7} refX={3.5} refY={3.5} orient="auto">
        <path d="M7,0 L7,7 L0,3.5 z" fill="#cc2200" />
      </marker>
      <pattern id="hatch" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={6} stroke="#ccc" strokeWidth={1} />
      </pattern>
      <pattern id="wood" width={8} height={8} patternUnits="userSpaceOnUse">
        <rect width={8} height={8} fill="#d4a96a" />
        <line x1={0} y1={2} x2={8} y2={2} stroke="#c09050" strokeWidth={0.5} />
        <line x1={0} y1={5} x2={8} y2={5} stroke="#c09050" strokeWidth={0.3} />
      </pattern>
    </defs>
  );
}

interface DimHProps { x1: number; x2: number; y: number; label: string; above?: boolean; col?: string; fs?: number; }
function DimH({ x1, x2, y, label, above = true, col = '#cc2200', fs = 8 }: DimHProps) {
  const mx = (x1 + x2) / 2, off = above ? -14 : 14;
  const lw = label.length * fs * 0.6 + 6;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={col} strokeWidth={0.8} markerStart="url(#ad)" markerEnd="url(#ad)" />
      <rect x={mx - lw / 2} y={y + off - fs * 0.7} width={lw} height={fs * 1.4} fill="white" stroke={col} strokeWidth={0.4} rx={1} />
      <text x={mx} y={y + off + fs * 0.35} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontFamily="'JetBrains Mono',monospace" fill={col}>{label}</text>
    </g>
  );
}

interface DimVProps { x: number; y1: number; y2: number; label: string; right?: boolean; col?: string; fs?: number; }
function DimV({ x, y1, y2, label, right = true, col = '#cc2200', fs = 8 }: DimVProps) {
  const my = (y1 + y2) / 2, off = right ? 14 : -14;
  const lw = label.length * fs * 0.6 + 6;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={col} strokeWidth={0.8} markerStart="url(#ad)" markerEnd="url(#ad)" />
      <rect x={x + off - lw / 2} y={my - fs * 0.7} width={lw} height={fs * 1.4} fill="white" stroke={col} strokeWidth={0.4} rx={1} />
      <text x={x + off} y={my + fs * 0.35} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontFamily="'JetBrains Mono',monospace" fill={col}>{label}</text>
    </g>
  );
}

function CabLabel({ x, y, w, h, text, sub = '', fs = 7 }: { x: number; y: number; w: number; h: number; text: string; sub?: string; fs?: number }) {
  if (w < 30 || h < 16) return null;
  return (
    <>
      <text x={x + w / 2} y={y + h / 2 - (sub ? fs * 0.7 : 0)} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontFamily="'DM Sans',sans-serif" fill="#333" fontWeight="700">{text}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + fs * 0.9} textAnchor="middle" dominantBaseline="middle" fontSize={fs * 0.8} fontFamily="'DM Sans',sans-serif" fill="#888">{sub}</text>}
    </>
  );
}

function Handle({ x, y, w = 3, h = 18, vertical = true }: { x: number; y: number; w?: number; h?: number; vertical?: boolean }) {
  return vertical
    ? <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={1} fill="#888" stroke="#555" strokeWidth={0.4} />
    : <rect x={x - h / 2} y={y - w / 2} width={h} height={w} rx={1} fill="#888" stroke="#555" strokeWidth={0.4} />;
}

function SvgRoot({ vw, vh, children, title }: { vw: number; vh: number; children: React.ReactNode; title?: string }) {
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width="100%" overflow="visible" style={{ background: '#fff', display: 'block' }}>
      <SvgDefs />
      {title && <text x={vw / 2} y={14} textAnchor="middle" fontSize={10} fontFamily="'DM Sans',sans-serif" fill="#222" fontWeight="900">{title}</text>}
      {children}
    </svg>
  );
}

function RoomBox({ x, y, w, h, label, dims, fill = '#f0f4ff', stroke = '#3b82f6', fs = 8 }: {
  x: number; y: number; w: number; h: number; label: string; dims?: string; fill?: string; stroke?: string; fs?: number;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <text x={x + w / 2} y={y + h / 2 - (dims ? fs * 0.7 : 0)} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontFamily="'DM Sans',sans-serif" fill={stroke} fontWeight="700">{label}</text>
      {dims && <text x={x + w / 2} y={y + h / 2 + fs * 0.9} textAnchor="middle" dominantBaseline="middle" fontSize={fs * 0.8} fontFamily="'JetBrains Mono',monospace" fill={stroke}>{dims}</text>}
    </g>
  );
}

// ─── FloorPlanRoom with wall thickness and optional door swing ────────────────
function FloorPlanRoom({ x, y, w, h, label, dims, fill, stroke, door = false }: {
  x: number; y: number; w: number; h: number; label: string; dims: string; fill: string; stroke: string; door?: boolean;
}) {
  const wall = 8;
  const r = Math.min(w, h) * 0.28; // door swing radius
  return (
    <g>
      {/* thick wall border */}
      <rect x={x} y={y} width={w} height={h} fill={stroke} stroke={stroke} strokeWidth={0} />
      {/* inner fill */}
      <rect x={x + wall} y={y + wall} width={w - wall * 2} height={h - wall * 2} fill={fill} />
      {/* door swing */}
      {door && (
        <g>
          <line x1={x + wall} y1={y + wall} x2={x + wall + r} y2={y + wall} stroke={stroke} strokeWidth={0.8} />
          <path d={`M${x + wall},${y + wall} A${r},${r} 0 0,1 ${x + wall},${y + wall + r}`} fill="none" stroke={stroke} strokeWidth={0.8} strokeDasharray="3 2" />
        </g>
      )}
      {w - wall * 2 > 20 && h - wall * 2 > 14 && (
        <>
          <text x={x + w / 2} y={y + h / 2 - 5} textAnchor="middle" dominantBaseline="middle" fontSize={7} fontFamily="'DM Sans',sans-serif" fill={stroke} fontWeight="700">{label}</text>
          <text x={x + w / 2} y={y + h / 2 + 6} textAnchor="middle" dominantBaseline="middle" fontSize={5.5} fontFamily="'JetBrains Mono',monospace" fill={stroke}>{dims}</text>
        </>
      )}
    </g>
  );
}

// North arrow helper
function NorthArrow({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={13} fill="white" stroke="#333" strokeWidth={1} />
      <text x={0} y={-16} textAnchor="middle" fontSize={10} fontWeight="900" fill="#333">N</text>
      <line x1={0} y1={9} x2={0} y2={-9} stroke="#cc2200" strokeWidth={1.5} />
      <polygon points="0,-9 -3,1 3,1" fill="#cc2200" />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BED — simplified per the user's real site-measurement workflow
// (2026-08-29). See src/products/bed/simpleBedGeometry.ts and
// SimpleBedDrawing.tsx. The detailed CALC_BED panel/patti/platform engine
// (bedFormulas.ts, bedGeometry.ts, BedTechnicalDrawing.tsx) is kept intact
// for a future "fabrication detail" mode but is no longer wired into the
// live Bed product entry.
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// SIDE TABLE — migrated to the real, verified engine (CALC_SIDE_TABLE).
// See src/products/sideTable/{sideTableFormulas,sideTableGeometry}.ts.
// ═══════════════════════════════════════════════════════════════════════════════
const SideTableDrawing: React.FC<{ dims: Record<string, number | string>; activeView: string }> = ({ dims, activeView }) => {
  const inp = {
    W: n(dims.W), D: n(dims.D), H: n(dims.H),
    drawers: n(dims.drawers) || 0,
    includeBackPanel: true,
    includeSkirting: true,
  };
  const drawing = activeView === 'plan' ? resolveSideTablePlan(inp) : activeView === 'side' ? resolveSideTableSide(inp) : resolveSideTableFront(inp);
  const [selected, setSelected] = React.useState<ReturnType<typeof resolveSideTableFront>['components'][number] | null>(null);
  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={`SIDE TABLE ${activeView.toUpperCase()} — ${Math.round(drawing.worldWidth)}×${Math.round(drawing.worldHeight)} mm`}
        components={drawing.components}
        dimensions={drawing.dimensions}
        onSelectComponent={setSelected}
        selectedComponentId={selected?.id ?? null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// OPENABLE WARDROBE
// ═══════════════════════════════════════════════════════════════════════════════
const OpenableWardrobeDrawing: React.FC<{ dims: Record<string, number | string>; activeView: string }> = ({ dims, activeView }) => {
  const W = n(dims.W), H = n(dims.H), D = n(dims.D), verts = n(dims.verticals), shelves = n(dims.shelves), thk = n(dims.thk);
  const skirt = 100;
  const sections = verts + 1;
  const pd = 75;

  if (activeView === 'plan') {
    const sc = Math.min(320 / W, 200 / D);
    const sw = W * sc, sd = D * sc, st = thk * sc, secW = sw / sections;
    const vw = sw + pd * 2 + 110, vh = sd + pd * 2 + 85;
    return (
      <SvgRoot vw={vw} vh={vh} title={`WARDROBE PLAN — ${W}×${D} mm`}>
        <rect x={pd} y={pd} width={sw} height={sd} fill="#f0eee8" stroke="#333" strokeWidth={1.5} />
        {/* back panel thin rect */}
        <rect x={pd + st} y={pd + sd - st * 0.6} width={sw - st * 2} height={st * 0.6} fill="#ccc" stroke="#aaa" strokeWidth={0.6} />
        {/* vertical section lines */}
        {Array.from({ length: verts }).map((_, i) => (
          <line key={i} x1={pd + secW * (i + 1)} y1={pd} x2={pd + secW * (i + 1)} y2={pd + sd} stroke="#666" strokeWidth={1} />
        ))}
        <CabLabel x={pd} y={pd} w={sw} h={sd} text="WARDROBE" sub={`${W}×${D}`} fs={6} />
        <DimH x1={pd} x2={pd + sw} y={pd + sd + 24} label={`${W} mm`} above={false} />
        <DimV x={pd + sw + 30} y1={pd} y2={pd + sd} label={`${D} mm`} />
      </SvgRoot>
    );
  }

  if (activeView === 'internal') {
    const sc = Math.min(320 / W, 250 / H);
    const sw = W * sc, sh = H * sc, st = thk * sc, secW = sw / sections;
    const numShelvesPerSec = Math.max(1, Math.ceil(shelves / sections));
    const shelfGap = (sh - st * 3) / (numShelvesPerSec + 1);
    const hangH = sh * 0.38;
    const vw = sw + pd * 2 + 110, vh = sh + pd * 2 + 85;
    return (
      <SvgRoot vw={vw} vh={vh} title={`WARDROBE INTERNAL — ${W}×${H} mm`}>
        <rect x={pd} y={pd} width={sw} height={sh} fill="#f5f2ee" stroke="#333" strokeWidth={1.5} />
        {/* top shelf board */}
        <rect x={pd + st} y={pd + st} width={sw - st * 2} height={st} fill="#ddd" stroke="#aaa" strokeWidth={0.6} />
        {/* vertical dividers */}
        {Array.from({ length: verts }).map((_, i) => (
          <rect key={i} x={pd + secW * (i + 1) - st / 2} y={pd + st * 2} width={st} height={sh - st * 3} fill="#e0d8cc" stroke="#aaa" strokeWidth={0.6} />
        ))}
        {/* evenly-spaced horizontal shelves */}
        {Array.from({ length: sections }).map((_, si) => {
          const x0 = pd + secW * si + (si === 0 ? st : st / 2);
          const xw = secW - (si === 0 || si === sections - 1 ? st * 1.5 : st);
          return Array.from({ length: numShelvesPerSec }).map((__, j) => (
            <rect key={`${si}-${j}`} x={x0} y={pd + st * 3 + shelfGap * (j + 1)} width={xw} height={st} fill="#ddd" stroke="#aaa" strokeWidth={0.5} />
          ));
        })}
        {/* hanging rail in first section — double line with circle ends */}
        <line x1={pd + st + 2} y1={pd + st * 3 + hangH} x2={pd + secW - st / 2 - 2} y2={pd + st * 3 + hangH} stroke="#777" strokeWidth={2} />
        <line x1={pd + st + 2} y1={pd + st * 3 + hangH + 3} x2={pd + secW - st / 2 - 2} y2={pd + st * 3 + hangH + 3} stroke="#aaa" strokeWidth={0.8} />
        <circle cx={pd + st + 5} cy={pd + st * 3 + hangH + 1} r={3} fill="#888" stroke="#555" strokeWidth={0.5} />
        <circle cx={pd + secW - st / 2 - 5} cy={pd + st * 3 + hangH + 1} r={3} fill="#888" stroke="#555" strokeWidth={0.5} />
        <text x={pd + secW / 2} y={pd + st * 3 + hangH + 14} textAnchor="middle" fontSize={5.5} fontFamily="'DM Sans',sans-serif" fill="#888">HANGING RAIL</text>
        <DimH x1={pd} x2={pd + sw} y={pd + sh + 24} label={`${W} mm`} above={false} />
        <DimV x={pd + sw + 30} y1={pd} y2={pd + sh} label={`${H} mm`} />
      </SvgRoot>
    );
  }

  // front elevation
  const sc = Math.min(320 / W, 250 / H);
  const sw = W * sc, sh = H * sc, st = thk * sc, secW = sw / sections, ss = skirt * sc;
  const vw = sw + pd * 2 + 110, vh = sh + pd * 2 + 85;
  return (
    <SvgRoot vw={vw} vh={vh} title={`WARDROBE FRONT ELEVATION — ${W}×${H} mm`}>
      {/* outer carcass */}
      <rect x={pd} y={pd} width={sw} height={sh - ss} fill="#f0eee8" stroke="#333" strokeWidth={2} />
      {/* skirting */}
      <rect x={pd} y={pd + sh - ss} width={sw} height={ss} fill="#ddd" stroke="#888" strokeWidth={0.8} />
      <CabLabel x={pd} y={pd + sh - ss} w={sw} h={ss} text="SKIRTING" fs={5.5} />
      {/* vertical divisions */}
      {Array.from({ length: verts }).map((_, i) => (
        <line key={i} x1={pd + secW * (i + 1)} y1={pd} x2={pd + secW * (i + 1)} y2={pd + sh - ss} stroke="#555" strokeWidth={1.5} />
      ))}
      {/* 2 hinged doors per section */}
      {Array.from({ length: sections }).map((_, si) => {
        const sectionX = pd + si * secW;
        const doorW = secW / 2;
        const doorH = sh - ss - 4;
        // left door
        const ldx = sectionX + 2;
        // right door
        const rdx = sectionX + doorW + 2;
        return (
          <React.Fragment key={si}>
            {/* left door */}
            <rect x={ldx} y={pd + 2} width={doorW - 4} height={doorH} fill="#eee9e0" stroke="#888" strokeWidth={0.8} rx={1} />
            {/* inset panel */}
            <rect x={ldx + 5} y={pd + 10} width={doorW - 14} height={doorH - 20} fill="#e5e0d8" stroke="#bbb" strokeWidth={0.5} rx={1} />
            {/* handle on inner (right) side of left door */}
            <Handle x={ldx + doorW - 10} y={pd + doorH / 2} vertical={true} h={22} />
            {/* right door */}
            <rect x={rdx} y={pd + 2} width={doorW - 4} height={doorH} fill="#e8e3db" stroke="#888" strokeWidth={0.8} rx={1} />
            <rect x={rdx + 5} y={pd + 10} width={doorW - 14} height={doorH - 20} fill="#dedad2" stroke="#bbb" strokeWidth={0.5} rx={1} />
            {/* handle on inner (left) side of right door */}
            <Handle x={rdx + 8} y={pd + doorH / 2} vertical={true} h={22} />
          </React.Fragment>
        );
      })}
      <DimH x1={pd} x2={pd + sw} y={pd + sh + 24} label={`${W} mm`} above={false} />
      <DimV x={pd + sw + 30} y1={pd} y2={pd + sh} label={`${H} mm`} />
      {/* section width dim bottom-2 in blue */}
      {Array.from({ length: sections }).map((_, i) => (
        <DimH key={i} x1={pd + secW * i} x2={pd + secW * (i + 1)} y={pd + sh + 48} label={`${Math.round(W / sections)}`} above={false} col="#0055bb" fs={7} />
      ))}
    </SvgRoot>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDING WARDROBE
// ═══════════════════════════════════════════════════════════════════════════════
const SlidingWardrobeDrawing: React.FC<{ dims: Record<string, number | string>; activeView: string }> = ({ dims, activeView }) => {
  const W = n(dims.W), H = n(dims.H), D = n(dims.D), shutters = n(dims.shutters), verts = n(dims.verticals);
  const skirt = 100;
  const pd = 75;
  const sections = verts + 1;
  const thk = n(dims.thk || 18);

  if (activeView === 'plan') {
    const sc = Math.min(320 / W, 200 / D);
    const sw = W * sc, sd = D * sc, trackD = 10;
    const vw = sw + pd * 2 + 110, vh = sd + pd * 2 + 85;
    return (
      <SvgRoot vw={vw} vh={vh} title={`SLIDING WARDROBE PLAN — ${W}×${D} mm`}>
        <rect x={pd} y={pd} width={sw} height={sd} fill="#f0eee8" stroke="#333" strokeWidth={1.5} />
        {/* front track strip */}
        <rect x={pd} y={pd} width={sw} height={trackD} fill="#bbb" stroke="#888" strokeWidth={0.5} />
        {/* near-back track strip */}
        <rect x={pd} y={pd + sd - trackD} width={sw} height={trackD} fill="#bbb" stroke="#888" strokeWidth={0.5} />
        <text x={pd + sw / 2} y={pd + trackD / 2} textAnchor="middle" dominantBaseline="middle" fontSize={5} fontFamily="'DM Sans',sans-serif" fill="#555">TRACK</text>
        <text x={pd + sw / 2} y={pd + sd - trackD / 2} textAnchor="middle" dominantBaseline="middle" fontSize={5} fontFamily="'DM Sans',sans-serif" fill="#555">TRACK</text>
        {/* vertical section lines */}
        {Array.from({ length: verts }).map((_, i) => (
          <line key={i} x1={pd + (sw / sections) * (i + 1)} y1={pd + trackD} x2={pd + (sw / sections) * (i + 1)} y2={pd + sd - trackD} stroke="#777" strokeWidth={0.8} />
        ))}
        <DimH x1={pd} x2={pd + sw} y={pd + sd + 24} label={`${W} mm`} above={false} />
        <DimV x={pd + sw + 30} y1={pd} y2={pd + sd} label={`${D} mm`} />
      </SvgRoot>
    );
  }

  if (activeView === 'internal') {
    // same as openable wardrobe internal
    const sc = Math.min(320 / W, 250 / H);
    const sw = W * sc, sh = H * sc, st = thk * sc, secW = sw / sections;
    const numShelvesPerSec = Math.max(1, Math.ceil(n(dims.shelves) / sections));
    const shelfGap = (sh - st * 3) / (numShelvesPerSec + 1);
    const hangH = sh * 0.38;
    const vw = sw + pd * 2 + 110, vh = sh + pd * 2 + 85;
    return (
      <SvgRoot vw={vw} vh={vh} title={`SLIDING WARDROBE INTERNAL — ${W}×${H} mm`}>
        <rect x={pd} y={pd} width={sw} height={sh} fill="#f5f2ee" stroke="#333" strokeWidth={1.5} />
        <rect x={pd + st} y={pd + st} width={sw - st * 2} height={st} fill="#ddd" stroke="#aaa" strokeWidth={0.5} />
        {Array.from({ length: verts }).map((_, i) => (
          <rect key={i} x={pd + secW * (i + 1) - st / 2} y={pd + st * 2} width={st} height={sh - st * 3} fill="#e0d8cc" stroke="#aaa" strokeWidth={0.6} />
        ))}
        {Array.from({ length: sections }).map((_, si) => {
          const x0 = pd + secW * si + (si === 0 ? st : st / 2);
          const xw = secW - (si === 0 || si === sections - 1 ? st * 1.5 : st);
          return Array.from({ length: numShelvesPerSec }).map((__, j) => (
            <rect key={`${si}-${j}`} x={x0} y={pd + st * 3 + shelfGap * (j + 1)} width={xw} height={st} fill="#ddd" stroke="#aaa" strokeWidth={0.5} />
          ));
        })}
        {/* hanging rail in first section */}
        <line x1={pd + st + 2} y1={pd + st * 3 + hangH} x2={pd + secW - st / 2 - 2} y2={pd + st * 3 + hangH} stroke="#777" strokeWidth={2} />
        <line x1={pd + st + 2} y1={pd + st * 3 + hangH + 3} x2={pd + secW - st / 2 - 2} y2={pd + st * 3 + hangH + 3} stroke="#aaa" strokeWidth={0.8} />
        <circle cx={pd + st + 5} cy={pd + st * 3 + hangH + 1} r={3} fill="#888" stroke="#555" strokeWidth={0.5} />
        <circle cx={pd + secW - st / 2 - 5} cy={pd + st * 3 + hangH + 1} r={3} fill="#888" stroke="#555" strokeWidth={0.5} />
        <text x={pd + secW / 2} y={pd + st * 3 + hangH + 14} textAnchor="middle" fontSize={5.5} fontFamily="'DM Sans',sans-serif" fill="#888">HANGING RAIL</text>
        <DimH x1={pd} x2={pd + sw} y={pd + sh + 24} label={`${W} mm`} above={false} />
        <DimV x={pd + sw + 30} y1={pd} y2={pd + sh} label={`${H} mm`} />
      </SvgRoot>
    );
  }

  // front elevation
  const sc = Math.min(320 / W, 250 / H);
  const sw = W * sc, sh = H * sc, ss = skirt * sc;
  const shutW = sw / shutters;
  const trackH = 10;
  const patti = 40 * (sw / W); // 40px border patti scaled
  const vw = sw + pd * 2 + 110, vh = sh + pd * 2 + 85;
  return (
    <SvgRoot vw={vw} vh={vh} title={`SLIDING WARDROBE FRONT — ${W}×${H} mm`}>
      {/* aluminum track top */}
      <rect x={pd} y={pd} width={sw} height={trackH} fill="#bbb" stroke="#888" strokeWidth={0.8} />
      <text x={pd + sw / 2} y={pd + trackH / 2} textAnchor="middle" dominantBaseline="middle" fontSize={5} fontFamily="'DM Sans',sans-serif" fill="#555">TRACK</text>
      {/* bottom track */}
      <rect x={pd} y={pd + sh - ss - trackH} width={sw} height={trackH} fill="#bbb" stroke="#888" strokeWidth={0.8} />
      {/* kickboard */}
      <rect x={pd} y={pd + sh - ss} width={sw} height={ss} fill="#ddd" stroke="#888" strokeWidth={0.8} />
      <CabLabel x={pd} y={pd + sh - ss} w={sw} h={ss} text="SKIRTING" fs={5} />
      {/* sliding doors with 40px border patti, slight overlap alternating */}
      {Array.from({ length: shutters }).map((_, i) => {
        const overlap = i % 2 === 0 ? 0 : 5;
        const dx = pd + shutW * i + overlap;
        const dw = shutW - 2;
        const dh = sh - ss - trackH * 2 - 4;
        const dy = pd + trackH + 2;
        return (
          <g key={i}>
            <rect x={dx} y={dy} width={dw} height={dh} fill={i % 2 === 0 ? '#f0ede6' : '#e8e4dc'} stroke="#888" strokeWidth={0.8} rx={1} />
            {/* border patti left */}
            <rect x={dx} y={dy} width={patti} height={dh} fill="#c8c0b0" stroke="#aaa" strokeWidth={0.5} />
            {/* border patti right */}
            <rect x={dx + dw - patti} y={dy} width={patti} height={dh} fill="#c8c0b0" stroke="#aaa" strokeWidth={0.5} />
            {/* handle in middle */}
            <Handle x={dx + dw / 2} y={dy + dh / 2} vertical={true} h={30} />
          </g>
        );
      })}
      <DimH x1={pd} x2={pd + sw} y={pd + sh + 24} label={`${W} mm`} above={false} />
      <DimV x={pd + sw + 30} y1={pd} y2={pd + sh} label={`${H} mm`} />
      {/* door width in blue bottom-2 */}
      {Array.from({ length: shutters }).map((_, i) => (
        <DimH key={i} x1={pd + shutW * i} x2={pd + shutW * (i + 1)} y={pd + sh + 48} label={`${Math.round(W / shutters)}`} above={false} col="#0055bb" fs={7} />
      ))}
    </SvgRoot>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TV UNIT
// ═══════════════════════════════════════════════════════════════════════════════
const TvUnitDrawing: React.FC<{ dims: Record<string, number | string>; activeView: string }> = ({ dims, activeView }) => {
  const W = n(dims.W), H = n(dims.H), D = n(dims.D), tvW = n(dims.tvW), tvH = n(dims.tvH);
  const baseCabs = n(dims.baseCabs), wallCabs = n(dims.wallCabs);
  const pd = 75;

  if (activeView === 'plan') {
    const sc = Math.min(300 / W, 180 / D);
    const sw = W * sc, sd = D * sc;
    const baseCabW = sw / baseCabs;
    const vw = sw + pd * 2 + 110, vh = sd + pd * 2 + 85;
    return (
      <SvgRoot vw={vw} vh={vh} title={`TV UNIT PLAN — ${W}×${D} mm`}>
        <rect x={pd} y={pd} width={sw} height={sd} fill="#e8eef8" stroke="#445" strokeWidth={1.5} />
        {Array.from({ length: baseCabs - 1 }).map((_, i) => (
          <line key={i} x1={pd + baseCabW * (i + 1)} y1={pd} x2={pd + baseCabW * (i + 1)} y2={pd + sd} stroke="#889" strokeWidth={0.8} />
        ))}
        <CabLabel x={pd} y={pd} w={sw} h={sd} text="BASE CABINETS" sub={`${W}×${D}`} fs={6} />
        <DimH x1={pd} x2={pd + sw} y={pd + sd + 24} label={`${W} mm`} above={false} />
        <DimV x={pd + sw + 30} y1={pd} y2={pd + sd} label={`${D} mm`} />
      </SvgRoot>
    );
  }

  // front elevation
  const sc = Math.min(320 / W, 220 / H);
  const sw = W * sc, sh = H * sc;
  const baseH = Math.min(500 * sc, sh * 0.28);
  const wallCabH = Math.min(380 * sc, sh * 0.2);
  const tvPanelH = sh - wallCabH - baseH;
  const tvSw = Math.min(tvW * sc, sw * 0.7), tvSh = Math.min(tvH * sc, tvPanelH * 0.85);
  const wallCabW = sw / wallCabs, baseCabW = sw / baseCabs;
  const tvX = pd + (sw - tvSw) / 2;
  const tvY = pd + wallCabH + (tvPanelH - tvSh) / 2;
  const vw = sw + pd * 2 + 110, vh = sh + pd * 2 + 85;
  return (
    <SvgRoot vw={vw} vh={vh} title={`TV UNIT FRONT ELEVATION — ${W}×${H} mm`}>
      {/* dark TV zone panel */}
      <rect x={pd} y={pd + wallCabH} width={sw} height={tvPanelH} fill="#0f172a" stroke="#222" strokeWidth={1} />
      {/* wall cabinets at top — shaker style with center line */}
      {Array.from({ length: wallCabs }).map((_, i) => (
        <g key={i}>
          <rect x={pd + wallCabW * i + 2} y={pd + 2} width={wallCabW - 4} height={wallCabH - 2} fill="#e8eef8" stroke="#5070a0" strokeWidth={0.8} rx={1} />
          {/* shaker center line */}
          <line x1={pd + wallCabW * i + wallCabW / 2} y1={pd + 4} x2={pd + wallCabW * i + wallCabW / 2} y2={pd + wallCabH - 4} stroke="#8090b0" strokeWidth={0.5} strokeDasharray="2 2" />
          <Handle x={pd + wallCabW * i + wallCabW / 2} y={pd + wallCabH - 10} vertical={false} h={wallCabW * 0.4} w={3} />
          <CabLabel x={pd + wallCabW * i + 2} y={pd + 2} w={wallCabW - 4} h={wallCabH - 2} text={`WC-0${i + 1}`} fs={6} />
        </g>
      ))}
      {/* TV screen centered in panel */}
      <rect x={tvX} y={tvY} width={tvSw} height={tvSh} fill="#1a1a2e" stroke="#444" strokeWidth={1} rx={4} />
      {/* inner screen lighter rect */}
      <rect x={tvX + 6} y={tvY + 5} width={tvSw - 12} height={tvSh - 10} fill="#0d1117" stroke="none" rx={2} />
      {/* TV size annotation in blue inside panel */}
      <text x={tvX + tvSw / 2} y={tvY + tvSh / 2} textAnchor="middle" dominantBaseline="middle" fontSize={8} fontFamily="'DM Sans',sans-serif" fill="#3b82f6" fontWeight="700">TV {tvW}×{tvH}</text>
      {/* base cabinets at bottom divided with handles */}
      {Array.from({ length: baseCabs }).map((_, i) => (
        <g key={i}>
          <rect x={pd + baseCabW * i + 2} y={pd + sh - baseH} width={baseCabW - 4} height={baseH - 2} fill="#e8eef8" stroke="#5070a0" strokeWidth={0.8} rx={1} />
          {/* center divider shaker line */}
          <line x1={pd + baseCabW * i + baseCabW / 2} y1={pd + sh - baseH + 4} x2={pd + baseCabW * i + baseCabW / 2} y2={pd + sh - 4} stroke="#8090b0" strokeWidth={0.5} strokeDasharray="2 2" />
          <Handle x={pd + baseCabW * i + baseCabW / 2} y={pd + sh - baseH + 12} vertical={false} h={baseCabW * 0.4} w={3} />
          <CabLabel x={pd + baseCabW * i + 2} y={pd + sh - baseH} w={baseCabW - 4} h={baseH - 2} text={`B-0${i + 1}`} sub={`${Math.round(W / baseCabs)}×500`} fs={6} />
        </g>
      ))}
      <DimH x1={pd} x2={pd + sw} y={pd + sh + 24} label={`${W} mm`} above={false} />
      <DimV x={pd + sw + 30} y1={pd} y2={pd + sh} label={`${H} mm`} />
      {/* TV size annotation outside in blue */}
      <DimH x1={tvX} x2={tvX + tvSw} y={tvY - 12} label={`TV ${tvW} mm`} col="#0055bb" />
    </SvgRoot>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOFT — migrated to the real, verified BOX engine (CALC_BOX — the same
// shared family as Cabinet/Storage/Open/Service Box). See
// src/products/loft/{boxFormulas,boxGeometry,BoxTechnicalDrawing}.tsx.
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// DINING TABLE
// ═══════════════════════════════════════════════════════════════════════════════
const DiningTableDrawing: React.FC<{ dims: Record<string, number | string>; activeView: string }> = ({ dims, activeView }) => {
  const L = n(dims.L), W = n(dims.W), H = n(dims.H), topThick = n(dims.topThick), seats = n(dims.seats);
  const pd = 75;

  if (activeView === 'front') {
    const sc = Math.min(300 / L, 200 / H);
    const sl = L * sc, sh = H * sc, st = topThick * sc;
    const legH = (H - topThick) * sc;
    const legW = 55 * sc;
    const apronH = 75 * sc;
    const apronY = pd + st;
    // apron spans 75% of leg span
    const legSpan = sl - legW * 2;
    const apronX = pd + legW + legSpan * 0.125;
    const apronW = legSpan * 0.75;
    const vw = sl + pd * 2 + 110, vh = sh + pd * 2 + 85;
    return (
      <SvgRoot vw={vw} vh={vh} title={`DINING TABLE FRONT — ${L}×${H} mm`}>
        {/* table top wood fill */}
        <rect x={pd} y={pd} width={sl} height={st} fill="url(#wood)" stroke="#555" strokeWidth={1.5} />
        {/* apron beam */}
        <rect x={apronX} y={apronY} width={apronW} height={apronH} fill="#b8895a" stroke="#8b6030" strokeWidth={0.8} />
        {/* 2 paired legs at each end */}
        <rect x={pd + 4} y={pd + st} width={legW} height={legH} fill="#c09050" stroke="#8b6030" strokeWidth={1} />
        <rect x={pd + legW + 4} y={pd + st} width={legW} height={legH} fill="#b8895a" stroke="#8b6030" strokeWidth={1} />
        <rect x={pd + sl - legW * 2 - 4} y={pd + st} width={legW} height={legH} fill="#b8895a" stroke="#8b6030" strokeWidth={1} />
        <rect x={pd + sl - legW - 4} y={pd + st} width={legW} height={legH} fill="#c09050" stroke="#8b6030" strokeWidth={1} />
        <DimH x1={pd} x2={pd + sl} y={pd + sh + 24} label={`${L} mm`} above={false} />
        <DimV x={pd + sl + 30} y1={pd} y2={pd + sh} label={`${H} mm`} />
        <DimV x={pd - 26} y1={pd} y2={pd + st} label={`${topThick}`} right={false} col="#0055bb" />
      </SvgRoot>
    );
  }

  if (activeView === 'side') {
    const sc = Math.min(220 / W, 200 / H);
    const sw = W * sc, sh = H * sc, st = topThick * sc;
    const legH = (H - topThick) * sc;
    const legW = 55 * sc;
    const apronH = 75 * sc;
    const vw = sw + pd * 2 + 110, vh = sh + pd * 2 + 85;
    return (
      <SvgRoot vw={vw} vh={vh} title={`DINING TABLE SIDE — ${W}×${H} mm`}>
        {/* table top */}
        <rect x={pd} y={pd} width={sw} height={st} fill="url(#wood)" stroke="#555" strokeWidth={1.5} />
        {/* apron */}
        <rect x={pd + legW * 0.5} y={pd + st} width={sw - legW} height={apronH} fill="#b8895a" stroke="#8b6030" strokeWidth={0.8} />
        {/* 2 legs side by side */}
        <rect x={pd + 4} y={pd + st} width={legW} height={legH} fill="#c09050" stroke="#8b6030" strokeWidth={1} />
        <rect x={pd + sw - legW - 4} y={pd + st} width={legW} height={legH} fill="#c09050" stroke="#8b6030" strokeWidth={1} />
        <DimH x1={pd} x2={pd + sw} y={pd + sh + 24} label={`${W} mm`} above={false} />
        <DimV x={pd + sw + 30} y1={pd} y2={pd + sh} label={`${H} mm`} />
      </SvgRoot>
    );
  }

  // plan with chairs around all 4 sides
  const sc = Math.min(270 / L, 200 / W);
  const sl = L * sc, sw = W * sc;
  const chairD = 24, chairW = Math.min(48, sl / Math.ceil(seats / 2) * 0.7);
  const sidesCount = Math.floor(seats / 2);
  const endsCount = seats % 2;
  const ox = pd + chairD + 6, oy = pd + chairD + 6;
  const gapL = (sl - chairW * sidesCount) / (sidesCount + 1);
  const vw = sl + (pd + chairD + 6) * 2 + 110, vh = sw + (pd + chairD + 6) * 2 + 85;
  return (
    <SvgRoot vw={vw} vh={vh} title={`DINING TABLE PLAN — ${seats}-SEATER, ${L}×${W} mm`}>
      {/* table top wood fill */}
      <rect x={ox} y={oy} width={sl} height={sw} fill="url(#wood)" stroke="#555" strokeWidth={1.5} />
      {/* seating count label in center */}
      <text x={ox + sl / 2} y={oy + sw / 2} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontFamily="'DM Sans',sans-serif" fill="#555" fontWeight="700">{seats}-SEATER</text>
      {/* chairs along long sides */}
      {Array.from({ length: sidesCount }).map((_, i) => {
        const cx = ox + gapL * (i + 1) + chairW * i;
        return (
          <React.Fragment key={i}>
            <rect x={cx} y={oy - chairD - 4} width={chairW} height={chairD} fill="#f0e8d0" stroke="#888" strokeWidth={0.8} rx={3} />
            <rect x={cx} y={oy + sw + 4} width={chairW} height={chairD} fill="#f0e8d0" stroke="#888" strokeWidth={0.8} rx={3} />
          </React.Fragment>
        );
      })}
      {/* chairs at ends */}
      {endsCount > 0 && <>
        <rect x={ox - chairD - 4} y={oy + (sw - chairW) / 2} width={chairD} height={chairW} fill="#f0e8d0" stroke="#888" strokeWidth={0.8} rx={3} />
        <rect x={ox + sl + 4} y={oy + (sw - chairW) / 2} width={chairD} height={chairW} fill="#f0e8d0" stroke="#888" strokeWidth={0.8} rx={3} />
      </>}
      <DimH x1={ox} x2={ox + sl} y={oy + sw + chairD + 24} label={`${L} mm`} above={false} />
      <DimV x={ox + sl + chairD + 30} y1={oy} y2={oy + sw} label={`${W} mm`} />
    </SvgRoot>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// BEDROOM
// ═══════════════════════════════════════════════════════════════════════════════
const BedroomDrawing: React.FC<{ dims: Record<string, number | string>; activeView: string }> = ({ dims, activeView }) => {
  const roomL = n(dims.roomL), roomW = n(dims.roomW);
  const bedW = n(dims.bedW), bedL = n(dims.bedL);
  const wardW = n(dims.wardW), tvW = n(dims.tvW);
  const hasBed = n(dims.hasBed), hasWard = n(dims.hasWardrobe), hasTV = n(dims.hasTVUnit);
  const pd = 75;
  const wardH = 2090;

  if (activeView === 'wall-a') {
    // wardrobe front elevation — same as openable wardrobe front
    const sc = Math.min(320 / wardW, 250 / wardH);
    const sw = wardW * sc, sh = wardH * sc;
    const sections = 2;
    const secW = sw / sections;
    const st = 18 * sc;
    const ss = 100 * sc;
    const vw = sw + pd * 2 + 110, vh = sh + pd * 2 + 85;
    const doorW = secW / 2;
    return (
      <SvgRoot vw={vw} vh={vh} title={`BEDROOM WALL A — WARDROBE ${wardW}×${wardH} mm`}>
        {/* outer carcass */}
        <rect x={pd} y={pd} width={sw} height={sh - ss} fill="#f0eee8" stroke="#333" strokeWidth={2} />
        {/* skirting */}
        <rect x={pd} y={pd + sh - ss} width={sw} height={ss} fill="#ddd" stroke="#888" strokeWidth={0.8} />
        <CabLabel x={pd} y={pd + sh - ss} w={sw} h={ss} text="SKIRTING" fs={5.5} />
        {/* vertical center division */}
        <line x1={pd + secW} y1={pd} x2={pd + secW} y2={pd + sh - ss} stroke="#555" strokeWidth={1.5} />
        {/* 2 hinged doors per section */}
        {Array.from({ length: sections }).map((_, si) => {
          const sectionX = pd + si * secW;
          const dh = sh - ss - 4;
          return (
            <React.Fragment key={si}>
              {/* left door */}
              <rect x={sectionX + 2} y={pd + 2} width={doorW - 4} height={dh} fill="#eee9e0" stroke="#888" strokeWidth={0.8} rx={1} />
              <rect x={sectionX + 7} y={pd + 10} width={doorW - 14} height={dh - 20} fill="#e5e0d8" stroke="#bbb" strokeWidth={0.5} rx={1} />
              <Handle x={sectionX + doorW - 10} y={pd + dh / 2} vertical={true} h={22} />
              {/* right door */}
              <rect x={sectionX + doorW + 2} y={pd + 2} width={doorW - 4} height={dh} fill="#e8e3db" stroke="#888" strokeWidth={0.8} rx={1} />
              <rect x={sectionX + doorW + 7} y={pd + 10} width={doorW - 14} height={dh - 20} fill="#dedad2" stroke="#bbb" strokeWidth={0.5} rx={1} />
              <Handle x={sectionX + doorW + 10} y={pd + dh / 2} vertical={true} h={22} />
            </React.Fragment>
          );
        })}
        <DimH x1={pd} x2={pd + sw} y={pd + sh + 24} label={`${wardW} mm`} above={false} />
        <DimV x={pd + sw + 30} y1={pd} y2={pd + sh} label={`${wardH} mm`} />
        {/* section widths in blue */}
        {Array.from({ length: sections }).map((_, i) => (
          <DimH key={i} x1={pd + secW * i} x2={pd + secW * (i + 1)} y={pd + sh + 48} label={`${Math.round(wardW / sections)}`} above={false} col="#0055bb" fs={7} />
        ))}
      </SvgRoot>
    );
  }

  // room plan view
  const sc = Math.min(320 / roomL, 260 / roomW);
  const sl = roomL * sc, sw = roomW * sc;
  const wall = 8;
  const vw = sl + pd * 2 + 110, vh = sw + pd * 2 + 85;

  const bedSl = Math.min(bedL * sc, sl * 0.55), bedSw = Math.min(bedW * sc, sw * 0.5);
  const bedHbH = bedSw * 0.12;
  const wardSl = Math.min(wardW * sc, sl * 0.55);
  const tvSl = Math.min(tvW * sc, sl * 0.5);

  // bed centered, headboard at top wall
  const bedX = pd + wall + (sl - wall * 2 - bedSl) / 2;
  const wardDepth = sw * 0.1;
  const tvDepth = sw * 0.08;
  const bedY = pd + wall + wardDepth + 10;

  return (
    <SvgRoot vw={vw} vh={vh} title={`BEDROOM PLAN — ${roomL}×${roomW} mm`}>
      {/* room walls — thick border */}
      <rect x={pd} y={pd} width={sl} height={sw} fill="#333" />
      <rect x={pd + wall} y={pd + wall} width={sl - wall * 2} height={sw - wall * 2} fill="#f8f8f5" />

      {/* wardrobe along top wall */}
      {hasWard ? (
        <g>
          <rect x={pd + wall} y={pd + wall} width={wardSl} height={wardDepth} fill="#ffe0b2" stroke="#e65100" strokeWidth={1} />
          <text x={pd + wall + wardSl / 2} y={pd + wall + wardDepth / 2} textAnchor="middle" dominantBaseline="middle" fontSize={5.5} fontFamily="'DM Sans',sans-serif" fill="#e65100" fontWeight="700">WARDROBE {wardW}</text>
        </g>
      ) : null}

      {/* TV unit along bottom wall */}
      {hasTV ? (
        <g>
          <rect x={pd + wall + (sl - wall * 2 - tvSl) / 2} y={pd + sw - wall - tvDepth} width={tvSl} height={tvDepth} fill="#222" stroke="#555" strokeWidth={1} />
          <text x={pd + wall + (sl - wall * 2) / 2} y={pd + sw - wall - tvDepth / 2} textAnchor="middle" dominantBaseline="middle" fontSize={5.5} fontFamily="'DM Sans',sans-serif" fill="#aaa" fontWeight="700">TV UNIT {tvW}</text>
        </g>
      ) : null}

      {/* bed centered with headboard at top */}
      {hasBed ? (
        <g>
          {/* headboard strip */}
          <rect x={bedX} y={bedY} width={bedSl} height={bedHbH} fill="#c8a87a" stroke="#3b82f6" strokeWidth={1} rx={2} />
          {/* mattress */}
          <rect x={bedX} y={bedY + bedHbH} width={bedSl} height={bedSw - bedHbH} fill="#d4e8ff" stroke="#3b82f6" strokeWidth={1.5} rx={3} />
          {/* pillow indicators */}
          {[0.18, 0.55].map((px, i) => (
            <rect key={i} x={bedX + bedSl * px} y={bedY + bedHbH + 4} width={bedSl * 0.25} height={Math.min(bedSw * 0.14, 18)} fill="#fff" stroke="#aaa" strokeWidth={0.6} rx={2} />
          ))}
          <text x={bedX + bedSl / 2} y={bedY + bedHbH + bedSw * 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={6.5} fontFamily="'DM Sans',sans-serif" fill="#3b82f6" fontWeight="700">BED {bedW}×{bedL}</text>
        </g>
      ) : null}

      {/* side tables flanking bed */}
      {hasBed ? (
        <g>
          <rect x={bedX - sl * 0.09} y={bedY + bedHbH} width={sl * 0.07} height={sl * 0.07} fill="#fff3d0" stroke="#f59e0b" strokeWidth={0.8} rx={1} />
          <text x={bedX - sl * 0.055} y={bedY + bedHbH + sl * 0.035} textAnchor="middle" dominantBaseline="middle" fontSize={4.5} fontFamily="'DM Sans',sans-serif" fill="#f59e0b">ST</text>
          <rect x={bedX + bedSl + sl * 0.02} y={bedY + bedHbH} width={sl * 0.07} height={sl * 0.07} fill="#fff3d0" stroke="#f59e0b" strokeWidth={0.8} rx={1} />
          <text x={bedX + bedSl + sl * 0.055} y={bedY + bedHbH + sl * 0.035} textAnchor="middle" dominantBaseline="middle" fontSize={4.5} fontFamily="'DM Sans',sans-serif" fill="#f59e0b">ST</text>
        </g>
      ) : null}

      {/* door swing arc at bottom-left corner */}
      <g>
        <line x1={pd + wall} y1={pd + sw - wall} x2={pd + wall + sw * 0.15} y2={pd + sw - wall} stroke="#555" strokeWidth={0.8} />
        <path d={`M${pd + wall + sw * 0.15},${pd + sw - wall} A${sw * 0.15},${sw * 0.15} 0 0,0 ${pd + wall},${pd + sw - wall - sw * 0.15}`} fill="none" stroke="#555" strokeWidth={0.8} strokeDasharray="3 2" />
      </g>

      {/* north arrow */}
      <NorthArrow x={pd + sl - 22} y={pd + 22} />

      <DimH x1={pd} x2={pd + sl} y={pd + sw + 24} label={`${roomL} mm`} above={false} />
      <DimV x={pd + sl + 30} y1={pd} y2={pd + sw} label={`${roomW} mm`} />
    </SvgRoot>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1 BHK
// ═══════════════════════════════════════════════════════════════════════════════
const OneBHKDrawing: React.FC<{ dims: Record<string, number | string>; activeView: string }> = ({ dims, activeView }) => {
  const lL = n(dims.livingL), lW = n(dims.livingW), kL = n(dims.kitchenL), kW = n(dims.kitchenW);
  const bL = n(dims.bedL), bW = n(dims.bedW), btL = n(dims.bathL), btW = n(dims.bathW);
  const pd = 75;

  if (activeView === 'kitchen-plan') {
    const sc = Math.min(280 / kL, 220 / kW);
    const skl = kL * sc, skw = kW * sc;
    const counterD = skw * 0.18;
    const vw = skl + pd * 2 + 110, vh = skw + pd * 2 + 85;
    return (
      <SvgRoot vw={vw} vh={vh} title={`KITCHEN PLAN — ${kL}×${kW} mm`}>
        {/* room walls */}
        <rect x={pd} y={pd} width={skl} height={skw} fill="#333" />
        <rect x={pd + 8} y={pd + 8} width={skl - 16} height={skw - 16} fill="#fffbf0" />
        {/* L-shaped counter: along top wall */}
        <rect x={pd + 8} y={pd + 8} width={skl - 16} height={counterD} fill="#ffd0a0" stroke="#c06000" strokeWidth={0.8} />
        {/* along left wall */}
        <rect x={pd + 8} y={pd + 8 + counterD} width={counterD} height={skw - 16 - counterD} fill="#ffd0a0" stroke="#c06000" strokeWidth={0.8} />
        {/* sink indication on top counter */}
        <rect x={pd + 8 + (skl - 16) * 0.6} y={pd + 8 + counterD * 0.15} width={(skl - 16) * 0.2} height={counterD * 0.7} fill="#88ccff" stroke="#0066aa" strokeWidth={0.6} rx={2} />
        <text x={pd + 8 + (skl - 16) * 0.7} y={pd + 8 + counterD * 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={4.5} fontFamily="'DM Sans',sans-serif" fill="#0066aa">SINK</text>
        <text x={pd + 8 + (skl - 16) * 0.5} y={pd + 8 + counterD / 2} textAnchor="middle" dominantBaseline="middle" fontSize={5} fontFamily="'DM Sans',sans-serif" fill="#c06000">PLATFORM</text>
        <text x={pd + 8 + counterD / 2} y={pd + 8 + counterD + (skw - 16 - counterD) / 2} textAnchor="middle" dominantBaseline="middle" fontSize={5} fontFamily="'DM Sans',sans-serif" fill="#c06000" transform={`rotate(-90,${pd + 8 + counterD / 2},${pd + 8 + counterD + (skw - 16 - counterD) / 2})`}>PLATFORM</text>
        <text x={pd + 8 + counterD + (skl - 16 - counterD) / 2} y={pd + 8 + counterD + (skw - 16 - counterD) / 2} textAnchor="middle" dominantBaseline="middle" fontSize={8} fontFamily="'DM Sans',sans-serif" fill="#555" fontWeight="700">KITCHEN</text>
        <DimH x1={pd} x2={pd + skl} y={pd + skw + 24} label={`${kL} mm`} above={false} />
        <DimV x={pd + skl + 30} y1={pd} y2={pd + skw} label={`${kW} mm`} />
      </SvgRoot>
    );
  }

  // floor plan
  const sc = Math.min(280 / (lL + Math.max(kL, bL + btL)), 220 / Math.max(lW, kW + bW));
  const slL = lL * sc, slW = lW * sc;
  const skL = kL * sc, skW = kW * sc;
  const sbL = bL * sc, sbW = bW * sc;
  const sbtL = btL * sc, sbtW = btW * sc;
  const totalW = slL + Math.max(skL, sbL + sbtL);
  const totalH = Math.max(slW, skW + sbW);
  const vw = totalW + pd * 2 + 110, vh = totalH + pd * 2 + 85;
  return (
    <SvgRoot vw={vw} vh={vh} title={`1 BHK FLOOR PLAN — ${lL + kL}×${Math.max(lW, bW)} mm`}>
      <FloorPlanRoom x={pd} y={pd} w={slL} h={slW} label="LIVING / DINING" dims={`${lL}×${lW}`} fill="#f0f4ff" stroke="#3b82f6" door={true} />
      <FloorPlanRoom x={pd + slL} y={pd} w={skL} h={skW} label="KITCHEN" dims={`${kL}×${kW}`} fill="#fff8e1" stroke="#f57c00" door={true} />
      <FloorPlanRoom x={pd + slL} y={pd + skW} w={sbL} h={sbW} label="BEDROOM" dims={`${bL}×${bW}`} fill="#e8f5e9" stroke="#388e3c" door={true} />
      <FloorPlanRoom x={pd + slL + sbL} y={pd + skW} w={sbtL} h={sbtW} label="BATH" dims={`${btL}×${btW}`} fill="#e3f2fd" stroke="#1976d2" door={true} />
      <NorthArrow x={pd + 22} y={pd + 22} />
    </SvgRoot>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2 BHK
// ═══════════════════════════════════════════════════════════════════════════════
const TwoBHKDrawing: React.FC<{ dims: Record<string, number | string>; activeView: string }> = ({ dims, activeView }) => {
  const lL = n(dims.livingL), lW = n(dims.livingW), kL = n(dims.kitchenL), kW = n(dims.kitchenW);
  const b1L = n(dims.bed1L), b1W = n(dims.bed1W), b2L = n(dims.bed2L), b2W = n(dims.bed2W);
  const bt1L = n(dims.bath1L), bt1W = n(dims.bath1W);
  const pd = 75;

  if (activeView === 'bedroom-plans') {
    const sc = Math.min(290 / (b1L + b2L + 20), 230 / Math.max(b1W, b2W));
    const sb1L = b1L * sc, sb1W = b1W * sc, sb2L = b2L * sc, sb2W = b2W * sc;
    const wall = 8;
    const vw = sb1L + sb2L + pd * 3 + 110, vh = Math.max(sb1W, sb2W) + pd * 2 + 85;
    // beds in each bedroom
    const bedW1 = Math.min(1800 * sc, sb1L * 0.45), bedL1 = Math.min(2000 * sc, sb1W * 0.5);
    const bedW2 = Math.min(1600 * sc, sb2L * 0.45), bedL2 = Math.min(2000 * sc, sb2W * 0.5);
    return (
      <SvgRoot vw={vw} vh={vh} title="2 BHK — BEDROOM PLANS">
        {/* bedroom 1 */}
        <rect x={pd} y={pd} width={sb1L} height={sb1W} fill="#333" />
        <rect x={pd + wall} y={pd + wall} width={sb1L - wall * 2} height={sb1W - wall * 2} fill="#e8f5e9" />
        <rect x={pd + wall + (sb1L - wall * 2 - bedW1) / 2} y={pd + wall + 4} width={bedW1} height={bedL1} fill="#d4e8ff" stroke="#3b82f6" strokeWidth={1} rx={2} />
        <rect x={pd + wall + (sb1L - wall * 2 - bedW1) / 2} y={pd + wall + 4} width={bedW1} height={bedL1 * 0.14} fill="#c8a87a" stroke="#3b82f6" strokeWidth={0.5} rx={2} />
        <text x={pd + sb1L / 2} y={pd + sb1W / 2 + 6} textAnchor="middle" dominantBaseline="middle" fontSize={7} fontFamily="'DM Sans',sans-serif" fill="#388e3c" fontWeight="700">MASTER BEDROOM</text>
        <text x={pd + sb1L / 2} y={pd + sb1W / 2 + 16} textAnchor="middle" dominantBaseline="middle" fontSize={5.5} fontFamily="'JetBrains Mono',monospace" fill="#388e3c">{b1L}×{b1W}</text>
        {/* bedroom 2 */}
        <rect x={pd + sb1L + pd} y={pd} width={sb2L} height={sb2W} fill="#333" />
        <rect x={pd + sb1L + pd + wall} y={pd + wall} width={sb2L - wall * 2} height={sb2W - wall * 2} fill="#f3e5f5" />
        <rect x={pd + sb1L + pd + wall + (sb2L - wall * 2 - bedW2) / 2} y={pd + wall + 4} width={bedW2} height={bedL2} fill="#d4e8ff" stroke="#3b82f6" strokeWidth={1} rx={2} />
        <rect x={pd + sb1L + pd + wall + (sb2L - wall * 2 - bedW2) / 2} y={pd + wall + 4} width={bedW2} height={bedL2 * 0.14} fill="#c8a87a" stroke="#3b82f6" strokeWidth={0.5} rx={2} />
        <text x={pd + sb1L + pd + sb2L / 2} y={pd + sb2W / 2 + 6} textAnchor="middle" dominantBaseline="middle" fontSize={7} fontFamily="'DM Sans',sans-serif" fill="#7b1fa2" fontWeight="700">BEDROOM 2</text>
        <text x={pd + sb1L + pd + sb2L / 2} y={pd + sb2W / 2 + 16} textAnchor="middle" dominantBaseline="middle" fontSize={5.5} fontFamily="'JetBrains Mono',monospace" fill="#7b1fa2">{b2L}×{b2W}</text>
      </SvgRoot>
    );
  }

  const sc = Math.min(300 / (lL + b1L + bt1L), 240 / Math.max(lW + kW, b1W + b2W));
  const slL = lL * sc, slW = lW * sc, skL = kL * sc, skW = kW * sc;
  const sb1L = b1L * sc, sb1W = b1W * sc, sb2L = b2L * sc, sb2W = b2W * sc;
  const sbtL = bt1L * sc, sbtW = bt1W * sc;
  const vw = slL + sb1L + sbtL + pd * 2 + 110, vh = Math.max(slW + skW, sb1W + sb2W) + pd * 2 + 85;
  return (
    <SvgRoot vw={vw} vh={vh} title={`2 BHK FLOOR PLAN — ${lL + b1L}×${Math.max(lW + kW, b1W + b2W)} mm`}>
      <FloorPlanRoom x={pd} y={pd} w={slL} h={slW} label="LIVING" dims={`${lL}×${lW}`} fill="#f0f4ff" stroke="#3b82f6" door={true} />
      <FloorPlanRoom x={pd} y={pd + slW} w={skL} h={skW} label="KITCHEN" dims={`${kL}×${kW}`} fill="#fff8e1" stroke="#f57c00" door={true} />
      <FloorPlanRoom x={pd + slL} y={pd} w={sb1L} h={sb1W} label="MBR" dims={`${b1L}×${b1W}`} fill="#e8f5e9" stroke="#388e3c" door={true} />
      <FloorPlanRoom x={pd + slL} y={pd + sb1W} w={sb2L} h={sb2W} label="BED 2" dims={`${b2L}×${b2W}`} fill="#f3e5f5" stroke="#7b1fa2" door={true} />
      <FloorPlanRoom x={pd + slL + sb1L} y={pd} w={sbtL} h={sbtW} label="BATH" dims={`${bt1L}×${bt1W}`} fill="#e3f2fd" stroke="#1976d2" door={true} />
      <NorthArrow x={pd + 22} y={pd + 22} />
    </SvgRoot>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3 BHK
// ═══════════════════════════════════════════════════════════════════════════════
const ThreeBHKDrawing: React.FC<{ dims: Record<string, number | string>; activeView: string }> = ({ dims }) => {
  const lL = n(dims.livingL), lW = n(dims.livingW), kL = n(dims.kitchenL), kW = n(dims.kitchenW);
  const b1L = n(dims.bed1L), b1W = n(dims.bed1W), b2L = n(dims.bed2L), b2W = n(dims.bed2W);
  const b3L = n(dims.bed3L), b3W = n(dims.bed3W);
  const pd = 75;
  const totalW = lL + b1L;
  const totalH = Math.max(lW + kW, b1W + b2W + b3W);
  const sc = Math.min(300 / totalW, 240 / totalH);
  const slL = lL * sc, slW = lW * sc, skL = kL * sc, skW = kW * sc;
  const sb1L = b1L * sc, sb1W = b1W * sc, sb2L = b2L * sc, sb2W = b2W * sc, sb3L = b3L * sc, sb3W = b3W * sc;
  const vw = slL + sb1L + pd * 2 + 110, vh = Math.max(slW + skW, sb1W + sb2W + sb3W) + pd * 2 + 85;
  return (
    <SvgRoot vw={vw} vh={vh} title={`3 BHK FLOOR PLAN — ${totalW}×${totalH} mm`}>
      <FloorPlanRoom x={pd} y={pd} w={slL} h={slW} label="LIVING / DINING" dims={`${lL}×${lW}`} fill="#f0f4ff" stroke="#3b82f6" door={true} />
      <FloorPlanRoom x={pd} y={pd + slW} w={skL} h={skW} label="KITCHEN" dims={`${kL}×${kW}`} fill="#fff8e1" stroke="#f57c00" door={true} />
      <FloorPlanRoom x={pd + slL} y={pd} w={sb1L} h={sb1W} label="MASTER BR" dims={`${b1L}×${b1W}`} fill="#e8f5e9" stroke="#388e3c" door={true} />
      <FloorPlanRoom x={pd + slL} y={pd + sb1W} w={sb2L} h={sb2W} label="BEDROOM 2" dims={`${b2L}×${b2W}`} fill="#f3e5f5" stroke="#7b1fa2" door={true} />
      <FloorPlanRoom x={pd + slL} y={pd + sb1W + sb2W} w={sb3L} h={sb3W} label="BEDROOM 3" dims={`${b3L}×${b3W}`} fill="#fff3e0" stroke="#e65100" door={true} />
      <NorthArrow x={pd + 22} y={pd + 22} />
    </SvgRoot>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════
export const PRODUCT_REGISTRY: ProductTemplate[] = [
  // ── BED ──────────────────────────────────────────────────────────────────────
  {
    id: 'bed',
    name: 'Bed',
    icon: '🛏️',
    category: 'furniture',
    roomCategory: 'Master Bedroom',
    isFormulaVerified: true,
    // Simplified per the user's real site-measurement workflow (2026-08-29):
    // a measurement person needs W/L/H + a headboard + optional side tables
    // in under a minute, not a fabrication component tree. The detailed
    // CALC_BED panel/patti/platform engine (bedFormulas.ts, bedGeometry.ts,
    // BedTechnicalDrawing.tsx) is kept, unused, for a future "fabrication
    // detail" mode — nothing was deleted, this product entry just no
    // longer wires to it. See src/products/bed/simpleBedGeometry.ts.
    demoDimensions: { W: 1800, L: 2000, H: 436, hasHeadboard: 1, headboardH: 900 },
    measurementFields: [
      { key: 'W', label: 'Bed Width', unit: 'mm', defaultValue: 1800, min: 900, max: 2400 },
      { key: 'L', label: 'Bed Length', unit: 'mm', defaultValue: 2000, min: 1800, max: 2400 },
      { key: 'H', label: 'Bed Height', unit: 'mm', defaultValue: 436, min: 250, max: 600 },
      // Headboard is optional — shown only when selected (default on, so
      // existing behaviour doesn't change unless the user turns it off).
      { key: 'hasHeadboard', label: 'Add Headboard', unit: 'bool', defaultValue: 1 },
      { key: 'headboardH', label: 'Headboard Height', unit: 'mm', defaultValue: 900, min: 400, max: 1500 },
    ],
    views: ['plan'],
    computeCutlist: (dims) => {
      const cutRows = simpleBedCutlist({
        W: n(dims.W), L: n(dims.L), H: n(dims.H),
        headboardEnabled: Number(dims.hasHeadboard ?? 1) === 1, headboardH: n(dims.headboardH) || 900,
        lst: { enabled: false, depthMm: 460, widthMm: 560 },
        rst: { enabled: false, depthMm: 460, widthMm: 560 },
        profileShutter: { enabled: false, side: 'left', heightMm: 150, light: false },
      });
      return cutRows.map((r, i) => row(i + 1, r.component, 'Site Measurement', r.width, r.height, r.qty, 0, '', r.remark));
    },
    DrawingComponent: (props) => <SimpleBedDrawing dims={props.dims} />,
  },

  // ── OPENABLE WARDROBE ─────────────────────────────────────────────────────────
  {
    id: 'openable-wardrobe',
    name: 'Openable Wardrobe',
    icon: '🚪',
    category: 'furniture',
    roomCategory: 'Master Bedroom',
    isFormulaVerified: true,
    // Simplified per the user's real site-measurement workflow (2026-08-30),
    // same treatment as the Bed: a plain W x H carcass, Depth shown as the
    // "/" diagonal leader, plus optional Side Dressing / Side Panel / Loft.
    // The 25-design zone system (wardrobeFormulas.ts, wardrobeGeometry.ts,
    // WardrobeTechnicalDrawing.tsx) is kept intact for a future
    // "fabrication detail" mode — nothing deleted, this entry and
    // ProductFlow.tsx's design-selection gate just no longer require it.
    demoDimensions: { W: 2290, H: 2090, D: 600 },
    measurementFields: [
      { key: 'W', label: 'Wardrobe Width', unit: 'mm', defaultValue: 2290, min: 900, max: 3600 },
      { key: 'H', label: 'Wardrobe Height', unit: 'mm', defaultValue: 2090, min: 1800, max: 2700 },
      { key: 'D', label: 'Wardrobe Depth', unit: 'mm', defaultValue: 600, min: 500, max: 700 },
    ],
    views: ['plan'],
    computeCutlist: (dims) => {
      const cutRows = simpleWardrobeCutlist({
        W: n(dims.W), H: n(dims.H), D: n(dims.D),
        dressing: { enabled: false, side: 'left', widthMm: 400 },
        sidePanel: { enabled: false, side: 'left', widthMm: 80, depthMm: 600 },
        loft: { enabled: false, mode: 'door', widthMm: 0, heightMm: 400, depthMm: 350, doorCount: 2 },
      });
      return cutRows.map((r, i) => row(i + 1, r.component, 'Site Measurement', r.width, r.height, r.qty, 0, '', r.remark));
    },
    DrawingComponent: (props) => <SimpleWardrobeDrawing dims={props.dims} />,
  },

  // ── SLIDING WARDROBE ──────────────────────────────────────────────────────────
  {
    id: 'sliding-wardrobe',
    name: 'Sliding Wardrobe',
    icon: '🪞',
    category: 'furniture',
    roomCategory: 'Master Bedroom',
    isFormulaVerified: true,
    demoDimensions: { W: 2400, H: 2090, D: 600 },
    measurementFields: [
      { key: 'W', label: 'Wardrobe Width', unit: 'mm', defaultValue: 2400, min: 1200, max: 5400 },
      { key: 'H', label: 'Wardrobe Height', unit: 'mm', defaultValue: 2090, min: 1800, max: 2700 },
      { key: 'D', label: 'Wardrobe Depth', unit: 'mm', defaultValue: 600, min: 500, max: 700 },
    ],
    views: ['plan'],
    computeCutlist: (dims) => {
      const cutRows = simpleWardrobeCutlist({
        W: n(dims.W), H: n(dims.H), D: n(dims.D),
        dressing: { enabled: false, side: 'left', widthMm: 400 },
        sidePanel: { enabled: false, side: 'left', widthMm: 80, depthMm: 600 },
        loft: { enabled: false, mode: 'door', widthMm: 0, heightMm: 400, depthMm: 350, doorCount: 2 },
      });
      return cutRows.map((r, i) => row(i + 1, r.component, 'Site Measurement', r.width, r.height, r.qty, 0, '', r.remark));
    },
    DrawingComponent: (props) => <SimpleWardrobeDrawing dims={props.dims} />,
  },

  // ── TV UNIT ───────────────────────────────────────────────────────────────────
  // Simplified in place per the user's own Product Library spec's "T.V."
  // entry (H x W plain labeled box, no depth, no cabinet breakdown) — the
  // user explicitly asked to edit this existing entry rather than add a
  // separate "T.V." product to the dropdown. The old base/wall-cabinet
  // TvUnitDrawing component above is kept intact (unused, not deleted),
  // same "kept for a future detailed-fabrication mode" treatment already
  // used for Side Table's old Front/Plan/Side view and Wardrobe's old
  // 25-design system.
  {
    id: 'tv-unit',
    name: 'TV Unit',
    icon: '📺',
    category: 'furniture',
    roomCategory: 'Living Room',
    isFormulaVerified: true,
    demoDimensions: { H: 700, W: 1400 },
    measurementFields: [
      { key: 'H', label: 'Height', unit: 'mm', defaultValue: 700, min: 300, max: 1500 },
      { key: 'W', label: 'Width', unit: 'mm', defaultValue: 1400, min: 400, max: 3000 },
    ],
    views: ['plan'],
    computeCutlist: (dims) => {
      const cfg: LabeledBoxConfig = { productType: 'tv-unit', boxLabel: 'T.V.', title: 'T.V.', color: '#3b82f6' };
      const cutRows = labeledBoxCutlist({ primary: n(dims.W), secondary: n(dims.H), primaryLabel: 'W', secondaryLabel: 'H' }, cfg);
      return cutRows.map((r, i) => row(i + 1, r.component, 'Site Measurement', r.width, r.height, r.qty, 0, '', r.remark));
    },
    DrawingComponent: (props) => (
      <LabeledBoxDrawing
        inp={{ primary: n(props.dims.W), secondary: n(props.dims.H), primaryLabel: 'W', secondaryLabel: 'H' }}
        cfg={{ productType: 'tv-unit', boxLabel: 'T.V.', title: 'T.V.', color: '#3b82f6' }}
      />
    ),
  },

  // ── SHOE RACK ─────────────────────────────────────────────────────────────────
  {
    id: 'shoe-rack',
    name: 'Shoe Rack',
    icon: '👞',
    category: 'furniture',
    roomCategory: 'Master Bedroom',
    isFormulaVerified: true,
    // No base W/H/D — per the user's own reference sketch, Shoe Rack is
    // built entirely from two optional box types (2 Door Box / Single Door
    // Box), each with its own real Height x Width x Depth. See the
    // "Add 2 Door Box" / "Add Single Door Box" add-ons below.
    demoDimensions: {},
    measurementFields: [],
    views: ['plan'],
    computeCutlist: () => {
      const cutRows = shoeRackCutlist({
        twoDoor: { enabled: false, heightMm: 1500, widthMm: 1050, depthMm: 450 },
        singleDoor: { enabled: false, heightMm: 750, widthMm: 450, depthMm: 450 },
      });
      return cutRows.map((r, i) => row(i + 1, r.component, 'Site Measurement', r.width, r.height, r.qty, 0, '', r.remark));
    },
    DrawingComponent: () => <SimpleShoeRackDrawing />,
  },

  // ── DINING TABLE ──────────────────────────────────────────────────────────────
  // Updated per the "Dining Table Type" master spec — replaces the legacy
  // apron/leg drawing with two real engine-driven types (Folding / Simple)
  // behind a single dropdown, matching the reference drawings. Legacy
  // DiningTableDrawing is left on disk unimported, same convention as the
  // old Side Table/Loft Cabinet engines above.
  {
    id: 'dining-table',
    name: 'Dining Table',
    icon: '🍽️',
    category: 'furniture',
    roomCategory: 'Living Room',
    isFormulaVerified: true,
    demoDimensions: { diningType: 'Folding Dining Table', foldW: 900, foldL: 1500, boxL: 1800, boxW: 900, boxD: 750, topL: 1600, topW: 700 },
    measurementFields: [
      { key: 'diningType', label: 'Dining Table Type', unit: 'select', defaultValue: 'Folding Dining Table', options: ['Folding Dining Table', 'Simple Dining Table'] },
      // Folding Dining Table — Width × Length only, no Depth.
      { key: 'foldW', label: 'Width', unit: 'mm', defaultValue: 900, min: 500, max: 2000 },
      { key: 'foldL', label: 'Length', unit: 'mm', defaultValue: 1500, min: 700, max: 3000 },
      // Simple Dining Table — outer Box (L × W × D) + inner Top (L × W).
      { key: 'boxL', label: 'Box Length', unit: 'mm', defaultValue: 1800, min: 700, max: 3000 },
      { key: 'boxW', label: 'Box Width', unit: 'mm', defaultValue: 900, min: 500, max: 1500 },
      { key: 'boxD', label: 'Box Depth', unit: 'mm', defaultValue: 750, min: 400, max: 900 },
      { key: 'topL', label: 'Top Length', unit: 'mm', defaultValue: 1600, min: 400, max: 3000 },
      { key: 'topW', label: 'Top Width', unit: 'mm', defaultValue: 700, min: 300, max: 1500 },
    ],
    views: ['plan'],
    computeCutlist: (dims) => {
      const diningType = String(dims.diningType ?? 'Folding Dining Table').toLowerCase().startsWith('simple') ? 'simple' : 'folding';
      const cutRows = diningTableCutlist({
        type: diningType,
        foldW: n(dims.foldW) || 900, foldL: n(dims.foldL) || 1500,
        boxL: n(dims.boxL) || 1800, boxW: n(dims.boxW) || 900, boxD: n(dims.boxD) || 750,
        topL: n(dims.topL) || 1600, topW: n(dims.topW) || 700,
      });
      return cutRows.map((r, i) => row(i + 1, r.component, 'Site Measurement', r.width, r.height, r.qty, 0, '', r.remark));
    },
    DrawingComponent: (props) => <DiningTableDrawing2 dims={props.dims} />,
  },

  // ── DOOR ──────────────────────────────────────────────────────────────────────
  {
    id: 'door',
    // Displayed as "Safety Door" per the Product Categories spec — the
    // Door product built earlier this session IS the reference "Safety
    // Door", so this is a display rename only, not a new/duplicate engine.
    name: 'Safety Door',
    icon: '🚪',
    category: 'furniture',
    roomCategory: 'Living Room',
    isFormulaVerified: true,
    demoDimensions: { H: 2100, W: 900, sidePanel: 'None', sidePanelWLeft: 300, sidePanelWRight: 300, addTop: 0, topH: 300, topW: 900 },
    measurementFields: [
      { key: 'H', label: 'Door Height', unit: 'mm', defaultValue: 2100, min: 1500, max: 2700 },
      { key: 'W', label: 'Door Width', unit: 'mm', defaultValue: 900, min: 500, max: 1500 },
      { key: 'sidePanel', label: 'Add Side Panel', unit: 'select', defaultValue: 'None', options: ['None', 'Left', 'Right', 'Both'] },
      { key: 'sidePanelWLeft', label: 'Left Side Panel Width', unit: 'mm', defaultValue: 300, min: 100, max: 900 },
      { key: 'sidePanelWRight', label: 'Right Side Panel Width', unit: 'mm', defaultValue: 300, min: 100, max: 900 },
      { key: 'addTop', label: 'Add Top', unit: 'bool', defaultValue: 0 },
      { key: 'topH', label: 'Top Height', unit: 'mm', defaultValue: 300, min: 100, max: 900 },
      // Defaults to Door Width (900) — the spec's "Top Width auto-populates
      // from Door Width" behaviour. Overridable like any other field; the
      // drawing/dimension-dedup logic in doorGeometry.ts compares the
      // CURRENT entered value against the current Door Width live, so this
      // stays correct even if the user changes Door Width afterwards.
      { key: 'topW', label: 'Top Width', unit: 'mm', defaultValue: 900, min: 200, max: 1500 },
    ],
    views: ['plan'],
    computeCutlist: (dims) => {
      const sidePanel = String(dims.sidePanel ?? 'None').toLowerCase();
      const cutRows = doorCutlist({
        H: n(dims.H) || 2100, W: n(dims.W) || 900,
        sidePanel: (sidePanel === 'left' || sidePanel === 'right' || sidePanel === 'both' ? sidePanel : 'none'),
        sidePanelWLeft: n(dims.sidePanelWLeft) || 300,
        sidePanelWRight: n(dims.sidePanelWRight) || 300,
        addTop: Number(dims.addTop ?? 0) === 1,
        topH: n(dims.topH) || 300,
        topW: n(dims.topW) || n(dims.W) || 900,
      });
      return cutRows.map((r, i) => row(i + 1, r.component, 'Site Measurement', r.width, r.height, r.qty, 0, '', r.remark));
    },
    DrawingComponent: (props) => <DoorDrawing dims={props.dims} />,
  },

  // ── BEDROOM ───────────────────────────────────────────────────────────────────
  {
    id: 'bedroom',
    name: 'Bedroom Layout',
    icon: '🛌',
    category: 'room',
    isFormulaVerified: false,
    demoDimensions: { roomL: 4200, roomW: 3600, ceiling: 2700, hasBed: 1, bedW: 1800, bedL: 2000, hasWardrobe: 1, wardW: 2290, hasTVUnit: 1, tvW: 1800, hasSideTable: 1 },
    measurementFields: [
      { key: 'roomL', label: 'Room Length', unit: 'mm', defaultValue: 4200, min: 2400, max: 7200 },
      { key: 'roomW', label: 'Room Width', unit: 'mm', defaultValue: 3600, min: 2400, max: 6000 },
      { key: 'ceiling', label: 'Ceiling Height', unit: 'mm', defaultValue: 2700, min: 2400, max: 3600 },
      { key: 'bedW', label: 'Bed Width', unit: 'mm', defaultValue: 1800, min: 1200, max: 2000 },
      { key: 'bedL', label: 'Bed Length', unit: 'mm', defaultValue: 2000, min: 1800, max: 2400 },
      { key: 'wardW', label: 'Wardrobe Width', unit: 'mm', defaultValue: 2290, min: 900, max: 3600 },
      { key: 'tvW', label: 'TV Unit Width', unit: 'mm', defaultValue: 1800, min: 900, max: 3000 },
      { key: 'hasBed', label: 'Include Bed', unit: 'bool', defaultValue: 1 },
      { key: 'hasWardrobe', label: 'Include Wardrobe', unit: 'bool', defaultValue: 1 },
      { key: 'hasTVUnit', label: 'Include TV Unit', unit: 'bool', defaultValue: 1 },
    ],
    views: ['plan', 'wall-a'],
    computeCutlist: (dims) => [
      row(1, 'Bed (furniture)',  'Refer Bed template',      n(dims.bedW), n(dims.bedL), 1, 18, '', 'See Bed cutlist'),
      row(2, 'Wardrobe',         'Refer Wardrobe template', n(dims.wardW), 2090,          1, 18, '', 'See Wardrobe cutlist'),
      row(3, 'TV Unit',          'Refer TV Unit template',  n(dims.tvW),  2100,          1, 18, '', 'See TV Unit cutlist'),
      row(4, 'Side Table (×2)',  'Refer Side Table',        500,           550,           2, 18, '', 'Bedside tables'),
    ],
    DrawingComponent: BedroomDrawing,
  },

  // Note: 1 BHK / 2 BHK / 3 BHK Layout products were removed entirely per
  // the user's explicit instruction (out of scope — this app is a
  // furniture-fabrication drawing tool, not a room/floor-plan planner).
  // Their drawing source files (OneBHKDrawing/TwoBHKDrawing/
  // ThreeBHKDrawing) are left on disk unimported, same convention as every
  // other removed product this session.

  // ── SEPARATE DRESSING ─────────────────────────────────────────────────────────
  // A single vertical stack of three zones — Dressing Box / Switch Board /
  // Base Storage — matching the user's own reference sketch. Total Depth is
  // shared by all three zones (one "/" diagonal leader); Total Width is
  // shared by Dressing Box + Switch Board, and by Base Storage too UNLESS
  // its own width is entered differently, in which case a second width
  // dimension appears just for it (no duplicate dimension when identical,
  // per the user's explicit rule). Switch Board is a real visual zone but
  // is never independently measured — its height is whatever's left over.
  {
    id: 'separate-dressing',
    // Maps to "Dressing Unit" in the Product Categories spec's Master
    // Bedroom list — same product, display name unchanged (Separate
    // Dressing is this app's own established name for it).
    name: 'Separate Dressing',
    icon: '🪞',
    category: 'furniture',
    roomCategory: 'Master Bedroom',
    isFormulaVerified: true,
    demoDimensions: { H: 2100, W: 1200, D: 600, dressingBoxH: 1400, baseStorageH: 700, baseStorageW: 1200 },
    measurementFields: [
      { key: 'H', label: 'Total Height', unit: 'mm', defaultValue: 2100, min: 1200, max: 2700 },
      { key: 'W', label: 'Total Width', unit: 'mm', defaultValue: 1200, min: 600, max: 2400 },
      { key: 'D', label: 'Total Depth', unit: 'mm', defaultValue: 600, min: 300, max: 700 },
      { key: 'dressingBoxH', label: 'Dressing Box Height', unit: 'mm', defaultValue: 1400, min: 400, max: 2000 },
      { key: 'baseStorageH', label: 'Base Storage Height', unit: 'mm', defaultValue: 700, min: 300, max: 1200 },
      { key: 'baseStorageW', label: 'Base Storage Width', unit: 'mm', defaultValue: 1200, min: 300, max: 2400 },
    ],
    views: ['plan'],
    computeCutlist: (dims) => {
      const cutRows = separateDressingCutlist({
        H: n(dims.H), W: n(dims.W), D: n(dims.D),
        dressingBoxH: n(dims.dressingBoxH), baseStorageH: n(dims.baseStorageH), baseStorageW: n(dims.baseStorageW) || n(dims.W),
      });
      return cutRows.map((r, i) => row(i + 1, r.component, 'Site Measurement', r.width, r.height, r.qty, 0, '', r.remark));
    },
    DrawingComponent: (props) => <SeparateDressingDrawing dims={props.dims} />,
  },

  // ── SOFA ──────────────────────────────────────────────────────────────────────
  // Plain technical-measurement box (H x W x D) per the user's spec — not a
  // photorealistic sofa, a real CAD dimension drawing like every other
  // product here. Depth is the "/" diagonal leader, same convention as
  // Wardrobe/Shoe Rack/Side Table's own Depth.
  {
    id: 'sofa',
    name: 'Sofa',
    icon: '🛋️',
    category: 'furniture',
    roomCategory: 'Living Room',
    isFormulaVerified: true,
    demoDimensions: { H: 850, W: 2100, D: 900 },
    measurementFields: [
      { key: 'H', label: 'Height', unit: 'mm', defaultValue: 850, min: 500, max: 1200 },
      { key: 'W', label: 'Width', unit: 'mm', defaultValue: 2100, min: 600, max: 4000 },
      { key: 'D', label: 'Depth', unit: 'mm', defaultValue: 900, min: 500, max: 1400 },
    ],
    views: ['plan'],
    computeCutlist: (dims) => {
      const cfg: LabeledBoxConfig = { productType: 'sofa', boxLabel: 'SOFA', title: 'SOFA', color: '#7c3aed' };
      const cutRows = labeledBoxCutlist({ primary: n(dims.W), secondary: n(dims.H), depth: n(dims.D), primaryLabel: 'W', secondaryLabel: 'H' }, cfg);
      return cutRows.map((r, i) => row(i + 1, r.component, 'Site Measurement', r.width, r.height, r.qty, 0, '', r.remark));
    },
    DrawingComponent: (props) => (
      <LabeledBoxDrawing
        inp={{ primary: n(props.dims.W), secondary: n(props.dims.H), depth: n(props.dims.D), primaryLabel: 'W', secondaryLabel: 'H' }}
        cfg={{ productType: 'sofa', boxLabel: 'SOFA', title: 'SOFA', color: '#7c3aed' }}
      />
    ),
  },

  // ── SOFA-CUM-BED ──────────────────────────────────────────────────────────────
  // New product per the Product Categories spec — H x W x D, same real
  // labeled-box + Depth-diagonal shape as Sofa/Center Table/T.V., so this
  // reuses that shared module rather than a new near-duplicate file.
  {
    id: 'sofa-cum-bed',
    name: 'Sofa-cum-Bed',
    icon: '🛏️',
    category: 'furniture',
    roomCategory: 'Living Room',
    isFormulaVerified: true,
    demoDimensions: { H: 800, W: 1800, D: 900 },
    measurementFields: [
      { key: 'H', label: 'Height', unit: 'mm', defaultValue: 800, min: 400, max: 1200 },
      { key: 'W', label: 'Width', unit: 'mm', defaultValue: 1800, min: 900, max: 3000 },
      { key: 'D', label: 'Depth', unit: 'mm', defaultValue: 900, min: 500, max: 1400 },
    ],
    views: ['plan'],
    computeCutlist: (dims) => {
      const cfg: LabeledBoxConfig = { productType: 'sofa-cum-bed', boxLabel: 'SOFA-CUM-BED', title: 'SOFA-CUM-BED', color: '#db2777' };
      const cutRows = labeledBoxCutlist({ primary: n(dims.W), secondary: n(dims.H), depth: n(dims.D), primaryLabel: 'W', secondaryLabel: 'H' }, cfg);
      return cutRows.map((r, i) => row(i + 1, r.component, 'Site Measurement', r.width, r.height, r.qty, 0, '', r.remark));
    },
    DrawingComponent: (props) => (
      <LabeledBoxDrawing
        inp={{ primary: n(props.dims.W), secondary: n(props.dims.H), depth: n(props.dims.D), primaryLabel: 'W', secondaryLabel: 'H' }}
        cfg={{ productType: 'sofa-cum-bed', boxLabel: 'SOFA-CUM-BED', title: 'SOFA-CUM-BED', color: '#db2777' }}
      />
    ),
  },

  // ── CENTER TABLE ──────────────────────────────────────────────────────────────
  // Plan/footprint box (Length x Width), no Height — per the user's spec.
  {
    id: 'center-table',
    name: 'Center Table',
    icon: '🛗',
    category: 'furniture',
    roomCategory: 'Living Room',
    isFormulaVerified: true,
    demoDimensions: { L: 1000, W: 550 },
    measurementFields: [
      { key: 'L', label: 'Length', unit: 'mm', defaultValue: 1000, min: 400, max: 2000 },
      { key: 'W', label: 'Width', unit: 'mm', defaultValue: 550, min: 300, max: 1200 },
    ],
    views: ['plan'],
    computeCutlist: (dims) => {
      const cfg: LabeledBoxConfig = { productType: 'center-table', boxLabel: 'CENTER TABLE', title: 'CENTER TABLE', color: '#0891b2' };
      const cutRows = labeledBoxCutlist({ primary: n(dims.L), secondary: n(dims.W), primaryLabel: 'L', secondaryLabel: 'W' }, cfg);
      return cutRows.map((r, i) => row(i + 1, r.component, 'Site Measurement', r.width, r.height, r.qty, 0, '', r.remark));
    },
    DrawingComponent: (props) => (
      <LabeledBoxDrawing
        inp={{ primary: n(props.dims.L), secondary: n(props.dims.W), primaryLabel: 'L', secondaryLabel: 'W' }}
        cfg={{ productType: 'center-table', boxLabel: 'CENTER TABLE', title: 'CENTER TABLE', color: '#0891b2' }}
      />
    ),
  },

  // ── SEPARATE SIDE TABLE ───────────────────────────────────────────────────────
  // Replaces the old "Side Table" entry (removed per the user's explicit
  // instruction) — Mirror + Base Storage with a real, visible gap between
  // them, matching the user's own reference sketch.
  {
    id: 'separate-side-table',
    // Maps to "Side Table" in the Product Categories spec's Master Bedroom
    // list — the old plain "Side Table" was explicitly replaced by this
    // product earlier in this session; display name unchanged.
    name: 'Separate Side Table',
    icon: '🪞',
    category: 'furniture',
    roomCategory: 'Master Bedroom',
    isFormulaVerified: true,
    demoDimensions: { mirrorW: 500, mirrorH: 700, baseH: 600, baseW: 500, baseD: 400 },
    measurementFields: [
      { key: 'mirrorW', label: 'Mirror Width', unit: 'mm', defaultValue: 500, min: 300, max: 900 },
      { key: 'mirrorH', label: 'Mirror Height', unit: 'mm', defaultValue: 700, min: 400, max: 1200 },
      { key: 'baseH', label: 'Base Storage Height', unit: 'mm', defaultValue: 600, min: 300, max: 900 },
      { key: 'baseW', label: 'Base Storage Width', unit: 'mm', defaultValue: 500, min: 300, max: 900 },
      { key: 'baseD', label: 'Base Storage Depth', unit: 'mm', defaultValue: 400, min: 300, max: 600 },
    ],
    views: ['plan'],
    computeCutlist: (dims) => {
      const cutRows = separateSideTableCutlist({ mirrorW: n(dims.mirrorW), mirrorH: n(dims.mirrorH), baseH: n(dims.baseH), baseW: n(dims.baseW), baseD: n(dims.baseD) });
      return cutRows.map((r, i) => row(i + 1, r.component, 'Site Measurement', r.width, r.height, r.qty, 0, '', r.remark));
    },
    DrawingComponent: (props) => <SeparateSideTableDrawing dims={props.dims} />,
  },

  // ── LOFT BOX ──────────────────────────────────────────────────────────────────
  // Replaces the old "Loft Cabinet" entry (removed per the user's explicit
  // instruction) — shutter-divided box (exact deduction formula from the
  // spec) + optional Top Panel (Left/Right), matching the reference sketch.
  {
    id: 'loft-box',
    // Maps to "Loft" in the Product Categories spec's Master Bedroom list
    // — the old plain "Loft Cabinet" was explicitly replaced by this
    // product earlier in this session; display name unchanged.
    name: 'Loft Box',
    icon: '📦',
    category: 'furniture',
    roomCategory: 'Master Bedroom',
    isFormulaVerified: true,
    demoDimensions: { H: 600, W: 1000, D: 400, onlyShutter: 1, shutterCount: 6, topPanel: 0, topPanelSide: 'Left', topPanelWidth: 300 },
    measurementFields: [
      { key: 'H', label: 'Height', unit: 'mm', defaultValue: 600, min: 300, max: 900 },
      { key: 'W', label: 'Width', unit: 'mm', defaultValue: 1000, min: 600, max: 3600 },
      { key: 'D', label: 'Depth', unit: 'mm', defaultValue: 400, min: 250, max: 600 },
      { key: 'onlyShutter', label: 'Only Shutter', unit: 'bool', defaultValue: 1 },
      { key: 'shutterCount', label: 'Number of Shutters', unit: 'count', defaultValue: 6, min: 1, max: 12 },
      { key: 'topPanel', label: 'Top Panel', unit: 'bool', defaultValue: 0 },
      { key: 'topPanelSide', label: 'Top Panel Side', unit: 'select', defaultValue: 'Left', options: ['Left', 'Right'] },
      { key: 'topPanelWidth', label: 'Top Panel Width', unit: 'mm', defaultValue: 300, min: 100, max: 1200 },
    ],
    views: ['plan'],
    computeCutlist: (dims) => {
      const cutRows = loftBoxCutlist({
        H: n(dims.H), W: n(dims.W), D: n(dims.D),
        onlyShutter: Number(dims.onlyShutter ?? 0) === 1, shutterCount: n(dims.shutterCount) || 6,
        topPanel: Number(dims.topPanel ?? 0) === 1, topPanelSide: String(dims.topPanelSide ?? 'Left').toLowerCase() === 'right' ? 'right' : 'left', topPanelWidth: n(dims.topPanelWidth) || 300,
      });
      return cutRows.map((r, i) => row(i + 1, r.component, 'Site Measurement', r.width, r.height, r.qty, 0, '', r.remark));
    },
    DrawingComponent: (props) => <LoftBoxDrawing dims={props.dims} />,
  },

  // ── KITCHEN LOFT ─────────────────────────────────────────────────────────────
  // Same product as Loft Box (Master Bedroom) in every respect — same
  // measurement fields, same shutter-division formula, same drawing engine
  // — just placed under the Kitchen room category with its own name, per
  // the user's explicit "same as Master Bedroom Loft Box, all
  // functionality and drawing the same" instruction. Reuses
  // LoftBoxDrawing/loftBoxCutlist directly rather than a duplicate
  // geometry file, matching the same "reusable product configuration"
  // convention already used for LabeledBoxDrawing (TV Unit/Sofa/Center
  // Table share one module).
  {
    id: 'kitchen-loft',
    name: 'Kitchen Loft',
    icon: '📦',
    category: 'furniture',
    roomCategory: 'Kitchen',
    isFormulaVerified: true,
    demoDimensions: { H: 600, W: 1000, D: 400, onlyShutter: 1, shutterCount: 6, topPanel: 0, topPanelSide: 'Left', topPanelWidth: 300 },
    measurementFields: [
      { key: 'H', label: 'Height', unit: 'mm', defaultValue: 600, min: 300, max: 900 },
      { key: 'W', label: 'Width', unit: 'mm', defaultValue: 1000, min: 600, max: 3600 },
      { key: 'D', label: 'Depth', unit: 'mm', defaultValue: 400, min: 250, max: 600 },
      { key: 'onlyShutter', label: 'Only Shutter', unit: 'bool', defaultValue: 1 },
      { key: 'shutterCount', label: 'Number of Shutters', unit: 'count', defaultValue: 6, min: 1, max: 12 },
      { key: 'topPanel', label: 'Top Panel', unit: 'bool', defaultValue: 0 },
      { key: 'topPanelSide', label: 'Top Panel Side', unit: 'select', defaultValue: 'Left', options: ['Left', 'Right'] },
      { key: 'topPanelWidth', label: 'Top Panel Width', unit: 'mm', defaultValue: 300, min: 100, max: 1200 },
    ],
    views: ['plan'],
    computeCutlist: (dims) => {
      const cutRows = loftBoxCutlist({
        H: n(dims.H), W: n(dims.W), D: n(dims.D),
        onlyShutter: Number(dims.onlyShutter ?? 0) === 1, shutterCount: n(dims.shutterCount) || 6,
        topPanel: Number(dims.topPanel ?? 0) === 1, topPanelSide: String(dims.topPanelSide ?? 'Left').toLowerCase() === 'right' ? 'right' : 'left', topPanelWidth: n(dims.topPanelWidth) || 300,
      });
      return cutRows.map((r, i) => row(i + 1, r.component, 'Site Measurement', r.width, r.height, r.qty, 0, '', r.remark));
    },
    DrawingComponent: (props) => <LoftBoxDrawing dims={props.dims} />,
  },

  // ── KITCHEN CABINET (K.B) ────────────────────────────────────────────────────
  // First real product under the Kitchen room category — was a placeholder
  // ("No products available yet") until now. Black main cabinet divided
  // into N equal doors with a fixed 3mm gap (never user-entered), plus an
  // optional blue Open Box (default width = Total Width) with an optional
  // orange Profile Light + centered "W × H" callout, matching the spec's
  // reference drawing exactly.
  {
    id: 'kitchen-cabinet',
    name: 'Kitchen Cabinet (K.B)',
    icon: '🗄️',
    category: 'furniture',
    roomCategory: 'Kitchen',
    isFormulaVerified: true,
    demoDimensions: { H: 720, W: 2000, D: 560, doorCount: 6, addOpenBox: 0, openBoxH: 150, openBoxW: 0, profileLight: 0 },
    measurementFields: [
      { key: 'H', label: 'Total Height', unit: 'mm', defaultValue: 720, min: 300, max: 2400 },
      { key: 'W', label: 'Total Width', unit: 'mm', defaultValue: 2000, min: 300, max: 6000 },
      { key: 'D', label: 'Depth', unit: 'mm', defaultValue: 560, min: 250, max: 900 },
      { key: 'doorCount', label: 'No. of Doors', unit: 'count', defaultValue: 6, min: 1, max: 20 },
      { key: 'addOpenBox', label: 'Add Open Box', unit: 'bool', defaultValue: 0 },
      { key: 'openBoxH', label: 'Open Box Height', unit: 'mm', defaultValue: 150, min: 1, max: 900 },
      { key: 'openBoxW', label: 'Open Box Width (blank = Total Width)', unit: 'mm', defaultValue: 0, min: 0, max: 6000 },
      { key: 'profileLight', label: 'Add Profile Light', unit: 'bool', defaultValue: 0 },
    ],
    views: ['plan'],
    computeCutlist: (dims) => {
      const cutRows = kitchenCabinetCutlist({
        H: n(dims.H), W: n(dims.W), D: n(dims.D),
        doorCount: n(dims.doorCount) || 6,
        addOpenBox: Number(dims.addOpenBox ?? 0) === 1,
        openBoxH: n(dims.openBoxH) || 150,
        openBoxW: n(dims.openBoxW) || 0,
        profileLight: Number(dims.profileLight ?? 0) === 1,
      });
      return cutRows.map((r, i) => row(i + 1, r.component, 'Site Measurement', r.width, r.height, r.qty, 0, '', r.remark));
    },
    DrawingComponent: (props) => <KitchenCabinetDrawing dims={props.dims} />,
  },

  // ── STUDY TABLE ───────────────────────────────────────────────────────────────
  {
    id: 'study-table',
    name: 'Study Table',
    icon: '📖',
    category: 'furniture',
    roomCategory: 'Master Bedroom',
    isFormulaVerified: true,
    demoDimensions: { H: 750, W: 1200, D: 600, storage: 'None', storageW: 450, sidePanel: 'None' },
    measurementFields: [
      { key: 'H', label: 'Height', unit: 'mm', defaultValue: 750, min: 600, max: 900 },
      { key: 'W', label: 'Width', unit: 'mm', defaultValue: 1200, min: 600, max: 2400 },
      { key: 'D', label: 'Depth', unit: 'mm', defaultValue: 600, min: 400, max: 900 },
      { key: 'storage', label: 'Add Storage', unit: 'select', defaultValue: 'None', options: ['None', 'Left', 'Right', 'Both'] },
      { key: 'storageW', label: 'Storage Width', unit: 'mm', defaultValue: 450, min: 250, max: 900 },
      { key: 'sidePanel', label: 'Add Side Panel', unit: 'select', defaultValue: 'None', options: ['None', 'Left', 'Right', 'Both'] },
    ],
    views: ['plan'],
    computeCutlist: (dims) => {
      const storage = String(dims.storage ?? 'None').toLowerCase();
      const sidePanel = String(dims.sidePanel ?? 'None').toLowerCase();
      const cutRows = studyTableCutlist({
        H: n(dims.H), W: n(dims.W), D: n(dims.D),
        storage: (storage === 'left' || storage === 'right' || storage === 'both' ? storage : 'none'),
        storageW: n(dims.storageW) || 450,
        sidePanel: (sidePanel === 'left' || sidePanel === 'right' || sidePanel === 'both' ? sidePanel : 'none'),
      });
      return cutRows.map((r, i) => row(i + 1, r.component, 'Site Measurement', r.width, r.height, r.qty, 0, '', r.remark));
    },
    DrawingComponent: (props) => <StudyTableDrawing dims={props.dims} />,
  },

  // ── PARTITION ─────────────────────────────────────────────────────────────────
  {
    id: 'partition',
    name: 'Partition',
    icon: '🧱',
    category: 'furniture',
    roomCategory: 'Living Room',
    isFormulaVerified: true,
    demoDimensions: { type: 'With Framing', H: 2100, W: 900, D: 400, side: 'Left' },
    measurementFields: [
      { key: 'type', label: 'Partition Type', unit: 'select', defaultValue: 'With Framing', options: ['With Framing', 'With Partition'] },
      { key: 'H', label: 'Height', unit: 'mm', defaultValue: 2100, min: 1800, max: 2700 },
      { key: 'W', label: 'Width', unit: 'mm', defaultValue: 900, min: 400, max: 2400 },
      { key: 'D', label: 'Depth', unit: 'mm', defaultValue: 400, min: 200, max: 700 },
      { key: 'side', label: 'Partition Position', unit: 'select', defaultValue: 'Left', options: ['Left', 'Right'] },
    ],
    views: ['plan'],
    computeCutlist: (dims) => {
      const cutRows = partitionCutlist({
        type: String(dims.type ?? 'With Framing').toLowerCase().includes('partition') ? 'partition' : 'framing',
        H: n(dims.H), W: n(dims.W), D: n(dims.D),
        side: String(dims.side ?? 'Left').toLowerCase() === 'right' ? 'right' : 'left',
      });
      return cutRows.map((r, i) => row(i + 1, r.component, 'Site Measurement', r.width, r.height, r.qty, 0, '', r.remark));
    },
    DrawingComponent: (props) => <PartitionDrawing dims={props.dims} />,
  },
];

export function getProduct(id: ProductId): ProductTemplate | undefined {
  return PRODUCT_REGISTRY.find((p) => p.id === id);
}
