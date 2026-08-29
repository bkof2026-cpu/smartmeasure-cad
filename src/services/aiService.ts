import type { KitchenProjectModel } from '../store/types';

// ─── AIService interface ──────────────────────────────────────────────────────
// This abstraction allows a real Claude API integration later via a
// secure server-side endpoint. Currently backed by MockClaudeService.

export interface AIMessage {
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
}

export interface AIService {
  getNextQuestion(model: KitchenProjectModel, step: number): Promise<string>;
  interpretUserInput(input: string, model: KitchenProjectModel): Promise<ModelUpdate | null>;
  validateMeasurement(field: string, value: number): Promise<string | null>;
  getContextualHint(model: KitchenProjectModel): Promise<string>;
}

export interface ModelUpdate {
  type: 'wall' | 'opening' | 'module' | 'config';
  field: string;
  value: unknown;
  confidence: number;
}

// ─── Mock implementation ──────────────────────────────────────────────────────

const STEP_QUESTIONS: Record<number, (model: KitchenProjectModel) => string> = {
  1: () => "What type of kitchen layout does this site have? Common types are Straight, L-Shape, U-Shape, Parallel, or Island.",
  2: (m) => {
    const missing = [];
    if (!m.kitchen.loftRequired && m.kitchen.loftRequired === undefined) missing.push('loft');
    if (!m.kitchen.trolleyRequired && m.kitchen.trolleyRequired === undefined) missing.push('trolley');
    return missing.length
      ? `Should the kitchen include ${missing.join(' and ')}?`
      : "Please confirm the required cabinet types: base cabinets, wall cabinets, loft, trolley, open box.";
  },
  3: (m) => {
    const wallA = m.kitchen.walls.find((w) => w.id === 'A');
    if (!wallA?.length) return "Please measure Wall A — the main kitchen wall length in mm.";
    const wallB = m.kitchen.walls.find((w) => w.id === 'B');
    if (m.kitchen.type === 'l-shape' && !wallB?.length) return `Wall A is ${wallA.length} mm. Now measure Wall B — the perpendicular wall length in mm.`;
    if (!m.kitchen.ceilingHeight) return "What is the floor-to-ceiling height in mm?";
    return `All walls recorded: Wall A = ${wallA?.length} mm${wallB ? `, Wall B = ${wallB.length} mm` : ''}. Height = ${m.kitchen.ceilingHeight} mm. Are there any corrections?`;
  },
  4: (m) => {
    if (m.openings.length === 0) return "Are there any doors, windows, columns or beams on the kitchen walls? If yes, describe their position and size.";
    return `${m.openings.length} opening(s) recorded. Are there any additional obstacles — electrical points, plumbing, gas, chimney duct?`;
  },
  5: (m) => {
    if (m.modules.length === 0) return "No cabinet modules added yet. Based on the wall dimensions, I can suggest a standard module layout. Shall I generate a starting configuration?";
    const wallA = m.kitchen.walls.find((w) => w.id === 'A');
    const totalW = m.modules.filter((mod) => mod.wallId === 'A').reduce((s, mod) => s + mod.width, 0);
    const diff = (wallA?.length ?? 0) - totalW;
    if (diff > 50) return `Current modules use ${totalW} mm. Wall A has ${wallA?.length} mm available — there is a ${diff} mm gap. Would you like to add a filler or adjust module widths?`;
    return "Module configuration looks complete. Review module widths and confirm.";
  },
};

const HINTS: string[] = [
  "Tip: Measure twice — always verify dimensions with a second reading.",
  "Tip: Record photo evidence at wall corners and at each opening.",
  "Tip: Note any existing pipes or electrical points before placing cabinets.",
  "Tip: If the wall is not plumb, record the largest measurement.",
  "Tip: Trolley width should be measured as per standard sizes: 450 mm or 600 mm.",
  "Tip: Loft height is typically calculated as ceiling height minus base height minus wall cabinet height minus gap.",
];

function parseNaturalLanguageUpdate(input: string): ModelUpdate | null {
  const lower = input.toLowerCase();

  // "wall a = 3085" or "wall a is 3085"
  const wallMatch = lower.match(/wall\s+([ab])\s*[=is]+\s*(\d+)/);
  if (wallMatch) {
    return { type: 'wall', field: wallMatch[1].toUpperCase(), value: parseInt(wallMatch[2]), confidence: 0.95 };
  }

  // "trolley 450" or "trolley = 600"
  const trolleyMatch = lower.match(/trolley\s*[=:to]+\s*(\d+)/);
  if (trolleyMatch) {
    return { type: 'module', field: 'trolley-width', value: parseInt(trolleyMatch[1]), confidence: 0.9 };
  }

  // "height 2700" or "ceiling height 2700"
  const heightMatch = lower.match(/(?:ceiling|height)\s*[=:is]+\s*(\d+)/);
  if (heightMatch) {
    return { type: 'config', field: 'ceilingHeight', value: parseInt(heightMatch[1]), confidence: 0.9 };
  }

  // "window 1200 wide, 500 from left"
  const windowMatch = lower.match(/window.*?(\d+).*?wide.*?(\d+).*?(?:from left|from corner)/);
  if (windowMatch) {
    return {
      type: 'opening',
      field: 'window',
      value: { width: parseInt(windowMatch[1]), distanceFromLeft: parseInt(windowMatch[2]) },
      confidence: 0.8,
    };
  }

  return null;
}

class MockClaudeService implements AIService {
  async getNextQuestion(model: KitchenProjectModel, step: number): Promise<string> {
    await delay(400);
    const fn = STEP_QUESTIONS[step];
    return fn ? fn(model) : "Is there anything else you'd like to add or change?";
  }

  async interpretUserInput(input: string, _model: KitchenProjectModel): Promise<ModelUpdate | null> {
    await delay(600);
    return parseNaturalLanguageUpdate(input);
  }

  async validateMeasurement(field: string, value: number): Promise<string | null> {
    await delay(200);
    if (field === 'ceilingHeight' && (value < 2100 || value > 3600)) {
      return `Ceiling height ${value} mm is unusual. Typical range is 2100–3600 mm. Please verify.`;
    }
    if (field.startsWith('wall') && (value < 500 || value > 12000)) {
      return `Wall length ${value} mm seems out of range. Typical kitchen walls: 500–12000 mm.`;
    }
    return null;
  }

  async getContextualHint(_model: KitchenProjectModel): Promise<string> {
    await delay(100);
    return HINTS[Math.floor(Math.random() * HINTS.length)];
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const aiService: AIService = new MockClaudeService();
