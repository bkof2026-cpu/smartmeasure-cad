// 'straight' = I-Shape Kitchen (the id is kept as-is for backward
// compatibility with existing saved projects/localStorage — only the
// user-facing label changed to "I-Shape Kitchen", per the Kitchen Model
// spec's 4-shape list: I-Shape/L-Shape/U-Shape/Parallel).
export type KitchenType = 'straight' | 'l-shape' | 'u-shape' | 'parallel';
export type KitchenFixPattiPosition = 'none' | 'left' | 'right' | 'both';
export type ModuleType = 'base' | 'wall' | 'loft' | 'trolley' | 'open-box' | 'tall-unit' | 'corner';
export type OpeningType = 'door' | 'window' | 'column' | 'beam' | 'electrical' | 'plumbing' | 'gas' | 'chimney';
export type EvidenceType = 'photo' | 'video' | 'note';
// 'drawing' was a separate screen (LiveDrawing.tsx) before KitchenFlow.tsx
// merged the wizard and the drawing into one screen with internal tabs —
// removed since 'kitchen-steps' (KitchenFlow) now covers both roles.
export type AppScreen = 'project' | 'products' | 'kitchen-steps' | 'admin' | 'final' | 'demos' | 'product-viewer' | 'ai-convert';

export interface ProjectDetails {
  clientName: string;
  projectId: string;
  address: string;
  measuredBy: string;
  date: string;
  contactNumber: string;
  notes: string;
}

export interface Wall {
  id: string;
  label: string;
  length: number;
}

export interface KadappaDetails {
  length: number;
  depth: number;
  height: number;
}

export interface SkirtingDetails {
  height: number;
  depth: number;
}

// ─── I-Shape Kitchen — Kadappa / Pani Patti model ─────────────────────────────
// Deliberately separate from the existing singular KadappaDetails above
// (a whole-kitchen "existing platform" record used by other kitchen
// shapes) — this is the new, named, per-segment Kadappa system specific
// to the I-Shape Kitchen rebuild (Phase 1 of the Kitchen Model spec).

export type WallSideKadappaOption = 'None' | 'Left' | 'Right' | 'Both';

// KitchenWallConfig is the real interface — it describes ONE kitchen wall's
// complete configuration (Kadappa, Clear Width, Trolley, Trolley Panel,
// Side Section Doors, Fix Patti, Pani Patti). IShapeKitchenConfig is kept
// as an exact type alias so every existing import site (the geometry
// engine, KitchenFlow.tsx, trolleyDimensions.ts, etc.) keeps compiling
// unchanged — I-Shape Kitchen IS just a single KitchenWallConfig, drawn
// alone. L-Shape Kitchen (see LShapeKitchenConfig below) reuses this same
// interface twice, once per wall — see LSHAPE_KITCHEN_PLAN.md.
export interface KitchenWallConfig {
  /** Total Kitchen Height (mm) — also the default Height for every
   * Kadappa (Wall Side and Inner Side alike). */
  height: number;
  /** Total Kitchen Width (mm) — also ALWAYS the Pani Patti's own Width;
   * Pani Patti has no independent Width field, per the user's explicit
   * instruction (only its own Height is a real, separate measurement). */
  width: number;
  /** Total Kitchen Depth (mm) — a manual site measurement, used as the
   * source value for the Trolley Depth calculation (Kitchen Depth −
   * Depth Deduction). Not used anywhere else in the I-Shape drawing. */
  depth: number;

  paniPattiHeight: number;

  wallSideKadappa: WallSideKadappaOption;
  /** The Left Wall Side Kadappa's own physical Width (mm) — a real box
   * width, present only when wallSideKadappa is 'Left' or 'Both'. NOT a
   * distance — the open space next to it is a separate Clear Width
   * segment (see clearWidths below). */
  leftWallKadappaWidth: number;
  /** The Right Wall Side Kadappa's own physical Width (mm) — same rule as
   * leftWallKadappaWidth, present only when wallSideKadappa is 'Right' or
   * 'Both'. */
  rightWallKadappaWidth: number;

  hasInnerKadappa: boolean;
  /** Number of Inner Side Kadappas — manually entered, no fixed cap (any
   * count >= 1). */
  innerKadappaCount: number;
  /** Each Inner Side Kadappa's own independently-entered physical Width
   * (mm), in physical left-to-right order — length always kept in sync
   * with innerKadappaCount. */
  innerKadappaWidths: number[];

  /** User-entered "Clear / Inside Width" segments — the open space
   * between two consecutive physical boundaries, left to right. The
   * number of segments and what each one spans depends on which Kadappa
   * exist (see buildKadappaSequence + buildClearSegments in
   * iShapeKitchenGeometry.ts): a wall with no Kadappa contributes a
   * Wall→first-component segment; two consecutive Kadappa contribute one
   * segment between them; a wall WITH a Kadappa contributes none (the
   * Kadappa sits flush against it). Independent from Kadappa width — see
   * the Kadappa-Width vs Clear-Width distinction (never conflate the
   * two). Kept in sync with the live segment count whenever the Kadappa
   * configuration changes. */
  clearWidths: number[];

  /** Which open Kitchen section (a ClearSegment.index from
   * iShapeKitchenGeometry.ts's buildClearSegments) the Trolley's Outer
   * Panel is placed in — null until the user explicitly picks one.
   * NEVER auto-assigned when more than one section exists; the drawing
   * engine refuses to place the Trolley into an unselected section. Only
   * exception: when exactly one section exists, it may be auto-selected
   * (no real ambiguity for the user to resolve). Reset to null whenever
   * the Kadappa configuration changes and the previously selected
   * section no longer exists. */
  trolleySectionId: number | null;

  /** Selected Trolley Type id (key into TROLLEY_TEMPLATES,
   * src/products/kitchen/trolleyTemplates.ts) — null until chosen in
   * Step 2 of the wizard. Its Outer Panel is inserted into the first
   * Inner Side Kadappa section (slot B) by the I-Shape drawing engine. */
  trolleyTemplateId: string | null;
  /** Editable "SPO" cell values for the selected trolley template, keyed
   * by that template's own TrolleySpoField.key (e.g. 'spo', 'spoRight',
   * 'spoCenter') — a trolley with no SPO cells (e.g. 7P-Only) leaves this
   * empty. Every template's spoFields[].default is used until the user
   * edits a value here. Never shared across trolley types — switching
   * Trolley Type does not carry old SPO values over to the new template's
   * (possibly differently-keyed) fields. */
  spoValues: Record<string, number>;

  // ─── Trolley Dimension Calculation (H × W × D) ───────────────────────────
  // Trolley Height  = Total Kitchen Height − Pani Patti Height −
  //                    Floor Ceiling Patti Height − 30mm (height clearance)
  // Trolley Width   = Selected Trolley Section's real Inside/Clear Width
  //                    − 30mm (width fit)
  // Trolley Depth   = Total Kitchen Depth − depthDeduction
  // All three calculated values may be manually overridden by the user
  // (trolleyHeightOverride/etc, null = use the calculated value) — an
  // override is never silently cleared by an unrelated field changing.

  /** Floor Ceiling Patti height (mm) deducted from Total Kitchen Height —
   * editable (was a fixed 10mm "Gap"). Not every kitchen has one, and
   * where it exists its height varies site to site, so this is a real
   * user-entered value rather than a constant. */
  floorCeilingPattiHeight: number;

  /** Depth deduction (mm) applied to Kitchen Depth to get Trolley Depth —
   * editable, default 20mm, the only other common value is 10mm. */
  depthDeduction: number;

  /** Manual override for the calculated Trolley Height — null = use the
   * live formula result. Set only when the user directly edits the Final
   * Trolley Height field. */
  trolleyHeightOverride: number | null;
  /** Manual override for the calculated Trolley Width — null = use the
   * live formula result. */
  trolleyWidthOverride: number | null;
  /** Manual override for the calculated Trolley Depth — null = use the
   * live formula result. */
  trolleyDepthOverride: number | null;

  // ─── Side Section Doors (src/products/kitchen/sideSectionDoorCalc.ts) ───
  // The plain cabinet door(s) filling the LEFT/RIGHT outer Clear-Width
  // section (the section against the actual room wall — never the section
  // the Trolley sits in). Door count is auto-recommended from that
  // section's own width (<=600mm -> 1, >=600mm -> 2) but stays editable —
  // null means "use the auto-recommendation," matching the same override
  // convention as trolleyHeightOverride/etc above.
  /** Manual override for the Left side section's door count — null = auto-recommended. */
  leftSideDoorCountOverride: number | null;
  /** Manual override for the Right side section's door count — null = auto-recommended. */
  rightSideDoorCountOverride: number | null;
  /** Manual override for an INNER (between-two-Kadappa, non-Trolley) Clear
   * Segment's door count, keyed by that segment's own index — absent/
   * undefined = auto-recommended. A plain map (not two fixed left/right
   * fields) because a kitchen can have any number of inner sections
   * depending on how many Kadappa are configured. */
  innerSideDoorCountOverrides: Record<number, number>;

  // ─── Fix Patti (src/products/kitchen/fixPattiCalc.ts) ────────────────────
  // A real vertical panel attached to the OUTSIDE of the kitchen box, on
  // the chosen side(s) — same None/Left/Right/Both shape as the Wardrobe's
  // own Fix Patti (src/engine/loftDoorEngine.ts's FixPattiPosition), kept
  // as its own local type here since this file intentionally has no
  // imports. Both Height and Width are manually entered per side (never
  // derived) — the defaults shown in the UI are Height = Total Kitchen
  // Height, Width = 40mm, but the user can type any real value.
  fixPattiPosition: KitchenFixPattiPosition;
  fixPattiLeftHeight: number;
  fixPattiLeftWidth: number;
  fixPattiRightHeight: number;
  fixPattiRightWidth: number;
}

/** I-Shape Kitchen IS just a single KitchenWallConfig, drawn alone — see
 * the comment above KitchenWallConfig. Kept as its own name since every
 * existing import site already spells it this way. */
export type IShapeKitchenConfig = KitchenWallConfig;

// ─── L-Shape Kitchen — Wall A + Wall B + shared corner ────────────────────────
// See LSHAPE_KITCHEN_PLAN.md for the full design. L-Shape reuses
// KitchenWallConfig wholesale for both walls (§2.3 of the plan — Wall A and
// Wall B must expose IDENTICAL functionality, independently editable), and
// factors Kitchen Height/Depth/Pani Patti Height out as shared, common-to-
// both-walls values (§15 Open Question 1, resolved: option (a)) rather than
// duplicating them per wall.

export type WallBPosition = 'left' | 'right';

export interface LShapeCornerConfig {
  /** Per LSHAPE_KITCHEN_PLAN.md §0.1: the Corner Fix Patti is its own
   * distinct, optional concept — NEVER a Wall-Side Kadappa, never part of
   * either wall's own fixPatti fields, never counted in either wall's
   * Total Width. Resolved exclusively by the dedicated corner engine. */
  fixPattiEnabled: boolean;
  fixPattiWidth: number;
  fixPattiHeight: number;
}

export interface LShapeKitchenConfig {
  /** Common to both walls (§3 of the original spec / §15 Q1 of the plan) —
   * copied into each wall's own KitchenWallConfig.height/.depth/
   * .paniPattiHeight right before resolveKitchenWall is called for it, so
   * the wall resolver itself never needs to know these are shared. */
  kitchenHeight: number;
  kitchenDepth: number;
  paniPattiHeight: number;

  wallA: KitchenWallConfig;
  wallB: KitchenWallConfig;

  /** Which physical end of Wall A the shared corner (and therefore Wall B)
   * sits at. Fully user-editable; switching this must never reset either
   * wall's own measurements (LSHAPE_KITCHEN_PLAN.md §13). */
  wallBPosition: WallBPosition;

  corner: LShapeCornerConfig;
}

export interface KitchenConfig {
  type: KitchenType;
  walls: Wall[];
  ceilingHeight: number;
  hasKadappa: boolean;
  kadappa?: KadappaDetails;
  hasSkirting: boolean;
  skirting?: SkirtingDetails;
  loftRequired: boolean;
  wallCabinetsRequired: boolean;
  baseCabinetsRequired: boolean;
  trolleyRequired: boolean;
  openBoxRequired: boolean;
  tallUnitRequired: boolean;
  cornerUnitRequired: boolean;
  /** Only meaningful when type === 'straight' (I-Shape Kitchen). */
  iShape: IShapeKitchenConfig;
  /** Only meaningful when type === 'l-shape'. */
  lShape: LShapeKitchenConfig;
}

export interface Opening {
  id: string;
  type: OpeningType;
  wallId: string;
  distanceFromLeft: number;
  width: number;
  height: number;
  sillHeight?: number;
  direction?: 'left' | 'right';
  notes?: string;
}

export interface CabinetModule {
  id: string;
  type: ModuleType;
  wallId: string;
  position: number;
  width: number;
  height: number;
  depth: number;
  shutterRequired: boolean;
  hasDrawer: boolean;
  hasShelf: boolean;
  notes?: string;
  isFixed: boolean;
}

export interface EvidenceItem {
  id: string;
  measurementId: string;
  label: string;
  type: EvidenceType;
  caption: string;
  dataUrl?: string;
  timestamp: string;
}

export interface Version {
  id: string;
  name: string;
  timestamp: string;
  notes: string;
}

export interface MeasurementHistoryEntry {
  id: string;
  productId: string;
  productName: string;
  projectId: string;
  employeeName: string;
  timestamp: string;
  dims: Record<string, number | string>;
  notes?: string;
}

export interface KitchenProjectModel {
  project: ProjectDetails;
  kitchen: KitchenConfig;
  openings: Opening[];
  modules: CabinetModule[];
  evidence: EvidenceItem[];
  versions: Version[];
  employeeName?: string;
  /** Real DB employee ID (e.g. "E101") the current session's login token
   * belongs to — distinct from employeeName (their display name), used
   * wherever a request must be tied back to a specific database row
   * (drawing-event logging, profile stats). */
  employeeId?: string;
  isLoggedIn?: boolean;
  lastSavedAt?: string;
  measurementHistory?: MeasurementHistoryEntry[];
  isDemoData: boolean;
  currentStep: number;
  completedSteps: number[];
}

// ─── Rule parameters ──────────────────────────────────────────────────────────

export interface RuleParameters {
  baseHeight: number;
  baseDepth: number;
  wallCabHeight: number;
  wallCabDepth: number;
  loftHeight: number;
  loftDepth: number;
  counterToWallGap: number;
  kadappaDefaultHeight: number;
  skirtingDefaultHeight: number;
  carcassThickness: number;
  shutterThickness: number;
  shutterGap: number;
  filler: number;
  sidePanel: number;
  trolleyStandardWidths: number[];
  minModuleWidth: number;
  maxModuleWidth: number;
  shutterDivisionMaxWidth: number;
  kadappaReduction: number;
}

// ─── Computed geometry ────────────────────────────────────────────────────────

export interface ComputedModule {
  id: string;
  type: ModuleType;
  wallId: string;
  x: number;
  width: number;
  height: number;
  depth: number;
  shutterDivisions: number;
  label: string;
  hasDrawer?: boolean;
}

export interface ValidationIssue {
  id: string;
  level: 'error' | 'warning' | 'info';
  message: string;
}

export interface ComputedGeometry {
  kitchenType: KitchenType;
  walls: Wall[];
  ceilingHeight: number;
  kadappaHeight: number;
  skirtingHeight: number;
  baseHeight: number;
  baseDepth: number;
  wallCabHeight: number;
  wallCabDepth: number;
  wallCabBottom: number;
  loftHeight: number;
  loftBottom: number;
  counterHeight: number;
  baseModules: ComputedModule[];
  wallModules: ComputedModule[];
  loftModules: ComputedModule[];
  openings: Opening[];
  availableWidth: Record<string, number>;
  usedWidth: Record<string, number>;
  validationIssues: ValidationIssue[];
  completionPercent: number;
}
