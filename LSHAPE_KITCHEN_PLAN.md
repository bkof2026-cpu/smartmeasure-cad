# L-Shape Kitchen — Implementation Plan

Status: **PLAN ONLY — no code written yet.** This document is the complete
design for the next Kitchen Type (L-Shape), to be reviewed and approved
before any implementation begins, per the project's own working convention
(see `KITCHEN_PLAN.md` for the I-Shape system this reuses).

---

## 0. Governing principle

> The existing I-Shape Kitchen is the SOURCE OF TRUTH for every kitchen rule:
> Total Width, Kadappa, Clear Width, Wall-side Kadappa, Inner Kadappa, Trolley
> section selection, Trolley H/W/D, Trolley templates, Trolley panel
> formulas, side-section door formulas, Fix Patti, dimension/label
> conventions, validation, PDF/export geometry.

L-Shape Kitchen is **not** a new set of formulas. It is:

```
L-Shape = Wall A (an I-Shape wall) + Wall B (an I-Shape wall, rotated 90°) + one shared corner
```

Every existing formula file (`trolleyDimensions.ts`, `trolleyTemplates.ts`,
`trolleyPanelCalc.ts`, `trolleyPanelConfig.ts`, `sideSectionDoorCalc.ts`)
is reused **unchanged**, called once per wall. The only genuinely new logic
in this feature is:

1. A reusable "resolve one wall" extraction from the current I-Shape engine
   (a refactor, not a behavior change).
2. The corner resolver (shared intersection + optional Corner Fix Patti).
3. The Wall B orientation transform (Left vs Right).
4. Merging two walls + a corner into one `ResolvedDrawing`.

### 0.1 Locked rule — Corner Fix Patti is NOT a Wall-Side Kadappa

**Confirmed and non-negotiable for this implementation:**

```
Wall A  →  shared 90° corner  →  Wall B
```

- The **Corner Fix Patti** is its own distinct, optional concept — a real
  physical panel that may exist at the shared intersection. It is never
  modeled as, aliased to, or drawn using the Wall-Side Kadappa
  code/type/fields of either wall.
- It is **not** part of Wall A's `rightWallKadappaWidth` (or whichever end
  touches the corner) and **not** part of Wall B's own corner-adjacent
  Wall-Side Kadappa field. Those two fields keep meaning exactly what they
  mean today in I-Shape: an ordinary Wall-Side Kadappa at a real outer
  room wall.
- It must **never be counted twice** — not added into Wall A's own Total
  Width calculation AND Wall B's own Total Width calculation, and not
  double-drawn once by each wall's own resolver. It is resolved exactly
  once, by the dedicated corner engine (§4.3), from the shared corner
  point — structurally outside both walls' own width math.
- A normal Wall A/Wall B Fix Patti (the existing `fixPattiPosition`/
  `fixPattiLeftWidth`/etc. fields, attached to a wall's own *outer* edge)
  and the Corner Fix Patti (attached to the *shared intersection*) are two
  separate features that happen to reuse the same visual leader/callout
  convention — never conflate the two in code or in the UI.

### 0.2 Final architecture (confirmed)

```
I-Shape:  1 × Kitchen Wall Engine

L-Shape:  Wall A Engine  +  Wall B Engine  +  Shared Corner Engine
```

Wall A and Wall B each run the *same* Kitchen Wall Engine
(`resolveKitchenWall`, §3.1) independently — independent measurements,
independent Kadappa/Clear-Width configuration, independent Trolley
selection (template, section, H/W/D, panel), independent Side Section
Doors. The Shared Corner Engine (§4) is a third, separate resolver that
only ever produces the one shared intersection point and (optionally) the
Corner Fix Patti — it has no opinion about either wall's own interior
layout.

---

## 1. Current state (read before building)

Files studied, and their current role:

| File | Role today | Change needed |
|---|---|---|
| `src/store/types/index.ts` | Defines `IShapeKitchenConfig`, `KitchenConfig`, `KitchenType` (`'l-shape'` already exists as a value, but no config shape backs it) | Add `KitchenWallConfig` (renamed/aliased `IShapeKitchenConfig`) + `LShapeKitchenConfig`, add `lShape` field to `KitchenConfig` |
| `src/products/kitchen/iShapeKitchenGeometry.ts` | Builds Kadappa sequence, Clear segments, positions every component, returns full `ResolvedDrawing` for ONE wall | Extract the "resolve one wall's components/dimensions/lines at a given origin+orientation" core into a reusable function; keep the existing exported function as a thin wrapper (no behavior change) |
| `src/products/kitchen/trolleyDimensions.ts` | Pure function: `(wallConfig, resolvedSection) → Trolley H/W/D` | **No change.** Called once per wall. |
| `src/products/kitchen/trolleyTemplates.ts` | Template registry + `calculateNormalColumnWidth` | **No change.** |
| `src/products/kitchen/trolleyPanelCalc.ts` + `trolleyPanelConfig.ts` | Panel width/height formulas per template | **No change.** |
| `src/products/kitchen/sideSectionDoorCalc.ts` | Door count/width formula per outer Clear segment | **No change.** |
| `src/products/kitchen/IShapeKitchenDrawing.tsx` | Thin React wrapper: calls the resolver, renders `TechnicalDrawingSvg` | Pattern reused as-is for a new `LShapeKitchenDrawing.tsx` |
| `src/screens/KitchenFlow.tsx` | 3-step wizard (Type → Trolley → Features) + Drawing tab, all reading `model.kitchen.iShape` | Extend Step 1 to allow selecting L-Shape; add Wall A/B tabs to the Features/Trolley steps; branch the Drawing tab |
| `src/store/AppContext.tsx` | `setKitchenType`, `updateIShapeConfig` | Add `updateLShapeWallConfig(wall, patch)`, `updateLShapeConfig(patch)` |
| `src/engine/types.ts` | `ResolvedDrawing` is coordinate-space-agnostic (just arrays of components/dimensions/lines/noteBoxes in world mm) | **No change needed** — confirmed this already supports merging multiple sub-drawings into one |
| `src/engine/noteBoxPlacement.ts`, `dimensionEngine.ts` | Pure world-mm placement/collision engines, no I-Shape-specific coupling | **No change needed** |

**Key finding:** nothing in the shared engine layer (`engine/types.ts`,
`noteBoxPlacement.ts`, `dimensionEngine.ts`, `CanonicalSvg.tsx`) assumes a
single straight wall. A `ResolvedDrawing` is just "components + dimensions +
lines + noteBoxes, all already positioned in one global mm coordinate
space." This is exactly what makes the "resolve two walls, merge" approach
possible without inventing new plumbing.

---

## 2. Data model

### 2.1 Rename for clarity (no behavior change)

`IShapeKitchenConfig` → kept as the exact same shape, but conceptually
renamed `KitchenWallConfig` since it's really "one wall's full
configuration" (Kadappa, Trolley, Doors, Fix Patti, etc.). Implementation
detail: export `KitchenWallConfig` as the real interface, and
`export type IShapeKitchenConfig = KitchenWallConfig;` so every existing
import site (`iShapeKitchenGeometry.ts`, `KitchenFlow.tsx`,
`trolleyDimensions.ts`, etc.) keeps compiling unchanged.

### 2.2 New types

```ts
export type WallBPosition = 'left' | 'right';

export interface LShapeCornerConfig {
  fixPattiEnabled: boolean;
  fixPattiWidth: number;
  fixPattiHeight: number;
}

export interface LShapeKitchenConfig {
  /** Common to both walls, per §3 of the spec. */
  kitchenHeight: number;
  kitchenDepth: number;
  paniPattiHeight: number;

  wallA: KitchenWallConfig;
  wallB: KitchenWallConfig;

  /** Which physical end of Wall A the corner (and Wall B) sits at. */
  wallBPosition: WallBPosition;

  corner: LShapeCornerConfig;
}
```

`KitchenConfig` gains:

```ts
lShape: LShapeKitchenConfig;
```

alongside the existing `iShape: IShapeKitchenConfig` field (both always
present in the model; only the one matching `kitchen.type` is read by the
UI/drawing — same pattern the codebase already uses for `iShape` sitting
unused when `type !== 'straight'`).

### 2.3 Why `wallA`/`wallB` reuse `KitchenWallConfig` wholesale

Per your spec §4–§6: Wall A and Wall B must expose **identical**
functionality (Total Width, Wall-side Kadappa, Inner Kadappa, Clear Width,
Trolley Type/Section/H/W/D/Template/Panel, Side Section Doors, Fix Patti),
and must be independently editable. Reusing `KitchenWallConfig` verbatim for
both guarantees this by construction — there is no field that exists on one
wall and not the other, and no risk of the two forms drifting apart over
time.

One nuance: `KitchenWallConfig.height`/`.depth`/`.paniPattiHeight` become
redundant once `LShapeKitchenConfig.kitchenHeight`/`kitchenDepth`/
`paniPattiHeight` are the shared source (§3: common to both walls). Decision
needed here — see **Open Question 1** below.

---

## 3. Geometry engine

### 3.1 Extract `resolveKitchenWall` (refactor step — must ship first, alone, verified as a no-op)

New file: `src/products/kitchen/kitchenWallGeometry.ts`

```ts
export interface WallOrigin { x: number; y: number; }
export type WallOrientation = 'horizontal' | 'vertical-down';

/** Everything resolveKitchenWall builds, in its own LOCAL frame — local
 * (0,0) is the wall's own start (the corner, for Wall B). Orientation/
 * translation to real world coordinates happens entirely OUTSIDE this
 * function, in rotateWallOutput (§6) — resolveKitchenWall itself never
 * receives or reasons about `origin`/`orientation` internally. */
export interface ResolvedWallLocal {
  components: ComponentSpec[];
  dimensionRequests: DimensionRequest[];   // unresolved — see §3.3, resolved once after merging
  lines: AnnotationLine[];
  calloutRequests: CalloutRequest[];
  issues: ValidationIssue[];
  /** Real local extent this wall's own content occupies. */
  bounds: { left: number; top: number; right: number; bottom: number };
  /** This wall's own two physical ends, in ITS OWN local frame — always
   * (0, rowY) and (totalWidth, rowY) since the wall resolver always lays
   * itself out left-to-right starting at local x=0. */
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
}

export function resolveKitchenWall(
  wallConfig: KitchenWallConfig,
  issuePrefix: string,               // 'Wall A' / 'Wall B' / '' for I-Shape
  cornerEnd: 'left' | 'right' | null = null,  // which local end (if any) is an L-Shape corner — see §8
): ResolvedWallLocal
```

This function is **the entire body of the current
`resolveIShapeKitchenPlan`**, unchanged except for two things: (1) every
`issues.push(...)` message gets `issuePrefix` prepended (empty string for
I-Shape's own single-wall case, so I-Shape's existing issue text stays
byte-identical), and (2) the new `cornerEnd` parameter (§8) suppresses
Side-Section-Door eligibility on whichever local end it names — `null`
(I-Shape's own default) leaves both ends' door eligibility exactly as
today. No coordinate math changes at all — the function keeps computing
everything exactly as today, at exactly the same fixed local origin it
already uses, and simply returns its arrays instead of feeding them
straight into `resolveIShapeKitchenPlan`'s own tail-end
`resolveDimensions`/`placeNoteBoxes` calls.

`resolveIShapeKitchenPlan` (existing function, existing file) becomes:

```ts
export function resolveIShapeKitchenPlan(inputs: IShapeKitchenDrawingInputs): ResolvedDrawing {
  const local = resolveKitchenWall(inputs.iShape, '');  // cornerEnd defaults to null
  const wall = rotateWallOutput(local, { x: leaderMargin, y: 90 }, 'horizontal'); // pure translate, see §6
  // existing worldWidth/worldHeight sizing, resolveDimensions(wall.dimensionRequests),
  // placeNoteBoxes(wall.calloutRequests, ...) — unchanged, just fed from
  // `wall` instead of inline local variables.
  ...
}
```

**Verification gate before touching anything else:** build the existing
Kitchen demo config through both the old and refactored code paths and diff
the resulting `ResolvedDrawing` (components/dimensions/lines/noteBoxes)
field-for-field. Any difference is a bug in the refactor, not an intentional
change — this must come back byte-identical. Since `'horizontal'` is a pure
translate with a fixed, unchanged origin, this is expected to pass
trivially — the only way it could fail is an actual copy/extraction mistake,
not a subtle geometry error.

### 3.2 New `resolveLShapeKitchenPlan`

New file: `src/products/kitchen/lShapeKitchenGeometry.ts`

```ts
export function resolveLShapeKitchenPlan(inputs: { lShape: LShapeKitchenConfig }): ResolvedDrawing {
  const { lShape } = inputs;

  // 1. Wall A — resolve in its own local frame (cornerEnd tells it which
  //    of ITS OWN local ends will be the L-Shape corner, per §8), then
  //    translate (no rotation — Wall A is always the horizontal run) to
  //    the fixed drawing origin.
  const wallALocal = resolveKitchenWall(lShape.wallA, 'Wall A', lShape.wallBPosition);
  const wallAOrigin = { x: leaderMargin, y: 90 };
  const wallA = rotateWallOutput(wallALocal, wallAOrigin, 'horizontal');

  // 2. Corner point = Wall A's own (already-translated, real-world) left
  //    or right end, per wallBPosition.
  const corner = lShape.wallBPosition === 'right' ? wallA.endPoint : wallA.startPoint;

  // 3. Wall B — resolve in its own local frame (its corner end is always
  //    local-left, per §5.2), then rotate 90° and translate so its local
  //    (0,0) lands exactly on `corner` (§6). Rotation (not the wall
  //    resolver) is what makes it read corner→outward correctly for BOTH
  //    Left and Right.
  const wallBLocal = resolveKitchenWall(lShape.wallB, 'Wall B', 'left');
  const wallB = rotateWallOutput(wallBLocal, corner, 'vertical-down');

  // 4. Corner resolver — see §4.
  const cornerResult = resolveLShapeCorner(lShape, corner, wallA, wallB);

  // 5. Merge.
  const components = [...wallA.components, ...wallB.components, ...cornerResult.components];
  const dimReqs = [...wallA.dimensionRequests, ...wallB.dimensionRequests, ...cornerResult.dimensions];
  const lines = [...wallA.lines, ...wallB.lines, ...cornerResult.lines];
  const calloutRequests = [...wallA.calloutRequests, ...wallB.calloutRequests, ...cornerResult.calloutRequests];
  const issues = [...wallA.issues, ...wallB.issues, ...cornerResult.issues];

  // 6. Corner-specific geometry validation (§4.3).
  issues.push(...validateLCorner(wallA, wallB, lShape));

  // 7. resolveDimensions / placeNoteBoxes / worldWidth/worldHeight sizing —
  //    identical pattern to resolveIShapeKitchenPlan's own tail end, just
  //    fed from the merged arrays above, called ONCE on the merged lists
  //    (never once per wall — see §3.3).
  ...

  return { view: 'plan', productType: 'kitchen', designId: 'l-shape', designName: 'L-Shape Kitchen', ... };
}
```

### 3.3 One detail that needs resolving before coding: `DimensionRequest` vs `DimensionLine`

Looking at the actual I-Shape code: `resolveIShapeKitchenPlan` builds up
`dimReqs: DimensionRequest[]` (not yet resolved to tiers/screen positions),
then calls `resolveDimensions(dimReqs)` **once, at the very end**, to get
real `DimensionLine[]` with collision-avoided tiers. This means
`resolveKitchenWall` must return **unresolved** `DimensionRequest[]` per
wall, and `resolveLShapeKitchenPlan` must call `resolveDimensions` exactly
once on the **merged** list from both walls — never once per wall. This
matters because `resolveDimensions`'s own tier-collision logic needs to see
every dimension on the final canvas at once to avoid overlaps between, say,
Wall A's Total Width dimension and Wall B's Clear Width dimension if they
ever end up visually near each other post-merge. Same reasoning applies to
`placeNoteBoxes` (Fix Patti callouts, etc.) — called once on the merged
`calloutRequests` list, not per wall.

---

## 4. The corner

### 4.1 What "one shared corner" means geometrically

Wall A is drawn as a horizontal run: a rectangle from
`(wallAOrigin.x, kadappaY)` to `(wallAOrigin.x + wallA.width, kadappaY +
kadappaH)` (using existing I-Shape naming). Its two physical ends are:

- `startPoint` = `(wallAOrigin.x, kadappaY)` (top-left of the Wall A body)
- `endPoint` = `(wallAOrigin.x + wallA.width, kadappaY)` (top-right)

The corner is **one of these two points** — never a third, independently
placed point. Wall B's own origin is set to exactly this point (or an
offset from it that accounts for the Kitchen Body's line thickness /
Kadappa depth, resolved during implementation against the real reference
sketch — see the two hand-drawn images you provided, where Wall B visually
begins flush with Wall A's own depth band, not from Wall A's zero-width
top edge).

### 4.2 No duplicate geometry at the corner

Per your spec §7 explicitly: never draw two overlapping kitchen boxes, never
duplicate Kadappa/Pani Patti/Trolley geometry at the shared point. Because
Wall B's origin is **derived from** Wall A's own resolved endpoint (not an
independent user-entered coordinate), there is structurally no way for the
two walls' bodies to overlap or gap unintentionally — the corner is a single
shared value read by both, never two separately-entered numbers that happen
to need reconciling.

### 4.3 `resolveLShapeCorner` — Corner Fix Patti only

```ts
function resolveLShapeCorner(
  lShape: LShapeKitchenConfig,
  cornerPoint: { x: number; y: number },
  wallA: ResolvedWall,
  wallB: ResolvedWall,
): { components: ComponentSpec[]; dimensions: DimensionRequest[]; lines: AnnotationLine[]; calloutRequests: CalloutRequest[]; issues: ValidationIssue[] }
```

If `corner.fixPattiEnabled` is false: returns everything empty — **no
invented Fix Patti**, per your explicit §24 instruction ("If Corner Fix
Patti is absent, do not invent a fake Fix Patti").

If enabled: draws exactly **one** `FIX_PATTI`-styled component (reusing the
existing `FIX_PATTI` type/color/leader-callout convention from I-Shape's own
`drawFixPatti`, generalized to accept an arbitrary position/size rather than
being hardcoded to "outside the kitchen box, left or right"), positioned at
the corner so it visually closes the gap between Wall A's own end and Wall
B's own start — bottom-aligned to the shared floor line, matching your two
reference sketches (the panel sits right where the walls meet, not floating).
Exact placement math (which quadrant of the corner it occupies, whether it's
inset into the corner or attached to the outside) will be pinned down
against your reference sketches during implementation — **this is the one
piece of real new geometry in the whole feature**, everything else is reuse
+ transform.

**Per §0.1, restated here at the point it matters most:** this component is
built entirely inside `resolveLShapeCorner` — it is never assembled from, or
written into, either wall's own `KitchenWallConfig` (not
`leftWallKadappaWidth`/`rightWallKadappaWidth`, not `fixPattiPosition`, not
any other existing per-wall field). Wall A's and Wall B's own Total Width
values are computed by `resolveKitchenWall` exactly as they are for I-Shape
today, with no knowledge that a Corner Fix Patti exists — so it is
structurally impossible for the corner panel to be double-counted into
either wall's width sum.

### 4.4 Corner validation codes (new, per your spec §20)

| Code | Fires when |
|---|---|
| `L_CORNER_INVALID` | Wall A and Wall B resolve to geometrically inconsistent endpoints (e.g. corner point mismatch after the position transform — should be structurally impossible given §4.2, but checked defensively) |
| `L_CORNER_FIX_PATTI_INVALID` | Corner Fix Patti enabled but Width/Height resolve to ≤ 0mm |
| `L_CORNER_GEOMETRY_OVERLAP` | Corner Fix Patti's own box overlaps a Wall A or Wall B component it shouldn't (e.g. a Side Section Door drawn too close to the corner) |

---

## 5. Wall B Position (Left / Right) — orientation, not a new formula

Per your spec's second half (the "IMPORTANT ADDITION"), this is a hard
requirement, not optional: `wallBPosition: 'left' | 'right'`, one field, one
`resolveWallB`-style call, never two separate resolvers.

### 5.1 Single calculation engine, transform applied once

`resolveKitchenWall(wallConfig, prefix, cornerEnd)` (§3.1/§8) always
resolves Wall B in its own local left→right frame, with no knowledge of
orientation at all (`cornerEnd: 'left'` only suppresses that end's door
eligibility — it carries no coordinate information). The **Left/Right**
choice lives entirely in `rotateWallOutput` (§6) — it determines only which
real-world point Wall B's local (0,0) gets translated onto after rotation:

```ts
const corner = lShape.wallBPosition === 'right' ? wallA.endPoint : wallA.startPoint;
const wallBLocal = resolveKitchenWall(lShape.wallB, 'Wall B', 'left');
const wallB = rotateWallOutput(wallBLocal, corner, 'vertical-down');
```

`resolveKitchenWall` never branches on Left/Right — it only ever produces
the same local drawing regardless of where it will end up. The Left/Right
decision is made **once**, by the caller (`resolveLShapeKitchenPlan`),
choosing *which* Wall A endpoint to hand `rotateWallOutput` as the
translation target. This is exactly your spec's §14 requirement ("Do NOT
create `resolveLeftWallB()` / `resolveRightWallB()`. Instead create ONE
`resolveWallB(...)` and apply an orientation transform") — here realized as
one resolver + one shared rotation function, rather than the resolver
itself taking an orientation parameter.

### 5.2 Kadappa sequence direction after the transform

Per your spec §6/§7: Wall B's own Kadappa sequence must always read
**corner → outward → real outer wall**, regardless of Left/Right — i.e. the
component nearest the corner is always positioned relative to the corner,
and the wall-side Kadappa at Wall B's *far* end is always anchored to Wall
B's own real outer wall edge (reusing the existing Right-Wall-Kadappa
anchor-to-real-edge logic from I-Shape, §4/pt.4 in `KITCHEN_PLAN.md`).

Because `resolveKitchenWall` always lays Wall B out in its own local
left→right frame starting at local (0,0) — which `rotateWallOutput` always
maps onto the corner point, and whose local far end always maps onto Wall
B's own real outer wall — this is correct by construction for both Left and
Right: the "corner end" is always local x=0, the "outer wall end" is always
local x=max, and the rotation (§6) determines only whether that local-max
ends up geometrically above/below/left/right of the corner on screen.
**The user's entered measurements (Kadappa widths, Clear widths, door
widths) are never reversed or reinterpreted** — only their final X/Y
placement changes, via the same fixed rotation formula regardless of which
real-world corner they're being translated onto.

### 5.3 What actually changes on screen between Left and Right

- **Right**: Wall B hangs down from Wall A's own right end. Wall A's row
  reads left→right ending at the corner; Wall B's row (rotated) reads
  corner→down.
- **Left**: Wall B hangs down from Wall A's own left end. Wall A's row still
  reads left→right, but now *starts* at the corner; Wall B still reads
  corner→down from that (now left-side) corner.

Both are the exact same `resolveKitchenWall(lShape.wallB, 'Wall B', 'left')` +
`rotateWallOutput(wallBLocal, corner, 'vertical-down')` pair — the only
difference is which point Wall A's own resolved geometry supplies as
`corner`. No mirroring/flipping of Wall B's *internal* layout is needed,
because "corner→outward" is already Wall B's local left→right direction in
both cases, and the rotation function is the same fixed 90° formula
regardless of which corner it's translating onto.

---

## 6. Coordinate transform — horizontal vs vertical-down

**Revised approach (lower risk than the original per-push-point plan):**
`resolveKitchenWall`'s internals are left **completely untouched** — the
function always computes in its normal horizontal local frame, at a fixed
local origin, exactly like `resolveIShapeKitchenPlan` does today. It never
knows or cares whether its output will end up horizontal or rotated.

The original plan called for threading a `toGlobal()` transform through
every individual coordinate computation site inside the wall resolver
(~40+ places across the Kadappa cursor walk, Trolley Panel columns, Side
Doors, Fix Patti, Inner Trolley placement, and every callout/dimension
push). That is mathematically sound but high-risk to get exactly right by
hand in one pass, in a file this dense — a single missed site produces a
subtle, hard-to-spot geometry bug.

Instead, orientation is applied as **one single post-processing rotation
step**, run once over a wall's *already-finished* local output
(`components`, `lines`, `calloutRequests`, and the not-yet-resolved
`DimensionRequest[]`), before it is merged into the L-Shape drawing:

```ts
function rotateWallOutput(wall: ResolvedWallLocal, origin: WallOrigin, orientation: WallOrientation): ResolvedWall {
  if (orientation === 'horizontal') {
    // Just re-anchor from the wall's own local (0,0) to the real origin —
    // same translate-only step 'horizontal' always needed anyway.
    return translateOnly(wall, origin);
  }
  // 'vertical-down': rotate the whole local drawing 90° clockwise around
  // its own local (0,0), THEN translate so that point lands on `origin`.
  // A component at local (x, y, w, h) becomes (originX - y - h, originY + x, h, w)
  // — i.e. width/height swap, and every x/y coordinate maps through the
  // same fixed rotation formula. Applied identically to every
  // ComponentSpec, every AnnotationLine's (x1,y1)/(x2,y2), every
  // CalloutRequest's componentBounds/anchor, and every DimensionRequest's
  // (x1,y1)/(x2,y2) + axis flip ('h' becomes 'v' and vice versa, since a
  // dimension that measured along local-X now measures along global-Y).
  return rotate90ClockwiseThenTranslate(wall, origin);
}
```

This is geometrically identical to the per-push-point approach — rotating
a finished flat drawing 90° produces the exact same pixels as computing
every point pre-rotated — but is a single, small, independently unit-
testable function instead of dozens of edited call sites scattered through
the Kadappa/Trolley/Door logic. `resolveKitchenWall` itself needs **zero
internal changes** beyond returning its local components/lines/
calloutRequests/dimension-requests instead of pushing straight into
`resolveIShapeKitchenPlan`'s own top-level arrays — a pure "return what you
already built" extraction, not a coordinate rewrite.

`resolveIShapeKitchenPlan` becomes: call `resolveKitchenWall` for its local
output, call `rotateWallOutput(wall, origin, 'horizontal')` (a translate-only,
same as today's fixed origin), then proceed exactly as before. Since
`'horizontal'` is a pure translate with no rotation, I-Shape's own output is
trivially unaffected — this is the safest possible form of the "verified
no-op" requirement in §3.1's build gate.

Depth diagonals (the `/` corner marker) rotate the same way as every other
line — their own two offsets are just two more (x, y) points subject to the
same rotation formula, so they automatically keep reading as "into the box"
after the transform, with no special-casing needed.

---

## 7. Trolley, Panel, Door — confirmed zero formula changes

Per your spec §9–§13, restated here as an implementation checklist to verify
during coding (not new logic — a confirmation list):

- [ ] `calculateTrolleyDimensions(wallConfig, resolvedSection)` called once
      for Wall A's own resolved section, once for Wall B's — each wall keeps
      its own independent `trolleySectionId`, `trolleyTemplateId`,
      `spoValues`, and all three H/W/D overrides.
- [ ] `calculateNormalColumnWidth` / the 9-template registry — read
      unmodified by both walls; a template chosen for Wall A has no
      relationship to Wall B's own template choice.
- [ ] `calculateTrolleyPanels` — called once per wall, with that wall's own
      `sequence`/`section`/`trolleyDims`, exactly as today.
- [ ] `calculateSideSectionDoors` — called once per wall's own outer Clear
      segments; the corner-side Clear segment (§8 below) is explicitly
      excluded from ever receiving a Side Section Door.

---

## 8. Corner and doors — explicit exclusion rule

Per your spec §14: the corner itself must never be treated as a normal
"outer" section eligible for a Side Section Door.

In the existing I-Shape engine, a Side Section Door only appears on a Clear
segment where `seg.fromLetter === null` (left outer wall) or
`seg.toLetter === null` (right outer wall) — see `iShapeKitchenGeometry.ts`'s
`isLeftOuterSection`/`isRightOuterSection` check. For L-Shape:

- **Wall A's end that touches the corner** must NOT be treated as an outer
  wall boundary for door purposes, even though geometrically nothing sits
  beyond it (same as today's "outer" definition, which is really "no
  further Kadappa/component in that direction" — but here there very much
  IS something further: Wall B).
- Concretely: when resolving Wall A, the corner-side end is passed to
  `resolveKitchenWall` with an explicit `hasCornerAtThisEnd: true` flag (new,
  small parameter) suppressing the "outer wall, eligible for a door" check
  on that specific end only. The opposite end of Wall A (the real room wall,
  away from the corner) keeps the existing door-eligibility logic unchanged.
- Wall B's own corner-adjacent end (`origin`, always its local-left) gets
  the same suppression; Wall B's far end (the real outer wall) keeps normal
  door eligibility.

This is a small, targeted addition to `resolveKitchenWall`'s signature —
not a new formula, just an extra guard on the existing
`isLeftOuterSection`/`isRightOuterSection` checks.

---

## 9. Pani Patti at the corner

Per your spec §15: Wall A's Pani Patti and Wall B's Pani Patti must meet at
the corner with no duplicate/overlapping geometry and no gap.

Because Wall A's Pani Patti already spans its own full resolved width
(`kitchenX .. kitchenX + width`, ending exactly at the corner point when
`wallBPosition` puts the corner there) and Wall B's Pani Patti (after the
orientation transform in §6) spans its own full resolved "width" starting
exactly at that same corner point — the two bars meet at exactly one shared
edge by construction, with no separate "corner Pani Patti" component needed.
This falls out of §4.1/§4.2 (shared corner point, never two independently
placed values) without any extra code — confirmed here as a design
consequence, not a new mechanism.

---

## 10. UI (KitchenFlow.tsx)

### 10.1 Step 1 — Kitchen Type

Enable the currently-disabled "L-Shape Kitchen" button
(`{ id: 'l-shape', label: 'L-Shape Kitchen', active: false }` →
`active: true`). `setKitchenType('l-shape')` already exists in
`AppContext.tsx` and already seeds a two-wall `walls: [A, B]` array (see
`AppContext.tsx:186-198`) — that array is the OLD generic `Wall[]` model
(length-only), unrelated to the new `LShapeKitchenConfig`; it stays as-is
for whatever legacy code still reads `kitchen.walls`, and the new
`kitchen.lShape` object is populated/read independently.

### 10.2 Step 2 (Trolley) and Step 3 (Features) — Wall A / Wall B tabs

Both steps currently render a single form bound to `model.kitchen.iShape` /
`updateIShapeConfig`. For L-Shape, add a small **Wall A / Wall B** tab
selector at the top of each step, and parametrize the existing
`Step2Trolley` / `Step3Features` bodies (and their sub-components —
`SideSectionDoorsFrame`, `FixPattiFrame`, `TrolleySectionPicker`,
`TrolleyDimensionsFrame`, `WidthSumHint`) to accept `wallConfig` +
`updateWallConfig` as props instead of reading `model.kitchen.iShape` /
`updateIShapeConfig` directly. I-Shape's own usage passes
`model.kitchen.iShape` / `updateIShapeConfig` unchanged; L-Shape's usage
passes `model.kitchen.lShape.wallA` / `(patch) => updateLShapeWallConfig('A', patch)`
or the Wall B equivalent depending on the active tab. This is a **prop
extraction**, not a rewrite of the form bodies — the JSX inside each frame
stays the same.

New fields added to Step 3 for L-Shape only:

- **Wall B Position**: Left / Right selector (two-button toggle, same
  visual style as `WallSideOptionButton`).
- **Corner Fix Patti**: None/Yes toggle + (if Yes) Width/Height `NumInput`s,
  same visual pattern as the existing `FixPattiFrame`.
- Kitchen Height / Depth / Pani Patti Height move to a single shared
  "Common Measurements" block at the top of Step 3 (not duplicated per
  wall) — see **Open Question 1**.

### 10.3 Drawing tab

```tsx
function DrawingTab() {
  const { model } = useApp();
  return (
    <div ...>
      <div ...>
        {model.kitchen.type === 'l-shape'
          ? <LShapeKitchenDrawing lShape={model.kitchen.lShape} />
          : <IShapeKitchenDrawing iShape={model.kitchen.iShape} />}
      </div>
    </div>
  );
}
```

### 10.4 New `LShapeKitchenDrawing.tsx`

Same thin-wrapper pattern as `IShapeKitchenDrawing.tsx` (§1 table) — calls
`resolveLShapeKitchenPlan`, renders `TechnicalDrawingSvg` with the same
`componentStyle` map (reused as-is; no new component types need new colors
except possibly a distinct style for the Corner Fix Patti, likely just
reusing the existing `FIX_PATTI` style directly since it IS a Fix Patti,
conceptually).

### 10.5 `AppContext.tsx` additions

```ts
const updateLShapeConfig = useCallback((patch: Partial<LShapeKitchenConfig>) => {
  setModel((prev) => ({ ...prev, kitchen: { ...prev.kitchen, lShape: { ...prev.kitchen.lShape, ...patch } } }));
}, []);

const updateLShapeWallConfig = useCallback((wall: 'A' | 'B', patch: Partial<KitchenWallConfig>) => {
  setModel((prev) => ({
    ...prev,
    kitchen: {
      ...prev.kitchen,
      lShape: {
        ...prev.kitchen.lShape,
        [wall === 'A' ? 'wallA' : 'wallB']: { ...prev.kitchen.lShape[wall === 'A' ? 'wallA' : 'wallB'], ...patch },
      },
    },
  }));
}, []);
```

Same `setModel` immutable-update pattern `updateIShapeConfig` already uses
— no new state-management approach introduced.

---

## 11. Demo data / defaults

`src/data/demoData.ts` currently seeds `kitchen.iShape` with a full default
`IShapeKitchenConfig`. A matching default `LShapeKitchenConfig` needs adding
(sensible defaults: both walls' Kadappa/Trolley/Doors off/empty, Wall B
Position defaulting to `'right'` per your spec §12 "default can be whichever
matches the existing reference implementation" — your first reference sketch
shows Wall B extending down-right from Wall A's right end, so `'right'` is
the natural default), following the exact same shape as the existing
`iShape` default object.

---

## 12. Save / Edit / History

Per your spec §13: `wallBPosition` and both walls' full configs must survive
save/reload exactly like every other `iShape` field does today (the model is
already persisted wholesale via `localStorage`/the existing save mechanism —
confirmed no special-casing exists today for individual `iShape` fields, so
adding `lShape` alongside it requires no new persistence code, only the type
addition from §2).

---

## 13. What is explicitly OUT of scope for this task

Per your spec §1: only L-Shape is implemented now. U-Shape and Parallel stay
disabled ("Soon") in Step 1. PDF export geometry for L-Shape is covered by
§21 (single source of truth — `resolveLShapeKitchenPlan`'s output feeds
PDF export exactly the way `resolveIShapeKitchenPlan`'s does today), but the
PDF template/layout code itself is not touched beyond making sure it can
consume the merged `ResolvedDrawing` (it already should be able to, since
`ResolvedDrawing` is shape-agnostic — to be confirmed against the actual PDF
export code during implementation, not assumed here).

---

## 14. Test matrix (from your spec §26, restated as acceptance criteria)

1. L-Shape, no Kadappa on either wall — both walls draw as plain boxes,
   corner clean, no doors misplaced.
2. Wall A Kadappa only.
3. Wall B Kadappa only.
4. Both walls with Wall-side Kadappa.
5. Inner Kadappa on both walls.
6. Different Clear Widths on both walls.
7. Trolley on Wall A only.
8. Trolley on Wall B only.
9. Trolley on both walls (independent templates/sections).
10. Multiple trolley sections available on one wall (must require explicit
    selection, never auto-guess when >1 exists).
11. 1-door outer section.
12. 2-door outer section.
13. Editable door count override, both walls.
14. Corner Fix Patti OFF — confirm nothing is invented at the corner.
15. Corner Fix Patti ON — confirm real box, correct position, no overlap.
16. Different Wall A / Wall B total widths.
17. Different Kadappa configurations per wall.
18. Fully asymmetric configuration (the general case).
19. Save/reload — every field above survives.
20. PDF export — geometry matches the on-screen drawing exactly.

**Orientation-specific matrix (Left vs Right), from your spec's second half:**

21. Wall B Position = Right — correct corner at Wall A's right end, correct
    Wall B geometry, Kadappa, trolley, doors, Pani Patti, Corner Fix Patti,
    no overlaps.
22. Change ONLY Wall B Position to Left (same measurements otherwise) —
    corner moves to Wall A's left end; Wall B geometry mirrors correctly;
    Kadappa sequence remains corner→outward; trolley/doors/Pani
    Patti/Corner Fix Patti all move with it; dimensions/labels move; **no
    measurement values are reset**; no overlaps; no artificial gap.

**Regression gate:** after all of the above, switch back to I-Shape and
confirm its drawing is pixel-identical to before this feature existed (the
§3.1 refactor verification, re-run as a final sanity check).

---

## 15. Open questions — resolved

1. **Kitchen Height / Depth / Pani Patti Height — RESOLVED: option (a),
   shared.** Per your confirmation that "Wall A and Wall B measurements
   remain independent" refers to each wall's own Kadappa/Clear-
   Width/Trolley/Door configuration — not to the three whole-kitchen
   envelope values that were already specified as common in §3 of the
   original spec ("Total Kitchen Height is common to both walls... Both
   Wall A and Wall B use the same vertical height"). `LShapeKitchenConfig`
   holds the single shared `kitchenHeight`/`kitchenDepth`/`paniPattiHeight`;
   these are copied into each wall's own `KitchenWallConfig.height`/
   `.depth`/`.paniPattiHeight` right before calling `resolveKitchenWall`, so
   the wall resolver itself needs no changes and stays unaware of where its
   inputs came from.

2. **Corner Fix Patti exact placement** — still to be pinned down against
   the two reference sketches during implementation (which quadrant/inset
   at the corner). Not a blocker: it's isolated entirely inside
   `resolveLShapeCorner` (§4.3/§0.1), so refining this later never touches
   Wall A/Wall B's own code.

3. **Wall B Position default — RESOLVED: `'right'`.** Matches the first
   reference sketch; remains fully user-editable per §12 of the original
   spec.

---

## 16. Build order (once approved)

1. **Refactor only** — extract `resolveKitchenWall` from
   `iShapeKitchenGeometry.ts`; `resolveIShapeKitchenPlan` becomes a thin
   wrapper. Verify byte-identical output. No new types, no UI changes yet.
2. **Data model** — add `KitchenWallConfig` alias, `LShapeKitchenConfig`,
   `lShape` field on `KitchenConfig`, default seed data.
3. **Corner + L-Shape resolver** — `resolveLShapeCorner`,
   `resolveLShapeKitchenPlan`, corner validation codes.
4. **AppContext wiring** — `updateLShapeConfig`, `updateLShapeWallConfig`.
5. **Drawing component** — `LShapeKitchenDrawing.tsx`.
6. **UI** — Step 1 enable L-Shape; Wall A/B tabs on Steps 2–3; Wall B
   Position + Corner Fix Patti fields; Drawing tab branch.
7. **Manual test pass** — full matrix from §14, plus the I-Shape regression
   check.
