import { useRef } from "react";
import * as THREE from "three";
import { GameBoardBoundingBox } from "./GameBoardBoundingBox";
import { Cube } from "./Cube";
import { COORDINATE_SYSTEM } from "../../constants/coordinates";

export const GameBoard = ({ board }: { board: boolean[][][] }) => {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Bounding box with grid patterns */}
      <GameBoardBoundingBox />

      {/* All cubes - transparent wireframes for empty spaces, solid for filled */}
      {board.map((layer, z) =>
        layer.map((row, y) =>
          row.map((cell, x) => (
            <Cube
              key={`${x}-${y}-${z}`}
              position={[x, y, z]}
              boundingBoxDimensions={[
                COORDINATE_SYSTEM.GRID_SIZE,
                COORDINATE_SYSTEM.GRID_SIZE,
                COORDINATE_SYSTEM.GRID_SIZE,
              ]}
              active={cell}
              selected={false}
            />
          ))
        )
      )}
    </group>
  );
};
