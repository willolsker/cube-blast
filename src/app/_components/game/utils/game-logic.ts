import type { GameState } from "../types/game";
import { getRandomBlock } from "../blocks";
import { calculateBlockDimensions } from "./block-utils";

export const getNextGameState = (
  gameState: GameState,
  blockGridX: number,
  blockGridY: number,
  blockGridZ: number
) => {
  const newBoard = gameState.board.map((layer, z) =>
    layer.map((row, y) => row.map((cell, x) => cell))
  );

  const activeBlock = gameState.activeBlock;
  if (activeBlock === null) return gameState;

  const block = gameState.nextBlocks[activeBlock];
  if (!block) return gameState;

  // Check if block can be placed at the specified position
  const blockDimensions = calculateBlockDimensions(block);
  let canPlace = true;

  // Check for collisions at the specified position
  for (let blockZ = 0; blockZ < blockDimensions.zDepth; blockZ++) {
    for (let blockY = 0; blockY < blockDimensions.yHeight; blockY++) {
      for (let blockX = 0; blockX < blockDimensions.xWidth; blockX++) {
        if (block[blockZ]?.[blockY]?.[blockX]) {
          const boardX = blockGridX + blockX;
          const boardY = blockGridY + blockY;
          const boardZ = blockGridZ + blockZ;

          // Check bounds
          if (
            boardX < 0 ||
            boardX >= 8 ||
            boardY < 0 ||
            boardY >= 8 ||
            boardZ < 0 ||
            boardZ >= 8
          ) {
            canPlace = false;
            break;
          }

          // Check if position is already occupied
          if (
            newBoard[boardZ] &&
            newBoard[boardZ][boardY] &&
            newBoard[boardZ][boardY][boardX]
          ) {
            canPlace = false;
            break;
          }
        }
      }
      if (!canPlace) break;
    }
    if (!canPlace) break;
  }

  if (!canPlace) return gameState;

  // Place the block at the specified position if valid
  for (let blockZ = 0; blockZ < blockDimensions.zDepth; blockZ++) {
    for (let blockY = 0; blockY < blockDimensions.yHeight; blockY++) {
      for (let blockX = 0; blockX < blockDimensions.xWidth; blockX++) {
        if (block[blockZ]?.[blockY]?.[blockX]) {
          const boardX = blockGridX + blockX;
          const boardY = blockGridY + blockY;
          const boardZ = blockGridZ + blockZ;

          if (
            boardX >= 0 &&
            boardX < 8 &&
            boardY >= 0 &&
            boardY < 8 &&
            boardZ >= 0 &&
            boardZ < 8
          ) {
            if (newBoard[boardZ] && newBoard[boardZ][boardY]) {
              newBoard[boardZ][boardY][boardX] = true;
            }
          }
        }
      }
    }
  }

  // Check for completed layers and clear them
  const layersToClear: number[] = [];
  for (let y = 0; y < 8; y++) {
    let layerComplete = true;
    for (let z = 0; z < 8; z++) {
      for (let x = 0; x < 8; x++) {
        if (!newBoard[z]![y]![x]) {
          layerComplete = false;
          break;
        }
      }
      if (!layerComplete) break;
    }
    if (layerComplete) {
      layersToClear.push(y);
    }
  }

  // Clear completed layers
  for (const layerY of layersToClear) {
    for (let z = 0; z < 8; z++) {
      for (let x = 0; x < 8; x++) {
        newBoard[z]![layerY]![x] = false;
      }
    }
  }

  // Drop blocks above cleared layers
  for (const layerY of layersToClear) {
    for (let y = layerY + 1; y < 8; y++) {
      for (let z = 0; z < 8; z++) {
        for (let x = 0; x < 8; x++) {
          if (newBoard[z]![y]![x]) {
            newBoard[z]![y - 1]![x] = true;
            newBoard[z]![y]![x] = false;
          }
        }
      }
    }
  }

  // Generate new next blocks (remove used block, add new one)
  let newNextBlocks = [...gameState.nextBlocks];
  newNextBlocks[activeBlock] = null;

  if (newNextBlocks.every((block) => block === null)) {
    newNextBlocks = Array.from({ length: 3 }, () => getRandomBlock());
  }

  const newActiveBlock = newNextBlocks.findIndex((block) => block !== null);

  return {
    board: newBoard,
    nextBlocks: newNextBlocks,
    activeBlock: newActiveBlock,
  };
};

export const createInitialGameState = (): GameState => ({
  board: Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => false))
  ),
  nextBlocks: Array.from({ length: 3 }, () => getRandomBlock()),
  activeBlock: null,
});
