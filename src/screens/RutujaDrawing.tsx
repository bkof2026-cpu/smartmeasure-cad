import React, { useState } from 'react';

// ─── Project info (from PDF) ───────────────────────────────────────────────────
const PI = {
  client: 'Arc. Rutuja Joshi',
  id: 'XXXXX-9038',
  address: '601 Ashray Residency, Racca Colony, Near Jain Mandir, Nashik',
  by: 'Nayan Mandlik',
  exec: 'Mahendra Thorat',
  execMo: '97673 71797',
  date: '05/07/2026',
  type: 'L-Shape Modular Kitchen',
  finish: 'H-Glossy Olivilya N0000 + PC140 L22 Beige',
  brand: 'Best Kitchennet',
};

// ─── Measurements from PDF (all mm) ───────────────────────────────────────────
const WA = 3085;   // Wall A total width
const WB = 2560;   // Wall B total width
const CEIL = 2750; // Ceiling height
const LOFT_H = 400;
const BASE_H = 750;
const KAD_H = 100;
const SLAB_H = 35;
const SKIRT_H = 70;
const BASE_DEPTH = 985;  // Wall A base depth
const WB_DEPTH = 940;    // Wall B base depth

// SVG y-coords (y=0 ceiling, y=CEIL floor)
const FLOOR = CEIL;
const KAD_TOP = CEIL - KAD_H;             // 2650
const CTR_TOP = CEIL - KAD_H - BASE_H;    // 1900 (counter surface = base top)
const SLAB_TOP = CTR_TOP - SLAB_H;        // 1865
const LOFT_BOT = LOFT_H;                  // 400

// Wall A crockery panels (Section 1, top-aligned at LOFT_BOT)
const WA_PANELS = [
  { w: 250, h: 330, kind: 'open',   label: 'OPEN BOX',  mat: '9804 HG Lam.' },
  { w: 405, h: 465, kind: 'crock',  label: 'CK-01', mat: 'PC140 L22 Beige' },
  { w: 405, h: 465, kind: 'crock',  label: 'CK-02', mat: 'PC140 L22 Beige' },
  { w: 405, h: 465, kind: 'crock',  label: 'CK-03', mat: 'PC140 L22 Beige' },
  { w: 405, h: 465, kind: 'crock',  label: 'CK-04', mat: 'PC140 L22 Beige' },
  { w: 600, h: 700, kind: 'glass',  label: 'FG-01',  mat: 'Fluted Glass (Silver Profile)' },
  { w: 615, h: 465, kind: 'crock',  label: 'WC-01', mat: 'PC140 L22 Beige' },
]; // sum: 250+405+405+405+405+600+615 = 3085

// Wall A base modules (Section 2)
const WA_BASE = [
  { w: 445, kind: 'base', label: 'B-01',  note: '' },
  { w: 670, kind: 'td',   label: 'TD-01', note: 'T.D 350 / T.D 398' },
  { w: 320, kind: 'spo',  label: 'SPO',   note: 'Space Tower' },
  { w: 461, kind: 'base', label: 'B-02',  note: '' },
  { w: 461, kind: 'base', label: 'B-03',  note: '' },
]; // sum: 2357 → base starts at x=728 (3085-2357=728)
const BASE_X0 = WA - WA_BASE.reduce((s, m) => s + m.w, 0); // 728

// Wall B storage sections (Section 3, bottom widths)
const WB_SECS = [
  { w: 755,  kind: 'tall',    label: 'TALL UNIT',     h_above: 2185 },
  { w: 600,  kind: 'roll',    label: 'ROLLING\nSHTTR',h_above: 2185 },
  { w: 600,  kind: 'fridge',  label: 'FRIDGE\nSPACE', h_above: 1800 },
  { w: 605,  kind: 'open',    label: 'OPEN\nSHELVES', h_above: 940  },
]; // sum: 2560

// ─── Colors ────────────────────────────────────────────────────────────────────
const C = {
  cab:    '#b5a080',  // Olivilya taupe finish
  cabBd:  '#7a6040',
  glass:  '#c0dce8',
  glassBd:'#80aabb',
  wood:   '#c07030',  // 9804 HG open box
  woodBd: '#9a5020',
  ctr:    '#1a1a1a',  // black granite counter
  marble: '#f6f4f0',  // backsplash
  mbVein: '#dcd8d0',
  skirt:  '#181818',
  kad:    '#6a5040',
  roll:   '#0d0d0d',  // rolling shutter
  fridge: '#dce8f5',
  wallBg: '#ece8e2',
  dim:    '#cc2200',  // red dimension lines (PDF style)
  note:   '#1133cc',
  tag:    '#444',
};

// ─── SVG helpers ───────────────────────────────────────────────────────────────
function Defs() {
  return (
    <defs>
      {/* Fluted glass pattern */}
      <pattern id="rj-flute" patternUnits="userSpaceOnUse" width="44" height="10">
        <rect width="44" height="10" fill={C.glass} />
        <line x1="0" y1="0" x2="0" y2="10" stroke={C.glassBd} strokeWidth="10" />
      </pattern>
      {/* Wood grain */}
      <pattern id="rj-wood" patternUnits="userSpaceOnUse" width="80" height="80" patternTransform="rotate(12)">
        <rect width="80" height="80" fill={C.wood} />
        <line x1="0" y1="0" x2="80" y2="0" stroke={C.woodBd} strokeWidth="4" />
        <line x1="0" y1="22" x2="80" y2="22" stroke={C.woodBd} strokeWidth="6" />
        <line x1="0" y1="45" x2="80" y2="45" stroke={C.woodBd} strokeWidth="4" />
        <line x1="0" y1="68" x2="80" y2="68" stroke={C.woodBd} strokeWidth="3" />
      </pattern>
      {/* Granite counter */}
      <pattern id="rj-granite" patternUnits="userSpaceOnUse" width="120" height="120">
        <rect width="120" height="120" fill="#1a1a1a" />
        <line x1="0" y1="30" x2="120" y2="45" stroke="#2a2a2a" strokeWidth="6" />
        <line x1="0" y1="80" x2="120" y2="90" stroke="#2a2a2a" strokeWidth="4" />
        <line x1="20" y1="0" x2="40" y2="120" stroke="#2a2a2a" strokeWidth="3" />
      </pattern>
      {/* Marble (backsplash) */}
      <pattern id="rj-marble" patternUnits="userSpaceOnUse" width="600" height="600">
        <rect width="600" height="600" fill={C.marble} />
        <path d="M 0 80 Q 300 60 600 90" stroke={C.mbVein} strokeWidth="8" fill="none" />
        <path d="M 0 220 Q 200 200 600 240" stroke={C.mbVein} strokeWidth="5" fill="none" />
        <path d="M 0 400 Q 400 380 600 420" stroke={C.mbVein} strokeWidth="6" fill="none" />
        <path d="M 100 0 Q 120 300 80 600" stroke={C.mbVein} strokeWidth="4" fill="none" />
        <path d="M 400 0 Q 380 300 420 600" stroke={C.mbVein} strokeWidth="5" fill="none" />
      </pattern>
      {/* Rolling shutter lines */}
      <pattern id="rj-roll" patternUnits="userSpaceOnUse" width="10" height="50">
        <rect width="10" height="50" fill={C.roll} />
        <line x1="0" y1="0" x2="10" y2="0" stroke="#333" strokeWidth="6" />
        <line x1="0" y1="25" x2="10" y2="25" stroke="#333" strokeWidth="4" />
      </pattern>
    </defs>
  );
}

// Horizontal dimension (ticks + line + label)
function HD({ x1, x2, y, label, fs = 72, col = C.dim, above = true }: {
  x1: number; x2: number; y: number; label: string;
  fs?: number; col?: string; above?: boolean;
}) {
  const mx = (x1 + x2) / 2;
  const ly = above ? y - 120 : y + 150;
  const tw = label.length * fs * 0.58;
  const tickDir = above ? 1 : -1;
  return (
    <g fill={col} stroke={col} strokeWidth={0}>
      <line x1={x1} y1={y - tickDir * 55} x2={x1} y2={y + tickDir * 55} stroke={col} strokeWidth={9} />
      <line x1={x2} y1={y - tickDir * 55} x2={x2} y2={y + tickDir * 55} stroke={col} strokeWidth={9} />
      <line x1={x1 + 25} y1={y} x2={x2 - 25} y2={y} stroke={col} strokeWidth={11} />
      <rect x={mx - tw / 2 - 18} y={ly - fs * 0.85} width={tw + 36} height={fs * 1.35} fill="white" />
      <text x={mx} y={ly} textAnchor="middle" fontSize={fs} fontWeight="bold"
        fontFamily="'JetBrains Mono',monospace" fill={col}>{label}</text>
    </g>
  );
}

// Vertical dimension
function VD({ x, y1, y2, label, fs = 65, col = C.dim, right = true }: {
  x: number; y1: number; y2: number; label: string;
  fs?: number; col?: string; right?: boolean;
}) {
  const my = (y1 + y2) / 2;
  const lx = right ? x + 90 : x - 90;
  const tw = label.length * fs * 0.58;
  const tickDir = right ? -1 : 1;
  return (
    <g fill={col} stroke={col}>
      <line x1={x - tickDir * 55} y1={y1} x2={x + tickDir * 55} y2={y1} stroke={col} strokeWidth={9} />
      <line x1={x - tickDir * 55} y1={y2} x2={x + tickDir * 55} y2={y2} stroke={col} strokeWidth={9} />
      <line x1={x} y1={y1 + 25} x2={x} y2={y2 - 25} stroke={col} strokeWidth={11} />
      <rect x={lx - tw / 2 - 18} y={my - fs * 0.85} width={tw + 36} height={fs * 1.35} fill="white" />
      <text x={lx} y={my + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight="bold"
        fontFamily="'JetBrains Mono',monospace" fill={col}
        transform={`rotate(-90,${lx},${my})`}>{label}</text>
    </g>
  );
}

// Centered module label
function ModLabel({ x, y, w, h, text, sub, fs = 55, col = '#444' }: {
  x: number; y: number; w: number; h: number; text: string;
  sub?: string; fs?: number; col?: string;
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g>
      <text x={cx} y={sub ? cy - 15 : cy + fs * 0.35} textAnchor="middle"
        fontSize={fs} fontWeight="700" fontFamily="'JetBrains Mono',monospace" fill={col}>{text}</text>
      {sub && (
        <text x={cx} y={cy + fs * 0.85} textAnchor="middle"
          fontSize={fs * 0.65} fontFamily="'DM Sans',sans-serif" fill={col + 'aa'}>{sub}</text>
      )}
    </g>
  );
}

// ─── Elevation A (Wall A = 3085mm — Loft + Crockery + Base) ───────────────────
function ElevationA() {
  const ML = 700, MR = 450, MT = 280, MB = 850;
  const vb = `${-ML} ${-MT} ${WA + ML + MR} ${CEIL + MT + MB}`;

  // Compute crockery panel x-positions
  const panelXs: number[] = [];
  let px = 0;
  for (const p of WA_PANELS) { panelXs.push(px); px += p.w; }

  // Compute base module x-positions
  const baseXs: number[] = [];
  let bx = BASE_X0;
  for (const m of WA_BASE) { baseXs.push(bx); bx += m.w; }

  return (
    <svg viewBox={vb} style={{ width: '100%', maxHeight: '82vh', display: 'block' }}
      preserveAspectRatio="xMidYMid meet">
      <Defs />

      {/* ── Background wall ── */}
      <rect x={0} y={0} width={WA} height={CEIL} fill={C.wallBg} />

      {/* ── Ceiling line ── */}
      <line x1={-80} y1={0} x2={WA + 80} y2={0} stroke="#999" strokeWidth={10} strokeDasharray="100 50" />

      {/* ── Floor line ── */}
      <line x1={-80} y1={FLOOR} x2={WA + 80} y2={FLOOR} stroke="#111" strokeWidth={24} />

      {/* ── Left / right wall lines ── */}
      <line x1={0} y1={0} x2={0} y2={FLOOR} stroke="#444" strokeWidth={20} />
      <line x1={WA} y1={0} x2={WA} y2={FLOOR} stroke="#444" strokeWidth={20} />

      {/* ── LOFT BOX (full width, 400mm high) ── */}
      <rect x={0} y={0} width={WA} height={LOFT_H} fill={C.cab} stroke={C.cabBd} strokeWidth={12} />
      {/* Loft panel dividers: 7 × (3085/7 ≈ 441) */}
      {[1, 2, 3, 4, 5, 6].map(i => (
        <g key={i}>
          <line x1={i * 441} y1={10} x2={i * 441} y2={LOFT_H - 10}
            stroke={C.cabBd} strokeWidth={9} />
          <text x={i * 441 - 220 + 220} y={LOFT_H / 2 + 22} textAnchor="middle"
            fontSize={52} fontFamily="'DM Sans',sans-serif" fill="#654" fontWeight="600">
            437
          </text>
        </g>
      ))}
      {/* Loft first panel label */}
      <text x={220} y={LOFT_H / 2 + 22} textAnchor="middle"
        fontSize={52} fontFamily="'DM Sans',sans-serif" fill="#654" fontWeight="600">437</text>
      <text x={WA - 220} y={LOFT_H / 2 + 22} textAnchor="middle"
        fontSize={52} fontFamily="'DM Sans',sans-serif" fill="#654" fontWeight="600">437</text>
      {/* Loft label */}
      <text x={WA / 2} y={LOFT_H / 2 - 45} textAnchor="middle"
        fontSize={68} fontWeight="900" fontFamily="'JetBrains Mono',monospace" fill="#443">
        LOFT BOX — PC140 L22 Beige
      </text>

      {/* ── CROCKERY / WALL CABINET PANELS (below loft, top-aligned) ── */}
      {WA_PANELS.map((p, i) => {
        const px2 = panelXs[i];
        const py = LOFT_BOT;
        const fill = p.kind === 'open' ? 'url(#rj-wood)'
          : p.kind === 'glass' ? 'url(#rj-flute)' : C.cab;
        const bd = p.kind === 'glass' ? C.glassBd : p.kind === 'open' ? C.woodBd : C.cabBd;
        return (
          <g key={i}>
            {/* Cabinet body */}
            <rect x={px2} y={py} width={p.w} height={p.h} fill={fill} stroke={bd} strokeWidth={10} />
            {/* Inner frame / shutter line */}
            {p.kind !== 'open' && (
              <rect x={px2 + 18} y={py + 18} width={p.w - 36} height={p.h - 36}
                fill="none" stroke={p.kind === 'glass' ? C.glassBd : C.cabBd} strokeWidth={7} rx={3} />
            )}
            {/* Handle (bottom edge, horizontal bar) */}
            {p.kind !== 'open' && (
              <line x1={px2 + p.w * 0.2} y1={py + p.h - 65}
                x2={px2 + p.w * 0.8} y2={py + p.h - 65}
                stroke="#222" strokeWidth={18} strokeLinecap="round" />
            )}
            {/* Label */}
            <text x={px2 + p.w / 2} y={py + p.h / 2 - 20} textAnchor="middle"
              fontSize={50} fontWeight="700" fontFamily="'JetBrains Mono',monospace"
              fill={p.kind === 'glass' ? '#336' : '#443'}>{p.label}</text>
            <text x={px2 + p.w / 2} y={py + p.h / 2 + 40} textAnchor="middle"
              fontSize={36} fontFamily="'DM Sans',sans-serif" fill="#887">{p.mat}</text>
            {/* Width dimension */}
            <HD x1={px2} x2={px2 + p.w} y={LOFT_BOT - 220} label={String(p.w)} fs={52} above={true} />
          </g>
        );
      })}

      {/* ── BACKSPLASH / WALL (marble, below crockery to counter) ── */}
      {/* Main zone (right of open box) */}
      <rect x={panelXs[1]} y={LOFT_BOT + 465}
        width={WA - panelXs[1]} height={SLAB_TOP - LOFT_BOT - 465}
        fill="url(#rj-marble)" />
      {/* Left zone (below open box, has window) */}
      <rect x={0} y={LOFT_BOT + 330} width={panelXs[1]} height={SLAB_TOP - LOFT_BOT - 330}
        fill="url(#rj-marble)" />
      {/* Fluted glass backsplash lower bit */}
      <rect x={panelXs[5]} y={LOFT_BOT + 700}
        width={WA_PANELS[5].w} height={SLAB_TOP - LOFT_BOT - 700}
        fill="url(#rj-marble)" />

      {/* ── WINDOW (left side, in backsplash zone) ── */}
      {/* Window opening: clear white */}
      <rect x={30} y={620} width={640} height={1140} fill="white" />
      {/* Window frame (black aluminium) */}
      <rect x={30} y={620} width={640} height={1140}
        fill="none" stroke="#1a1a2a" strokeWidth={22} />
      {/* Horizontal glazing bar */}
      <line x1={30} y1={1060} x2={670} y2={1060} stroke="#1a1a2a" strokeWidth={18} />
      {/* Vertical glazing bar */}
      <line x1={350} y1={620} x2={350} y2={1760} stroke="#1a1a2a" strokeWidth={14} />
      {/* Sky fill (light blue) */}
      <rect x={52} y={642} width={286} height={400} fill="#d0e8f8" opacity={0.6} />
      <rect x={358} y={642} width={290} height={400} fill="#d0e8f8" opacity={0.6} />
      {/* Sill */}
      <rect x={0} y={1760} width={700} height={50} fill={C.cab} stroke={C.cabBd} strokeWidth={8} />
      {/* Window label */}
      <text x={350} y={1040} textAnchor="middle" fontSize={50}
        fontFamily="'DM Sans',sans-serif" fill="#336" fontWeight="700">WINDOW</text>
      <text x={350} y={1110} textAnchor="middle" fontSize={40}
        fontFamily="'DM Sans',sans-serif" fill="#558">750×1140 (approx.)</text>

      {/* ── COUNTER SLAB (black granite) ── */}
      <rect x={0} y={SLAB_TOP} width={WA} height={SLAB_H}
        fill="url(#rj-granite)" stroke="#111" strokeWidth={10} />
      <text x={WA / 2} y={SLAB_TOP + 28} textAnchor="middle" fontSize={26}
        fontFamily="'DM Sans',sans-serif" fill="#aaa" fontWeight="600">BLACK GRANITE COUNTER SLAB</text>

      {/* ── BASE CABINETS (right zone: x=728 to x=3085) ── */}
      {WA_BASE.map((m, i) => {
        const bx2 = baseXs[i];
        const by = CTR_TOP;
        const bh = BASE_H;
        const fill = m.kind === 'td' ? '#bfae9a' : m.kind === 'spo' ? '#b0c8d0' : C.cab;
        return (
          <g key={i}>
            {/* Cabinet body */}
            <rect x={bx2} y={by} width={m.w} height={bh}
              fill={fill} stroke={C.cabBd} strokeWidth={10} />
            {/* Shutter frame */}
            <rect x={bx2 + 18} y={by + 18} width={m.w - 36} height={bh - 36}
              fill="none" stroke={C.cabBd} strokeWidth={7} rx={3} />
            {/* Tandem drawer lines for TD type */}
            {m.kind === 'td' && [0.3, 0.6].map(frac => (
              <line key={frac} x1={bx2 + 16} y1={by + bh * frac} x2={bx2 + m.w - 16} y2={by + bh * frac}
                stroke={C.cabBd} strokeWidth={9} />
            ))}
            {/* SPO vertical lines */}
            {m.kind === 'spo' && [0.25, 0.5, 0.75].map(frac => (
              <line key={frac} x1={bx2 + m.w * frac} y1={by + 20} x2={bx2 + m.w * frac} y2={by + bh - 20}
                stroke={C.glassBd} strokeWidth={8} />
            ))}
            {/* Handle (top-edge black) */}
            <line x1={bx2 + 20} y1={by + 55}
              x2={bx2 + m.w - 20} y2={by + 55}
              stroke="#111" strokeWidth={22} strokeLinecap="round" />
            {/* Label */}
            <text x={bx2 + m.w / 2} y={by + bh / 2 - 15} textAnchor="middle"
              fontSize={52} fontWeight="700" fontFamily="'JetBrains Mono',monospace"
              fill={m.kind === 'spo' ? '#234' : '#443'}>{m.label}</text>
            <text x={bx2 + m.w / 2} y={by + bh / 2 + 45} textAnchor="middle"
              fontSize={36} fontFamily="'DM Sans',sans-serif" fill="#887">{m.note}</text>
            {/* Width dimension (below base zone) */}
            <HD x1={bx2} x2={bx2 + m.w} y={FLOOR + 290} label={String(m.w)} fs={55} above={false} />
          </g>
        );
      })}

      {/* ── LEFT BASE ZONE (under window / corner area, 728mm) ── */}
      {/* Hidden drawer unit */}
      <rect x={0} y={CTR_TOP} width={BASE_X0} height={BASE_H}
        fill="#c0ae94" stroke={C.cabBd} strokeWidth={10} />
      {/* Three drawer lines */}
      {[0.28, 0.58].map(frac => (
        <line key={frac} x1={12} y1={CTR_TOP + BASE_H * frac} x2={BASE_X0 - 12} y2={CTR_TOP + BASE_H * frac}
          stroke={C.cabBd} strokeWidth={9} />
      ))}
      <line x1={20} y1={CTR_TOP + 50} x2={BASE_X0 - 20} y2={CTR_TOP + 50}
        stroke="#111" strokeWidth={20} strokeLinecap="round" />
      <text x={BASE_X0 / 2} y={CTR_TOP + BASE_H / 2 - 15} textAnchor="middle"
        fontSize={50} fontWeight="700" fontFamily="'JetBrains Mono',monospace" fill="#443">HIDDEN DRW.</text>
      <text x={BASE_X0 / 2} y={CTR_TOP + BASE_H / 2 + 42} textAnchor="middle"
        fontSize={36} fontFamily="'DM Sans',sans-serif" fill="#776">290+290+272</text>
      <HD x1={0} x2={BASE_X0} y={FLOOR + 290} label={String(BASE_X0)} fs={55} above={false} />

      {/* ── KADAPPA PLATFORM ── */}
      <rect x={0} y={KAD_TOP} width={WA} height={KAD_H}
        fill={C.kad} stroke="#4a3020" strokeWidth={10} />
      <text x={WA / 2} y={KAD_TOP + 70} textAnchor="middle" fontSize={48}
        fontFamily="'DM Sans',sans-serif" fill="#c8a888" fontWeight="600">KADAPPA PLATFORM — {KAD_H}mm</text>

      {/* ── SKIRTING LINE ── */}
      <line x1={BASE_X0} y1={KAD_TOP} x2={WA} y2={KAD_TOP} stroke="#111" strokeWidth={14} />

      {/* ─── DIMENSION ANNOTATIONS ───────────────────────────────────────────── */}

      {/* Top: overall width */}
      <HD x1={0} x2={WA} y={-180} label={`${WA} mm`} fs={80} above={true} />

      {/* Bottom: overall base total */}
      <HD x1={0} x2={WA} y={FLOOR + 520} label={`${WA} mm`} fs={80} above={false} />

      {/* Left side vertical dims */}
      <VD x={-ML + 60} y1={0} y2={LOFT_BOT} label={`${LOFT_H}`} fs={60} right={false} />
      <VD x={-ML + 60} y1={0} y2={CTR_TOP} label={`${CTR_TOP}mm`} fs={60} right={false} />
      <VD x={-ML + 60} y1={0} y2={FLOOR} label={`${CEIL}mm`} fs={70} right={false} />

      {/* Right side: crockery heights */}
      <VD x={WA + 220} y1={LOFT_BOT} y2={LOFT_BOT + 465} label="465" fs={52} right={true} col="#0033bb" />
      <VD x={WA + 380} y1={LOFT_BOT} y2={LOFT_BOT + 700} label="700" fs={52} right={true} col="#0033bb" />
      <VD x={WA + 220} y1={CTR_TOP} y2={FLOOR} label={`${BASE_H}`} fs={58} right={true} />
      <VD x={WA + 380} y1={LOFT_BOT} y2={CTR_TOP} label="BACKSPLASH" fs={44} right={true} col="#888" />

      {/* Materials callout */}
      <text x={WA + MR - 30} y={LOFT_H / 2} textAnchor="end"
        fontSize={46} fontFamily="'DM Sans',sans-serif" fill={C.note} fontWeight="700">
        LAMINATE - PC140 L22 BEIGE
      </text>
      <text x={WA + MR - 30} y={LOFT_BOT + 240} textAnchor="end"
        fontSize={46} fontFamily="'DM Sans',sans-serif" fill={C.note} fontWeight="700">
        LAMINATE - PC140 L22 BEIGE
      </text>
      <text x={WA + MR - 30} y={LOFT_BOT + 560} textAnchor="end"
        fontSize={46} fontFamily="'DM Sans',sans-serif" fill="#0055aa" fontWeight="700">
        SILVER PROFILE SHUTTER WITH FLUTED GLASS
      </text>

      {/* Drawing title */}
      <text x={WA / 2} y={-MT + 90} textAnchor="middle" fontSize={88} fontWeight="900"
        fontFamily="'DM Sans',sans-serif" fill="#222">
        ELEVATION A — WALL A (LOFT + CROCKERY)
      </text>
      <text x={WA / 2} y={-MT + 170} textAnchor="middle" fontSize={56}
        fontFamily="'DM Sans',sans-serif" fill="#666">
        Project: {PI.id} · Client: {PI.client} · Scale NTS · All dims in mm
      </text>
    </svg>
  );
}

// ─── Kitchen Trolley Base Section (Section 2 — 2430mm) ───────────────────────
function BaseSection() {
  const SECTION_W = 2430;
  const CORNER_W = 760, CORNER_H = 920;
  const ML = 700, MR = 450, MT = 280, MB = 1100;
  const TOTAL_W = SECTION_W + CORNER_W + 200;
  const vb = `${-ML} ${-MT} ${TOTAL_W + ML + MR} ${CEIL + MT + MB}`;

  // Base positions
  const baseXs2: number[] = [];
  let bx2 = 0;
  for (const m of WA_BASE) { baseXs2.push(bx2); bx2 += m.w; }
  const totalBase = WA_BASE.reduce((s, m) => s + m.w, 0);

  const BY = CTR_TOP;
  const BH = BASE_H;
  const PLAN_Y = FLOOR + 400;
  const PLAN_H = 400;

  return (
    <svg viewBox={vb} style={{ width: '100%', maxHeight: '82vh', display: 'block' }}
      preserveAspectRatio="xMidYMid meet">
      <Defs />

      {/* ── ELEVATION: Corner hidden drawer unit (left) ── */}
      <rect x={-CORNER_W - 50} y={FLOOR - CORNER_H} width={CORNER_W} height={CORNER_H}
        fill="#c0ae94" stroke={C.cabBd} strokeWidth={10} />
      {/* Corner drawer lines: 290+290+272 */}
      {[290, 580].map((d, i) => (
        <line key={i} x1={-CORNER_W - 40} y1={FLOOR - CORNER_H + d} x2={-55} y2={FLOOR - CORNER_H + d}
          stroke={C.cabBd} strokeWidth={9} />
      ))}
      <line x1={-CORNER_W - 30} y1={FLOOR - CORNER_H + 50} x2={-70} y2={FLOOR - CORNER_H + 50}
        stroke="#111" strokeWidth={18} strokeLinecap="round" />
      <text x={-CORNER_W / 2 - 50} y={FLOOR - CORNER_H / 2 - 20} textAnchor="middle"
        fontSize={52} fontWeight="700" fontFamily="'JetBrains Mono',monospace" fill="#443">HIDDEN</text>
      <text x={-CORNER_W / 2 - 50} y={FLOOR - CORNER_H / 2 + 45} textAnchor="middle"
        fontSize={52} fontWeight="700" fontFamily="'JetBrains Mono',monospace" fill="#443">DRAWER</text>

      {/* Corner dimensions */}
      <HD x1={-CORNER_W - 50} x2={-50} y={FLOOR + 290} label={`${CORNER_W}`} fs={55} above={false} />
      <VD x={-CORNER_W - ML + 80} y1={FLOOR - CORNER_H} y2={FLOOR} label={String(CORNER_H)} fs={55} right={false} />

      {/* ── ELEVATION: Main base cabinets (0 to totalBase) ── */}
      {WA_BASE.map((m, i) => {
        const bxi = baseXs2[i];
        const fill = m.kind === 'td' ? '#bfae9a' : m.kind === 'spo' ? '#b0c8d0' : C.cab;
        return (
          <g key={i}>
            <rect x={bxi} y={BY} width={m.w} height={BH}
              fill={fill} stroke={C.cabBd} strokeWidth={10} />
            <rect x={bxi + 18} y={BY + 18} width={m.w - 36} height={BH - 36}
              fill="none" stroke={C.cabBd} strokeWidth={7} rx={3} />
            {m.kind === 'td' && [0.3, 0.6].map(frac => (
              <line key={frac} x1={bxi + 14} y1={BY + BH * frac} x2={bxi + m.w - 14} y2={BY + BH * frac}
                stroke={C.cabBd} strokeWidth={9} />
            ))}
            {m.kind === 'spo' && [0.25, 0.5, 0.75].map(frac => (
              <line key={frac} x1={bxi + m.w * frac} y1={BY + 18} x2={bxi + m.w * frac} y2={BY + BH - 18}
                stroke={C.glassBd} strokeWidth={8} />
            ))}
            <line x1={bxi + 18} y1={BY + 55} x2={bxi + m.w - 18} y2={BY + 55}
              stroke="#111" strokeWidth={22} strokeLinecap="round" />
            <ModLabel x={bxi} y={BY} w={m.w} h={BH} text={m.label} sub={m.note} />
            <HD x1={bxi} x2={bxi + m.w} y={FLOOR + 290} label={String(m.w)} fs={55} above={false} />
          </g>
        );
      })}

      {/* Slab */}
      <rect x={0} y={SLAB_TOP} width={totalBase} height={SLAB_H}
        fill="url(#rj-granite)" stroke="#111" strokeWidth={10} />
      {/* Kadappa */}
      <rect x={0} y={KAD_TOP} width={totalBase} height={KAD_H}
        fill={C.kad} stroke="#4a3020" strokeWidth={10} />
      <text x={totalBase / 2} y={KAD_TOP + 68} textAnchor="middle" fontSize={44}
        fontFamily="'DM Sans',sans-serif" fill="#c8a888">KADAPPA — {KAD_H}mm</text>
      {/* Floor */}
      <line x1={-CORNER_W - 80} y1={FLOOR} x2={totalBase + 80} y2={FLOOR} stroke="#111" strokeWidth={24} />

      {/* Overall base dim */}
      <HD x1={0} x2={totalBase} y={FLOOR + 520} label={`${SECTION_W} mm`} fs={72} above={false} />

      {/* Existing skirting label */}
      <text x={totalBase / 2} y={FLOOR + 200} textAnchor="middle"
        fontSize={50} fontFamily="'DM Sans',sans-serif" fill={C.note} fontWeight="700">
        EXISTING SKIRTING
      </text>
      {/* Handle callout */}
      <text x={totalBase + MR - 30} y={BY + 90} textAnchor="end"
        fontSize={48} fontFamily="'DM Sans',sans-serif" fill={C.note} fontWeight="700">
        TOP EDGE BLACK HANDLE
      </text>
      <text x={totalBase + MR - 30} y={BY + 160} textAnchor="end"
        fontSize={48} fontFamily="'DM Sans',sans-serif" fill={C.note} fontWeight="700">
        1.5 MM ACRYLIC ACSO 126
      </text>

      {/* Height dims */}
      <VD x={totalBase + 240} y1={BY} y2={FLOOR} label={String(BH)} fs={58} right={true} />
      <VD x={-ML + 70} y1={0} y2={FLOOR} label={`${CEIL}mm`} fs={70} right={false} />

      {/* ── PLAN VIEW (below elevation) ── */}
      <text x={SECTION_W / 2} y={PLAN_Y - 80} textAnchor="middle"
        fontSize={70} fontWeight="800" fontFamily="'DM Sans',sans-serif" fill="#222">
        PLAN
      </text>
      {/* Plan outline */}
      <rect x={0} y={PLAN_Y} width={SECTION_W} height={BASE_DEPTH}
        fill="#f0ece6" stroke="#444" strokeWidth={14} />
      {/* Wall line */}
      <line x1={0} y1={PLAN_Y} x2={SECTION_W} y2={PLAN_Y} stroke="#111" strokeWidth={20} />
      {/* Corner return (perpendicular, shown in plan) */}
      <rect x={-CORNER_W - 50} y={PLAN_Y} width={CORNER_W} height={BASE_DEPTH}
        fill="#e8e0d0" stroke="#444" strokeWidth={14} />
      {/* Module dividers in plan */}
      {baseXs2.slice(1).map((x2, i) => (
        <line key={i} x1={x2} y1={PLAN_Y + 14} x2={x2} y2={PLAN_Y + BASE_DEPTH - 14}
          stroke="#888" strokeWidth={8} />
      ))}
      {/* Plan dimensions */}
      <HD x1={0} x2={SECTION_W} y={PLAN_Y + BASE_DEPTH + 220} label={`${SECTION_W}`} fs={65} above={false} />
      <VD x={-CORNER_W - ML + 90} y1={PLAN_Y} y2={PLAN_Y + BASE_DEPTH} label={String(BASE_DEPTH)} fs={60} right={false} />
      {/* HETTICH label */}
      <text x={SECTION_W / 2} y={PLAN_Y + BASE_DEPTH / 2 + 30} textAnchor="middle"
        fontSize={75} fontWeight="800" fontFamily="'DM Sans',sans-serif" fill="#b8c8d0" opacity={0.7}>
        HETTICH TENDAM KITCHEN
      </text>

      {/* Title */}
      <text x={SECTION_W / 2} y={-MT + 90} textAnchor="middle" fontSize={88} fontWeight="900"
        fontFamily="'DM Sans',sans-serif" fill="#222">
        KITCHEN TROLLEY SHUTTER — BASE (SECTION 2)
      </text>
      <text x={SECTION_W / 2} y={-MT + 165} textAnchor="middle" fontSize={52}
        fontFamily="'DM Sans',sans-serif" fill="#666">
        Project: {PI.id} · Client: {PI.client} · All dims in mm
      </text>
    </svg>
  );
}

// ─── Elevation B (Wall B = 2560mm — Storage + Rolling Shutter) ───────────────
function ElevationB() {
  const ML = 700, MR = 500, MT = 280, MB = 850;
  const vb = `${-ML} ${-MT} ${WB + ML + MR} ${CEIL + MT + MB}`;

  // Compute section x-positions
  const secXs: number[] = [];
  let sx = 0;
  for (const s of WB_SECS) { secXs.push(sx); sx += s.w; }

  // Wall B heights
  const KICK = SKIRT_H;             // 70mm kickboard
  const KICK_TOP = FLOOR - KICK;    // 2680
  const WB_BASE_TOP = KICK_TOP - 940; // base top (940mm base height for Wall B) = 1740
  // Loft positions same
  // Rolling shutter: from kickboard to 2185mm above it
  const ROLL_TOP = KICK_TOP - 2185; // y = 2680 - 2185 = 495

  return (
    <svg viewBox={vb} style={{ width: '100%', maxHeight: '82vh', display: 'block' }}
      preserveAspectRatio="xMidYMid meet">
      <Defs />

      {/* Background wall */}
      <rect x={0} y={0} width={WB} height={CEIL} fill={C.wallBg} />
      <line x1={-80} y1={0} x2={WB + 80} y2={0} stroke="#999" strokeWidth={10} strokeDasharray="100 50" />
      <line x1={-80} y1={FLOOR} x2={WB + 80} y2={FLOOR} stroke="#111" strokeWidth={24} />
      <line x1={0} y1={0} x2={0} y2={FLOOR} stroke="#444" strokeWidth={20} />
      <line x1={WB} y1={0} x2={WB} y2={FLOOR} stroke="#444" strokeWidth={20} />

      {/* ── LOFT BOX (Wall B, 400mm, 6 panels of 424mm) ── */}
      <rect x={0} y={0} width={WB} height={LOFT_H} fill={C.cab} stroke={C.cabBd} strokeWidth={12} />
      {[1, 2, 3, 4, 5].map(i => (
        <line key={i} x1={i * 424} y1={10} x2={i * 424} y2={LOFT_H - 10}
          stroke={C.cabBd} strokeWidth={9} />
      ))}
      <text x={WB / 2} y={LOFT_H / 2 - 40} textAnchor="middle"
        fontSize={68} fontWeight="900" fontFamily="'JetBrains Mono',monospace" fill="#443">
        LOFT BOX — PC140 L22 Beige
      </text>
      <text x={WB / 2} y={LOFT_H / 2 + 32} textAnchor="middle"
        fontSize={52} fontFamily="'DM Sans',sans-serif" fill="#665">
        6 panels × 424 mm = 2544 mm
      </text>
      <HD x1={0} x2={WB} y={-170} label={`${WB} mm`} fs={80} above={true} />

      {/* ── SECTION DETAILS (below loft) ── */}
      {WB_SECS.map((s, i) => {
        const x1 = secXs[i];
        const isRoll = s.kind === 'roll';
        const isFridge = s.kind === 'fridge';
        const isOpen = s.kind === 'open';
        const isTall = s.kind === 'tall';

        return (
          <g key={i}>
            {/* Rolling shutter column */}
            {isRoll && (
              <>
                <rect x={x1} y={ROLL_TOP} width={s.w} height={2185}
                  fill="url(#rj-roll)" stroke="#111" strokeWidth={14} />
                <text x={x1 + s.w / 2} y={ROLL_TOP + 1092} textAnchor="middle"
                  fontSize={58} fontWeight="800" fontFamily="'JetBrains Mono',monospace" fill="#ccc"
                  transform={`rotate(-90,${x1 + s.w / 2},${ROLL_TOP + 1092})`}>
                  BLACK ROLLING SHUTTER
                </text>
              </>
            )}

            {/* Refrigerator */}
            {isFridge && (
              <>
                <rect x={x1} y={LOFT_BOT} width={s.w} height={FLOOR - LOFT_BOT}
                  fill={C.fridge} stroke="#8ab0c0" strokeWidth={12} />
                {/* Fridge handle */}
                <line x1={x1 + s.w * 0.2} y1={LOFT_BOT + 200}
                  x2={x1 + s.w * 0.2} y2={LOFT_BOT + 700}
                  stroke="#555" strokeWidth={24} strokeLinecap="round" />
                <line x1={x1 + s.w * 0.2} y1={LOFT_BOT + 900}
                  x2={x1 + s.w * 0.2} y2={LOFT_BOT + 1500}
                  stroke="#555" strokeWidth={24} strokeLinecap="round" />
                <text x={x1 + s.w / 2} y={CEIL / 2} textAnchor="middle"
                  fontSize={52} fontWeight="700" fontFamily="'DM Sans',sans-serif" fill="#336">
                  FRIDGE
                </text>
              </>
            )}

            {/* Tall cabinet (left section) */}
            {isTall && (
              <>
                {/* Upper cabinet zone */}
                <rect x={x1} y={LOFT_BOT} width={s.w} height={600}
                  fill={C.cab} stroke={C.cabBd} strokeWidth={10} />
                <rect x={x1 + 18} y={LOFT_BOT + 18} width={s.w - 36} height={564}
                  fill="none" stroke={C.cabBd} strokeWidth={7} rx={3} />
                <line x1={x1 + 20} y1={LOFT_BOT + 55} x2={x1 + s.w - 20} y2={LOFT_BOT + 55}
                  stroke="#111" strokeWidth={18} strokeLinecap="round" />
                <ModLabel x={x1} y={LOFT_BOT} w={s.w} h={600} text="WC-01" sub="PC140 L22 Beige" />
                {/* Lower wall (marble) */}
                <rect x={x1} y={LOFT_BOT + 600} width={s.w} height={WB_BASE_TOP - LOFT_BOT - 600}
                  fill="url(#rj-marble)" />
                {/* Base cabinet */}
                <rect x={x1} y={WB_BASE_TOP} width={s.w} height={940}
                  fill={C.cab} stroke={C.cabBd} strokeWidth={10} />
                <rect x={x1 + 18} y={WB_BASE_TOP + 18} width={s.w - 36} height={904}
                  fill="none" stroke={C.cabBd} strokeWidth={7} rx={3} />
                <line x1={x1 + 18} y1={WB_BASE_TOP + 55} x2={x1 + s.w - 18} y2={WB_BASE_TOP + 55}
                  stroke="#111" strokeWidth={18} strokeLinecap="round" />
                <ModLabel x={x1} y={WB_BASE_TOP} w={s.w} h={940} text="B-04" sub="PC140 L22 Beige" />
              </>
            )}

            {/* Open shelves */}
            {isOpen && (
              <>
                {/* Upper crockery cabinets (2 × 298mm) */}
                {[0, 298].map((ox2, j) => (
                  <g key={j}>
                    <rect x={x1 + ox2} y={LOFT_BOT} width={298} height={700}
                      fill={C.cab} stroke={C.cabBd} strokeWidth={10} />
                    <rect x={x1 + ox2 + 18} y={LOFT_BOT + 18} width={262} height={664}
                      fill="none" stroke={C.cabBd} strokeWidth={7} rx={3} />
                    <line x1={x1 + ox2 + 18} y1={LOFT_BOT + 55} x2={x1 + ox2 + 280} y2={LOFT_BOT + 55}
                      stroke="#111" strokeWidth={16} strokeLinecap="round" />
                    <ModLabel x={x1 + ox2} y={LOFT_BOT} w={298} h={700} text={`CK-0${5 + j}`} fs={44} />
                  </g>
                ))}
                {/* Small top right cabinet (330mm high) */}
                <rect x={x1 + 596} y={LOFT_BOT} width={9} height={FLOOR - LOFT_BOT}
                  fill={C.cab} /> {/* filler */}
                {/* Marble backsplash */}
                <rect x={x1} y={LOFT_BOT + 700} width={605} height={WB_BASE_TOP - LOFT_BOT - 700}
                  fill="url(#rj-marble)" />
                {/* Open shelf base */}
                <rect x={x1} y={WB_BASE_TOP} width={605} height={940}
                  fill="#e4eef0" stroke="#88aab0" strokeWidth={10} />
                {/* Shelf horizontal lines */}
                {[0.28, 0.55, 0.78].map(frac => (
                  <line key={frac} x1={x1 + 20} y1={WB_BASE_TOP + 940 * frac}
                    x2={x1 + 585} y2={WB_BASE_TOP + 940 * frac}
                    stroke="#88aab0" strokeWidth={8} />
                ))}
                <text x={x1 + 302} y={WB_BASE_TOP + 470 + 22} textAnchor="middle"
                  fontSize={52} fontWeight="700" fontFamily="'JetBrains Mono',monospace"
                  fill="#336">OPEN SHELF</text>
                {/* Width dims for crockery */}
                <HD x1={x1} x2={x1 + 298} y={LOFT_BOT + 760} label="298" fs={50} col={C.dim} />
                <HD x1={x1 + 298} x2={x1 + 596} y={LOFT_BOT + 760} label="298" fs={50} col={C.dim} />
              </>
            )}

            {/* Bottom width dimension */}
            <HD x1={x1} x2={x1 + s.w} y={FLOOR + 290} label={String(s.w)} fs={58} above={false} />
          </g>
        );
      })}

      {/* ── KICKBOARD / SKIRTING ── */}
      <rect x={0} y={KICK_TOP} width={WB} height={KICK}
        fill={C.skirt} stroke="#111" strokeWidth={8} />
      <text x={WB / 2} y={KICK_TOP + 52} textAnchor="middle"
        fontSize={42} fontFamily="'DM Sans',sans-serif" fill="#888">KICKBOARD — {KICK}mm</text>

      {/* ── DIMENSION ANNOTATIONS ── */}
      {/* Overall width */}
      <HD x1={0} x2={WB} y={FLOOR + 520} label={`${WB} mm`} fs={80} above={false} />

      {/* Left side vertical */}
      <VD x={-ML + 70} y1={0} y2={FLOOR} label={`${CEIL}mm`} fs={70} right={false} />
      <VD x={-ML + 70} y1={0} y2={LOFT_BOT} label={String(LOFT_H)} fs={60} right={false} />

      {/* Right side: rolling shutter height */}
      <VD x={WB + 240} y1={ROLL_TOP} y2={KICK_TOP} label="2185" fs={58} right={true} />
      <VD x={WB + 240} y1={WB_BASE_TOP} y2={KICK_TOP} label="940" fs={55} right={true} />
      <VD x={WB + 410} y1={LOFT_BOT} y2={LOFT_BOT + 600} label="600" fs={50} right={true} col="#0033bb" />
      <VD x={WB + 410} y1={LOFT_BOT} y2={LOFT_BOT + 700} label="700" fs={50} right={true} col="#0033bb" />

      {/* Loft width dim */}
      <HD x1={0} x2={424} y={-160} label="424" fs={52} col={C.dim} />

      {/* Materials callouts */}
      <text x={WB + MR - 30} y={LOFT_H / 2 + 20} textAnchor="end"
        fontSize={46} fontFamily="'DM Sans',sans-serif" fill={C.note} fontWeight="700">
        LAMINATE - PC140 L22 BEIGE
      </text>
      <text x={WB + MR - 30} y={LOFT_BOT + 360} textAnchor="end"
        fontSize={46} fontFamily="'DM Sans',sans-serif" fill={C.note} fontWeight="700">
        1.5 MM ACRYLIC ACSO 126
      </text>
      <text x={WB + MR - 30} y={LOFT_BOT + 450} textAnchor="end"
        fontSize={46} fontFamily="'DM Sans',sans-serif" fill={C.note} fontWeight="700">
        1.5 MM ACRYLIC ACSO 126
      </text>

      {/* Title */}
      <text x={WB / 2} y={-MT + 90} textAnchor="middle" fontSize={88} fontWeight="900"
        fontFamily="'DM Sans',sans-serif" fill="#222">
        ELEVATION B — WALL B (LOFT + STORAGE + ROLLING SHUTTER)
      </text>
      <text x={WB / 2} y={-MT + 165} textAnchor="middle" fontSize={52}
        fontFamily="'DM Sans',sans-serif" fill="#666">
        Project: {PI.id} · Client: {PI.client} · Scale NTS · All dims in mm
      </text>
    </svg>
  );
}

// ─── Plan View ─────────────────────────────────────────────────────────────────
function PlanLocal() {
  const WALL_T = 150;
  const PL = 800, PR = 600, PT = 600, PB = 800;
  const vb = `${-PL} ${-PT} ${WA + WALL_T + PL + PR} ${WB + WALL_T + PT + PB}`;

  const CAB_DEPTH = BASE_DEPTH;   // 985mm depth for Wall A cabs
  const WB_CAB_D = WB_DEPTH;      // 940mm depth for Wall B cabs

  return (
    <svg viewBox={vb} style={{ width: '100%', maxHeight: '82vh', display: 'block' }}
      preserveAspectRatio="xMidYMid meet">
      <Defs />

      {/* Floor background */}
      <rect x={-100} y={-100} width={WA + WALL_T + 200} height={WB + WALL_T + 200}
        fill="#f8f8f6" />

      {/* ── WALLS ── */}
      {/* Wall A (horizontal back wall) */}
      <rect x={0} y={-WALL_T} width={WA} height={WALL_T} fill="#ccc" stroke="#444" strokeWidth={14} />
      {/* Wall B (vertical side wall, right) */}
      <rect x={WA} y={-WALL_T} width={WALL_T} height={WB + WALL_T} fill="#ccc" stroke="#444" strokeWidth={14} />
      {/* Left opening wall (short section) */}
      <rect x={0} y={0} width={WALL_T} height={WB} fill="#ccc" stroke="#444" strokeWidth={14} />

      {/* ── WALL A BASE CABINET FOOTPRINT ── */}
      {/* Counter along Wall A (depth = 985mm from wall) */}
      <rect x={BASE_X0} y={0} width={WA - BASE_X0} height={CAB_DEPTH}
        fill={C.cab} stroke={C.cabBd} strokeWidth={10} opacity={0.85} />
      {/* Module dividers */}
      {(() => {
        const xs: number[] = [];
        let x = BASE_X0;
        for (const m of WA_BASE) { xs.push(x); x += m.w; }
        return xs.slice(1).map((x2, i) => (
          <line key={i} x1={x2} y1={10} x2={x2} y2={CAB_DEPTH - 10}
            stroke={C.cabBd} strokeWidth={8} />
        ));
      })()}
      {/* Counter front edge (thick line) */}
      <line x1={BASE_X0} y1={CAB_DEPTH} x2={WA} y2={CAB_DEPTH}
        stroke="#333" strokeWidth={18} />
      {/* Counter depth dim */}
      <VD x={-250} y1={0} y2={CAB_DEPTH} label={String(CAB_DEPTH)} fs={60} right={false} />

      {/* ── CORNER RETURN (760mm perpendicular piece) ── */}
      <rect x={BASE_X0 - 760} y={0} width={760} height={CAB_DEPTH}
        fill="#c8b8a0" stroke={C.cabBd} strokeWidth={10} opacity={0.85} />
      <line x1={BASE_X0 - 760} y1={CAB_DEPTH} x2={BASE_X0} y2={CAB_DEPTH}
        stroke="#333" strokeWidth={18} />

      {/* ── WALL B CABINET FOOTPRINT (along right side wall) ── */}
      <rect x={WA - WB_CAB_D} y={0} width={WB_CAB_D} height={WB}
        fill="#b0c0c8" stroke="#6090a0" strokeWidth={10} opacity={0.85} />
      {/* Dividers for Wall B sections */}
      {(() => {
        let y = 0;
        const lines: number[] = [];
        for (const s of WB_SECS.slice(0, -1)) { y += s.w; lines.push(y); }
        return lines.map((y2, i) => (
          <line key={i} x1={WA - WB_CAB_D + 10} y1={y2} x2={WA - 10} y2={y2}
            stroke="#6090a0" strokeWidth={8} />
        ));
      })()}
      <line x1={WA - WB_CAB_D} y1={0} x2={WA - WB_CAB_D} y2={WB}
        stroke="#333" strokeWidth={18} />
      {/* Wall B depth dim */}
      <HD x1={WA - WB_CAB_D} x2={WA} y={WB + 220} label={String(WB_CAB_D)} fs={60} above={false} />

      {/* ── PLAN DIMENSIONS ── */}
      {/* Wall A length */}
      <HD x1={0} x2={WA} y={-WALL_T - 200} label={`${WA} mm`} fs={72} above={true} />
      {/* Wall B length */}
      <VD x={WA + WALL_T + 250} y1={0} y2={WB} label={`${WB} mm`} fs={72} right={true} />
      {/* Base start */}
      <HD x1={0} x2={BASE_X0} y={CAB_DEPTH + 220} label={String(BASE_X0)} fs={55} above={false} col="#777" />
      {/* Base run */}
      <HD x1={BASE_X0} x2={WA} y={CAB_DEPTH + 220} label="2357" fs={55} above={false} />

      {/* ── NORTH ARROW ── */}
      <g transform={`translate(${-PL + 180}, ${-PT + 180})`}>
        <circle r={80} fill="white" stroke="#333" strokeWidth={8} />
        <text x={0} y={-95} textAnchor="middle" fontSize={80} fontWeight="900" fill="#333">N</text>
        <line x1={0} y1={70} x2={0} y2={-60} stroke="#cc2200" strokeWidth={14} />
        <polygon points="0,-60 -18,10 18,10" fill="#cc2200" />
      </g>

      {/* Title */}
      <text x={WA / 2} y={-PT + 90} textAnchor="middle" fontSize={88} fontWeight="900"
        fontFamily="'DM Sans',sans-serif" fill="#222">
        KITCHEN PLAN — TOP VIEW
      </text>
      <text x={WA / 2} y={-PT + 170} textAnchor="middle" fontSize={52}
        fontFamily="'DM Sans',sans-serif" fill="#666">
        Project: {PI.id} · Client: {PI.client} · Scale NTS · All dims in mm
      </text>

      {/* Legend */}
      {[
        { fill: C.cab, label: 'Base / Wall Cabinets (Olivilya N0000)' },
        { fill: '#b0c0c8', label: 'Wall B Storage Unit' },
        { fill: '#c8b8a0', label: 'Corner Return Unit' },
        { fill: '#ccc', label: 'RCC Walls' },
      ].map((item, i) => (
        <g key={i} transform={`translate(${-PL + 30}, ${WB + PB - 280 + i * 110})`}>
          <rect width={80} height={80} fill={item.fill} stroke="#888" strokeWidth={6} rx={6} />
          <text x={100} y={58} fontSize={52} fontFamily="'DM Sans',sans-serif" fill="#333">{item.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
type Tab = 'elev-a' | 'base-a' | 'elev-b' | 'plan';

const TABS: { id: Tab; label: string }[] = [
  { id: 'elev-a', label: 'Elevation A — Loft + Crockery (3085mm)' },
  { id: 'base-a', label: 'Kitchen Trolley Base (2430mm)' },
  { id: 'elev-b', label: 'Elevation B — Storage Wall (2560mm)' },
  { id: 'plan',   label: 'Plan View (L-Shape)' },
];

export const RutujaDrawing: React.FC<{ onBack?: () => void; initialTab?: Tab }> = ({ onBack, initialTab = 'plan' }) => {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d1117', fontFamily: "'DM Sans',sans-serif" }}>

      {/* ── Project Header ── */}
      <div style={{ background: '#131920', borderBottom: '1px solid #243045', padding: '14px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          {onBack && (
            <button onClick={onBack}
              style={{ padding: '6px 16px', borderRadius: 8, background: '#1a2233', color: '#94a3b8', border: '1px solid #243045', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
              ← Back
            </button>
          )}
          <div style={{ fontSize: 18, fontWeight: 900, color: '#e2e8f0' }}>
            SmartMeasure <span style={{ color: '#3b82f6' }}>CAD</span>
          </div>
          <span style={{ padding: '3px 10px', borderRadius: 6, background: '#1a3a2a', color: '#6ee7b7', border: '1px solid #065f46', fontSize: 11, fontWeight: 700 }}>
            DEMO — BEST KITCHENNET PROJECT
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#4a5f7a' }}>
            {PI.id}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px 16px', fontSize: 12 }}>
          {[
            ['CLIENT', PI.client],
            ['DESIGNED BY', PI.by],
            ['EXECUTIVE', `${PI.exec} · ${PI.execMo}`],
            ['DATE', PI.date],
            ['KITCHEN TYPE', PI.type],
            ['WALL A', '3085 mm'],
            ['WALL B', '2560 mm'],
            ['CEILING', '2750 mm'],
          ].map(([k, v]) => (
            <div key={k}>
              <span style={{ color: '#4a5f7a', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{k}: </span>
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
          FINISH: {PI.finish} · COUNTER: Black Granite · HARDWARE: Top-Edge Black Handle (Hettich)
          · Fluted Glass Crockery Unit · Rolling Shutter Storage · ACSO 126 Acrylic 1.5mm
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #243045', background: '#131920', flexShrink: 0, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '11px 18px', fontSize: 12, fontWeight: 700,
              background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              borderBottom: tab === t.id ? '2.5px solid #3b82f6' : '2.5px solid transparent',
              color: tab === t.id ? '#60a5fa' : '#4a5f7a',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Drawing Canvas ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16, background: '#0d1117' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #243045', overflow: 'hidden', minHeight: 500 }}>
          {tab === 'elev-a' && <ElevationA />}
          {tab === 'base-a' && <BaseSection />}
          {tab === 'elev-b' && <ElevationB />}
          {tab === 'plan'   && <PlanLocal />}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ borderTop: '1px solid #243045', padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: '#3d4f6a', fontFamily: "'JetBrains Mono',monospace" }}>
          Best Kitchennet · {PI.brand} · {PI.id} · Designed by {PI.by} · All measurements from client PDF
        </span>
        <span style={{ fontSize: 11, color: '#cc2200', fontWeight: 700 }}>
          ⚠ DEMO DRAWING — All dimensions from supplied PDF · Verify on site before fabrication
        </span>
      </div>
    </div>
  );
};

export default RutujaDrawing;
