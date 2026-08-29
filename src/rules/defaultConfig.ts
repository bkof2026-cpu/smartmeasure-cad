import type { RuleParameters } from '../store/types';

// ⚠️ ALL VALUES BELOW ARE DEMO PLACEHOLDER VALUES ONLY.
// Do NOT treat as actual company standards.
// Configure in Admin → Company Standards before production use.

export const DEFAULT_RULE_PARAMS: RuleParameters = {
  baseHeight: 750,              // DEMO VALUE — base cabinet carcass height (mm)
  baseDepth: 600,               // DEMO VALUE — base cabinet depth (mm)
  wallCabHeight: 720,           // DEMO VALUE — wall cabinet height (mm)
  wallCabDepth: 350,            // DEMO VALUE — wall cabinet depth (mm)
  loftHeight: 400,              // DEMO VALUE — loft cabinet height (mm)
  loftDepth: 350,               // DEMO VALUE — loft cabinet depth (mm)
  counterToWallGap: 500,        // DEMO VALUE — counter top to wall cab bottom (backsplash zone, mm)
  kadappaDefaultHeight: 100,    // DEMO VALUE — existing platform/kadappa height (mm)
  skirtingDefaultHeight: 100,   // DEMO VALUE — kickboard/skirting height (mm)
  carcassThickness: 18,         // DEMO VALUE — carcass board thickness (mm)
  shutterThickness: 18,         // DEMO VALUE — shutter/door thickness (mm)
  shutterGap: 3,                // DEMO VALUE — gap around each shutter leaf (mm)
  filler: 6,                    // DEMO VALUE — side filler per wall end (mm)
  sidePanel: 18,                // DEMO VALUE — exposed side panel thickness (mm)
  trolleyStandardWidths: [450, 600],   // DEMO VALUES
  minModuleWidth: 300,          // DEMO VALUE (mm)
  maxModuleWidth: 900,          // DEMO VALUE (mm)
  shutterDivisionMaxWidth: 600, // DEMO VALUE — split shutter above this width (mm)
  kadappaReduction: 5,          // DEMO VALUE — clearance/tolerance (mm)
};

export type RuleKey = keyof RuleParameters;

export const RULE_LABELS: Record<string, string> = {
  baseHeight: 'Base Cabinet Height (mm)',
  baseDepth: 'Base Cabinet Depth (mm)',
  wallCabHeight: 'Wall Cabinet Height (mm)',
  wallCabDepth: 'Wall Cabinet Depth (mm)',
  loftHeight: 'Loft Cabinet Height (mm)',
  loftDepth: 'Loft Cabinet Depth (mm)',
  counterToWallGap: 'Counter Top to Wall Cabinet Gap (mm)',
  kadappaDefaultHeight: 'Default Kadappa / Platform Height (mm)',
  skirtingDefaultHeight: 'Default Skirting / Kickboard Height (mm)',
  carcassThickness: 'Carcass Thickness (mm)',
  shutterThickness: 'Shutter Thickness (mm)',
  shutterGap: 'Shutter Gap per Side (mm)',
  filler: 'Filler per Wall End (mm)',
  sidePanel: 'Side Panel Thickness (mm)',
  shutterDivisionMaxWidth: 'Max Shutter Width Before Split (mm)',
  minModuleWidth: 'Minimum Module Width (mm)',
  maxModuleWidth: 'Maximum Module Width (mm)',
  kadappaReduction: 'Kadappa Tolerance / Reduction (mm)',
};

export const RULE_SECTIONS: { title: string; keys: (keyof RuleParameters)[] }[] = [
  { title: 'Base Cabinet', keys: ['baseHeight', 'baseDepth'] },
  { title: 'Wall Cabinet', keys: ['wallCabHeight', 'wallCabDepth', 'counterToWallGap'] },
  { title: 'Loft Cabinet', keys: ['loftHeight', 'loftDepth'] },
  { title: 'Existing Conditions', keys: ['kadappaDefaultHeight', 'skirtingDefaultHeight', 'kadappaReduction'] },
  { title: 'Fabrication', keys: ['carcassThickness', 'shutterThickness', 'shutterGap', 'filler', 'sidePanel'] },
  { title: 'Module Limits', keys: ['minModuleWidth', 'maxModuleWidth', 'shutterDivisionMaxWidth'] },
];
