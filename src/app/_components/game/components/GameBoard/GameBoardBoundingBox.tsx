import { useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { COORDINATE_SYSTEM } from "../../constants/coordinates";

export const GameBoardBoundingBox = () => {
  const { camera } = useThree();
  const [faceOpacities, setFaceOpacities] = useState({
    xMin: 0.8,
    xMax: 0.8,
    yMin: 0.8,
    yMax: 0.8,
    zMin: 0.8,
    zMax: 0.8,
  });

  const gridSize = COORDINATE_SYSTEM.GRID_SIZE;
  const gridMin = -0.5;
  const gridMax = gridSize - 0.5;
  const center = COORDINATE_SYSTEM.GAME_BOARD_CENTER;

  useFrame(() => {
    // Calculate camera direction from game board center
    const cameraDir = new THREE.Vector3()
      .subVectors(camera.position, new THREE.Vector3(center, center, center))
      .normalize();

    // Face normals
    const normals = {
      xMin: new THREE.Vector3(-1, 0, 0),
      xMax: new THREE.Vector3(1, 0, 0),
      yMin: new THREE.Vector3(0, -1, 0),
      yMax: new THREE.Vector3(0, 1, 0),
      zMin: new THREE.Vector3(0, 0, -1),
      zMax: new THREE.Vector3(0, 0, 1),
    };

    // Calculate opacity based on dot product (facing camera = positive)
    const newOpacities = {
      xMin: Math.max(0.15, normals.xMin.dot(cameraDir) * 0.8),
      xMax: Math.max(0.15, normals.xMax.dot(cameraDir) * 0.8),
      yMin: Math.max(0.15, normals.yMin.dot(cameraDir) * 0.8),
      yMax: Math.max(0.15, normals.yMax.dot(cameraDir) * 0.8),
      zMin: Math.max(0.15, normals.zMin.dot(cameraDir) * 0.8),
      zMax: Math.max(0.15, normals.zMax.dot(cameraDir) * 0.8),
    };

    setFaceOpacities(newOpacities);
  });

  // Create grid lines for a face
  const createGridLines = (
    axis: "x" | "y" | "z",
    position: number,
    orientation: "horizontal" | "vertical",
    opacity: number
  ) => {
    const lines: React.ReactElement[] = [];
    const lineCount = gridSize + 1; // 9 lines for 8 cells

    for (let i = 0; i < lineCount; i++) {
      const offset = i - 0.5;
      let point1: [number, number, number];
      let point2: [number, number, number];

      if (axis === "x") {
        // YZ plane
        if (orientation === "horizontal") {
          // Lines parallel to Z axis
          point1 = [position, offset, gridMin];
          point2 = [position, offset, gridMax];
        } else {
          // Lines parallel to Y axis
          point1 = [position, gridMin, offset];
          point2 = [position, gridMax, offset];
        }
      } else if (axis === "y") {
        // XZ plane
        if (orientation === "horizontal") {
          // Lines parallel to Z axis
          point1 = [offset, position, gridMin];
          point2 = [offset, position, gridMax];
        } else {
          // Lines parallel to X axis
          point1 = [gridMin, position, offset];
          point2 = [gridMax, position, offset];
        }
      } else {
        // XY plane
        if (orientation === "horizontal") {
          // Lines parallel to Y axis
          point1 = [offset, gridMin, position];
          point2 = [offset, gridMax, position];
        } else {
          // Lines parallel to X axis
          point1 = [gridMin, offset, position];
          point2 = [gridMax, offset, position];
        }
      }

      lines.push(
        <line key={`${axis}-${position}-${orientation}-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  point1[0],
                  point1[1],
                  point1[2],
                  point2[0],
                  point2[1],
                  point2[2],
                ]),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color="#333333"
            opacity={opacity}
            transparent
            linewidth={2}
            depthTest={false}
            toneMapped={false}
          />
        </line>
      );
    }

    return lines;
  };

  return (
    <group>
      {/* X faces (left and right) - YZ plane */}
      {createGridLines("x", gridMin, "horizontal", faceOpacities.xMin)}
      {createGridLines("x", gridMin, "vertical", faceOpacities.xMin)}
      {createGridLines("x", gridMax, "horizontal", faceOpacities.xMax)}
      {createGridLines("x", gridMax, "vertical", faceOpacities.xMax)}

      {/* Y faces (bottom and top) - XZ plane */}
      {createGridLines("y", gridMin, "horizontal", faceOpacities.yMin)}
      {createGridLines("y", gridMin, "vertical", faceOpacities.yMin)}
      {createGridLines("y", gridMax, "horizontal", faceOpacities.yMax)}
      {createGridLines("y", gridMax, "vertical", faceOpacities.yMax)}

      {/* Z faces (front and back) - XY plane */}
      {createGridLines("z", gridMin, "horizontal", faceOpacities.zMin)}
      {createGridLines("z", gridMin, "vertical", faceOpacities.zMin)}
      {createGridLines("z", gridMax, "horizontal", faceOpacities.zMax)}
      {createGridLines("z", gridMax, "vertical", faceOpacities.zMax)}
    </group>
  );
};
