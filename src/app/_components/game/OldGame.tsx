"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Edges,
  Hud,
  PerspectiveCamera,
} from "@react-three/drei";
import { getRandomBlock } from "./blocks";
import * as THREE from "three";

interface GameState {
  board: boolean[][][];
  nextBlocks: boolean[][][][];
}

const initialGameState: GameState = {
  board: Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => false))
  ),
  nextBlocks: Array.from({ length: 4 }, () => getRandomBlock()),
};

// 3D Cube component for individual cubes
const Cube = ({
  position,
  active,
  isBottomLayer,
}: {
  position: [number, number, number];
  active: boolean;
  isBottomLayer: boolean;
}) => {
  if (active) {
    // Solid cube for active positions
    return (
      <>
        <mesh position={position}>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <meshStandardMaterial color="#3b82f6" transparent opacity={1} />
        </mesh>
        <mesh position={position}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial transparent opacity={0} />
          <Edges color={isBottomLayer ? "#ff0000" : "#e2e8f0"} />
        </mesh>
      </>
    );
  } else {
    // Wireframe cube for inactive positions - only outer edges
    return (
      <mesh position={position}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={0} />
        <Edges color={isBottomLayer ? "#ff0000" : "#e2e8f0"} />
      </mesh>
    );
  }
};

// Component to render a 3D block
const BlockRenderer = ({
  block,
  position,
  scale = 1,
}: {
  block: boolean[][][];
  position: [number, number, number];
  scale?: number;
}) => {
  return (
    <group position={position} scale={scale}>
      {block.map((layer, z) =>
        layer.map((row, y) =>
          row.map((cell, x) => (
            <Cube
              key={`${x}-${y}-${z}`}
              position={[x, y, z]}
              active={cell}
              isBottomLayer={z === 0}
            />
          ))
        )
      )}
    </group>
  );
};

// Main game board renderer
const GameBoard = ({ board }: { board: boolean[][][] }) => {
  return (
    <group>
      {/* All cubes - transparent wireframes for empty spaces, solid for filled */}
      {board.map((layer, z) =>
        layer.map((row, y) =>
          row.map((cell, x) => (
            <Cube
              key={`${x}-${y}-${z}`}
              position={[x, y, z]}
              active={cell}
              isBottomLayer={z === 0}
            />
          ))
        )
      )}
    </group>
  );
};

// Calculate the center of a block based on its dimensions
const calculateBlockCenter = (
  block: boolean[][][]
): [number, number, number] => {
  const height = block.length;
  const width = block[0]?.length ?? 0;
  const depth = block[0]?.[0]?.length ?? 0;

  // Return the center of the block dimensions
  return [-width / 2, -height / 2, -depth / 2];
};

// Next blocks HUD component that mirrors camera rotation
function NextBlocksHUD({
  blocks,
  mainCamera,
  matrix = new THREE.Matrix4(),
}: {
  blocks: boolean[][][][];
  mainCamera: THREE.Camera;
  matrix?: THREE.Matrix4;
}) {
  const { viewport } = useThree();

  return (
    <Hud renderPriority={1}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <PerspectiveCamera makeDefault position={[0, 0, 10]} />

      {blocks.map((block, index) => {
        const yPosition = (index - (blocks.length - 1) / 2) * 3;
        const xPosition = -viewport.width / 2 + 2;

        return (
          <NextBlock
            key={index}
            block={block}
            position={[xPosition, yPosition, 0]}
            camera={mainCamera}
            matrix={matrix}
          />
        );
      })}
    </Hud>
  );
}

// Individual next block that rotates with main camera
function NextBlock({
  block,
  position,
  camera,
  matrix,
}: {
  block: boolean[][][];
  position: [number, number, number];
  camera: THREE.Camera;
  matrix: THREE.Matrix4;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const centerOffset = calculateBlockCenter(block);

  /*
  useFrame(() => {
    if (meshRef.current) {
      // Spin mesh to the inverse of the default cameras matrix
      matrix.copy(camera.matrix).invert();
      meshRef.current.quaternion.setFromRotationMatrix(matrix);
    }
  });
  */

  return (
    <group position={position}>
      <group ref={meshRef}>
        <BlockRenderer block={block} position={centerOffset} scale={0.8} />
      </group>
    </group>
  );
}

// Scene wrapper that captures main camera
function GameScene({ gameState }: { gameState: GameState }) {
  const { camera } = useThree();

  return (
    <>
      {/* Game Board - Center with orbit controls */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        target={[3.5, 3.5, 3.5]}
      />
      <GameBoard board={gameState.board} />

      {/* Next Blocks - HUD (stays in screen space, left side) */}
      <NextBlocksHUD blocks={gameState.nextBlocks} mainCamera={camera} />
    </>
  );
}

export const Game = () => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);

  return (
    <div className="w-full h-screen">
      <Canvas camera={{ position: [10, 10, 10], fov: 60 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <GameScene gameState={gameState} />
      </Canvas>
    </div>
  );
};
