export type KitchenType = 'straight' | 'l-shape' | 'u-shape' | 'parallel' | 'island' | 'custom';
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
