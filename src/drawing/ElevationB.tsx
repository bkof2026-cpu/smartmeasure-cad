import React from 'react';
import type { ComputedGeometry } from '../store/types';
import { DrawingDefs, HDim, VDim, ViewTitle, DPullVertical, BarHandleH, Knob } from './svgPrimitives';

interface ElevationBProps {
  geo: ComputedGeometry;
  projectId?: string;
  selectedModuleId?: string | null;
  onSelectModule?: (id: string | null) => void;
}

const MARGIN = 620;

export const ElevationB: React.FC<ElevationBProps> = ({ geo, projectId, selectedModuleId, onSelectModule }) => {
  const wallB = geo.walls.find((w) => w.id === 'B');
  const W = wallB?.length ?? 0;
  const H = geo.ceilingHeight;

  if (!W) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#fff' }}>
        <div style={{ textAlign: 'center', color: '#aaa', fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📐</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Wall B Not Defined</div>
          <div style={{ fontSize: 14 }}>Enter Wall B length in Step 3 (Wall Measurements)</div>
        </div>
      </div>
    );
  }

  const floorY = H;
  const kadappaTopY = H - geo.kadappaHeight;
  const baseCabTopY = H - geo.counterHeight;
  const counterSlabTopY = baseCabTopY - 35;
  const wallCabBotY = H - geo.wallCabBottom;
  const wallCabTopY = wallCabBotY - geo.wallCabHeight;
  const loftTopY = 0;
  const loftBotY = geo.loftHeight;
  const carcassTopY = baseCabTopY;
  const carcassH = kadappaTopY - carcassTopY;
  const skirtingTopY = H - geo.skirtingHeight;

  const baseModsB = geo.baseModules.filter((m) => m.wallId === 'B');
  const wallModsB = geo.wallModules.filter((m) => m.wallId === 'B');
  const loftModsB = geo.loftModules.filter((m) => m.wallId === 'B');

  const vb = `${-MARGIN} ${-MARGIN} ${W + MARGIN * 2} ${H + MARGIN * 2}`;

  return (
    <svg viewBox={vb} preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', background: '#fff' }}>
      <DrawingDefs />

      <ViewTitle x={-MARGIN + 20} y={-MARGIN + 90}
        title="ELEVATION B — SIDE VIEW (WALL B)"
        sub={`Project: ${projectId ?? 'DEMO-2024-001'} · Scale: NTS · All dims in mm`} fs={72} />

      {/* Structural */}
      <line x1={0} y1={0} x2={W} y2={0} stroke="#aaa" strokeWidth={7} strokeDasharray="80 40" />
      <line x1={0} y1={0} x2={0} y2={floorY} stroke="#2a2a2a" strokeWidth={22} />
      <line x1={W} y1={0} x2={W} y2={floorY} stroke="#2a2a2a" strokeWidth={22} />
      <line x1={-80} y1={floorY} x2={W + 80} y2={floorY} stroke="#111" strokeWidth={28} />

      {/* Loft */}
      {loftModsB.map((mod) => (
        <g key={mod.id}>
          <rect x={mod.x} y={loftTopY} width={mod.width} height={geo.loftHeight}
            fill="url(#grainLoft)" stroke="#444" strokeWidth={10} />
          {mod.shutterDivisions > 0 && Array.from({ length: mod.shutterDivisions }).map((_, i) => {
            const sw = mod.width / mod.shutterDivisions;
            const sx = mod.x + i * sw;
            const gap = 14;
            return (
              <g key={i}>
                <rect x={sx + gap} y={loftTopY + gap} width={sw - gap * 2} height={geo.loftHeight - gap * 2}
                  fill="none" stroke="#777" strokeWidth={7} rx={3} />
                <Knob cx={sx + sw / 2} cy={loftBotY - 55} r={20} color="#666" />
              </g>
            );
          })}
          <text x={mod.x + mod.width / 2} y={loftTopY + geo.loftHeight / 2}
            textAnchor="middle" dominantBaseline="middle" fontSize={58}
            fontFamily="'JetBrains Mono', monospace" fill="#666">{mod.label}</text>
        </g>
      ))}

      {/* Wall cabinets */}
      {wallModsB.map((mod) => {
        const isSelected = selectedModuleId === mod.id;
        return (
          <g key={mod.id} style={{ cursor: 'pointer' }} onClick={() => onSelectModule?.(isSelected ? null : mod.id)}>
            <rect x={mod.x} y={wallCabTopY} width={mod.width} height={geo.wallCabHeight}
              fill={isSelected ? '#eff6ff' : 'url(#grainWall)'}
              stroke={isSelected ? '#3b82f6' : '#444'} strokeWidth={isSelected ? 16 : 9} />
            {mod.shutterDivisions > 0 && Array.from({ length: mod.shutterDivisions }).map((_, i) => {
              const sw = mod.width / mod.shutterDivisions;
              const sx = mod.x + i * sw;
              const gap = 14;
              return (
                <g key={i}>
                  <rect x={sx + gap} y={wallCabTopY + gap} width={sw - gap * 2} height={geo.wallCabHeight - gap * 2}
                    fill="none" stroke={isSelected ? '#3b82f6' : '#666'} strokeWidth={7} rx={3} />
                  <BarHandleH cx={sx + sw / 2} y={wallCabBotY - 70} length={Math.min(140, sw * 0.45)} color={isSelected ? '#3b82f6' : '#555'} />
                </g>
              );
            })}
            <text x={mod.x + mod.width / 2} y={wallCabTopY + geo.wallCabHeight / 2}
              textAnchor="middle" dominantBaseline="middle" fontSize={58}
              fontFamily="'JetBrains Mono', monospace" fill={isSelected ? '#1d4ed8' : '#555'}>{mod.label}</text>
          </g>
        );
      })}

      {/* Counter slab */}
      <rect x={0} y={counterSlabTopY} width={W} height={35}
        fill="url(#counterFill)" stroke="#2a2a2a" strokeWidth={10} />

      {/* Base cabinets */}
      {baseModsB.map((mod) => {
        const isTrolley = mod.type === 'trolley';
        const isOpenBox = mod.type === 'open-box';
        const isSelected = selectedModuleId === mod.id;
        const gap = 14;
        const shutterTopY = carcassTopY + gap;
        const shutterBotY = skirtingTopY > carcassTopY ? skirtingTopY - gap : kadappaTopY - gap;
        const shutterH = shutterBotY - shutterTopY;
        const sw = mod.shutterDivisions > 0 ? mod.width / mod.shutterDivisions : mod.width;

        return (
          <g key={mod.id} style={{ cursor: 'pointer' }} onClick={() => onSelectModule?.(isSelected ? null : mod.id)}>
            <rect x={mod.x} y={carcassTopY} width={mod.width} height={carcassH}
              fill={isTrolley ? 'url(#grainTrolley)' : isOpenBox ? 'url(#grainOpenBox)' : isSelected ? '#eff6ff' : 'url(#grainBase)'}
              stroke={isSelected ? '#3b82f6' : '#222'} strokeWidth={isSelected ? 16 : 11}
            />
            {geo.skirtingHeight > 0 && !isTrolley && !isOpenBox && (
              <rect x={mod.x + 18} y={skirtingTopY} width={mod.width - 36} height={geo.skirtingHeight - 10}
                fill="#3d3d3d" stroke="#1a1a1a" strokeWidth={6} rx={4} />
            )}
            {isTrolley && Array.from({ length: 5 }).map((_, i) => (
              <line key={i} x1={mod.x + 20} x2={mod.x + mod.width - 20}
                y1={shutterTopY + (i + 1) * shutterH / 6} y2={shutterTopY + (i + 1) * shutterH / 6}
                stroke="#d97706" strokeWidth={9} />
            ))}
            {isOpenBox && (
              <line x1={mod.x + 20} x2={mod.x + mod.width - 20}
                y1={carcassTopY + carcassH * 0.5} y2={carcassTopY + carcassH * 0.5}
                stroke="#059669" strokeWidth={9} />
            )}
            {!isTrolley && !isOpenBox && mod.shutterDivisions > 0 && Array.from({ length: mod.shutterDivisions }).map((_, i) => {
              const sx = mod.x + i * sw;
              return (
                <g key={i}>
                  <rect x={sx + gap} y={shutterTopY} width={sw - gap * 2} height={shutterH}
                    fill="none" stroke={isSelected ? '#3b82f6' : '#555'} strokeWidth={8} rx={3} />
                  <DPullVertical cx={sx + sw / 2} y={shutterTopY + 120} length={130} color={isSelected ? '#3b82f6' : '#555'} />
                </g>
              );
            })}
            <text x={mod.x + mod.width / 2} y={carcassTopY + carcassH * 0.5 - 35}
              textAnchor="middle" dominantBaseline="middle" fontSize={60}
              fontFamily="'JetBrains Mono', monospace"
              fill={isTrolley ? '#92400e' : isOpenBox ? '#065f46' : isSelected ? '#1d4ed8' : '#374151'}>{mod.label}</text>
            <text x={mod.x + mod.width / 2} y={carcassTopY + carcassH * 0.5 + 45}
              textAnchor="middle" fontSize={52} fontFamily="'JetBrains Mono', monospace" fill="#6b7280">{mod.width}</text>
          </g>
        );
      })}

      {/* Kadappa */}
      {geo.kadappaHeight > 0 && (
        <rect x={0} y={kadappaTopY} width={W} height={geo.kadappaHeight}
          fill="url(#kadappaHatch)" stroke="#7a6a50" strokeWidth={10} />
      )}

      {/* Doors */}
      {geo.openings.filter((o) => o.type === 'door' && o.wallId === 'B').map((door) => {
        const dTop = H - door.height;
        return (
          <g key={door.id}>
            <rect x={door.distanceFromLeft} y={dTop} width={door.width} height={door.height} fill="white" />
            <rect x={door.distanceFromLeft} y={dTop} width={door.width} height={door.height}
              fill="#e0e7ff" stroke="#6366f1" strokeWidth={10} opacity={0.8} />
            <text x={door.distanceFromLeft + door.width / 2} y={dTop + door.height / 2}
              textAnchor="middle" dominantBaseline="middle" fontSize={55}
              fontFamily="'DM Sans', sans-serif" fill="#6366f1">DOOR</text>
            <text x={door.distanceFromLeft + door.width / 2} y={dTop - 45}
              textAnchor="middle" fontSize={52} fontFamily="'DM Sans', sans-serif" fill="#6366f1">
              {door.width}×{door.height}
            </text>
          </g>
        );
      })}

      {/* Dimensions */}
      <HDim x1={0} x2={W} y={floorY + 430} label={`${W} mm`} fontSize={72} tickLen={65} />
      {baseModsB.map((mod) => (
        <HDim key={`d-${mod.id}`} x1={mod.x} x2={mod.x + mod.width} y={floorY + 240} label={String(mod.width)} fontSize={58} tickLen={55} color="#555" />
      ))}
      <VDim x={-MARGIN + 220} y1={0} y2={floorY} label={`${H} mm`} fontSize={72} tickLen={65} />
      {geo.wallCabHeight > 0 && <VDim x={W + 220} y1={wallCabTopY} y2={wallCabBotY} label={`${geo.wallCabHeight}`} fontSize={56} tickLen={48} color="#555" />}
      {geo.loftHeight > 0 && <VDim x={W + 360} y1={loftTopY} y2={loftBotY} label={`${geo.loftHeight}`} fontSize={56} tickLen={48} color="#555" />}
      <VDim x={W + 220} y1={carcassTopY} y2={floorY} label={`${geo.counterHeight}`} fontSize={56} tickLen={48} color="#777" />

      <text x={W} y={-MARGIN + 90} textAnchor="end" fontSize={52}
        fontFamily="'DM Sans', sans-serif" fill="#888">© SmartMeasure CAD — DEMO</text>
    </svg>
  );
};

export default ElevationB;
