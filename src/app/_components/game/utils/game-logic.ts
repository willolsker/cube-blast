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

  // Check for completed 1D lines and clear them
  // Lines can be along X, Y, or Z axis

  // Track which cubes to clear (using Set to avoid duplicates)
  const cubesToClear = new Set<string>();

  // Check X-axis lines (all cubes from x=0 to x=7 at specific y,z)
  for (let y = 0; y < 8; y++) {
    for (let z = 0; z < 8; z++) {
      let lineComplete = true;
      for (let x = 0; x < 8; x++) {
        if (!newBoard[z]![y]![x]) {
          lineComplete = false;
          break;
        }
      }
      if (lineComplete) {
        for (let x = 0; x < 8; x++) {
          cubesToClear.add(`${x},${y},${z}`);
        }
      }
    }
  }

  // Check Y-axis lines (all cubes from y=0 to y=7 at specific x,z)
  for (let x = 0; x < 8; x++) {
    for (let z = 0; z < 8; z++) {
      let lineComplete = true;
      for (let y = 0; y < 8; y++) {
        if (!newBoard[z]![y]![x]) {
          lineComplete = false;
          break;
        }
      }
      if (lineComplete) {
        for (let y = 0; y < 8; y++) {
          cubesToClear.add(`${x},${y},${z}`);
        }
      }
    }
  }

  // Check Z-axis lines (all cubes from z=0 to z=7 at specific x,y)
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      let lineComplete = true;
      for (let z = 0; z < 8; z++) {
        if (!newBoard[z]![y]![x]) {
          lineComplete = false;
          break;
        }
      }
      if (lineComplete) {
        for (let z = 0; z < 8; z++) {
          cubesToClear.add(`${x},${y},${z}`);
        }
      }
    }
  }

  // Clear all marked cubes
  for (const cubeKey of cubesToClear) {
    const coords = cubeKey.split(",").map(Number);
    const x = coords[0]!;
    const y = coords[1]!;
    const z = coords[2]!;
    newBoard[z]![y]![x] = false;
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
    score: gameState.score + cubesToClear.size * 100,
  };
};

export const createInitialGameState = (): GameState => ({
  board: Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => false))
  ),
  nextBlocks: Array.from({ length: 3 }, () => getRandomBlock()),
  activeBlock: 0,
  score: 0,
});
