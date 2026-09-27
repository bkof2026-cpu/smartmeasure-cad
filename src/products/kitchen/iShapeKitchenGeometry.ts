import type { ResolvedDrawing } from '../../engine/types';
import { placeNoteBoxes } from '../../engine/noteBoxPlacement';
import { resolveDimensions } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity } from '../../engine/validationEngine';
import type { IShapeKitchenConfig } from '../../store/types';
import { resolveKitchenWall, rotateWallOutput } from './kitchenWallGeometry';

// ─────────────────────────────────────────────────────────────────────────────
// I-Shape Kitchen — the single-wall Kitchen shape. All of the real layout
// logic (Kadappa, Clear Width, Trolley, Trolley Panel, Side Section Doors,
// Fix Patti, Pani Patti, dimension/label conventions, validation) now lives
// in kitchenWallGeometry.ts's resolveKitchenWall — the SAME engine L-Shape's
// Wall A and Wall B each call independently (see lShapeKitchenGeometry.ts).
// This file is a thin wrapper: resolve one wall in its own local frame,
// translate it onto the drawing's fixed origin (a pure translate — I-Shape
// never rotates), then finish the shared tail-end steps every Kitchen shape
// needs (resolve dimensions, place note-box callouts, size the world
// bounds, run validation).
//
// Re-exports every helper (buildKadappaSequence, buildClearSegments,
// resolveTrolleySectionId, KadappaSlot, ClearSegment) from
// kitchenWallGeometry.ts unchanged, since KitchenFlow.tsx's wizard imports
// them from this file's path.
// ─────────────────────────────────────────────────────────────────────────────

export {
  buildKadappaSequence,
  buildClearSegments,
  resolveTrolleySectionId,
  type KadappaSlot,
  type ClearSegment,
} from './kitchenWallGeometry';

export interface IShapeKitchenDrawingInputs {
  iShape: IShapeKitchenConfig;
}

export function resolveIShapeKitchenPlan(inputs: IShapeKitchenDrawingInputs): ResolvedDrawing {
  const { iShape } = inputs;

  // Pure translate (no rotation) — I-Shape is always the single horizontal
  // run. resolveKitchenWall's own local frame already bakes in the same
  // leaderMargin/kitchenY=90 constants the original single-function version
  // used directly, so translating by (0, 0) here reproduces the exact same
  // on-canvas positions as before this extraction — this IS the drawing's
  // real origin, not a placeholder.
  const local = resolveKitchenWall(iShape, '');
  const wall = rotateWallOutput(local, { x: 0, y: 0 }, 'horizontal');

  const dimensions = resolveDimensions(wall.dimensionRequests);
  const preWorldWidth = wall.bounds.right + 60;
  const preWorldHeight = wall.bounds.bottom + 60;
  let noteBoxes = placeNoteBoxes(wall.calloutRequests, {
    components: wall.components, dimensions, lines: wall.lines, worldWidth: preWorldWidth, worldHeight: preWorldHeight,
  });
  const worldWidth = Math.max(preWorldWidth, ...noteBoxes.map((nb) => nb.x + 190));
  const worldHeight = Math.max(preWorldHeight, ...noteBoxes.map((nb) => nb.y + 80));

  return {
    view: 'plan', productType: 'kitchen', designId: 'i-shape', designName: 'I-Shape Kitchen',
    worldWidth, worldHeight, components: wall.components, dimensions, lines: wall.lines, noteBoxes,
    issues: [...wall.issues, ...validateComponentBounds(wall.components, worldWidth, worldHeight), ...validateDimensionIntegrity(dimensions)],
    formulaStatus: 'verified',
  };
}
