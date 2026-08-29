I already have an existing Figma Make prototype called:

"SmartMeasure CAD"

The Kitchen demo is already implemented.

DO NOT redesign or replace the existing Kitchen demo.

Extend the existing prototype by adding realistic DEMO DATA and PARAMETRIC 2D DRAWINGS for all major furniture/product types.

The goal is to demonstrate that SmartMeasure CAD is not only a Kitchen measurement application, but a complete interior furniture measurement → rules → 2D drawing → cutlist system.

==================================================
PRODUCTS TO ADD
==================================================

Add demo products:

1. Kitchen
2. Bed
3. Side Table
4. Openable Wardrobe
5. Sliding Wardrobe
6. TV Unit
7. Loft
8. Dining Table
9. Bedroom
10. 1 BHK
11. 2 BHK
12. 3 BHK

Keep Kitchen as the existing primary demo.

Add the remaining products as selectable demos.

==================================================
IMPORTANT SOURCE DATA
==================================================

I have uploaded company cutlist/formula Excel files.

Use the uploaded cutlist/formula data as the reference for product components, terminology, dimensions, quantities and construction logic.

Do NOT invent company-specific cutlist formulas when information is available in the uploaded files.

The uploaded formula data contains examples/structures for:

- LOFT BOX & CABINET BOX
- BED
- BED 2
- SIDE TABLE
- OPENABLE WARDROBE
- SLIDING WARDROBE

Use these as the basis for the corresponding product demos.

Where a product is not represented in the uploaded cutlist, create clearly marked DEMO/PLACEHOLDER values rather than pretending they are company standards.

==================================================
PRODUCT SELECTION
==================================================

Modify the existing Product Selection screen.

Display product cards:

KITCHEN
BED
SIDE TABLE
WARDROBE
TV UNIT
LOFT
DINING TABLE
BEDROOM
1 BHK
2 BHK
3 BHK

Each card should show:

Product name
Small 2D preview/icon
"Demo Available"

Clicking a product opens its product-specific measurement workflow.

==================================================
COMMON WORKFLOW
==================================================

Every product should follow the same overall architecture:

SELECT PRODUCT
↓
PRODUCT CONFIGURATION
↓
SITE MEASUREMENTS
↓
REQUIREMENTS
↓
COMPONENT/MODULE CONFIGURATION
↓
PHOTO/VIDEO EVIDENCE
↓
VALIDATION
↓
LIVE 2D DRAWING
↓
CUTLIST PREVIEW
↓
FINAL DRAWING

Do not create separate unrelated applications for each product.

Use one common architecture with product-specific templates.

==================================================
PRODUCT TEMPLATE ARCHITECTURE
==================================================

Create:

ProductTemplate

Each product template should define:

- Product type
- Required measurements
- Optional measurements
- Components
- Modules
- Rules
- Drawing views
- Cutlist structure
- Validation rules

Example:

KitchenTemplate
BedTemplate
SideTableTemplate
OpenableWardrobeTemplate
SlidingWardrobeTemplate
TVUnitTemplate
LoftTemplate
DiningTableTemplate
BedroomTemplate
BHKTemplate

==================================================
MASTER PROJECT MODEL
==================================================

Use one common model:

Project
 ├── Product
 ├── Measurements
 ├── Requirements
 ├── Components
 ├── Rules
 ├── Evidence
 ├── Drawing
 └── Cutlist

Do NOT duplicate the entire data structure for every product.

==================================================
BED DEMO
==================================================

Create a realistic Bed demo using the uploaded BED/BED 2 formula structure.

Measurement inputs:

Overall Width
Overall Length
Overall Height
Mattress Width
Mattress Length
Headboard Height
Side Panel Height
Storage Required
Storage Type
Hydraulic/Normal
Finish
Material

Show modules/components such as:

Head Board
Back Panel
Front Panel
Left Side
Right Side
Top
Bottom
Top Patti
H Panel Shelf

Use the uploaded formula terminology where applicable.

==================================================
BED 2D DRAWING
==================================================

Create:

PLAN
FRONT ELEVATION
SIDE ELEVATION
HEADBOARD ELEVATION
SECTION

Show:

Overall dimensions
Mattress area
Headboard
Side panels
Storage modules
Dimensions
Component labels

Changing overall bed width must update the drawing.

==================================================
SIDE TABLE DEMO
==================================================

Use the uploaded SIDE TABLE formula as the reference.

Ask:

Width
Depth
Height
Number of drawers
Drawer height
Groove requirement
Material
Thickness
Finish

Components can include:

Top
Bottom
LHS
RHS
Back Panel
Drawer Channel
Drawer Back Side
Drawer Front Side
Drawer Back
Drawer Facia
Skirting

Use company terminology from the uploaded formula.

==================================================
SIDE TABLE 2D
==================================================

Generate:

PLAN
FRONT
SIDE
SECTION

Show:

Overall W × D × H
Drawer divisions
Top
Bottom
Side panels
Skirting
Dimensions

==================================================
OPENABLE WARDROBE DEMO
==================================================

Use the uploaded OPENABLE WARDROB formula as the reference.

Ask:

Overall Width
Overall Height
Depth
Number of shutters
Number of vertical divisions
Shelves
Drawers
Hanging section
Loft
Skirting
Back panel
Finish

Components should include where applicable:

TOP
BOTTOM
SIDE LHS
SIDE RHS
VERTICAL
SELF TOP
SMALL SELF
SMALL VERTICAL
CHANNEL PATTA
CENTER VERTICAL
DRAWER LHS
DRAWER RHS
DR FRNT
DR BACK
DR FACIA
WARDROBE SCRTING
WARDROBE BACK PANEL
DR BACK PANEL
WARDROBE DOOR

Do not invent additional company rules.

==================================================
OPENABLE WARDROBE 2D
==================================================

Generate:

FRONT ELEVATION
SIDE ELEVATION
PLAN
INTERNAL ELEVATION
SECTION

Show:

Shutter divisions
Vertical divisions
Shelves
Drawers
Hanging areas
Skirting
Loft if selected
Overall dimensions
Internal dimensions

Allow the user to change:

Width
Height
Depth
Number of shutters
Drawer count

The drawing must update.

==================================================
SLIDING WARDROBE DEMO
==================================================

Use the uploaded SLIDING WARDROB formula as the reference.

Ask:

Width
Height
Depth
Number of sliding shutters
Track type
Internal divisions
Shelves
Drawers
Back panel
Border Patti
Skirting
Finish

Use the formula terminology where applicable:

TOP
BOTTOM
SIDE LHS
SIDE RHS
VERTICAL
SELF TOP
SMALL SELF
SMALL VERTICAL
CHANNEL PATTA
CENTER VERTICAL
DRAWER
WARDROBE SCRTING
BACK PANEL
BORDER PATTI

==================================================
SLIDING WARDROBE 2D
==================================================

Generate:

FRONT ELEVATION
PLAN
SIDE ELEVATION
INTERNAL ELEVATION
SECTION

Show sliding shutters and internal divisions clearly.

Allow:

2 shutter
3 shutter
4 shutter

demo configurations.

==================================================
LOFT DEMO
==================================================

Use the uploaded LOFT BOX & CABINET BOX structure.

Ask:

Width
Height
Depth
Number of boxes
Door type
Vertical divisions
Open box
Shutter
Material
Finish

Components can include:

TOP
BOTTOM
LHS
RHS
9 MM BACK
VERTICAL
DOOR

Generate:

FRONT
SIDE
PLAN
SECTION

Show box divisions and door divisions.

==================================================
TV UNIT DEMO
==================================================

Create a configurable TV unit demo.

Ask:

Overall Width
Overall Height
Depth
TV Width
TV Height
Base Cabinet
Wall Cabinet
Open Box
Drawer
Panel
Wire Management
Electrical Points

Generate:

FRONT ELEVATION
PLAN
SIDE ELEVATION
SECTION

Show:

TV position
Base unit
Wall units
Open boxes
Drawers
Panel
Electrical/wire points
Dimensions

Clearly mark values as DEMO DATA because TV Unit formula data is not present in the uploaded formula workbook.

==================================================
DINING TABLE DEMO
==================================================

Create:

4 Seater
6 Seater
8 Seater

Ask:

Table Length
Table Width
Table Height
Top Thickness
Leg Type
Number of Chairs
Chair Width

Generate:

PLAN
FRONT
SIDE
SECTION

Show dimensions.

Mark company-specific construction/cutlist values as DEMO DATA unless provided by the uploaded files.

==================================================
BEDROOM DEMO
==================================================

Bedroom should be treated as a ROOM / MULTI-PRODUCT DEMO rather than a single furniture item.

Allow:

Bed
Wardrobe
Side Table
TV Unit
Dresser
Loft

Ask:

Room Length
Room Width
Ceiling Height
Door
Window
Electrical
Furniture placement

Generate:

ROOM PLAN
FURNITURE PLAN
WALL ELEVATION A
WALL ELEVATION B
WALL ELEVATION C
WALL ELEVATION D

Show furniture footprints and dimensions.

==================================================
1 BHK DEMO
==================================================

Create a complete apartment demo.

Rooms:

Living Room
Kitchen
Bedroom
Bathroom
Optional Balcony

Ask room dimensions.

Allow furniture modules:

Kitchen
Bed
Wardrobe
TV Unit
Side Table
Dining Table
Loft

Generate:

FULL FLOOR PLAN
ROOM-WISE PLAN
FURNITURE LAYOUT
KITCHEN PLAN
BEDROOM ELEVATION
TV WALL ELEVATION

Clearly label this as:

"DEMO 1 BHK"

==================================================
2 BHK DEMO
==================================================

Rooms:

Living Room
Kitchen
Bedroom 1
Bedroom 2
Bathrooms
Optional Balcony

Allow furniture placement.

Generate:

FULL FLOOR PLAN
ROOM-WISE FURNITURE PLAN
KITCHEN PLAN
BEDROOM PLANS
WARDROBE ELEVATIONS
TV UNIT ELEVATION
DINING LAYOUT

==================================================
3 BHK DEMO
==================================================

Rooms:

Living Room
Kitchen
Bedroom 1
Bedroom 2
Bedroom 3
Bathrooms
Optional Balcony

Generate:

FULL FLOOR PLAN
ROOM-WISE FURNITURE PLAN
KITCHEN
BEDROOMS
WARDROBES
TV UNIT
DINING

Use demo values only where company formulas are not available.

==================================================
PARAMETRIC DRAWING ENGINE
==================================================

IMPORTANT:

Do NOT use static images as drawings.

Every drawing must be generated from structured dimensions.

For example:

{
  width: 2100,
  height: 2090,
  depth: 600
}

must generate actual geometry.

If:

width = 2100

changes to:

width = 2400

the drawing must automatically update.

The dimensions displayed on the drawing must come from the same model.

==================================================
DRAWING VIEWS
==================================================

Create reusable views:

PLAN
FRONT ELEVATION
SIDE ELEVATION
END ELEVATION
INTERNAL ELEVATION
SECTION
DETAIL

Not every product requires every view.

Each ProductTemplate defines its required views.

==================================================
CUTLIST CONNECTION
==================================================

Add a "CUTLIST" tab next to the 2D drawing.

The cutlist should be generated from the product's dimensions and component rules.

Display:

SR NO
MATERIAL
WIDTH
HEIGHT
QTY
COLOR
THICKNESS
GROOVE
REMARK

Use the terminology and structure from the uploaded formula workbook.

For example, wardrobe components should appear with the same component naming style as the uploaded formulas.

IMPORTANT:

The cutlist must NOT be a manually typed static table.

It should be generated from the parametric product model.

If the overall dimensions change:

2D DRAWING changes
AND
CUTLIST changes.

==================================================
2D + CUTLIST RELATIONSHIP
==================================================

Example:

Wardrobe:

Width = 2290
Height = 2090
Depth = 600

If Width changes to 2400:

Recalculate:

Top
Bottom
Verticals
Shelves
Doors
Back Panel
Drawer components

Then update:

2D
Dimensions
Cutlist

automatically.

==================================================
DEMO DATA
==================================================

Each product should have at least 1 complete demo project.

Use realistic dimensions.

Clearly show:

DEMO DATA

Do not represent demo values as official company standards.

Where uploaded company formula data exists, use it as the reference.

Where it does not exist, use placeholder/demo rules.

==================================================
PRODUCT DEMO DASHBOARD
==================================================

Create a screen:

"PRODUCT DEMOS"

Cards:

Kitchen
✓ Demo Ready

Bed
✓ Demo Ready

Side Table
✓ Demo Ready

Openable Wardrobe
✓ Demo Ready

Sliding Wardrobe
✓ Demo Ready

TV Unit
✓ Demo Ready

Loft
✓ Demo Ready

Dining Table
✓ Demo Ready

Bedroom
✓ Demo Ready

1 BHK
✓ Demo Ready

2 BHK
✓ Demo Ready

3 BHK
✓ Demo Ready

Each card should have:

View Demo
Open Measurements
View 2D
View Cutlist

==================================================
LIVE DEMONSTRATION MODE
==================================================

Add a button:

"DEMO MODE"

When enabled, users can quickly switch between products without creating real orders.

Show:

Product
Measurements
2D
Cutlist

in a clean demonstration workflow.

==================================================
REFERENCE / DESIGN STYLE
==================================================

Keep the current SmartMeasure CAD visual language.

Do NOT make each product look like a different application.

The application should feel like one unified professional CAD/measurement system.

Use:

Technical drawing style
White canvas
Clean black/gray lines
Dimension arrows
Professional labels
Selected components highlighted
Warnings highlighted
Clear measurement fields

==================================================
IMPORTANT ARCHITECTURE
==================================================

Do NOT create 12 completely separate implementations.

Build reusable systems:

ProductTemplate
MeasurementSchema
RuleEngine
ComponentLibrary
GeometryEngine
DimensionEngine
CutlistEngine
EvidenceEngine
DrawingRenderer

Then configure each product using these systems.

Architecture:

Product
↓
Measurements
↓
Rules
↓
Components
↓
Geometry
↓
2D Drawing
↓
Cutlist

==================================================
CLAUDE AI
==================================================

Keep Claude as an AI assistant.

Claude may:

- ask missing questions
- interpret requirements
- identify missing measurements
- convert natural language into structured commands
- explain cutlist/drawing warnings

Claude must NOT directly draw the 2D geometry.

The deterministic geometry/rule engine must generate the drawing.

==================================================
FINAL DEMO FLOW
==================================================

The final prototype must allow me to demonstrate:

Kitchen
→ measurements
→ 2D
→ cutlist

Bed
→ measurements
→ 2D
→ cutlist

Openable Wardrobe
→ measurements
→ 2D
→ cutlist

Sliding Wardrobe
→ measurements
→ 2D
→ cutlist

Side Table
→ measurements
→ 2D
→ cutlist

Loft
→ measurements
→ 2D
→ cutlist

TV Unit
→ measurements
→ 2D

Dining Table
→ measurements
→ 2D

Bedroom
→ room measurements
→ furniture layout
→ 2D

1 BHK
→ room measurements
→ furniture plan
→ 2D

2 BHK
→ room measurements
→ furniture plan
→ 2D

3 BHK
→ room measurements
→ furniture plan
→ 2D

==================================================
FINAL REQUIREMENT
==================================================

The goal is to make the prototype demonstrate the complete vision:

SITE MEASUREMENT
↓
PRODUCT SELECTION
↓
PRODUCT-SPECIFIC QUESTIONS
↓
MEASUREMENTS
↓
COMPANY RULES
↓
PARAMETRIC COMPONENTS
↓
LIVE 2D DRAWING
↓
CUTLIST
↓
VALIDATION
↓
FINAL PDF

The Kitchen demo already exists.

Do NOT break it.

Extend the same architecture to all the products above.

Prioritize functional demo behavior over decorative UI.