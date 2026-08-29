import React from 'react';
import type { ComputedGeometry } from '../store/types';
import { DrawingDefs, HDim, VDim, ViewTitle, DPullVertical, BarHandleH, Knob } from './svgPrimitives';

interface ElevationAProps {
  geo: ComputedGeometry;
  projectId?: string;
  selectedModuleId?: string | null;
  onSelectModule?: (id: string | null) => void;
}

const MARGIN = 620;

export const ElevationA: React.FC<ElevationAProps> = ({ geo, projectId, selectedModuleId, onSelectModule }) => {
  const wallA = geo.walls.find((w) => w.id === 'A');
  const W = wallA?.length ?? 3000;
  const H = geo.ceilingHeight;

  // ─── SVG Y positions (y=0 = ceiling, y=H = floor) ────────────────────────
  const floorY = H;
  const kadappaTopY = H - geo.kadappaHeight;                    // top of kadappa = bottom of base carcass
  const baseCabTopY = H - geo.counterHeight;                    // top of base carcass
  const counterSlabTopY = baseCabTopY - 35;                     // top of 35mm stone slab
  const wallCabBotY = H - geo.wallCabBottom;                    // bottom of wall cabinets
  const wallCabTopY = wallCabBotY - geo.wallCabHeight;          // top of wall cabinets
  const loftTopY = 0;                                           // loft at ceiling
  const loftBotY = geo.loftHeight;                              // bottom of loft
  const skirtingTopY = H - geo.skirtingHeight;                  // top of kickboard (inside base)

  // Cabinet carcass body (between kadappa and counter)
  const carcassTopY = baseCabTopY;
  const carcassH = kadappaTopY - carcassTopY;           // = baseHeight - visible height

  const vb = `${-MARGIN} ${-MARGIN} ${W + MARGIN * 2} ${H + MARGIN * 2}`;

  const baseModsA = geo.baseModules.filter((m) => m.wallId === 'A');
  const wallModsA = geo.wallModules.filter((m) => m.wallId === 'A');
  const loftModsA = geo.loftModules.filter((m) => m.wallId === 'A');

  return (
    <svg viewBox={vb} preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', background: '#fff' }}>
      <DrawingDefs />

      {/* ── View title ── */}
      <ViewTitle x={-MARGIN + 20} y={-MARGIN + 90} title="ELEVATION A — FRONT VIEW (WALL A)"
        sub={`Project: ${projectId ?? 'DEMO-2024-001'} · Scale: NTS · All dims in mm`} fs={72} />

      {/* ── Scale note ── */}
      <text x={W} y={-MARGIN + 90} textAnchor="end" fontSize={52} fontFamily="'DM Sans', sans-serif" fill="#888">
        © SmartMeasure CAD — DEMO
      </text>

      {/* ══════════ STRUCTURAL LINES ════════════════════════════════════════════ */}

      {/* Ceiling — dashed */}
      <line x1={0} y1={0} x2={W} y2={0} stroke="#aaa" strokeWidth={7} strokeDasharray="80 40" />
      <text x={-60} y={10} textAnchor="end" fontSize={52} fontFamily="'DM Sans', sans-serif" fill="#aaa">FL+{H}</text>

      {/* Left wall */}
      <line x1={0} y1={0} x2={0} y2={floorY} stroke="#2a2a2a" strokeWidth={22} />
      {/* Right wall */}
      <line x1={W} y1={0} x2={W} y2={floorY} stroke="#2a2a2a" strokeWidth={22} />
      {/* Floor — very thick */}
      <line x1={-80} y1={floorY} x2={W + 80} y2={floorY} stroke="#111" strokeWidth={28} />

      {/* ══════════ LOFT ════════════════════════════════════════════════════════ */}
      {loftModsA.length > 0 && (
        <g>
          {loftModsA.map((mod) => (
            <g key={mod.id}>
              <rect x={mod.x} y={loftTopY} width={mod.width} height={geo.loftHeight}
                fill="url(#grainLoft)" stroke="#444" strokeWidth={10} />
              {/* Shutter division */}
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
                fontFamily="'JetBrains Mono', monospace" fill="#666">
                {mod.label}
              </text>
            </g>
          ))}
        </g>
      )}

      {/* ══════════ WALL CABINETS ════════════════════════════════════════════════ */}
      {wallModsA.length > 0 && (
        <g>
          {wallModsA.map((mod) => {
            const isSelected = selectedModuleId === mod.id;
            return (
              <g key={mod.id} style={{ cursor: 'pointer' }} onClick={() => onSelectModule?.(isSelected ? null : mod.id)}>
                {/* Carcass */}
                <rect x={mod.x} y={wallCabTopY} width={mod.width} height={geo.wallCabHeight}
                  fill={isSelected ? '#eff6ff' : 'url(#grainWall)'}
                  stroke={isSelected ? '#3b82f6' : '#444'} strokeWidth={isSelected ? 16 : 9} />
                {/* Shutter panels */}
                {mod.shutterDivisions > 0 && Array.from({ length: mod.shutterDivisions }).map((_, i) => {
                  const sw = mod.width / mod.shutterDivisions;
                  const sx = mod.x + i * sw;
                  const gap = 14;
                  const shutterBotY = wallCabBotY - gap;
                  const shutterTopY = wallCabTopY + gap;
                  return (
                    <g key={i}>
                      <rect x={sx + gap} y={shutterTopY} width={sw - gap * 2} height={shutterBotY - shutterTopY}
                        fill="none" stroke={isSelected ? '#3b82f6' : '#666'} strokeWidth={7} rx={3} />
                      {/* Horizontal bar handle near bottom of wall shutter */}
                      <BarHandleH cx={sx + sw / 2} y={shutterBotY - 70} length={Math.min(140, sw * 0.45)} color={isSelected ? '#3b82f6' : '#555'} />
                    </g>
                  );
                })}
                {/* Module label */}
                <text x={mod.x + mod.width / 2} y={wallCabTopY + geo.wallCabHeight / 2}
                  textAnchor="middle" dominantBaseline="middle" fontSize={58}
                  fontFamily="'JetBrains Mono', monospace" fill={isSelected ? '#1d4ed8' : '#555'}>
                  {mod.label}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* ══════════ COUNTER SLAB ════════════════════════════════════════════════ */}
      <rect x={0} y={counterSlabTopY} width={W} height={35}
        fill="url(#counterFill)" stroke="#2a2a2a" strokeWidth={10} />
      {/* Counter level label */}
      <text x={-60} y={counterSlabTopY + 20} textAnchor="end" fontSize={52}
        fontFamily="'DM Sans', sans-serif" fill="#555">
        FL+{geo.counterHeight}
      </text>

      {/* ══════════ BASE CABINETS ════════════════════════════════════════════════ */}
      {baseModsA.map((mod) => {
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
            {/* Carcass box */}
            <rect x={mod.x} y={carcassTopY} width={mod.width} height={carcassH}
              fill={
                isTrolley ? 'url(#grainTrolley)' :
                isOpenBox ? 'url(#grainOpenBox)' :
                isSelected ? '#eff6ff' : 'url(#grainBase)'
              }
              stroke={isSelected ? '#3b82f6' : '#222'} strokeWidth={isSelected ? 16 : 11}
            />

            {/* Kickboard / skirting */}
            {geo.skirtingHeight > 0 && !isTrolley && !isOpenBox && (
              <rect x={mod.x + 18} y={skirtingTopY} width={mod.width - 36} height={geo.skirtingHeight - 10}
                fill="#3d3d3d" stroke="#1a1a1a" strokeWidth={6} rx={4} />
            )}

            {/* ── TROLLEY: horizontal shelf slats ── */}
            {isTrolley && (() => {
              const slats = 5;
              return Array.from({ length: slats }).map((_, i) => (
                <line key={i}
                  x1={mod.x + 20} x2={mod.x + mod.width - 20}
                  y1={shutterTopY + (i + 1) * shutterH / (slats + 1)}
                  y2={shutterTopY + (i + 1) * shutterH / (slats + 1)}
                  stroke="#d97706" strokeWidth={9} />
              ));
            })()}

            {/* ── OPEN BOX: shelf + no shutter ── */}
            {isOpenBox && (
              <line x1={mod.x + 20} x2={mod.x + mod.width - 20}
                y1={carcassTopY + carcassH * 0.5} y2={carcassTopY + carcassH * 0.5}
                stroke="#059669" strokeWidth={9}
              />
            )}

            {/* ── BASE: shutter panels ── */}
            {!isTrolley && !isOpenBox && mod.shutterDivisions > 0 && (
              Array.from({ length: mod.shutterDivisions }).map((_, i) => {
                const sx = mod.x + i * sw;
                const shutterInnerH = shutterH;
                // Check if this module has a drawer
                const hasDrawer = mod.hasDrawer;
                const drawerH = hasDrawer ? 200 : 0;

                return (
                  <g key={i}>
                    {hasDrawer ? (
                      <>
                        {/* Drawer box */}
                        <rect x={sx + gap} y={shutterTopY} width={sw - gap * 2} height={drawerH}
                          fill="none" stroke={isSelected ? '#3b82f6' : '#555'} strokeWidth={8} rx={3} />
                        {/* Drawer handle — horizontal bar */}
                        <BarHandleH cx={sx + sw / 2} y={shutterTopY + drawerH / 2} length={Math.min(150, sw * 0.5)} color={isSelected ? '#3b82f6' : '#555'} />
                        {/* Door below drawer */}
                        <rect x={sx + gap} y={shutterTopY + drawerH + gap} width={sw - gap * 2} height={shutterInnerH - drawerH - gap}
                          fill="none" stroke={isSelected ? '#3b82f6' : '#555'} strokeWidth={8} rx={3} />
                        {/* Door handle */}
                        <DPullVertical cx={sx + sw / 2} y={shutterTopY + drawerH + gap + 120} length={130} color={isSelected ? '#3b82f6' : '#555'} />
                      </>
                    ) : (
                      <>
                        {/* Full door panel */}
                        <rect x={sx + gap} y={shutterTopY} width={sw - gap * 2} height={shutterInnerH}
                          fill="none" stroke={isSelected ? '#3b82f6' : '#555'} strokeWidth={8} rx={3} />
                        {/* D-pull handle — near top of door */}
                        <DPullVertical cx={sx + sw / 2} y={shutterTopY + 120} length={130} color={isSelected ? '#3b82f6' : '#555'} />
                      </>
                    )}
                  </g>
                );
              })
            )}

            {/* Module label & width */}
            <text x={mod.x + mod.width / 2} y={carcassTopY + carcassH * 0.5 - 35}
              textAnchor="middle" dominantBaseline="middle" fontSize={60}
              fontFamily="'JetBrains Mono', monospace"
              fill={isTrolley ? '#92400e' : isOpenBox ? '#065f46' : isSelected ? '#1d4ed8' : '#374151'}>
              {mod.label}
            </text>
            <text x={mod.x + mod.width / 2} y={carcassTopY + carcassH * 0.5 + 45}
              textAnchor="middle" fontSize={52}
              fontFamily="'JetBrains Mono', monospace" fill="#6b7280">
              {mod.width}
            </text>
          </g>
        );
      })}

      {/* ══════════ KADAPPA / PLATFORM ══════════════════════════════════════════ */}
      {geo.kadappaHeight > 0 && (
        <rect x={0} y={kadappaTopY} width={W} height={geo.kadappaHeight}
          fill="url(#kadappaHatch)" stroke="#7a6a50" strokeWidth={10} />
      )}

      {/* ══════════ DIMENSION CHAINS ═══════════════════════════════════════════ */}

      {/* Individual module width chain (below floor) */}
      {baseModsA.map((mod) => (
        <HDim key={`dim-${mod.id}`}
          x1={mod.x} x2={mod.x + mod.width}
          y={floorY + 240} label={String(mod.width)}
          fontSize={58} tickLen={55}
        />
      ))}

      {/* Overall Wall A width */}
      <HDim x1={0} x2={W} y={floorY + 430} label={`${W} mm`} fontSize={72} tickLen={65} />

      {/* Left side: overall height */}
      <VDim x={-MARGIN + 220} y1={0} y2={floorY} label={`${H} mm`} fontSize={72} tickLen={65} />

      {/* Left side: base cabinet height */}
      <VDim x={-260} y1={carcassTopY} y2={kadappaTopY > carcassTopY ? kadappaTopY : floorY} label={`${geo.baseHeight}`} fontSize={56} tickLen={48} color="#555" />

      {/* Right side heights */}
      {geo.loftHeight > 0 && (
        <VDim x={W + 220} y1={loftTopY} y2={loftBotY} label={`${geo.loftHeight}`} fontSize={56} tickLen={48} color="#555" />
      )}
      {geo.wallCabHeight > 0 && (
        <VDim x={W + 360} y1={wallCabTopY} y2={wallCabBotY} label={`${geo.wallCabHeight}`} fontSize={56} tickLen={48} color="#555" />
      )}
      {geo.counterHeight > 0 && (
        <VDim x={W + 220} y1={carcassTopY} y2={floorY} label={`${geo.counterHeight}`} fontSize={56} tickLen={48} color="#777" />
      )}
      {geo.kadappaHeight > 0 && (
        <VDim x={W + 360} y1={kadappaTopY} y2={floorY} label={`${geo.kadappaHeight}`} fontSize={52} tickLen={44} color="#7a6a50" />
      )}

      {/* Wall cabinet gap label */}
      {geo.wallCabBottom > 0 && geo.counterHeight > 0 && (
        <g>
          <line x1={W + 100} y1={counterSlabTopY} x2={W + 100} y2={wallCabBotY}
            stroke="#bbb" strokeWidth={5} strokeDasharray="30 20" />
          <text x={W + 150} y={(counterSlabTopY + wallCabBotY) / 2}
            fontSize={50} fontFamily="'JetBrains Mono', monospace" fill="#bbb"
            dominantBaseline="middle">
            {geo.wallCabBottom - geo.counterHeight}
          </text>
        </g>
      )}

      {/* ══════════ WINDOW SYMBOLS ══════════════════════════════════════════════ */}
      {geo.openings.filter((o) => o.type === 'window' && o.wallId === 'A').map((win) => {
        const winBotFromFloor = win.sillHeight ?? 1050;
        const winTopFromFloor = winBotFromFloor + win.height;
        const winTopY = H - winTopFromFloor;
        const winBotY = H - winBotFromFloor;
        return (
          <g key={win.id}>
            {/* Window opening — white rectangle (erases what's behind) */}
            <rect x={win.distanceFromLeft} y={winTopY} width={win.width} height={win.height} fill="white" />
            {/* Frame */}
            <rect x={win.distanceFromLeft} y={winTopY} width={win.width} height={win.height}
              fill="#dbeafe" stroke="#3b82f6" strokeWidth={10} opacity={0.8} />
            {/* Center rail */}
            <line x1={win.distanceFromLeft + win.width / 2} y1={winTopY}
              x2={win.distanceFromLeft + win.width / 2} y2={winBotY}
              stroke="#3b82f6" strokeWidth={8} />
            {/* Sill */}
            <line x1={win.distanceFromLeft - 30} y1={winBotY}
              x2={win.distanceFromLeft + win.width + 30} y2={winBotY}
              stroke="#555" strokeWidth={14} />
            {/* Label */}
            <text x={win.distanceFromLeft + win.width / 2} y={winTopY - 40}
              textAnchor="middle" fontSize={52} fontFamily="'DM Sans', sans-serif" fill="#3b82f6">
              WIN {win.width}×{win.height}
            </text>
            {/* Sill height dim */}
            <HDim x1={win.distanceFromLeft} x2={win.distanceFromLeft + win.width}
              y={winBotY + 100} label={`@${winBotFromFloor}`} fontSize={50} tickLen={40} color="#3b82f6" />
          </g>
        );
      })}

      {/* ══════════ FLOOR LEVEL LABEL ══════════════════════════════════════════ */}
      <text x={-60} y={floorY + 20} textAnchor="end" fontSize={52}
        fontFamily="'DM Sans', sans-serif" fill="#555">FL+0</text>
    </svg>
  );
};

export default ElevationA;
