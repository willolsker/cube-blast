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
  DragControls,
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
  cursorY: number,
  cursorZ: number,
  selectedBlock: number
) => {
  const newBoard = gameState.board.map((layer, z) =>
    layer.map((row, y) => row.map((cell, x) => cell))
  );

  const block = gameState.nextBlocks[selectedBlock];
  if (!block) return gameState;

  // Check if block can be placed at the specified position
  const blockDimensions = calculateBlockDimensions(block);
  let canPlace = true;

  // Check for collisions at the specified position
  for (let blockZ = 0; blockZ < blockDimensions.zDepth; blockZ++) {
    for (let blockY = 0; blockY < blockDimensions.yHeight; blockY++) {
      for (let blockX = 0; blockX < blockDimensions.xWidth; blockX++) {
        if (block[blockZ]?.[blockY]?.[blockX]) {
          const boardX = cursorX + blockX;
          const boardY = cursorY + blockY;
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

  // Place the block at the specified position if valid
  if (canPlace) {
    for (let blockZ = 0; blockZ < blockDimensions.zDepth; blockZ++) {
      for (let blockY = 0; blockY < blockDimensions.yHeight; blockY++) {
        for (let blockX = 0; blockX < blockDimensions.xWidth; blockX++) {
          if (block[blockZ]?.[blockY]?.[blockX]) {
            const boardX = cursorX + blockX;
            const boardY = cursorY + blockY;
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
  const [cursorY, setCursorY] = useState(0);
  const [cursorZ, setCursorZ] = useState(0);
  const [activeBlock, setActiveBlock] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<{
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const [interactionMode, setInteractionMode] = useState<"orbit" | "drag">(
    "orbit"
  );

  // Handle block pickup
  const handleBlockPickup = (blockIndex: number) => {
    setActiveBlock(blockIndex);
    setInteractionMode("drag");
  };

  // Handle right-click to switch interaction mode
  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setInteractionMode((prev) => (prev === "orbit" ? "drag" : "orbit"));
  };

  // Handle block drag
  const handleBlockDrag = (x: number, y: number, z: number) => {
    console.log("Block dragged to:", { x, y, z }); // Debug log
    setDragPosition({ x, y, z });
  };

  // Handle block drop - just update cursor position
  const handleBlockDrop = () => {
    if (dragPosition) {
      // Update cursor position to where the block was dragged
      setCursorX(dragPosition.x);
      setCursorY(dragPosition.y);
      setCursorZ(dragPosition.z);
      console.log("Updated cursor to:", dragPosition); // Debug log

      // Clear drag position after using it
      setDragPosition(null);
    } else {
      console.log("No dragPosition available"); // Debug log
    }

    // Don't switch to orbit mode - stay in drag mode
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block cycling with Tab instead of Space
      if (e.key === "Tab") {
        e.preventDefault(); // Prevent tab from moving focus
        setActiveBlock((value) =>
          value === null ? 0 : (value + 1) % gameState.nextBlocks.length
        );
      }
      // Y position controls
      if (e.key === " ") {
        e.preventDefault();
        setCursorY((value) => Math.min(7, value + 1));
      }
      if (e.key === "Shift") {
        e.preventDefault();
        setCursorY((value) => Math.max(0, value - 1));
      }
      // X position controls
      if (e.key === "ArrowRight") {
        setCursorX((value) => Math.min(7, value + 1));
      }
      if (e.key === "ArrowLeft") {
        setCursorX((value) => Math.max(0, value - 1));
      }
      // Z position controls
      if (e.key === "ArrowUp") {
        setCursorZ((value) => Math.min(7, value + 1));
      }
      if (e.key === "ArrowDown") {
        setCursorZ((value) => Math.max(0, value - 1));
      }
      // Alternative Y controls (keeping PageUp/PageDown)
      if (e.key === "PageUp") {
        setCursorY((value) => Math.min(7, value + 1));
      }
      if (e.key === "PageDown") {
        setCursorY((value) => Math.max(0, value - 1));
      }
      if (e.key === "Enter" && activeBlock !== null) {
        // Place the block using keyboard
        const newGameState = getNextGameState(
          gameState,
          cursorX,
          cursorY,
          cursorZ,
          activeBlock
        );
        setGameState(newGameState);
      }
      if (e.key === "Escape" && activeBlock !== null) {
        // Cancel drag
        setActiveBlock(null);
        setDragPosition(null);
        setInteractionMode("orbit");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, cursorX, cursorY, cursorZ, activeBlock]);

  return (
    <div className="w-full h-screen relative">
      {/* Mode indicator */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white px-3 py-2 rounded-lg font-mono text-sm">
        Mode: {interactionMode === "orbit" ? "Orbit" : "Drag"}
      </div>
      <Canvas
        camera={{ position: [5, 5, 5], fov: 60 }}
        onContextMenu={handleRightClick}
      >
        <ambientLight intensity={0.5 * Math.PI} />
        <GameBoard board={gameState.board} scale={0.5} />
        <BlocksRenderer
          orbitControlsRef={orbitControlsRef}
          blocks={gameState.nextBlocks}
          activeBlock={activeBlock}
          onBlockPickup={handleBlockPickup}
        />
        {activeBlock !== null && gameState.nextBlocks[activeBlock] && (
          <FloatingBlock
            block={gameState.nextBlocks[activeBlock]}
            onDrag={handleBlockDrag}
            onDrop={handleBlockDrop}
            gameState={gameState}
            dragPosition={dragPosition}
            interactionMode={interactionMode}
            cursorPosition={{ x: cursorX, y: cursorY, z: cursorZ }}
          />
        )}
        <OrbitControls
          ref={orbitControlsRef}
          enableZoom={false}
          enabled={interactionMode === "orbit"}
          target={[0, 0, 0]}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI - Math.PI / 6}
        />
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
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={scale}>
      {/* All cubes - transparent wireframes for empty spaces, solid for filled */}
      {board.map((layer, z) =>
        layer.map((row, y) =>
          row.map((cell, x) => (
            <Cube
              key={`${x}-${y}-${z}`}
              position={[x, y, z]}
              boundingBoxDimensions={[8, 8, 8]}
              active={cell}
              selected={false}
            />
          ))
        )
      )}
    </group>
  );
};

const FloatingBlock = ({
  block,
  onDrag,
  onDrop,
  gameState,
  dragPosition,
  interactionMode,
  cursorPosition,
}: {
  block: boolean[][][];
  onDrag: (x: number, y: number, z: number) => void;
  onDrop: () => void;
  gameState: GameState;
  dragPosition: { x: number; y: number; z: number } | null;
  interactionMode: "orbit" | "drag";
  cursorPosition: { x: number; y: number; z: number };
}) => {
  const { camera, raycaster, mouse } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const { xWidth, yHeight, zDepth } = calculateBlockDimensions(block);

  // Check if current position is valid
  const isValidPosition = (() => {
    // Use dragPosition if available, otherwise use cursorPosition
    const currentPosition = dragPosition || cursorPosition;
    const blockDimensions = calculateBlockDimensions(block);

    for (let blockZ = 0; blockZ < blockDimensions.zDepth; blockZ++) {
      for (let blockY = 0; blockY < blockDimensions.yHeight; blockY++) {
        for (let blockX = 0; blockX < blockDimensions.xWidth; blockX++) {
          if (block[blockZ]?.[blockY]?.[blockX]) {
            const boardX = currentPosition.x + blockX;
            const boardY = currentPosition.y + blockY;
            const boardZ = currentPosition.z + blockZ;

            if (
              boardX < 0 ||
              boardX >= 8 ||
              boardY < 0 ||
              boardY >= 8 ||
              boardZ < 0 ||
              boardZ >= 8
            ) {
              return false;
            }

            if (gameState.board[boardZ]?.[boardY]?.[boardX]) {
              return false;
            }
          }
        }
      }
    }
    return true;
  })();

  // Determine position based on drag state
  const currentPosition = dragPosition || cursorPosition;
  const worldPosition: [number, number, number] = [
    (currentPosition.x - 4) * 0.5,
    (currentPosition.y - 4) * 0.5,
    (currentPosition.z - 4) * 0.5,
  ];

  const blockContent = (
    <group ref={groupRef} position={worldPosition} scale={0.5}>
      <group position={[0, 0, 0]}>
        {block.map((layer, z) =>
          layer.map((row, y) =>
            row.map((cell, x) => (
              <mesh key={`${x}-${y}-${z}`} position={[x, y, z]}>
                <boxGeometry args={[0.9, 0.9, 0.9]} />
                <meshLambertMaterial
                  color={layerColors[y]}
                  transparent
                  opacity={cell ? 0.8 : 0}
                  emissive={isValidPosition ? "#00ff00" : "#ff0000"}
                  emissiveIntensity={0.5}
                />
                <Edges color={isValidPosition ? "#00ff00" : "#ff0000"} />
              </mesh>
            ))
          )
        )}
      </group>
    </group>
  );

  return interactionMode === "drag" ? (
    <DragControls
      onDrag={(e) => {
        console.log("DragControls onDrag event (Matrix4):", e);

        // Try using mouse position to calculate world position
        raycaster.setFromCamera(mouse, camera);

        // Create a plane at Y=0 to intersect with
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersection);

        console.log("Mouse position:", mouse);
        console.log("Raycaster intersection:", intersection);

        if (intersection) {
          const gridX = Math.round(intersection.x / 0.5 + 4);
          const gridY = cursorPosition.y; // Keep current Y position instead of using intersection
          const gridZ = Math.round(intersection.z / 0.5 + 4);
          const clampedX = Math.max(0, Math.min(7, gridX));
          const clampedY = Math.max(0, Math.min(7, gridY));
          const clampedZ = Math.max(0, Math.min(7, gridZ));
          console.log(
            "Mouse-based drag - intersection:",
            intersection,
            "grid:",
            { gridX, gridY, gridZ },
            "clamped:",
            { clampedX, clampedY, clampedZ }
          );
          onDrag(clampedX, clampedY, clampedZ);
        }
      }}
      onDragEnd={() => {
        console.log("DragControls onDragEnd called");
        onDrop();
      }}
      autoTransform={false}
    >
      {blockContent}
    </DragControls>
  ) : (
    blockContent
  );
};

const Cube = ({
  position,
  boundingBoxDimensions = [0, 0, 0],
  active,
  selected,
}: {
  position: [number, number, number];
  boundingBoxDimensions: [number, number, number];
  active: boolean;
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

const PickupableBlock = forwardRef(
  (
    {
      block,
      position,
      scale = 1,
      selected,
      onPickup,
    }: {
      block: boolean[][][];
      position: [number, number, number];
      scale?: number;
      selected: boolean;
      onPickup: () => void;
    },
    fref
  ) => {
    const { xWidth, yHeight, zDepth } = calculateBlockDimensions(block);

    const ref = useRef(null);
    useImperativeHandle(fref, () => ref.current, []);

    const handleClick = (e: any) => {
      e.stopPropagation();
      // Always pick up the block when clicked
      onPickup();
    };

    return (
      <group
        position={[position[0], position[1], position[2]]}
        scale={scale}
        ref={ref}
        onClick={handleClick}
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
  activeBlock,
  onBlockPickup,
}: {
  orbitControlsRef: React.RefObject<any>;
  renderPriority?: number;
  matrix?: THREE.Matrix4;
  blocks: boolean[][][][];
  activeBlock: number | null;
  onBlockPickup: (index: number) => void;
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
        <PickupableBlock
          key={index}
          ref={(r: THREE.Group) => void (blockGroups.current[index] = r)}
          block={block}
          position={[-6, 2 - index * 2, -2]}
          scale={0.5}
          selected={activeBlock === index}
          onPickup={() => onBlockPickup(index)}
        />
      ))}
      <ambientLight intensity={1} />
      <pointLight position={[200, 200, 100]} intensity={0.5} />
    </Hud>
  );
}
