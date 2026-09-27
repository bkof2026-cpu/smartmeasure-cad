# I-Shape Kitchen — Design & Formula Reference

This document describes exactly how the I-Shape Kitchen (and its Trolley system)
is modeled and drawn in this codebase: the geometry rules, every formula, and
the style/position conventions used on the CAD drawing. It reflects the actual
implementation in:

- `src/products/kitchen/iShapeKitchenGeometry.ts` — main drawing/layout engine
- `src/products/kitchen/trolleyDimensions.ts` — Trolley H×W×D formula
- `src/products/kitchen/trolleyTemplates.ts` — Inner Trolley template registry
- `src/products/kitchen/trolleyPanelCalc.ts` + `trolleyPanelConfig.ts` — Trolley Panel (in-kitchen) layer
- `src/products/kitchen/sideSectionDoorCalc.ts` — Side Section Door formula

---

## 1. Three width concepts — never conflated

| Concept | Meaning | Source |
|---|---|---|
| **Total Kitchen Width** | The whole entered envelope | User input — drawn as the outer kitchen box |
| **Kadappa Width** | A single Kadappa panel's own physical width | User input, per slot |
| **Clear Width** | The *open* gap between two consecutive physical boundaries | User input, per segment — independent of Kadappa width |

These are never derived from one another automatically. A validation warning
(`WIDTH_SUM_MISMATCH`) fires if:

```
Σ(Kadappa widths) + Σ(Clear widths) ≠ Total Kitchen Width
```

but nothing silently auto-corrects the mismatch — it's surfaced, not hidden.

---

## 2. Kadappa sequence & naming

Built strictly left → right:

```
[ optional Left Wall Kadappa ] → [ N Inner Kadappa ] → [ optional Right Wall Kadappa ]
```

Each present component gets the next sequential letter: **A, B, C, …**
A component that doesn't exist (e.g. no Left Wall Kadappa) never reserves or
skips a letter — the lettering is always dense.

---

## 3. Clear-Width segments

One segment exists for every gap between consecutive physical boundaries:

- No Kadappa anywhere → a single `Wall → Wall` segment
- A wall **with** a Kadappa → no separate wall segment (the Kadappa sits flush
  against that wall)
- A wall **without** a Kadappa → a leading/trailing `Wall → A` / `… → Wall` segment
- Every consecutive pair of Kadappa → exactly one segment between them

---

## 4. Positioning rule — wall anchors vs. cursor walk

- **Left Wall Kadappa** and every **Inner Kadappa**: positioned by walking a
  cursor left→right — add the segment's Clear Width, then the Kadappa's own
  width, repeat.
- **Right Wall Kadappa**: always force-anchored flush to the kitchen's real
  right edge, **regardless of where the cursor walk lands**. This is a
  deliberate fix — without it, small rounding/typo drift in entered clear
  widths could leave the Right Wall Kadappa floating with a visible gap
  before the real wall.

---

## 5. Overall drawing layout (top → bottom)

```
Total Kitchen Width  ─── outermost dimension, red, topmost tier
Kadappa / Trolley Panel / Door Width labels ─── plain text, tier just above Pani Patti
════════════════════ Pani Patti bar (purple, width = Total Kitchen Width, always) ════
┌──────────────────────────────────────────────────────────────────────────┐
│  Kadappa box │ Trolley Panel (or plain Kadappa) │ Side Section Door(s)   │  ← one row,
│                                                                          │    full Kitchen Height
└──────────────────────────────────────────────────────────────────────────┘
Clear-Width dimensions ─── green, drawn BELOW the row (never mixed with Kadappa-width tier above)
```

**Depth** (Kitchen and Trolley) is never a straight dimension line — in plan
view, depth runs front-to-back and can't be shown that way. Instead a short
`/` diagonal is drawn inside each box's own top-left corner, labeled
`<value> mm (D)` — the same convention used by every other product in this
engine (Wardrobe, Bed, etc.).

---

## 6. Fix Patti

A real panel attached to the **outside** of the kitchen box — left, right, or
both.

- Height defaults to Total Kitchen Height (editable)
- Width defaults to 40mm (editable)
- Bottom-aligned with the kitchen floor
- **Never labeled inline.** Indicated only via a leader-arrow callout box
  (name "Fix Patti" + H/W), the same collision-free leader/callout mechanism
  every small component on this drawing uses.

---

## 7. Trolley Section selection

The Trolley only occupies a Clear-Width section the user **explicitly picks**
(`trolleySectionId`) — except when exactly one section exists at all, in
which case it auto-resolves (no real ambiguity). It is never guessed when
multiple sections exist.

---

## 8. Trolley Dimensions — the one shared formula

```
Trolley Height = Total Kitchen Height − Pani Patti Height − Floor/Ceiling Patti (default 10mm) − 30mm clearance
Trolley Width  = Selected Section's Clear Width (manual measurement) − 30mm fit
Trolley Depth  = Total Kitchen Depth − Depth Deduction (default 20mm)
```

Each of the three has an optional user override which always takes priority
over the calculated value. Overrides are stored separately and are never
silently cleared by an unrelated change elsewhere in the form.

This is the **single shared source of truth** — the UI panel, the CAD
drawing, and the (future) PDF export all read from this same calculation, so
they can never disagree with each other.

---

## 9. Trolley Templates — the Inner Trolley detail drawing

### Shared Normal Column Width formula

Every template uses the same engine for its non-SPO ("normal") columns:

```
Normal Column Width = (Trolley Width − pipeCount × 20mm − SPO Width [if present]) ÷ normalColumnCount
```

- `pipeCount` — the real number of 20mm-wide physical vertical pipe
  separators in that template's structure (confirmed per template, never a
  generic guess)
- `normalColumnCount` — the number of columns that actually contain a real
  empty (undetermined-height) box; SPO columns are never counted here

### The 9 confirmed templates

| Template | Structure | Pipes | Normal columns |
|---|---|---|---|
| **7P-Only** | Left [220 fixed + empty] · Center [130 + 200 fixed + empty] · Right [220 fixed + empty] | 4 | ÷3 |
| **5P-Only** | Left [220 fixed + empty] · Right [130 + 200 fixed + empty] | 3 | ÷2 |
| **2P-RSPO** | Left [220 fixed + empty] · Right = SPO (full height) | 3 | ÷1 |
| **2P-LSPO** | Left = SPO (full height) · Right [220 fixed + empty] | 3 | ÷1 |
| **3P-RSPO** | Left [130 + 200 fixed + empty] · Right = SPO | 3 | ÷1 |
| **3P-LSPO** | Left = SPO · Right [130 + 200 fixed + empty] | 3 | ÷1 |
| **5P-CSPO** | Left [220 fixed + empty] · Center = SPO (200–300mm range) · Right [130 + 200 fixed + empty] | 4 | ÷2 |
| **5P-LSPO** | Left = SPO · Middle [220 fixed + empty] · Right [130 + 200 fixed + empty] | 4 | ÷2 |
| **4P-Only** | Left [220 fixed + empty] · Right [220 fixed + empty] (symmetric) | 3 | ÷2 |

### Box drawing/labeling convention

- **Fixed box** (known height, e.g. 220mm / 130mm / 200mm): shows only its
  **Height** as plain in-box text (`220(H)`), never Width, never a dimension
  arrow/line.
- **Empty box** (height intentionally left undefined — no formula provided
  yet): shows only its **Width** as plain text (`445(W)`) — the calculated
  Normal Column Width. Mirror image of the fixed box's convention.
- **SPO**: always drawn full Trolley Height (never split, never a separate
  height input); Width is user-editable, defaulting to 200mm (200–300mm for
  5P-CSPO specifically).

---

## 10. Trolley Panel — the second, independent in-kitchen layer

Drawn *inside* the main kitchen row, in the selected Trolley section. This is
a visually distinct layer from the Inner Trolley detail drawing below — it
never mutates the Inner Trolley's own numbers.

**Confirmed deliberately wider than its section bay** — the panel extends out
over the neighboring Kadappa, matching how real cabinetry physically
overlaps the adjacent wall panel, rather than being shrunk to force-fit the
open gap.

### Panel width formulas

```
Side column width   = Column's own Trolley Box Width
                       + outerPipe (20mm)
                       + innerPipeAllowance (9mm)
                       + sideRecovery (15mm)
                       + adjacent Kadappa Width

Center column width = Column's own Trolley Box Width
                       + innerPipeAllowance (9mm) × 2
                       (no outer pipe / side recovery / Kadappa — it's an internal boundary)

SPO column width     = template's own SPO width, unchanged
```

### Panel height (per column, top → bottom)

- First fixed box in the column → `sourceBoxHeight + topAllowance (55mm) + Pani Patti Height`
- Any additional fixed box in that column → stays exactly as configured (e.g. the 200mm fixed box)
- Column always ends in a **remaining** segment → whatever Kitchen Height is left after everything above it and every horizontal pipe (2mm) between segments
- SPO panel height = `Kitchen Height − spoTopBottomAllowance (15mm)`

### Drawing convention

Only the **center** column (or both side columns, for a template with no
center at all — e.g. 4P-Only) is drawn as a real bordered box. Side columns
in a template that *does* have a center column are drawn as plain floating
text + a horizontal pipe-divider line at each internal segment boundary —
matching the hand-drawn reference sketch convention.

---

## 11. Side Section Doors

Drawn only in the two **outer** Clear-Width sections (the ones against a real
room wall) that are **not** the section the Trolley occupies.

```
Door count:  sectionWidth ≥ 600mm → 2 doors
             sectionWidth <  600mm → 1 door
             (auto-recommended, user-overridable)

Door width (N doors) = [ sectionWidth
                          − innerKadappaDeduction (2mm)
                          − wallDeduction (3mm if a real Wall Side Kadappa
                                           exists on that side, else 2mm)
                          − (N − 1) × doorGap (2mm) ] ÷ N
```

- Height label = `Kitchen Height − 15mm`; the box itself is drawn flush/full
  height (zero gap to floor/Pani Patti) — only the *label* shows the reduced
  value.
- A 2-door pair gets handles converging toward the shared boundary between
  them (mirrors a real pair of cabinet doors opening away from each other).

---

## 12. Validation layer

The engine never silently absorbs a contradiction — it always surfaces one of:

| Code | Meaning |
|---|---|
| `WIDTH_SUM_MISMATCH` | Kadappa + Clear widths don't sum to Total Kitchen Width |
| `TROLLEY_SECTION_NOT_SELECTED` | Multiple sections exist and none has been picked |
| `TROLLEY_WIDTH_DOES_NOT_CLOSE` | A template's pipes + columns + SPO don't sum exactly to the calculated Trolley Width |
| `TROLLEY_WIDTH_INVALID` / `TROLLEY_DEPTH_INVALID` | Trolley dimensions resolved to an impossible value |
| `TROLLEY_COLUMN_WIDTH_INVALID` | Normal Column Width formula produced ≤ 0mm |
| `TROLLEY_PANEL_INVALID` | Trolley Panel geometry resolved to ≤ 0mm somewhere |
| `SIDE_SECTION_DOOR_INVALID` | Side Section Door width resolved to ≤ 0mm |

## Single source of truth

Every number above — what's drawn, what's dimensioned, and what will
eventually appear in the PDF export — is computed once by this same model and
never recalculated a second, possibly-diverging way anywhere else in the app.
