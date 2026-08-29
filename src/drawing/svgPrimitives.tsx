import React from 'react';

// All SVG units are in mm. The viewBox is set in mm so 1 SVG unit = 1 mm.
// Marker sizes use markerUnits="userSpaceOnUse" so they scale with the drawing.

// ─── Arrow marker (mm-scale) ──────────────────────────────────────────────────
export const DimArrow = ({ id, color = '#1a1a1a', size = 60 }: { id: string; color?: string; size?: number }) => (
  <marker
    id={id}
    markerUnits="userSpaceOnUse"
    markerWidth={size * 1.4}
    markerHeight={size}
    refX={size * 1.35}
    refY={size / 2}
    orient="auto"
  >
    <path d={`M 0 0 L ${size * 1.4} ${size / 2} L 0 ${size} L ${size * 0.22} ${size / 2} Z`} fill={color} />
  </marker>
);

// ─── Horizontal dimension ──────────────────────────────────────────────────────
interface HDimProps {
  x1: number; x2: number; y: number; label: string;
  color?: string; fontSize?: number; tickLen?: number; mid?: string;
}
export const HDim: React.FC<HDimProps> = ({ x1, x2, y, label, color = '#1a1a1a', fontSize = 72, tickLen = 50 }) => {
  const cx = (x1 + x2) / 2;
  const w = x2 - x1;
  if (w < 10) return null;
  const bgW = fontSize * label.length * 0.62;
  return (
    <g>
      {/* Tick marks */}
      <line x1={x1} y1={y - tickLen * 0.6} x2={x1} y2={y + tickLen * 0.6} stroke={color} strokeWidth={6} />
      <line x1={x2} y1={y - tickLen * 0.6} x2={x2} y2={y + tickLen * 0.6} stroke={color} strokeWidth={6} />
      {/* Dimension line */}
      <line x1={x1} y1={y} x2={x2} y2={y}
        stroke={color} strokeWidth={7}
        markerStart="url(#dimArr)" markerEnd="url(#dimArr)"
      />
      {/* Label background + text */}
      <rect x={cx - bgW / 2} y={y - fontSize * 0.92} width={bgW} height={fontSize * 1.15} fill="white" opacity={0.92} />
      <text x={cx} y={y + fontSize * 0.2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={fontSize} fontWeight="600"
        fontFamily="'JetBrains Mono', monospace" fill={color}
      >{label}</text>
    </g>
  );
};

// ─── Vertical dimension ────────────────────────────────────────────────────────
interface VDimProps {
  x: number; y1: number; y2: number; label: string;
  color?: string; fontSize?: number; tickLen?: number;
}
export const VDim: React.FC<VDimProps> = ({ x, y1, y2, label, color = '#1a1a1a', fontSize = 72, tickLen = 50 }) => {
  const cy = (y1 + y2) / 2;
  const h = Math.abs(y2 - y1);
  if (h < 10) return null;
  const bgW = fontSize * label.length * 0.62;
  return (
    <g>
      <line x1={x - tickLen * 0.6} y1={y1} x2={x + tickLen * 0.6} y2={y1} stroke={color} strokeWidth={6} />
      <line x1={x - tickLen * 0.6} y1={y2} x2={x + tickLen * 0.6} y2={y2} stroke={color} strokeWidth={6} />
      <line x1={x} y1={y1} x2={x} y2={y2}
        stroke={color} strokeWidth={7}
        markerStart="url(#dimArr)" markerEnd="url(#dimArr)"
      />
      <g transform={`rotate(-90, ${x - fontSize * 0.6}, ${cy})`}>
        <rect x={x - fontSize * 0.6 - bgW / 2} y={cy - fontSize * 0.92} width={bgW} height={fontSize * 1.15} fill="white" opacity={0.92} />
        <text x={x - fontSize * 0.6} y={cy + fontSize * 0.2}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={fontSize} fontWeight="600"
          fontFamily="'JetBrains Mono', monospace" fill={color}
        >{label}</text>
      </g>
    </g>
  );
};

// ─── Diagonal hatch fill (for walls, kadappa) ─────────────────────────────────
export const HatchPattern = ({ id, color = '#c8b99a', bg = '#e8ddd0', spacing = 60, angle = 45 }: {
  id: string; color?: string; bg?: string; spacing?: number; angle?: number;
}) => (
  <pattern id={id} patternUnits="userSpaceOnUse" width={spacing} height={spacing} patternTransform={`rotate(${angle})`}>
    <rect width={spacing} height={spacing} fill={bg} />
    <line x1={0} y1={0} x2={0} y2={spacing} stroke={color} strokeWidth={8} />
  </pattern>
);

// ─── Wood grain (subtle carcass/panel texture, mm-scale) ─────────────────────
export const WoodGrainPattern = ({ id, base = '#f8fafc' }: { id: string; base?: string }) => (
  <pattern id={id} patternUnits="userSpaceOnUse" width={220} height={220}>
    <rect width={220} height={220} fill={base} />
    <line x1={0} y1={55} x2={220} y2={55} stroke="#00000010" strokeWidth={5} />
    <line x1={0} y1={140} x2={220} y2={140} stroke="#00000010" strokeWidth={4} />
  </pattern>
);

// ─── Wall hatch (cross-hatch for cut walls in section/plan) ──────────────────
export const WallHatch = ({ id }: { id: string }) => (
  <pattern id={id} patternUnits="userSpaceOnUse" width={80} height={80} patternTransform="rotate(45)">
    <rect width={80} height={80} fill="#c8cdd6" />
    <line x1={0} y1={0} x2={0} y2={80} stroke="#a0a8b4" strokeWidth={10} />
  </pattern>
);

// ─── Cabinet handle — D-pull vertical (for base cabinets) ────────────────────
export const DPullVertical = ({ cx, y, length = 130, color = '#555' }: {
  cx: number; y: number; length?: number; color?: string;
}) => (
  <g>
    <rect x={cx - 13} y={y} width={26} height={length} rx={10} fill={color} opacity={0.85} />
  </g>
);

// ─── Cabinet handle — bar horizontal (for wall cabinets) ─────────────────────
export const BarHandleH = ({ cx, y, length = 140, color = '#555' }: {
  cx: number; y: number; length?: number; color?: string;
}) => (
  <g>
    <rect x={cx - length / 2} y={y - 10} width={length} height={20} rx={9} fill={color} opacity={0.85} />
  </g>
);

// ─── Cabinet handle — round knob (for loft) ──────────────────────────────────
export const Knob = ({ cx, cy, r = 22, color = '#666' }: {
  cx: number; cy: number; r?: number; color?: string;
}) => (
  <circle cx={cx} cy={cy} r={r} fill={color} opacity={0.75} />
);

// ─── Horizontal wall section (plan view wall fill) ───────────────────────────
export const WallSection = ({ x, y, width, height, id }: {
  x: number; y: number; width: number; height: number; id: string;
}) => (
  <g>
    <defs><WallHatch id={id} /></defs>
    <rect x={x} y={y} width={width} height={height} fill={`url(#${id})`} stroke="#555" strokeWidth={12} />
  </g>
);

// ─── View title block ─────────────────────────────────────────────────────────
export const ViewTitle = ({ x, y, title, sub, fs = 80 }: {
  x: number; y: number; title: string; sub?: string; fs?: number;
}) => (
  <g>
    <text x={x} y={y} fontSize={fs} fontWeight="700" fontFamily="'DM Sans', sans-serif" fill="#111">{title}</text>
    {sub && <text x={x} y={y + fs * 1.3} fontSize={fs * 0.62} fontFamily="'DM Sans', sans-serif" fill="#666">{sub}</text>}
  </g>
);

// ─── Shared SVG defs (must be included once per drawing SVG) ─────────────────
export const DrawingDefs = ({ arrowColor = '#1a1a1a' }: { arrowColor?: string }) => (
  <defs>
    <DimArrow id="dimArr" color={arrowColor} size={58} />
    <DimArrow id="dimArrBlue" color="#3b82f6" size={52} />
    <DimArrow id="dimArrGray" color="#888" size={48} />
    <HatchPattern id="kadappaHatch" color="#c8a880" bg="#e8dfd4" />
    <HatchPattern id="wallHatch" color="#9aa0ae" bg="#c8cdd6" spacing={70} angle={45} />
    <pattern id="counterFill" patternUnits="userSpaceOnUse" width={120} height={120} patternTransform="rotate(30)">
      <rect width={120} height={120} fill="#8b9097" />
      <line x1={0} y1={0} x2={0} y2={120} stroke="#737980" strokeWidth={14} />
    </pattern>
    <WoodGrainPattern id="grainBase" base="#f8fafc" />
    <WoodGrainPattern id="grainWall" base="#f7f8fa" />
    <WoodGrainPattern id="grainLoft" base="#f4f4f1" />
    <WoodGrainPattern id="grainTrolley" base="#fffbeb" />
    <WoodGrainPattern id="grainOpenBox" base="#f0fdf4" />
  </defs>
);
