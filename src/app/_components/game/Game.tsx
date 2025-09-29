"use client";

import * as THREE from "three";
import {
  useRef,
  useState,
  useContext,
  createContext,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useEffect,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Hud,
  OrbitControls,
  RenderTexture,
  OrthographicCamera,
  PerspectiveCamera,
  Text,
  Environment,
  Edges,
} from "@react-three/drei";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { suspend } from "suspend-react";
import { getRandomBlock, layerColors } from "./blocks";

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

const getNextGameState = (
  gameState: GameState,
  cursorX: number,
  cursorZ: number,
  selectedBlock: number
) => {
  const newBoard = gameState.board.map((layer, z) =>
    layer.map((row, y) => row.map((cell, x) => cell))
  );

  const block = gameState.nextBlocks[selectedBlock];
  if (!block) return gameState;

  // Find the lowest valid Y position for the block
  const blockDimensions = calculateBlockDimensions(block);
  let dropY = 0;
  let canPlace = true;

  // Check if block can be placed at cursor position
  for (let y = 0; y < 8 - blockDimensions.yHeight + 1; y++) {
    let collision = false;

    // Check for collisions at this Y level
    for (let blockZ = 0; blockZ < blockDimensions.zDepth; blockZ++) {
      for (let blockY = 0; blockY < blockDimensions.yHeight; blockY++) {
        for (let blockX = 0; blockX < blockDimensions.xWidth; blockX++) {
          if (block[blockZ]?.[blockY]?.[blockX]) {
            const boardX = cursorX + blockX;
            const boardY = y + blockY;
            const boardZ = cursorZ + blockZ;

            // Check bounds
            if (
              boardX < 0 ||
              boardX >= 8 ||
              boardY < 0 ||
              boardY >= 8 ||
              boardZ < 0 ||
              boardZ >= 8
            ) {
              collision = true;
              break;
            }

            // Check if position is already occupied
            if (
              newBoard[boardZ] &&
              newBoard[boardZ][boardY] &&
              newBoard[boardZ][boardY][boardX]
            ) {
              collision = true;
              break;
            }
          }
        }
        if (collision) break;
      }
      if (collision) break;
    }

    if (collision) {
      dropY = Math.max(0, y - 1);
      break;
    }

    dropY = y;
  }

  // Place the block at the calculated position
  for (let blockZ = 0; blockZ < blockDimensions.zDepth; blockZ++) {
    for (let blockY = 0; blockY < blockDimensions.yHeight; blockY++) {
      for (let blockX = 0; blockX < blockDimensions.xWidth; blockX++) {
        if (block[blockZ]?.[blockY]?.[blockX]) {
          const boardX = cursorX + blockX;
          const boardY = dropY + blockY;
          const boardZ = cursorZ + blockZ;

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
  const newNextBlocks = [...gameState.nextBlocks];
  newNextBlocks[selectedBlock] = getRandomBlock();

  return {
    board: newBoard,
    nextBlocks: newNextBlocks,
  };
};

export function Game() {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const orbitControlsRef = useRef<any>(null);

  const [cursorX, setCursorX] = useState(0);
  const [cursorZ, setCursorZ] = useState(0);
  const [selectedBlock, setSelectedBlock] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setCursorX((value) => Math.min(7, value + 1));
      }
      if (e.key === "ArrowLeft") {
        setCursorX((value) => Math.max(0, value - 1));
      }
      if (e.key === "ArrowUp") {
        setCursorZ((value) => Math.min(7, value + 1));
      }
      if (e.key === "ArrowDown") {
        setCursorZ((value) => Math.max(0, value - 1));
      }
      if (e.key === " ") {
        setSelectedBlock((value) => (value + 1) % gameState.nextBlocks.length);
      }
      if (e.key === "Enter") {
        // Place the block
        const newGameState = getNextGameState(
          gameState,
          cursorX,
          cursorZ,
          selectedBlock
        );
        setGameState(newGameState);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, cursorX, cursorZ, selectedBlock]);

  return (
    <div className="w-full h-screen">
      <Canvas>
        <ambientLight intensity={0.5 * Math.PI} />
        <GameBoard
          board={
            getNextGameState(gameState, cursorX, cursorZ, selectedBlock).board
          }
          scale={0.5}
        />
        <BlocksRenderer
          orbitControlsRef={orbitControlsRef}
          blocks={gameState.nextBlocks}
          selectedBlock={selectedBlock}
        />
        <OrbitControls ref={orbitControlsRef} enableZoom={false} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}

const GameBoard = ({
  board,
  scale,
}: {
  board: boolean[][][];
  scale: number;
}) => {
  return (
    <group position={[0, 0, 0]} scale={scale}>
      {/* All cubes - transparent wireframes for empty spaces, solid for filled */}
      {board.map((layer, z) =>
        layer.map((row, y) =>
          row.map((cell, x) => (
            <Cube
              key={`${x}-${y}-${z}`}
              position={[x, 7 - y, z]}
              boundingBoxDimensions={[8, 8, 8]}
              active={cell}
              isBottomLayer={y === 0}
              selected={false}
            />
          ))
        )
      )}
    </group>
  );
};

const Cube = ({
  position,
  boundingBoxDimensions = [0, 0, 0],
  active,
  isBottomLayer,
  selected,
}: {
  position: [number, number, number];
  boundingBoxDimensions: [number, number, number];
  active: boolean;
  isBottomLayer: boolean;
  selected: boolean;
}) => {
  // Solid cube for active positions
  return (
    <>
      <mesh
        position={[
          position[0] - boundingBoxDimensions[0] / 2,
          position[1] - boundingBoxDimensions[1] / 2,
          position[2] - boundingBoxDimensions[2] / 2,
        ]}
      >
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshLambertMaterial
          color={layerColors[position[1]]}
          transparent
          opacity={active ? 1 : 0.05}
          emissive={selected ? layerColors[position[1]] : "#000000"}
          emissiveIntensity={selected ? 1 : 0}
        />
      </mesh>
    </>
  );
};

const calculateBlockDimensions = (block: boolean[][][]) => {
  const zDepth = block.length;
  const yHeight = block[0]?.length ?? 0;
  const xWidth = block[0]?.[0]?.length ?? 0;
  return { xWidth, yHeight, zDepth };
};

const BlockRenderer = forwardRef(
  (
    {
      block,
      position,
      scale = 1,
      selected,
    }: {
      block: boolean[][][];
      position: [number, number, number];
      scale?: number;
      selected: boolean;
    },
    fref
  ) => {
    const { xWidth, yHeight, zDepth } = calculateBlockDimensions(block);

    const ref = useRef(null);
    useImperativeHandle(fref, () => ref.current, []);
    return (
      <group
        position={[position[0], position[1], position[2]]}
        scale={scale}
        ref={ref}
      >
        <group position={[0, 0, 0]}>
          {block.map((layer, z) =>
            layer.map((row, y) =>
              row.map((cell, x) => (
                <Cube
                  key={`${x}-${y}-${z}`}
                  position={[x, y, z]}
                  boundingBoxDimensions={[xWidth, yHeight, zDepth]}
                  active={cell}
                  isBottomLayer={y === 0}
                  selected={selected}
                />
              ))
            )
          )}
        </group>
      </group>
    );
  }
);

function BlocksRenderer({
  orbitControlsRef,
  renderPriority = 1,
  matrix = new THREE.Matrix4(),
  blocks,
  selectedBlock,
}: {
  orbitControlsRef: React.RefObject<any>;
  renderPriority?: number;
  matrix?: THREE.Matrix4;
  blocks: boolean[][][][];
  selectedBlock: number;
}) {
  const blockGroups = useRef<THREE.Group[]>([]);
  const { viewport } = useThree();

  useFrame(() => {
    // Get the main camera from OrbitControls
    const mainCamera = orbitControlsRef.current?.object;
    const controls = orbitControlsRef.current;

    if (mainCamera && controls) {
      // Spin blockGroup to the inverse of the main camera's matrix
      matrix.copy(mainCamera.matrix).invert();
      blockGroups.current.forEach((group) => {
        group.quaternion.setFromRotationMatrix(matrix);
      });
    }
  });

  return (
    <Hud renderPriority={renderPriority}>
      <ambientLight intensity={Math.PI / 2} />
      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        decay={0}
        intensity={Math.PI}
      />
      <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
      <PerspectiveCamera makeDefault position={[0, 0, 10]} />
      {blocks.map((block, index) => (
        <BlockRenderer
          key={index}
          ref={(r: THREE.Group) => void (blockGroups.current[index] = r)}
          block={block}
          position={[
            -(viewport.width / 2 - 1),
            viewport.height / 2.5 - (viewport.height / 2.5 - 1) * index,
            0,
          ]}
          scale={0.5}
          selected={selectedBlock === index}
        />
      ))}
      <ambientLight intensity={1} />
      <pointLight position={[200, 200, 100]} intensity={0.5} />
    </Hud>
  );
}
