import type { KitchenProjectModel, KitchenWallConfig, LShapeKitchenConfig } from '../store/types';

// ⚠️ DEMO DATA — All values are illustrative only. Not actual company standards.

/** A blank KitchenWallConfig — every numeric field zeroed, every toggle at
 * its "nothing configured yet" default. Used as the starting point for
 * both a fresh I-Shape kitchen and each wall of a fresh L-Shape kitchen, so
 * the two shapes' defaults can never drift apart. */
function emptyKitchenWallConfig(): KitchenWallConfig {
  return {
    height: 0,
    width: 0,
    depth: 0,
    paniPattiHeight: 0,
    wallSideKadappa: 'None',
    leftWallKadappaWidth: 0,
    rightWallKadappaWidth: 0,
    hasInnerKadappa: false,
    innerKadappaCount: 2,
    innerKadappaWidths: [],
    clearWidths: [],
    trolleySectionId: null,
    trolleyTemplateId: null,
    spoValues: {},
    floorCeilingPattiHeight: 10,
    trolleyHeightClearance: 30,
    depthDeduction: 20,
    trolleyHeightOverride: null,
    trolleyWidthOverride: null,
    trolleyDepthOverride: null,
    leftSideDoorCountOverride: null,
    rightSideDoorCountOverride: null,
    innerSideDoorCountOverrides: {},
    fixPattiPosition: 'none',
    fixPattiLeftHeight: 0,
    fixPattiLeftWidth: 40,
    fixPattiRightHeight: 0,
    fixPattiRightWidth: 40,
  };
}

/** A blank LShapeKitchenConfig — both walls start from
 * emptyKitchenWallConfig(), Wall B Position defaults to 'right' per
 * LSHAPE_KITCHEN_PLAN.md §15 (matches the reference sketch; fully
 * user-editable), Corner Fix Patti starts disabled (never invented). */
export function emptyLShapeKitchenConfig(): LShapeKitchenConfig {
  return {
    kitchenHeight: 0,
    kitchenDepth: 0,
    paniPattiHeight: 0,
    wallA: emptyKitchenWallConfig(),
    wallB: emptyKitchenWallConfig(),
    wallBPosition: 'right',
    corner: { fixPattiEnabled: false, fixPattiWidth: 40, fixPattiHeight: 0 },
  };
}

// ── Arc. Rutuja Joshi · Best Kitchennet · Nashik · imported from client PDF ──
export const DEMO_PROJECT: KitchenProjectModel = {
  isDemoData: true,
  // Left at 5 (the old wizard's "Review" step) even though the wizard is
  // now only 3 steps (Kitchen Type, Features/Kadappa, Trolley) —
  // KitchenFlow.tsx opens straight on its Drawing tab whenever
  // currentStep is already past TOTAL_STEPS (this demo project — an
  // already-fully-measured L-Shape kitchen imported from a client PDF —
  // has nothing left to configure in the new wizard, and Step 2's
  // Kadappa editor is I-Shape-only anyway, meaningless for an L-Shape
  // project).
  currentStep: 5,
  completedSteps: [1, 2, 3, 4],
  project: {
    clientName: 'Arc. Rutuja Joshi — Best Kitchennet',
    projectId: 'XXXXX-9038',
    address: '601 Ashray Residency, Racca Colony, Near Jain Mandir, Nashik',
    measuredBy: 'Nayan Mandlik',
    date: '2026-07-05',
    contactNumber: '+91 97673 71797',
    notes: 'L-Shape Modular Kitchen · H-Glossy Olivilya N0000 + PC140 L22 Beige · Fluted Glass Crockery · Rolling Shutter Storage · Hettich Hardware · All measurements from client PDF · DEMO DATA',
  },
  kitchen: {
    type: 'l-shape',
    walls: [
      { id: 'A', label: 'A', length: 3085 },
      { id: 'B', label: 'B', length: 2560 },
    ],
    ceilingHeight: 2750,
    hasKadappa: true,
    kadappa: { length: 3085, depth: 985, height: 100 },
    hasSkirting: true,
    skirting: { height: 70, depth: 985 },
    loftRequired: true,
    wallCabinetsRequired: true,
    baseCabinetsRequired: true,
    trolleyRequired: true,
    openBoxRequired: true,
    tallUnitRequired: true,
    cornerUnitRequired: true,
    // Not the active shape for this demo project (l-shape), but every
    // KitchenConfig carries iShape so switching Kitchen Type to I-Shape
    // always has real starting values — matches the spec's own
    // acceptance-test example (§34) so a fresh look at I-Shape Kitchen
    // shows a fully worked, sensible configuration rather than zeros.
    iShape: {
      height: 2200,
      // Kadappa are real proportional-width boxes; Clear Widths are the
      // OPEN space between them, entered separately (never conflated) —
      // matches the spec's own §40 worked example exactly:
      // A(450) + A→B(300) + B(500) + B→C(250) + C(600) + C→D(300) + D(310)
      // = 2710 ≠ 3000, so a real remaining/open segment intentionally
      // still shows a WIDTH_SUM_MISMATCH warning in this demo (never
      // silently stretched) — matches §27's own "remaining 290mm must be
      // represented, do not silently stretch" acceptance example.
      width: 3000,
      depth: 600,
      paniPattiHeight: 100,
      wallSideKadappa: 'Both',
      leftWallKadappaWidth: 450,
      rightWallKadappaWidth: 310,
      hasInnerKadappa: true,
      innerKadappaCount: 2,
      innerKadappaWidths: [500, 600],
      clearWidths: [300, 250, 300],
      // Explicit section pick (A → B, index 0) — the demo shows the real
      // trolley template's Outer Panel filling that section end-to-end;
      // no longer auto-assumed by the engine, matches the section-
      // selection spec's requirement that Trolley placement is always a
      // real user choice.
      trolleySectionId: 0,
      trolleyTemplateId: '7p-only',
      spoValues: {},
      floorCeilingPattiHeight: 10,
      trolleyHeightClearance: 30,
      depthDeduction: 20,
      trolleyHeightOverride: null,
      trolleyWidthOverride: null,
      trolleyDepthOverride: null,
      leftSideDoorCountOverride: null,
      rightSideDoorCountOverride: null,
      innerSideDoorCountOverrides: {},
      fixPattiPosition: 'none',
      fixPattiLeftHeight: 2200,
      fixPattiLeftWidth: 40,
      fixPattiRightHeight: 2200,
      fixPattiRightWidth: 40,
    },
    // This demo project's own active shape is 'l-shape' (see kitchen.type
    // above) but its real Wall A/Wall B measurements haven't been entered
    // into the new LShapeKitchenConfig model yet (this demo predates that
    // feature) — starts blank rather than guessing values, same as every
    // other KitchenConfig carrying an unused shape's config.
    lShape: emptyLShapeKitchenConfig(),
  },
  openings: [
    {
      id: 'WIN-01',
      type: 'window',
      wallId: 'A',
      distanceFromLeft: 728,
      width: 0,
      height: 0,
      sillHeight: 900,
      notes: 'Window opening between corner unit and main base run — exact size on site',
    },
  ],
  modules: [
    // ── Wall A base cabinets (PDF: 445 + 670 TD + 320 SPO + 461 + 461 = 2357mm from x=728) ──
    {
      id: 'BASE-A-01', type: 'base', wallId: 'A', position: -1,
      width: 445, height: 750, depth: 985,
      shutterRequired: true, hasDrawer: false, hasShelf: true, isFixed: true,
      notes: 'B-01 · PC140 L22 Beige',
    },
    {
      id: 'TROLL-A-01', type: 'trolley', wallId: 'A', position: -1,
      width: 670, height: 750, depth: 985,
      shutterRequired: false, hasDrawer: true, hasShelf: false, isFixed: true,
      notes: 'TD-01 · Tandem Drawer 350/398 · Hettich Tendam',
    },
    {
      id: 'OB-A-01', type: 'open-box', wallId: 'A', position: -1,
      width: 320, height: 750, depth: 985,
      shutterRequired: false, hasDrawer: false, hasShelf: true, isFixed: true,
      notes: 'SPO · Space Tower / Open unit',
    },
    {
      id: 'BASE-A-02', type: 'base', wallId: 'A', position: -1,
      width: 461, height: 750, depth: 985,
      shutterRequired: true, hasDrawer: false, hasShelf: true, isFixed: true,
      notes: 'B-02 · PC140 L22 Beige',
    },
    {
      id: 'BASE-A-03', type: 'base', wallId: 'A', position: -1,
      width: 461, height: 750, depth: 985,
      shutterRequired: true, hasDrawer: false, hasShelf: true, isFixed: true,
      notes: 'B-03 · PC140 L22 Beige',
    },
    // ── Wall B modules (PDF: Tall 755 + Roll-Shutter 600 + Fridge 600 + Open 605 = 2560mm) ──
    {
      id: 'TALL-B-01', type: 'tall-unit', wallId: 'B', position: -1,
      width: 755, height: 2750, depth: 940,
      shutterRequired: true, hasDrawer: false, hasShelf: true, isFixed: true,
      notes: 'Tall unit · WC-01 upper + B-04 base · PC140 L22 Beige',
    },
    {
      id: 'BASE-B-01', type: 'base', wallId: 'B', position: -1,
      width: 600, height: 750, depth: 940,
      shutterRequired: true, hasDrawer: false, hasShelf: false, isFixed: true,
      notes: 'Rolling shutter unit — 2185mm height · Aluminium shutter',
    },
    {
      id: 'BASE-B-02', type: 'base', wallId: 'B', position: -1,
      width: 600, height: 750, depth: 940,
      shutterRequired: false, hasDrawer: false, hasShelf: false, isFixed: true,
      notes: 'Fridge alcove — open space for refrigerator',
    },
    {
      id: 'OB-B-01', type: 'open-box', wallId: 'B', position: -1,
      width: 605, height: 750, depth: 940,
      shutterRequired: false, hasDrawer: false, hasShelf: true, isFixed: true,
      notes: 'Open shelves · CK-05 + CK-06 crockery (298+298mm) above',
    },
  ],
  evidence: [
    {
      id: 'EV-01',
      measurementId: 'A',
      label: 'Wall A',
      type: 'photo',
      caption: 'Wall A (3085mm) — Elevation A PDF page. Crockery units, fluted glass, loft 400mm.',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'EV-02',
      measurementId: 'B',
      label: 'Wall B',
      type: 'photo',
      caption: 'Wall B (2560mm) — Elevation B PDF page. Tall unit 755mm, rolling shutter 600mm, fridge 600mm, open 605mm.',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 'EV-03',
      measurementId: 'WIN-01',
      label: 'Corner / Plan',
      type: 'note',
      caption: 'Corner unit 760mm × 985mm depth. Hettich Tendam kitchen trolley at 670mm. PDF imported 05/07/2026.',
      timestamp: new Date(Date.now() - 900000).toISOString(),
    },
  ],
  versions: [
    {
      id: 'V1',
      name: 'V1 — PDF Import · Arc. Rutuja Joshi',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      notes: 'All measurements imported from client PDF. Best Kitchennet, Nashik. Designer: Nayan Mandlik.',
    },
  ],
};

export function createNewProject(): KitchenProjectModel {
  return {
    isDemoData: false,
    currentStep: 1,
    completedSteps: [],
    project: {
      clientName: '',
      projectId: `PRJ-${Date.now().toString().slice(-6)}`,
      address: '',
      measuredBy: '',
      date: new Date().toISOString().slice(0, 10),
      contactNumber: '',
      notes: '',
    },
    kitchen: {
      type: 'straight',
      walls: [{ id: 'A', label: 'A', length: 0 }],
      ceilingHeight: 0,
      hasKadappa: false,
      hasSkirting: false,
      loftRequired: false,
      wallCabinetsRequired: true,
      baseCabinetsRequired: true,
      trolleyRequired: false,
      openBoxRequired: false,
      tallUnitRequired: false,
      cornerUnitRequired: false,
      iShape: emptyKitchenWallConfig(),
      lShape: emptyLShapeKitchenConfig(),
    },
    openings: [],
    modules: [],
    evidence: [],
    versions: [],
  };
}
