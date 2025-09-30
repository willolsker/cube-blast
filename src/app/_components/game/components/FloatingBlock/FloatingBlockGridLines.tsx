import { useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { COORDINATE_SYSTEM } from "../../constants/coordinates";
import {
  GRID_OPACITY,
  GRID_COLORS,
  GRID_LINE_WIDTH,
} from "../../constants/rendering";
import type { GameState, BlockDimensions } from "../../types/game";

export const FloatingBlockGridLines = ({
  blockDimensions,
  worldPosition,
  block,
  gameState,
}: {
  blockDimensions: BlockDimensions;
  worldPosition: [number, number, number];
  block: boolean[][][];
  gameState: GameState;
}) => {
  const { camera } = useThree();
  const [faceOpacities, setFaceOpacities] = useState<{
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    zMin: number;
    zMax: number;
  }>({
    xMin: GRID_OPACITY.MAX,
    xMax: GRID_OPACITY.MAX,
    yMin: GRID_OPACITY.MAX,
    yMax: GRID_OPACITY.MAX,
    zMin: GRID_OPACITY.MAX,
    zMax: GRID_OPACITY.MAX,
  });

  const { xWidth, yHeight, zDepth } = blockDimensions;
  const xMin = worldPosition[0] - 0.5;
  const xMax = worldPosition[0] + xWidth - 0.5;
  const yMin = worldPosition[1] - 0.5;
  const yMax = worldPosition[1] + yHeight - 0.5;
  const zMin = worldPosition[2] - 0.5;
  const zMax = worldPosition[2] + zDepth - 0.5;

  // Get grid positions
  const gridX = Math.round(worldPosition[0]);
  const gridY = Math.round(worldPosition[1]);
  const gridZ = Math.round(worldPosition[2]);

  // Check if faces are outside the board bounds
  const gameBoardMin = -0.5;
  const gameBoardMax = COORDINATE_SYSTEM.GRID_SIZE - 0.5;

  // Helper function to check if a face plane intersects with existing blocks
  const checkFaceCollision = (
    axis: "x" | "y" | "z",
    facePosition: number
  ): boolean => {
    // Get the grid coordinate for this face
    const faceGridCoord = Math.round(facePosition + 0.5);

    // Check all cells in the block that would be at this face position
    for (let blockZ = 0; blockZ < zDepth; blockZ++) {
      for (let blockY = 0; blockY < yHeight; blockY++) {
        for (let blockX = 0; blockX < xWidth; blockX++) {
          if (block[blockZ]?.[blockY]?.[blockX]) {
            const boardX = gridX + blockX;
            const boardY = gridY + blockY;
            const boardZ = gridZ + blockZ;

            // Check if this block cell is at the face position
            let atFace = false;
            if (axis === "x" && boardX === faceGridCoord) atFace = true;
            if (axis === "y" && boardY === faceGridCoord) atFace = true;
            if (axis === "z" && boardZ === faceGridCoord) atFace = true;

            if (atFace) {
              // Check if there's a collision at this position
              if (
                boardX >= 0 &&
                boardX < 8 &&
                boardY >= 0 &&
                boardY < 8 &&
                boardZ >= 0 &&
                boardZ < 8 &&
                gameState.board[boardZ]?.[boardY]?.[boardX]
              ) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  };

  const isOutOfBounds = {
    xMin: xMin < gameBoardMin || checkFaceCollision("x", xMin),
    xMax: xMax > gameBoardMax || checkFaceCollision("x", xMax),
    yMin: yMin < gameBoardMin || checkFaceCollision("y", yMin),
    yMax: yMax > gameBoardMax || checkFaceCollision("y", yMax),
    zMin: zMin < gameBoardMin || checkFaceCollision("z", zMin),
    zMax: zMax > gameBoardMax || checkFaceCollision("z", zMax),
  };

  const centerX = (xMin + xMax) / 2;
  const centerY = (yMin + yMax) / 2;
  const centerZ = (zMin + zMax) / 2;

  // Face normal vectors for each face
  const FACE_NORMALS = {
    xMin: new THREE.Vector3(-1, 0, 0),
    xMax: new THREE.Vector3(1, 0, 0),
    yMin: new THREE.Vector3(0, -1, 0),
    yMax: new THREE.Vector3(0, 1, 0),
    zMin: new THREE.Vector3(0, 0, -1),
    zMax: new THREE.Vector3(0, 0, 1),
  } as const;

  useFrame(() => {
    // Calculate camera direction from block center
    const cameraDir = new THREE.Vector3()
      .subVectors(camera.position, new THREE.Vector3(centerX, centerY, centerZ))
      .normalize();

    // Calculate opacity based on dot product (facing camera = positive)
    const calculateFaceOpacity = (normal: THREE.Vector3) =>
      Math.max(GRID_OPACITY.MIN, normal.dot(cameraDir) * GRID_OPACITY.MAX);

    const newOpacities = {
      xMin: calculateFaceOpacity(FACE_NORMALS.xMin),
      xMax: calculateFaceOpacity(FACE_NORMALS.xMax),
      yMin: calculateFaceOpacity(FACE_NORMALS.yMin),
      yMax: calculateFaceOpacity(FACE_NORMALS.yMax),
      zMin: calculateFaceOpacity(FACE_NORMALS.zMin),
      zMax: calculateFaceOpacity(FACE_NORMALS.zMax),
    };

    setFaceOpacities(newOpacities);
  });

  // Create grid lines for the entire face (spanning the game board)
  const createFaceGridLines = (
    axis: "x" | "y" | "z",
    position: number,
    opacity: number,
    isOutOfBounds: boolean
  ) => {
    const lines: React.ReactElement[] = [];
    const gameBoardMin = -0.5;
    const gameBoardMax = COORDINATE_SYSTEM.GRID_SIZE - 0.5;

    const lineColor = isOutOfBounds ? GRID_COLORS.INVALID : GRID_COLORS.VALID;

    // Draw lines across the entire game board at this block face
    for (let i = 0; i <= COORDINATE_SYSTEM.GRID_SIZE; i++) {
      const offset = i - 0.5;

      if (axis === "x") {
        // Horizontal lines (parallel to Z)
        lines.push(
          <line key={`${axis}-${position}-h-${i}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[
                  new Float32Array([
                    position,
                    offset,
                    gameBoardMin,
                    position,
                    offset,
                    gameBoardMax,
                  ]),
                  3,
                ]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color={lineColor}
              opacity={opacity}
              transparent
              linewidth={GRID_LINE_WIDTH}
              depthTest={false}
              toneMapped={false}
            />
          </line>
        );
        // Vertical lines (parallel to Y)
        lines.push(
          <line key={`${axis}-${position}-v-${i}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[
                  new Float32Array([
                    position,
                    gameBoardMin,
                    offset,
                    position,
                    gameBoardMax,
                    offset,
                  ]),
                  3,
                ]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color={lineColor}
              opacity={opacity}
              transparent
              linewidth={GRID_LINE_WIDTH}
              depthTest={false}
              toneMapped={false}
            />
          </line>
        );
      } else if (axis === "y") {
        // Horizontal lines (parallel to Z)
        lines.push(
          <line key={`${axis}-${position}-h-${i}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[
                  new Float32Array([
                    offset,
                    position,
                    gameBoardMin,
                    offset,
                    position,
                    gameBoardMax,
                  ]),
                  3,
                ]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color={lineColor}
              opacity={opacity}
              transparent
              linewidth={GRID_LINE_WIDTH}
              depthTest={false}
              toneMapped={false}
            />
          </line>
        );
        // Vertical lines (parallel to X)
        lines.push(
          <line key={`${axis}-${position}-v-${i}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[
                  new Float32Array([
                    gameBoardMin,
                    position,
                    offset,
                    gameBoardMax,
                    position,
                    offset,
                  ]),
                  3,
                ]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color={lineColor}
              opacity={opacity}
              transparent
              linewidth={GRID_LINE_WIDTH}
              depthTest={false}
              toneMapped={false}
            />
          </line>
        );
      } else {
        // Z axis
        // Horizontal lines (parallel to Y)
        lines.push(
          <line key={`${axis}-${position}-h-${i}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[
                  new Float32Array([
                    offset,
                    gameBoardMin,
                    position,
                    offset,
                    gameBoardMax,
                    position,
                  ]),
                  3,
                ]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color={lineColor}
              opacity={opacity}
              transparent
              linewidth={GRID_LINE_WIDTH}
              depthTest={false}
              toneMapped={false}
            />
          </line>
        );
        // Vertical lines (parallel to X)
        lines.push(
          <line key={`${axis}-${position}-v-${i}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[
                  new Float32Array([
                    gameBoardMin,
                    offset,
                    position,
                    gameBoardMax,
                    offset,
                    position,
                  ]),
                  3,
                ]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color={lineColor}
              opacity={opacity}
              transparent
              linewidth={GRID_LINE_WIDTH}
              depthTest={false}
              toneMapped={false}
            />
          </line>
        );
      }
    }

    return lines;
  };

  const gameBoardSize = COORDINATE_SYSTEM.GRID_SIZE;
  const gameBoardCenter = COORDINATE_SYSTEM.GAME_BOARD_CENTER;

  // Helper function to create a face (gridlines + plane)
  const createFace = (
    axis: "x" | "y" | "z",
    position: number,
    faceKey: keyof typeof faceOpacities,
    rotation: [number, number, number]
  ) => {
    const opacity = faceOpacities[faceKey];
    const outOfBounds = isOutOfBounds[faceKey];
    const color = outOfBounds ? GRID_COLORS.INVALID : GRID_COLORS.VALID;

    // Calculate plane position based on axis
    const planePosition: [number, number, number] =
      axis === "x"
        ? [position, gameBoardCenter, gameBoardCenter]
        : axis === "y"
        ? [gameBoardCenter, position, gameBoardCenter]
        : [gameBoardCenter, gameBoardCenter, position];

    return (
      <group key={`face-${faceKey}`}>
        {createFaceGridLines(axis, position, opacity, outOfBounds)}
        <mesh position={planePosition} rotation={rotation}>
          <planeGeometry args={[gameBoardSize, gameBoardSize]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={opacity * GRID_OPACITY.PLANE_MULTIPLIER}
            side={THREE.DoubleSide}
            depthTest={false}
          />
        </mesh>
      </group>
    );
  };

  // Face configuration: [axis, position, faceKey, rotation]
  const faces: Array<
    [
      "x" | "y" | "z",
      number,
      keyof typeof faceOpacities,
      [number, number, number]
    ]
  > = [
    ["x", xMin, "xMin", [0, Math.PI / 2, 0]],
    ["x", xMax, "xMax", [0, Math.PI / 2, 0]],
    ["y", yMin, "yMin", [Math.PI / 2, 0, 0]],
    ["y", yMax, "yMax", [Math.PI / 2, 0, 0]],
    ["z", zMin, "zMin", [0, 0, 0]],
    ["z", zMax, "zMax", [0, 0, 0]],
  ];

  return (
    <group>
      {faces.map(([axis, pos, key, rot]) => createFace(axis, pos, key, rot))}
    </group>
  );
};
