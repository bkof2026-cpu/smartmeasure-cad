// ─────────────────────────────────────────────────────────────────────────────
// CLEARANCE_MASTER — copied verbatim from C:\Users\HP\Downloads\
// Cutlist_Engine_NEW_SHEETS_ONLY.xlsx, sheet "CLEARANCE_MASTER".
// Do NOT add or change a value here without re-reading that sheet — this is
// the authoritative, historically-verified standards source for this app.
// See docs/PRODUCT_STANDARDS.md for the full table with descriptions.
// ─────────────────────────────────────────────────────────────────────────────

export const CLEARANCE_MASTER = {
  BOARD_18: 18,
  BOARD_9: 9,

  // BOX family (Loft Box / Cabinet Box / Storage Box / Open Box / Service Box)
  BOX_TB_DEDUCT: 36,
  BOX_BACK_WH_DEDUCT: 20,
  BOX_VERT_H_DEDUCT: 36,
  BOX_VERT_D_DEDUCT: 30,

  // WARDROBE (shared by Openable + Sliding)
  WARD_TB_DEDUCT: 36,
  WARD_VERT_H_DEDUCT: 106,
  WARD_OPEN_VERT_D_DEDUCT: 30,
  WARD_SLIDE_VERT_D_DEDUCT: 120,
  WARD_SELF_W_DEDUCT: 54,
  WARD_SMALLSELF_H_DEDUCT: 18,
  WARD_OPEN_DEPTH_A: 80,
  WARD_OPEN_DEPTH_B: 110,
  WARD_SLIDE_DEPTH_A: 120,
  WARD_SLIDE_DEPTH_B: 150,
  WARD_DR_OFFSET: 61,
  WARD_BACKPANEL_H_DEDUCT: 90,
  WARD_BACKPANEL_W_DEDUCT: 20,
  WARD_OPEN_DOOR_W_DEDUCT: 6,
  WARD_OPEN_DOOR_H_DEDUCT: 134,
  WARD_SLIDE_DOOR_H_DEDUCT: 136,

  // BED
  BED_W_CLR1: 200,
  BED_W_CLR2: 72,
  BED_H_CLR1: 100,
  BED_H_CLR2: 18,
  BED_BOTTOM_H_DEDUCT: 36,

  // SIDE TABLE
  SIDE_TBL_BOT_D_DEDUCT: 30,
  SIDE_TBL_BOT_W_DEDUCT: 36,
  SIDE_TBL_DRAWER_W_DEDUCT: 97,
  SIDE_TBL_FACIA_H_DEDUCT: 110,
} as const;

export type ClearanceConstant = keyof typeof CLEARANCE_MASTER;

/** For the Drawing Inspector: constant name -> its value, for display. */
export function constantValue(name: string): number | undefined {
  return (CLEARANCE_MASTER as Record<string, number>)[name];
}
