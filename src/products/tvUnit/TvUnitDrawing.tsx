import React, { useState } from 'react';
import { TechnicalDrawingSvg, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolveTvUnitPlan, tvUnitTitle, type TvUnitInputs, type TvUnitSide } from './tvUnitGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);
const side = (v: number | string | undefined): TvUnitSide => (String(v ?? 'Left').toLowerCase() === 'right' ? 'right' : 'left');
const bool = (v: number | string | undefined) => Number(v) === 1;

interface Props {
  dims: Record<string, number | string>;
}

function tvUnitStyle(c: ComponentSpec): ComponentStyle {
  switch (c.type) {
    case 'TV_UNIT_FRAME':
      return { fill: '#ffffff', stroke: '#111827', strokeWidth: 1.6 };
    case 'BLACK_TINTED_BOX':
      // Outline only, no fill — per the user, matching every other TV Unit
      // component's plain white-interior look (the name "Black Tinted
      // Box" is just the label, not a literal dark render).
      return { fill: '#ffffff', stroke: '#111827', strokeWidth: 1.4 };
    case 'TV_BOX':
      return { fill: '#ffffff', stroke: '#111827', strokeWidth: 1.4 };
    case 'MANDIR_FRAME':
      return { fill: '#e0f7fb', stroke: '#0891b2', strokeWidth: 1.4 };
    case 'PARTITION_FRAME':
      // Bold dark-maroon border, matching the reference's own distinct
      // Partition outline (visibly heavier than the TV Unit's black frame).
      return { fill: '#ffffff', stroke: '#7c2d12', strokeWidth: 2.2 };
    default:
      return { fill: '#f0eee8', stroke: '#333', strokeWidth: 1 };
  }
}

export const TvUnitDrawing: React.FC<Props> = ({ dims }) => {
  const tvH = n(dims.H) || 700;
  const inp: TvUnitInputs = {
    H: tvH,
    W: n(dims.W) || 2700,
    D: n(dims.D) || 450,
    blackBoxSide: side(dims.blackBoxSide),

    hasMandir: bool(dims.hasMandir),
    mandirSide: side(dims.mandirSide ?? 'Right'),
    // Mandir/Partition Height always track TV Unit Height (per the user)
    // — dims.mandirH/partitionH are kept resynced to dims.H by
    // ProductFlow's handleDimChange whenever H changes, but fall back to
    // TV Unit Height here too (never a stale hardcoded number) for the
    // brief window before that resync has run (e.g. right after Include
    // Mandir/Partition is first turned on).
    mandirH: n(dims.mandirH) || tvH,
    mandirW: n(dims.mandirW) || 450,
    mandirD: n(dims.mandirD) || 450,

    hasPartition: bool(dims.hasPartition),
    partitionSide: side(dims.partitionSide ?? 'Left'),
    partitionH: n(dims.partitionH) || tvH,
    partitionW: n(dims.partitionW) || 500,
    partitionD: n(dims.partitionD) || 400,
  };
  const drawing = resolveTvUnitPlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={tvUnitTitle(inp)}
        components={drawing.components}
        dimensions={drawing.dimensions}
        lines={drawing.lines}
        componentStyle={tvUnitStyle}
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default TvUnitDrawing;
