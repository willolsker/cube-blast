// Coordinate System Constants
export const COORDINATE_SYSTEM = {
  GRID_SIZE: 8,
  GRID_MIN: 0,
  GRID_MAX: 7,
  CUBE_SIZE: 0.9,
  GAME_BOARD_CENTER: 3.5, // (GRID_SIZE - 1) / 2
} as const;

// Coordinate Helper Functions
export const gridToWorld = (gridPos: number) => gridPos;
export const worldToGrid = (worldPos: number) => worldPos;
export const clampGrid = (pos: number) =>
  Math.max(
    COORDINATE_SYSTEM.GRID_MIN,
    Math.min(COORDINATE_SYSTEM.GRID_MAX, Math.round(pos))
  );
