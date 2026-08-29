import React from 'react';
import type { ComputedGeometry } from '../store/types';
import { DrawingDefs, HDim, VDim, ViewTitle } from './svgPrimitives';

interface PlanViewProps {
  geo: ComputedGeometry;
  projectId?: string;
  selectedModuleId?: string | null;
  onSelectModule?: (id: string | null) => void;
}

const MARGIN = 620;
const WALL_T = 150; // wall thickness in mm

export const PlanView: React.FC<PlanViewProps> = ({ geo, projectId, selectedModuleId, onSelectModule }) => {
  const wallA = geo.walls.find((w) => w.id === 'A');
  const wallB = geo.walls.find((w) => w.id === 'B');
  const W = wallA?.length ?? 3000;
  const D = wallB?.length ?? 0;
  const isL = geo.kitchenType === 'l-shape' && D > 0;
  const cabDepth = geo.baseDepth;

  const vb = `${-MARGIN} ${-MARGIN} ${W + MARGIN * 2} ${(isL ? D : cabDepth + 200) + MARGIN * 2}`;

  return (
    <svg viewBox={vb} preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', background: '#fff' }}>
      <DrawingDefs />

      <ViewTitle x={-MARGIN + 20} y={-MARGIN + 90}
        title="KITCHEN PLAN — TOP VIEW"
        sub={`Project: ${projectId ?? 'DEMO-2024-001'} · Scale: NTS · All dims in mm`} fs={72} />

      {/* ── Wall A (top wall, horizontal) ── */}
      <rect x={0} y={-WALL_T} width={W} height={WALL_T}
        fill="url(#wallHatch)" stroke="#444" strokeWidth={12} />

      {/* ── Wall B (left wall, vertical) — L-shape only ── */}
      {isL && (
        <rect x={-WALL_T} y={0} width={WALL_T} height={D}
          fill="url(#wallHatch)" stroke="#444" strokeWidth={12} />
      )}

      {/* ── Cabinet footprints — Wall A ── */}
      {geo.baseModules.filter((m) => m.wallId === 'A').map((mod) => {
        const isTrolley = mod.type === 'trolley';
        const isOpenBox = mod.type === 'open-box';
        const isCorner = mod.type === 'corner';
        const isSelected = selectedModuleId === mod.id;
        return (
          <g key={mod.id} style={{ cursor: 'pointer' }} onClick={() => onSelectModule?.(isSelected ? null : mod.id)}>
            {/* Cabinet footprint */}
            <rect x={mod.x} y={0} width={mod.width} height={cabDepth}
              fill={isCorner ? '#f5f0fe' : isTrolley ? 'url(#grainTrolley)' : isOpenBox ? 'url(#grainOpenBox)' : isSelected ? '#eff6ff' : 'url(#grainBase)'}
              stroke={isSelected ? '#3b82f6' : isCorner ? '#7c3aed' : '#333'} strokeWidth={isSelected ? 16 : 10}
            />
            {/* Countertop surface line (front edge) */}
            <line x1={mod.x} y1={cabDepth} x2={mod.x + mod.width} y2={cabDepth}
              stroke="#555" strokeWidth={12} />
            {/* Corner unit — diagonal lazy-susan front convention */}
            {isCorner && (
              <line x1={mod.x} y1={0} x2={mod.x + mod.width} y2={cabDepth} stroke="#7c3aed" strokeWidth={8} strokeDasharray="20 12" />
            )}
            {/* Division lines */}
            {!isCorner && mod.shutterDivisions > 1 && Array.from({ length: mod.shutterDivisions - 1 }).map((_, i) => {
              const divX = mod.x + ((i + 1) * mod.width) / mod.shutterDivisions;
              return <line key={i} x1={divX} y1={0} x2={divX} y2={cabDepth} stroke="#888" strokeWidth={6} strokeDasharray="25 15" />;
            })}
            {/* Trolley slat indication */}
            {isTrolley && Array.from({ length: 3 }).map((_, i) => (
              <line key={i} x1={mod.x + 20} x2={mod.x + mod.width - 20}
                y1={(i + 1) * cabDepth / 4} y2={(i + 1) * cabDepth / 4}
                stroke="#d97706" strokeWidth={7} />
            ))}
            {/* Module label */}
            <text x={mod.x + mod.width / 2} y={cabDepth / 2}
              textAnchor="middle" dominantBaseline="middle" fontSize={isCorner ? 48 : 62}
              fontFamily="'JetBrains Mono', monospace"
              fill={isCorner ? '#6d28d9' : isTrolley ? '#92400e' : isOpenBox ? '#065f46' : '#374151'}>
              {mod.label}
            </text>
          </g>
        );
      })}

      {/* ── Cabinet footprints — Wall B (L-shape) ── */}
      {isL && geo.baseModules.filter((m) => m.wallId === 'B').map((mod) => {
        const isTrolley = mod.type === 'trolley';
        const isOpenBox = mod.type === 'open-box';
        const isSelected = selectedModuleId === mod.id;
        return (
          <g key={mod.id} style={{ cursor: 'pointer' }} onClick={() => onSelectModule?.(isSelected ? null : mod.id)}>
            <rect x={0} y={mod.x} width={cabDepth} height={mod.width}
              fill={isTrolley ? 'url(#grainTrolley)' : isOpenBox ? 'url(#grainOpenBox)' : isSelected ? '#eff6ff' : 'url(#grainBase)'}
              stroke={isSelected ? '#3b82f6' : '#333'} strokeWidth={isSelected ? 16 : 10}
            />
            {/* Countertop surface (right edge of B cabinet) */}
            <line x1={cabDepth} y1={mod.x} x2={cabDepth} y2={mod.x + mod.width} stroke="#555" strokeWidth={12} />
            {/* Division lines */}
            {mod.shutterDivisions > 1 && Array.from({ length: mod.shutterDivisions - 1 }).map((_, i) => {
              const divY = mod.x + ((i + 1) * mod.width) / mod.shutterDivisions;
              return <line key={i} x1={0} y1={divY} x2={cabDepth} y2={divY} stroke="#888" strokeWidth={6} strokeDasharray="25 15" />;
            })}
            <text x={cabDepth / 2} y={mod.x + mod.width / 2}
              textAnchor="middle" dominantBaseline="middle" fontSize={62}
              fontFamily="'JetBrains Mono', monospace"
              fill={isTrolley ? '#92400e' : isOpenBox ? '#065f46' : '#374151'}>
              {mod.label}
            </text>
          </g>
        );
      })}

      {/* ── Windows in plan (gap in Wall A) ── */}
      {geo.openings.filter((o) => o.type === 'window' && o.wallId === 'A').map((win) => (
        <g key={win.id}>
          <rect x={win.distanceFromLeft} y={-WALL_T} width={win.width} height={WALL_T}
            fill="#dbeafe" stroke="#3b82f6" strokeWidth={10} />
          <line x1={win.distanceFromLeft + win.width / 2} y1={-WALL_T}
            x2={win.distanceFromLeft + win.width / 2} y2={0} stroke="#3b82f6" strokeWidth={8} />
        </g>
      ))}

      {/* ── Doors (arc symbol) ── */}
      {geo.openings.filter((o) => o.type === 'door').map((door) => {
        const r = door.width;
        const fromLeft = door.distanceFromLeft;
        const isWallA = door.wallId === 'A';
        // Simplified: show as a colored gap + swing arc
        return (
          <g key={door.id}>
            {isWallA ? (
              <>
                <rect x={fromLeft} y={-WALL_T} width={door.width} height={WALL_T} fill="white" stroke="#6366f1" strokeWidth={10} />
                <path d={`M ${fromLeft} 0 A ${r} ${r} 0 0 1 ${fromLeft + r} ${-r}`}
                  fill="#e0e7ff" stroke="#6366f1" strokeWidth={7} fillOpacity={0.5} />
                <line x1={fromLeft} y1={0} x2={fromLeft + r} y2={0} stroke="#6366f1" strokeWidth={10} />
              </>
            ) : (
              <>
                <rect x={-WALL_T} y={fromLeft} width={WALL_T} height={door.width} fill="white" stroke="#6366f1" strokeWidth={10} />
                <path d={`M 0 ${fromLeft} A ${r} ${r} 0 0 0 ${r} ${fromLeft + r}`}
                  fill="#e0e7ff" stroke="#6366f1" strokeWidth={7} fillOpacity={0.5} />
              </>
            )}
          </g>
        );
      })}

      {/* ── Corner dot ── */}
      <circle cx={0} cy={0} r={28} fill="#111" />

      {/* ── Dimensions ── */}
      <HDim x1={0} x2={W} y={-MARGIN + 210} label={`${W} mm`} fontSize={72} tickLen={65} />
      {isL && <VDim x={-MARGIN + 220} y1={0} y2={D} label={`${D} mm`} fontSize={72} tickLen={65} />}
      {/* Depth labels */}
      <VDim x={W + 180} y1={0} y2={cabDepth} label={`${cabDepth}d`} fontSize={58} tickLen={50} color="#666" />

      {/* ── Individual module widths (Wall A) ── */}
      {geo.baseModules.filter((m) => m.wallId === 'A').map((mod) => (
        <HDim key={`pd-${mod.id}`}
          x1={mod.x} x2={mod.x + mod.width}
          y={cabDepth + 200} label={String(mod.width)}
          fontSize={56} tickLen={48} color="#555"
        />
      ))}

      {/* ── Module widths Wall B ── */}
      {isL && geo.baseModules.filter((m) => m.wallId === 'B').map((mod) => (
        <VDim key={`pd-${mod.id}`}
          x={cabDepth + 200} y1={mod.x} y2={mod.x + mod.width}
          label={String(mod.width)} fontSize={56} tickLen={48} color="#555"
        />
      ))}

      {/* Scale / north indicator */}
      <g transform={`translate(${W - 200}, ${-MARGIN + 150})`}>
        <circle cx={0} cy={0} r={80} fill="none" stroke="#ccc" strokeWidth={8} />
        <text x={0} y={-95} textAnchor="middle" fontSize={60} fill="#999" fontFamily="'DM Sans', sans-serif">N ↑</text>
      </g>
    </svg>
  );
};

export default PlanView;
