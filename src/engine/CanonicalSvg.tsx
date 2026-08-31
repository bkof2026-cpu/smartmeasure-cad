import React from 'react';
import type { AnnotationLine, ComponentSpec, DimensionLine } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Shared SVG primitives used by every product's technical drawing renderer.
// World coordinates are millimetres; this file owns the world -> viewport
// scale so every product fits-to-page consistently and never distorts
// proportions. Visual language (colors, fonts, arrow markers) matches the
// existing hand-authored drawings in src/products/productRegistry.tsx so the
// app's look stays consistent while the geometry underneath becomes real.
//
// Everything below operates in already-scaled viewport pixels (not a nested
// SVG <g transform="scale(...)">) so stroke widths and font sizes stay a
// constant, legible size on screen regardless of how large the real
// furniture is — a 2400mm wardrobe and a 500mm side table both get readable
// 8px dimension labels.
// ─────────────────────────────────────────────────────────────────────────────

const DIM_COLOR = '#cc2200';
const DIM_TIER_STEP_PX = 18; // viewport px of offset per collision tier
const PAD = 60; // viewport px padding for dimension lines + labels

export interface ComponentStyle {
  fill: string;
  stroke: string;
  strokeWidth?: number;
}

// Line-weight hierarchy, matching real technical-drawing convention: outer
// carcass boundary heaviest, internal partitions/shelves medium, trim/fixed
// hardware thin — never uniform, which is what read as "CAD box" flat.
const DEFAULT_STYLE: ComponentStyle = { fill: '#f0eee8', stroke: '#333', strokeWidth: 1 };

function defaultStyleFor(c: ComponentSpec): ComponentStyle {
  const t = c.type.toUpperCase();
  if (t.includes('DOOR') || t.includes('SHUTTER') || t.includes('FACIA')) return { fill: '#eee9e0', stroke: '#777', strokeWidth: 1.1 };
  if (t.includes('MIRROR')) return { fill: '#dbe9f5', stroke: '#5b7c99', strokeWidth: 1 };
  if (t.includes('BACK')) return { fill: '#e5ded2', stroke: '#aaa', strokeWidth: 0.5 };
  if (t.includes('DRAWER')) return { fill: '#ece8e0', stroke: '#777', strokeWidth: 0.9 };
  if (t.includes('HEAD_BOARD') || t.includes('HEADBOARD')) return { fill: '#d9c8ab', stroke: '#8a6d3b', strokeWidth: 1.5 };
  if (t.includes('SELF') || t.includes('SHELF')) return { fill: '#ddd', stroke: '#999', strokeWidth: 0.6 };
  if (t.includes('PATTI') || t.includes('SKIRT') || t.includes('SCRTING') || t.includes('PLINTH')) return { fill: '#c8c0a8', stroke: '#888', strokeWidth: 0.7 };
  if (t.includes('MATTRESS')) return { fill: '#ede5f5', stroke: '#999', strokeWidth: 0.6 };
  if (t.includes('TRACK')) return { fill: '#bbb', stroke: '#888', strokeWidth: 0.7 };
  if (t.includes('NICHE')) return { fill: '#f8f8f6', stroke: '#94a3b8', strokeWidth: 0.7 };
  if (t.includes('TOP_PANEL') || t.includes('BOTTOM_PANEL') || t.includes('SIDE_PANEL') || t.includes('PLATFORM')) return { fill: 'url(#canon-grain)', stroke: '#2a2a2a', strokeWidth: 1.5 };
  if (t.includes('VERTICAL_PARTITION')) return { fill: 'url(#canon-grain)', stroke: '#555', strokeWidth: 0.8 };
  if (t.includes('CARCASS')) return { fill: 'url(#canon-grain)', stroke: '#2a2a2a', strokeWidth: 1.5 };
  return DEFAULT_STYLE;
}

/** Does this component get a drawn handle (real door/drawer pull, not a label)? */
function isPullType(type: string): boolean {
  const t = type.toUpperCase();
  return (t.includes('DOOR') || t.includes('SHUTTER') || t.includes('FACIA') || t.includes('DRAWER_FRONT')) && !t.includes('SLIDING');
}

export function fitScale(worldWidth: number, worldHeight: number, maxVw: number, maxVh: number): number {
  return Math.min(maxVw / Math.max(worldWidth, 1), maxVh / Math.max(worldHeight, 1));
}

interface Px { x1: number; y1: number; x2: number; y2: number; }

function toPx(d: DimensionLine, ox: number, oy: number, scale: number): Px {
  return { x1: ox + d.x1 * scale, y1: oy + d.y1 * scale, x2: ox + d.x2 * scale, y2: oy + d.y2 * scale };
}

function DimensionMarkers() {
  return (
    <marker id="canon-arrow" markerWidth={7} markerHeight={7} refX={3.5} refY={3.5} orient="auto">
      <path d="M7,0 L7,7 L0,3.5 z" fill={DIM_COLOR} />
    </marker>
  );
}

/** Subtle wood-grain fill for carcass/panel components — a technical hint of material, not decoration. */
function GrainPattern() {
  return (
    <pattern id="canon-grain" width={10} height={10} patternUnits="userSpaceOnUse">
      <rect width={10} height={10} fill="#f2ede1" />
      <line x1={0} y1={2.5} x2={10} y2={2.5} stroke="#e2d9c4" strokeWidth={0.6} />
      <line x1={0} y1={6.5} x2={10} y2={6.5} stroke="#e2d9c4" strokeWidth={0.4} />
    </pattern>
  );
}

function DimensionLineView({ d, ox, oy, scale, onSelect }: { d: DimensionLine; ox: number; oy: number; scale: number; onSelect?: (d: DimensionLine) => void }) {
  const p = toPx(d, ox, oy, scale);
  const off = (d.tier + 1) * DIM_TIER_STEP_PX;
  const fs = 8;
  const lw = d.label.length * fs * 0.62 + 6;

  if (d.axis === 'h') {
    const y = d.edge === 'top' ? Math.min(p.y1, p.y2) - off : Math.max(p.y1, p.y2) + off;
    const mx = (p.x1 + p.x2) / 2;
    return (
      <g onClick={() => onSelect?.(d)} style={{ cursor: onSelect ? 'pointer' : undefined }}>
        <line x1={p.x1} y1={y} x2={p.x2} y2={y} stroke={DIM_COLOR} strokeWidth={0.8} markerStart="url(#canon-arrow)" markerEnd="url(#canon-arrow)" />
        <line x1={p.x1} y1={p.y1} x2={p.x1} y2={y} stroke={DIM_COLOR} strokeWidth={0.35} strokeDasharray="2 2" />
        <line x1={p.x2} y1={p.y2} x2={p.x2} y2={y} stroke={DIM_COLOR} strokeWidth={0.35} strokeDasharray="2 2" />
        <rect x={mx - lw / 2} y={y - fs * 0.7} width={lw} height={fs * 1.4} fill="white" stroke={DIM_COLOR} strokeWidth={0.4} rx={1} />
        <text x={mx} y={y + fs * 0.35} textAnchor="middle" fontSize={fs} fontFamily="'JetBrains Mono',monospace" fill={DIM_COLOR}>{d.label}</text>
      </g>
    );
  }
  const x = d.edge === 'left' ? Math.min(p.x1, p.x2) - off : Math.max(p.x1, p.x2) + off;
  const my = (p.y1 + p.y2) / 2;
  return (
    <g onClick={() => onSelect?.(d)} style={{ cursor: onSelect ? 'pointer' : undefined }}>
      <line x1={x} y1={p.y1} x2={x} y2={p.y2} stroke={DIM_COLOR} strokeWidth={0.8} markerStart="url(#canon-arrow)" markerEnd="url(#canon-arrow)" />
      <line x1={p.x1} y1={p.y1} x2={x} y2={p.y1} stroke={DIM_COLOR} strokeWidth={0.35} strokeDasharray="2 2" />
      <line x1={p.x2} y1={p.y2} x2={x} y2={p.y2} stroke={DIM_COLOR} strokeWidth={0.35} strokeDasharray="2 2" />
      <rect x={x - lw / 2} y={my - fs * 0.7} width={lw} height={fs * 1.4} fill="white" stroke={DIM_COLOR} strokeWidth={0.4} rx={1} />
      <text x={x} y={my + fs * 0.35} textAnchor="middle" fontSize={fs} fontFamily="'JetBrains Mono',monospace" fill={DIM_COLOR}>{d.label}</text>
    </g>
  );
}

interface RenderProps {
  worldWidth: number;
  worldHeight: number;
  title: string;
  components: ComponentSpec[];
  dimensions: DimensionLine[];
  lines?: AnnotationLine[];
  maxVw?: number;
  maxVh?: number;
  componentStyle?: (c: ComponentSpec) => ComponentStyle;
  selectedComponentId?: string | null;
  onSelectComponent?: (c: ComponentSpec) => void;
  onSelectDimension?: (d: DimensionLine) => void;
}

/** The one renderer every product's technical drawing view goes through. */
export function TechnicalDrawingSvg({
  worldWidth, worldHeight, title, components, dimensions, lines = [],
  maxVw = 640, maxVh = 480, componentStyle, selectedComponentId, onSelectComponent, onSelectDimension,
}: RenderProps) {
  // Extra pixel headroom per collision tier actually used, so nothing clips.
  // Bounded to a fraction of the requested viewport — at full size (640x480)
  // this is just PAD/DIM_TIER_STEP_PX as before, but a small preview
  // (e.g. a 280x160 design-gallery card) would otherwise have its padding
  // exceed the whole available area, driving the fit scale negative and
  // collapsing every shape to zero width — a real bug, not just a display
  // nicety, since it silently produced an all-blank drawing.
  const maxTier = dimensions.reduce((m, d) => Math.max(m, d.tier), 0);
  const rawDimRoom = PAD + (maxTier + 1) * DIM_TIER_STEP_PX;
  const dimRoom = Math.min(rawDimRoom, Math.max(4, Math.min(maxVw, maxVh) * 0.22));
  const titleRoom = Math.min(26, maxVh * 0.18);
  const scale = fitScale(worldWidth, worldHeight, Math.max(10, maxVw - dimRoom * 2), Math.max(10, maxVh - dimRoom * 2 - titleRoom));
  const footerRoom = Math.min(20, Math.max(0, maxVh * 0.09));
  const vw = worldWidth * scale + dimRoom * 2;
  const vh = worldHeight * scale + dimRoom * 2 + titleRoom + footerRoom;
  const ox = dimRoom, oy = dimRoom + titleRoom;
  // Clamped by height (titleRoom) as before, but ALSO by the actual title
  // string's width against the SVG's own vw — a long compound title (e.g.
  // "BED WITH RIGHT SIDE TABLE + PROFILE SHUTTER — ...") on a product whose
  // drawing itself is narrow (small worldWidth → small vw) would otherwise
  // render past the SVG's edge, since the <svg> is `overflow="visible"` on
  // purpose (so leader lines/components at the edges never get clipped).
  const titleFsByHeight = Math.min(11, Math.max(7, titleRoom * 0.5));
  const titleFsByWidth = title.length > 0 ? (vw * 0.96) / (title.length * 0.58) : titleFsByHeight;
  const titleFs = Math.max(5, Math.min(titleFsByHeight, titleFsByWidth));
  const footerFs = Math.min(7, Math.max(5, footerRoom * 0.42));
  const footerY = vh - footerRoom * 0.4;

  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width="100%" overflow="visible" style={{ background: '#fff', display: 'block' }}>
      <defs><DimensionMarkers /><GrainPattern /></defs>
      <text x={vw / 2} y={titleRoom * 0.65} textAnchor="middle" fontSize={titleFs} fontFamily="'DM Sans',sans-serif" fill="#222" fontWeight={900}>{title}</text>
      {components.filter((c) => c.visible).map((c) => {
        const style = (componentStyle ?? defaultStyleFor)(c);
        const selected = selectedComponentId === c.id;
        // Clamped defensively — a transient zero/negative input (e.g. the
        // instant a field is cleared while typing) must never throw an
        // invalid SVG attribute; validationEngine is what surfaces this as a
        // real CRITICAL issue to the user, this is just render safety.
        const px = ox + c.x * scale, py = oy + c.y * scale, pw = Math.max(0, c.width * scale), ph = Math.max(0, c.height * scale);
        // Handle side: whichever edge faces the drawing's own centerline —
        // the standard "doors open outward from the middle" convention for
        // a row of doors/drawers, derived from real position, not guessed.
        const worldCx = c.x + c.width / 2;
        const handleOnRight = worldCx < worldWidth / 2;
        const showHandle = isPullType(c.type) && pw > 14 && ph > 10;
        return (
          <g key={c.id} onClick={() => onSelectComponent?.(c)} style={{ cursor: onSelectComponent ? 'pointer' : undefined }}>
            <rect x={px} y={py} width={pw} height={ph} fill={style.fill} stroke={selected ? '#2563eb' : style.stroke} strokeWidth={selected ? 2.2 : (style.strokeWidth ?? 1)} />
            {showHandle && (
              ph >= pw ? (
                // Tall component (door) — vertical pull near the swing edge.
                <rect
                  x={(handleOnRight ? px + pw - Math.min(6, pw * 0.12) : px + Math.min(4, pw * 0.08))}
                  y={py + ph / 2 - Math.min(14, ph * 0.18)} width={2} height={Math.min(28, ph * 0.36)}
                  rx={1} fill="#555"
                />
              ) : (
                // Wide component (drawer front) — horizontal pull, centered.
                <rect x={px + pw / 2 - Math.min(14, pw * 0.18)} y={py + Math.min(4, ph * 0.3)} width={Math.min(28, pw * 0.36)} height={1.6} rx={0.8} fill="#555" />
              )
            )}
            {pw > 26 && ph > 12 && (
              <text x={px + pw / 2} y={py + ph / 2} textAnchor="middle" dominantBaseline="middle" fontSize={7} fontFamily="'DM Sans',sans-serif" fill="#333" fontWeight={700}>
                {c.label}
              </text>
            )}
          </g>
        );
      })}
      {lines.map((l, i) => {
        const lx2 = ox + l.x2 * scale, ly2 = oy + l.y2 * scale;
        return (
          <g key={i}>
            <line
              x1={ox + l.x1 * scale} y1={oy + l.y1 * scale} x2={lx2} y2={ly2}
              stroke={l.color ?? '#94a3b8'} strokeWidth={0.8} strokeDasharray={l.dashed ? '3 2' : undefined}
            />
            {l.label && (
              <text x={lx2} y={ly2 - 4} textAnchor="middle" fontSize={8} fontFamily="'JetBrains Mono',monospace" fill={l.color ?? DIM_COLOR} fontWeight={700}>
                {l.label}
              </text>
            )}
          </g>
        );
      })}
      {dimensions.map((d) => (
        <DimensionLineView key={d.id} d={d} ox={ox} oy={oy} scale={scale} onSelect={onSelectDimension} />
      ))}
      {footerRoom > 8 && (
        <g>
          <line x1={4} y1={vh - footerRoom} x2={vw - 4} y2={vh - footerRoom} stroke="#ddd" strokeWidth={0.6} />
          <text x={6} y={footerY} fontSize={footerFs} fontFamily="'JetBrains Mono',monospace" fill="#999">SmartMeasure CAD</text>
          <text x={vw - 6} y={footerY} textAnchor="end" fontSize={footerFs} fontFamily="'JetBrains Mono',monospace" fill="#999">SCALE NTS · UNIT MM</text>
        </g>
      )}
    </svg>
  );
}
