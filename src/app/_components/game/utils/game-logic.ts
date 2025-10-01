import type { GameState, ThreeDimensionalBooleanArray } from "../types/game";
import { getRandomBlock } from "../blocks";
import { calculateBlockDimensions } from "./block-utils";
import { COORDINATE_SYSTEM } from "../constants/coordinates";

/**
 * Checks if a block can be placed at a specific position on the board
 */
const canPlaceBlockAt = (
  board: ThreeDimensionalBooleanArray,
  block: ThreeDimensionalBooleanArray,
  x: number,
  y: number,
  z: number
): boolean => {
  const blockDimensions = calculateBlockDimensions(block);

  // Check for collisions at the specified position
  for (let blockZ = 0; blockZ < blockDimensions.zDepth; blockZ++) {
    for (let blockY = 0; blockY < blockDimensions.yHeight; blockY++) {
      for (let blockX = 0; blockX < blockDimensions.xWidth; blockX++) {
        if (block[blockZ]?.[blockY]?.[blockX]) {
          const boardX = x + blockX;
          const boardY = y + blockY;
          const boardZ = z + blockZ;

          // Check bounds
          if (
            boardX < 0 ||
            boardX >= COORDINATE_SYSTEM.GRID_SIZE ||
            boardY < 0 ||
            boardY >= COORDINATE_SYSTEM.GRID_SIZE ||
            boardZ < 0 ||
            boardZ >= COORDINATE_SYSTEM.GRID_SIZE
          ) {
            return false;
          }

          // Check if position is already occupied
          if (
            board[boardZ] &&
            board[boardZ][boardY] &&
            board[boardZ][boardY][boardX]
          ) {
            return false;
          }
        }
      }
    }
  }

  return true;
};

/**
 * Checks if any of the next blocks can be placed anywhere on the board
 */
const checkGameOver = (
  board: ThreeDimensionalBooleanArray,
  nextBlocks: (ThreeDimensionalBooleanArray | null)[]
): boolean => {
  // Get all non-null blocks
  const availableBlocks = nextBlocks.filter(
    (block): block is ThreeDimensionalBooleanArray => block !== null
  );

  // If no blocks available, game is not over (new blocks will be generated)
  if (availableBlocks.length === 0) {
    return false;
  }

  // Check if any block can be placed anywhere on the board
  for (const block of availableBlocks) {
    for (let z = 0; z < COORDINATE_SYSTEM.GRID_SIZE; z++) {
      for (let y = 0; y < COORDINATE_SYSTEM.GRID_SIZE; y++) {
        for (let x = 0; x < COORDINATE_SYSTEM.GRID_SIZE; x++) {
          if (canPlaceBlockAt(board, block, x, y, z)) {
            return false; // At least one block can be placed, game is not over
          }
        }
      }
    }
  }

  // No blocks can be placed anywhere
  return true;
};

export const getNextGameState = (
  gameState: GameState,
  blockGridX: number,
  blockGridY: number,
  blockGridZ: number
) => {
  // Don't allow placing blocks if game is over
  if (gameState.gameOver) return gameState;

  const newBoard = gameState.board.map((layer, z) =>
    layer.map((row, y) => row.map((cell, x) => cell))
  );

  const activeBlock = gameState.activeBlock;
  if (activeBlock === null) return gameState;

  const block = gameState.nextBlocks[activeBlock];
  if (!block) return gameState;

  // Check if block can be placed at the specified position
  if (!canPlaceBlockAt(newBoard, block, blockGridX, blockGridY, blockGridZ)) {
    return gameState;
  }

  // Place the block at the specified position if valid
  const blockDimensions = calculateBlockDimensions(block);
  for (let blockZ = 0; blockZ < blockDimensions.zDepth; blockZ++) {
    for (let blockY = 0; blockY < blockDimensions.yHeight; blockY++) {
      for (let blockX = 0; blockX < blockDimensions.xWidth; blockX++) {
        if (block[blockZ]?.[blockY]?.[blockX]) {
          const boardX = blockGridX + blockX;
          const boardY = blockGridY + blockY;
          const boardZ = blockGridZ + blockZ;

          if (
            boardX >= 0 &&
            boardX < COORDINATE_SYSTEM.GRID_SIZE &&
            boardY >= 0 &&
            boardY < COORDINATE_SYSTEM.GRID_SIZE &&
            boardZ >= 0 &&
            boardZ < COORDINATE_SYSTEM.GRID_SIZE
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

  // Check X-axis lines (all cubes from x=0 to x=GRID_MAX at specific y,z)
  for (let y = 0; y < COORDINATE_SYSTEM.GRID_SIZE; y++) {
    for (let z = 0; z < COORDINATE_SYSTEM.GRID_SIZE; z++) {
      let lineComplete = true;
      for (let x = 0; x < COORDINATE_SYSTEM.GRID_SIZE; x++) {
        if (!newBoard[z]![y]![x]) {
          lineComplete = false;
          break;
        }
      }
      if (lineComplete) {
        for (let x = 0; x < COORDINATE_SYSTEM.GRID_SIZE; x++) {
          cubesToClear.add(`${x},${y},${z}`);
        }
      }
    }
  }

  // Check Y-axis lines (all cubes from y=0 to y=GRID_MAX at specific x,z)
  for (let x = 0; x < COORDINATE_SYSTEM.GRID_SIZE; x++) {
    for (let z = 0; z < COORDINATE_SYSTEM.GRID_SIZE; z++) {
      let lineComplete = true;
      for (let y = 0; y < COORDINATE_SYSTEM.GRID_SIZE; y++) {
        if (!newBoard[z]![y]![x]) {
          lineComplete = false;
          break;
        }
      }
      if (lineComplete) {
        for (let y = 0; y < COORDINATE_SYSTEM.GRID_SIZE; y++) {
          cubesToClear.add(`${x},${y},${z}`);
        }
      }
    }
  }

  // Check Z-axis lines (all cubes from z=0 to z=GRID_MAX at specific x,y)
  for (let x = 0; x < COORDINATE_SYSTEM.GRID_SIZE; x++) {
    for (let y = 0; y < COORDINATE_SYSTEM.GRID_SIZE; y++) {
      let lineComplete = true;
      for (let z = 0; z < COORDINATE_SYSTEM.GRID_SIZE; z++) {
        if (!newBoard[z]![y]![x]) {
          lineComplete = false;
          break;
        }
      }
      if (lineComplete) {
        for (let z = 0; z < COORDINATE_SYSTEM.GRID_SIZE; z++) {
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

  // Check for game over condition
  const isGameOver = checkGameOver(newBoard, newNextBlocks);

  return {
    board: newBoard,
    nextBlocks: newNextBlocks,
    activeBlock: newActiveBlock,
    score: gameState.score + cubesToClear.size * 100,
    gameOver: isGameOver,
  };
};

export const createInitialGameState = (): GameState => ({
  board: Array.from({ length: COORDINATE_SYSTEM.GRID_SIZE }, () =>
    Array.from({ length: COORDINATE_SYSTEM.GRID_SIZE }, () =>
      Array.from({ length: COORDINATE_SYSTEM.GRID_SIZE }, () => false)
    )
  ),
  nextBlocks: Array.from({ length: 3 }, () => getRandomBlock()),
  activeBlock: 0,
  score: 0,
  gameOver: false,
});
