export const layerColors = [
  "#3b82f6",
  "#10b981",
  "#ef4444",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#0ea5e9",
  "#10b981",
];

// [z][y][x]

export const possibleBlocks: boolean[][][][] = [
  // Rectangular prism 2L 3W 2H
  [
    [
      [true, true, true],
      [true, true, true],
    ],
    [
      [true, true, true],
      [true, true, true],
    ],
  ],
  // Rectangular prism 1L 8W 1H
  [[[true, true, true, true, true, true, true, true]]],
  // L block
  [
    [
      [true, false, false],
      [true, false, false],
      [true, true, true],
    ],
  ],
  // T block
  [
    [
      [true, true, true],
      [false, true, false],
      [false, true, false],
    ],
  ],
];

interface Rotation {
  x: number;
  y: number;
  z: number;
}
// Rotates the block around the x, y, z axes
const rotateBlock =
  (block: boolean[][][]) =>
  (rotation: Rotation): boolean[][][] => {
    const { x, y, z } = rotation;

    let rotatedBlock = block;

    // Rotate around X axis (Y becomes Z, Z becomes -Y)
    for (let i = 0; i < x % 4; i++) {
      const newBlock: boolean[][][] = [];
      const height = rotatedBlock.length;
      const width = rotatedBlock[0]?.length ?? 0;
      const depth = rotatedBlock[0]?.[0]?.length ?? 0;

      for (let z = 0; z < depth; z++) {
        newBlock[z] = [];
        for (let x = 0; x < width; x++) {
          if (!newBlock[z]) newBlock[z] = [];
          newBlock[z]![x] = [];
          for (let y = 0; y < height; y++) {
            const sourceY = height - 1 - y;
            const sourceX = x;
            const sourceZ = z;
            const sourceRow = rotatedBlock[sourceY];
            const sourceCell = sourceRow?.[sourceX];
            newBlock[z]![x]![y] = sourceCell?.[sourceZ] ?? false;
          }
        }
      }
      rotatedBlock = newBlock;
    }

    // Rotate around Y axis (X becomes Z, Z becomes -X)
    for (let i = 0; i < y % 4; i++) {
      const newBlock: boolean[][][] = [];
      const height = rotatedBlock.length;
      const width = rotatedBlock[0]?.length ?? 0;
      const depth = rotatedBlock[0]?.[0]?.length ?? 0;

      for (let y = 0; y < height; y++) {
        newBlock[y] = [];
        for (let z = 0; z < depth; z++) {
          if (!newBlock[y]) newBlock[y] = [];
          newBlock[y]![z] = [];
          for (let x = 0; x < width; x++) {
            const sourceY = y;
            const sourceX = width - 1 - x;
            const sourceZ = z;
            const sourceRow = rotatedBlock[sourceY];
            const sourceCell = sourceRow?.[sourceX];
            newBlock[y]![z]![x] = sourceCell?.[sourceZ] ?? false;
          }
        }
      }
      rotatedBlock = newBlock;
    }

    // Rotate around Z axis (X becomes Y, Y becomes -X)
    for (let i = 0; i < z % 4; i++) {
      const newBlock: boolean[][][] = [];
      const height = rotatedBlock.length;
      const width = rotatedBlock[0]?.length ?? 0;
      const depth = rotatedBlock[0]?.[0]?.length ?? 0;

      for (let y = 0; y < height; y++) {
        newBlock[y] = [];
        for (let x = 0; x < width; x++) {
          if (!newBlock[y]) newBlock[y] = [];
          newBlock[y]![x] = [];
          for (let z = 0; z < depth; z++) {
            const sourceY = y;
            const sourceX = width - 1 - x;
            const sourceZ = depth - 1 - z;
            const sourceRow = rotatedBlock[sourceY];
            const sourceCell = sourceRow?.[sourceX];
            newBlock[y]![x]![z] = sourceCell?.[sourceZ] ?? false;
          }
        }
      }
      rotatedBlock = newBlock;
    }

    return rotatedBlock;
  };

const generateRandomRotation = (): Rotation => {
  return {
    x: Math.floor(Math.random() * 4),
    y: Math.floor(Math.random() * 4),
    z: Math.floor(Math.random() * 4),
  };
};

export const getRandomBlock = (): boolean[][][] => {
  const block =
    possibleBlocks[Math.floor(Math.random() * possibleBlocks.length)];
  if (!block) {
    throw new Error("No block found");
  }
  const rotation = generateRandomRotation();
  return rotateBlock(block)(rotation);
};
