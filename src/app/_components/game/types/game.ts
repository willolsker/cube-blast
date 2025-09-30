export type ThreeDimensionalBooleanArray = boolean[][][];

export interface GameState {
  board: ThreeDimensionalBooleanArray;
  nextBlocks: (ThreeDimensionalBooleanArray | null)[];
  activeBlock: number | null;
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface BlockDimensions {
  xWidth: number;
  yHeight: number;
  zDepth: number;
}

export type DebugMode = "off" | "gameboard" | "cursor";
export type InteractionMode = "orbit" | "drag";
