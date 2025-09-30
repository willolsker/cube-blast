import type {
  BlockDimensions,
  ThreeDimensionalBooleanArray,
} from "../types/game";

export const calculateBlockDimensions = (
  block: ThreeDimensionalBooleanArray
): BlockDimensions => {
  const zDepth = block.length;
  const yHeight = block[0]?.length ?? 0;
  const xWidth = block[0]?.[0]?.length ?? 0;
  return { xWidth, yHeight, zDepth };
};
