// 'straight' = I-Shape Kitchen (the id is kept as-is for backward
// compatibility with existing saved projects/localStorage — only the
// user-facing label changed to "I-Shape Kitchen", per the Kitchen Model
// spec's 4-shape list: I-Shape/L-Shape/U-Shape/Parallel).
export type KitchenType = 'straight' | 'l-shape' | 'u-shape' | 'parallel';
export type ModuleType = 'base' | 'wall' | 'loft' | 'trolley' | 'open-box' | 'tall-unit' | 'corner';
export type OpeningType = 'door' | 'window' | 'column' | 'beam' | 'electrical' | 'plumbing' | 'gas' | 'chimney';
export type EvidenceType = 'photo' | 'video' | 'note';
export type AppScreen = 'project' | 'products' | 'kitchen-steps' | 'drawing' | 'admin' | 'final' | 'demos' | 'product-viewer' | 'ai-convert';

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

export interface IShapeKitchenConfig {
  /** Total Kitchen Height (mm) — also the default Height for every
   * Kadappa (Wall Side and Inner Side alike). */
  height: number;
  /** Total Kitchen Width (mm) — also ALWAYS the Pani Patti's own Width;
   * Pani Patti has no independent Width field, per the user's explicit
   * instruction (only its own Height is a real, separate measurement). */
  width: number;

  paniPattiHeight: number;

  wallSideKadappa: WallSideKadappaOption;
  /** Width (mm) of the Left Wall Side Kadappa — present only when
   * wallSideKadappa is 'Left' or 'Both'. */
  leftWallKadappaWidth: number;
  /** Width (mm) of the Right Wall Side Kadappa — present only when
   * wallSideKadappa is 'Right' or 'Both'. */
  rightWallKadappaWidth: number;

  hasInnerKadappa: boolean;
  /** Number of Inner Side Kadappas — manually entered, default 2. */
  innerKadappaCount: number;
  /** Each Inner Side Kadappa's own independently-entered Width (mm), in
   * physical left-to-right order — length always kept in sync with
   * innerKadappaCount. */
  innerKadappaWidths: number[];

  /** Selected Trolley Type id (key into TROLLEY_TEMPLATES,
   * src/products/kitchen/trolleyTemplates.ts) — null until chosen in
   * Step 3 of the wizard. Its Outer Panel is inserted into the first
   * Inner Side Kadappa section (slot B) by the I-Shape drawing engine. */
  trolleyTemplateId: string | null;
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
