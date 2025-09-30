// Constants for floating block grid visualization
export const GRID_OPACITY = {
  MIN: 0.15, // Back-facing grids
  MAX: 0.6, // Front-facing grids
  PLANE_MULTIPLIER: 0.5, // Plane opacity relative to grid lines
} as const;

export const GRID_COLORS = {
  VALID: "#00ff88", // Cyan/green for valid placement
  INVALID: "#ff0000", // Red for out of bounds
} as const;

export const GRID_LINE_WIDTH = 1;
