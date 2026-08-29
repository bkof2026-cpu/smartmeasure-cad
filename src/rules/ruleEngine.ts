import type {
  KitchenProjectModel,
  RuleParameters,
  ComputedGeometry,
  ComputedModule,
  CabinetModule,
  Wall,
  ValidationIssue,
} from '../store/types';

function calcShutterDivisions(width: number, rules: RuleParameters): number {
  if (width <= rules.shutterDivisionMaxWidth) return 1;
  return Math.ceil(width / rules.shutterDivisionMaxWidth);
}

function moduleLabel(type: string, idx: number): string {
  const prefix: Record<string, string> = {
    base: 'B',
    wall: 'W',
    loft: 'L',
    trolley: 'T',
    'open-box': 'OB',
    'tall-unit': 'TU',
    corner: 'CU',
  };
  return `${prefix[type] ?? 'X'}-${String(idx + 1).padStart(2, '0')}`;
}

function distributeModules(
  wallId: string,
  modules: CabinetModule[],
  wallLength: number,
  rules: RuleParameters,
  startOffset = 0
): { distributed: ComputedModule[]; usedWidth: number } {
  const wallMods = modules.filter((m) => m.wallId === wallId);
  if (!wallMods.length) return { distributed: [], usedWidth: startOffset };

  const fillerTotal = rules.filler * 2;
  const available = Math.max(0, wallLength - fillerTotal - startOffset);

  const fixed = wallMods.filter((m) => m.isFixed);
  const flexible = wallMods.filter((m) => !m.isFixed);

  const fixedWidth = fixed.reduce((s, m) => s + m.width, 0);
  const flexAvailable = Math.max(0, available - fixedWidth);
  const totalFlexReq = flexible.reduce((s, m) => s + m.width, 0);
  const scale = totalFlexReq > 0 ? flexAvailable / totalFlexReq : 1;

  const result: ComputedModule[] = [];
  let x = rules.filler + startOffset;
  let wallIdx = 0;

  for (const mod of wallMods) {
    const computedWidth = mod.isFixed ? mod.width : Math.max(rules.minModuleWidth, Math.round(mod.width * scale));
    result.push({
      id: mod.id,
      type: mod.type,
      wallId: mod.wallId,
      x,
      width: computedWidth,
      height: mod.height,
      depth: mod.depth,
      shutterDivisions: mod.shutterRequired ? calcShutterDivisions(computedWidth, rules) : 0,
      label: moduleLabel(mod.type, wallIdx),
      hasDrawer: mod.hasDrawer,
    });
    x += computedWidth;
    wallIdx++;
  }

  return { distributed: result, usedWidth: x };
}

function computeHeights(model: KitchenProjectModel, rules: RuleParameters) {
  const kadappaHeight = model.kitchen.hasKadappa
    ? (model.kitchen.kadappa?.height ?? rules.kadappaDefaultHeight)
    : 0;
  const skirtingHeight = model.kitchen.hasSkirting
    ? (model.kitchen.skirting?.height ?? rules.skirtingDefaultHeight)
    : 0;
  const baseHeight = rules.baseHeight;
  const counterHeight = kadappaHeight + baseHeight;
  const wallCabBottom = counterHeight + rules.counterToWallGap;
  const wallCabHeight = rules.wallCabHeight;
  const ceilingH = model.kitchen.ceilingHeight || 2700;
  const loftHeight = model.kitchen.loftRequired ? rules.loftHeight : 0;
  const loftBottom = ceilingH - loftHeight;

  return {
    kadappaHeight,
    skirtingHeight,
    baseHeight,
    baseDepth: rules.baseDepth,
    wallCabHeight: model.kitchen.wallCabinetsRequired ? wallCabHeight : 0,
    wallCabDepth: rules.wallCabDepth,
    wallCabBottom: model.kitchen.wallCabinetsRequired ? wallCabBottom : 0,
    loftHeight,
    loftDepth: rules.loftDepth,
    loftBottom,
    counterHeight,
  };
}

function validate(
  model: KitchenProjectModel,
  availableWidth: Record<string, number>,
  usedWidth: Record<string, number>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const wall of model.kitchen.walls) {
    const avail = availableWidth[wall.id] ?? 0;
    const used = usedWidth[wall.id] ?? 0;
    const diff = used - avail;
    if (diff > 5) {
      issues.push({
        id: `overflow-${wall.id}`,
        level: 'error',
        message: `Wall ${wall.label}: modules exceed wall width by ${Math.round(diff)} mm`,
      });
    } else if (avail - used > 80) {
      issues.push({
        id: `gap-${wall.id}`,
        level: 'warning',
        message: `Wall ${wall.label}: ${Math.round(avail - used)} mm unaccounted gap`,
      });
    }
  }

  for (const wall of model.kitchen.walls) {
    const hasEvidence = model.evidence.some((e) => e.measurementId === wall.id);
    if (!hasEvidence) {
      issues.push({
        id: `evidence-${wall.id}`,
        level: 'warning',
        message: `Wall ${wall.label}: no photo evidence captured`,
      });
    }
  }

  if (!model.kitchen.ceilingHeight || model.kitchen.ceilingHeight < 2000) {
    issues.push({
      id: 'ceiling',
      level: 'warning',
      message: 'Ceiling height not recorded or unusually low',
    });
  }

  for (const op of model.openings) {
    if (!op.width || !op.height) {
      issues.push({
        id: `opening-${op.id}`,
        level: 'error',
        message: `${op.type} on Wall ${op.wallId}: missing width or height`,
      });
    }
  }

  return issues;
}

function calcCompletion(model: KitchenProjectModel, issues: ValidationIssue[]): number {
  const checks = [
    !!model.project.clientName,
    !!model.project.projectId,
    model.kitchen.walls.length > 0 && model.kitchen.walls.every((w) => w.length > 0),
    !!model.kitchen.ceilingHeight,
    model.modules.length > 0,
    issues.filter((i) => i.level === 'error').length === 0,
    model.evidence.some((e) => e.type === 'photo'),
    model.completedSteps.length >= 3,
    model.kitchen.type !== 'straight' ? model.kitchen.walls.length >= 2 : true,
    model.openings.length > 0 || model.completedSteps.includes(4),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function computeGeometry(model: KitchenProjectModel, rules: RuleParameters): ComputedGeometry {
  const heights = computeHeights(model, rules);
  const ceilingHeight = model.kitchen.ceilingHeight || 2700;
  const walls: Wall[] = model.kitchen.walls;
  const wallA = walls.find((w) => w.id === 'A') ?? walls[0];
  const wallB = walls.find((w) => w.id === 'B');

  // Base (includes trolley, open-box)
  const baseRaw = model.modules.filter((m) => ['base', 'trolley', 'open-box'].includes(m.type));

  // L/U-shape corner: Wall A and Wall B cabinet runs both physically meet at
  // the shared corner square (cabDepth × cabDepth) — without accounting for
  // this, each wall's run is distributed independently starting at x=0,
  // which silently double-counts that square as if it were free floor space
  // on BOTH walls (spec's own "two unrelated rectangles" bug, §18). A real
  // corner base unit (lazy-susan style) occupies that square once; both
  // wall runs are set back by its footprint so neither overlaps it.
  const hasCorner = (model.kitchen.type === 'l-shape' || model.kitchen.type === 'u-shape')
    && !!wallB && wallA && wallA.length > 0 && wallB.length > 0
    && baseRaw.some((m) => m.wallId === 'A') && baseRaw.some((m) => m.wallId === 'B');
  const cornerModules: ComputedModule[] = [];
  const cornerOffset = hasCorner ? heights.baseDepth : 0;
  if (hasCorner) {
    cornerModules.push({
      id: 'corner-1', type: 'corner', wallId: 'A', x: 0,
      width: heights.baseDepth, height: heights.baseHeight, depth: heights.baseDepth,
      shutterDivisions: 1, label: 'CU-01',
    });
  }

  const { distributed: distA, usedWidth: usedA } = wallA
    ? distributeModules('A', baseRaw, wallA.length, rules, cornerOffset)
    : { distributed: [], usedWidth: 0 };
  const { distributed: distB, usedWidth: usedB } = wallB
    ? distributeModules('B', baseRaw, wallB.length, rules, cornerOffset)
    : { distributed: [], usedWidth: 0 };
  const baseModules: ComputedModule[] = [...cornerModules, ...distA, ...distB];

  // Wall cabinets mirror base (only base type, not trolleys/open-boxes)
  const wallModules: ComputedModule[] = model.kitchen.wallCabinetsRequired
    ? baseModules
        .filter((m) => m.type === 'base')
        .map((bm, i) => ({
          ...bm,
          id: `W-${bm.id}`,
          type: 'wall' as const,
          height: heights.wallCabHeight,
          depth: heights.wallCabDepth,
          shutterDivisions: calcShutterDivisions(bm.width, rules),
          label: `W-${String(i + 1).padStart(2, '0')}`,
          hasDrawer: false,
        }))
    : [];

  // Loft — segments spanning wall width
  const loftModules: ComputedModule[] = [];
  if (model.kitchen.loftRequired && heights.loftHeight > 0) {
    for (const wall of walls) {
      if (!wall.length) continue;
      const segs = Math.max(1, Math.ceil(wall.length / rules.shutterDivisionMaxWidth));
      const segW = Math.round(wall.length / segs);
      for (let i = 0; i < segs; i++) {
        const w = i === segs - 1 ? wall.length - i * segW : segW;
        loftModules.push({
          id: `loft-${wall.id}-${i}`,
          type: 'loft',
          wallId: wall.id,
          x: i * segW,
          width: w,
          height: heights.loftHeight,
          depth: heights.loftDepth,
          shutterDivisions: 1,
          label: `L-${wall.id}${String(i + 1).padStart(2, '0')}`,
        });
      }
    }
  }

  const availableWidth: Record<string, number> = {};
  const usedWidth: Record<string, number> = {};
  for (const wall of walls) {
    availableWidth[wall.id] = Math.max(0, wall.length - rules.filler * 2);
  }
  // distributeModules already starts its walk at (filler + cornerOffset), so
  // usedA/usedB already include the corner unit's footprint exactly once —
  // it must NOT be added again here.
  if (wallA) usedWidth['A'] = Math.max(0, usedA - rules.filler);
  if (wallB) usedWidth['B'] = Math.max(0, usedB - rules.filler);

  const validationIssues = validate(model, availableWidth, usedWidth);
  const completionPercent = calcCompletion(model, validationIssues);

  return {
    kitchenType: model.kitchen.type,
    walls,
    ceilingHeight,
    ...heights,
    baseModules,
    wallModules,
    loftModules,
    openings: model.openings,
    availableWidth,
    usedWidth,
    validationIssues,
    completionPercent,
  };
}
