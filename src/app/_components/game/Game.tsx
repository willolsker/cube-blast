"use client";

import * as THREE from "three";

// Coordinate System Constants
const COORDINATE_SYSTEM = {
  GRID_SIZE: 8,
  GRID_MIN: 0,
  GRID_MAX: 7,
  CUBE_SIZE: 0.9,
  GAME_BOARD_CENTER: 3.5, // (GRID_SIZE - 1) / 2
} as const;

// Coordinate Helper Functions
const gridToWorld = (gridPos: number) => gridPos;
const worldToGrid = (worldPos: number) => worldPos;
const clampGrid = (pos: number) =>
  Math.max(
    COORDINATE_SYSTEM.GRID_MIN,
    Math.min(COORDINATE_SYSTEM.GRID_MAX, Math.round(pos))
  );
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

// Shared helper functions for drag calculations
const calculateDragProjections = (camera: THREE.Camera) => {
  // Get camera's right and up vectors to determine screen edge directions
  const cameraRight = new THREE.Vector3();
  const cameraUp = new THREE.Vector3();
  camera.matrixWorld.extractBasis(cameraRight, cameraUp, new THREE.Vector3());

  // Calculate which world axes are most aligned with screen edges
  const rightAxis = cameraRight.clone().normalize();
  const upAxis = cameraUp.clone().normalize();

  // Project screen directions onto world axes
  // Screen X (right) projects onto world axes
  const screenXToWorldX = rightAxis.x;
  const screenXToWorldY = rightAxis.y;
  const screenXToWorldZ = rightAxis.z;

  // Screen Y (up) projects onto world axes
  const screenYToWorldX = upAxis.x;
  const screenYToWorldY = upAxis.y;
  const screenYToWorldZ = upAxis.z;

  return {
    screenXToWorldX,
    screenXToWorldY,
    screenXToWorldZ,
    screenYToWorldX,
    screenYToWorldY,
    screenYToWorldZ,
    rightAxis,
    upAxis,
  };
};

const calculateMouseSensitivity = (
  camera: THREE.Camera,
  gameBoardCenter: THREE.Vector3
) => {
  // Calculate distance from camera to the game board center
  const distanceToCamera = camera.position.distanceTo(gameBoardCenter);

  // Calculate the size of one pixel in world space at the object's distance
  const fovRadians = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
  const screenHeight = 2 * Math.tan(fovRadians / 2) * distanceToCamera;
  const pixelSize = screenHeight / window.innerHeight;

  // Calculate ideal sensitivity for 1:1 grid movement
  // We want 1 grid unit = 1 mouse unit, so we need to find the right multiplier
  // Grid units are 0.5 world units apart (based on the game board scale)
  const gridUnitSize = 0.5; // One grid unit in world space
  const idealSensitivity = gridUnitSize / pixelSize; // How many pixels = 1 grid unit

  // Use the ideal sensitivity, but cap it to reasonable bounds
  const mouseSensitivity = Math.max(1, Math.min(1000, idealSensitivity));

  return {
    distanceToCamera,
    screenHeight,
    pixelSize,
    mouseSensitivity,
  };
};

const calculateAxisBiasing = (
  mouseX: number,
  mouseY: number,
  mouseSensitivity: number,
  screenProjections: ReturnType<typeof calculateDragProjections>
) => {
  // Calculate raw mouse movement contributions to each axis
  const rawX =
    mouseX * mouseSensitivity * screenProjections.screenXToWorldX +
    mouseY * mouseSensitivity * screenProjections.screenYToWorldX;
  const rawY =
    mouseX * mouseSensitivity * screenProjections.screenXToWorldY +
    mouseY * mouseSensitivity * screenProjections.screenYToWorldY;
  const rawZ =
    mouseX * mouseSensitivity * screenProjections.screenXToWorldZ +
    mouseY * mouseSensitivity * screenProjections.screenYToWorldZ;

  // Calculate the magnitude of movement in each axis
  const axisMagnitudes = [Math.abs(rawX), Math.abs(rawY), Math.abs(rawZ)];
  const maxMagnitude = Math.max(...axisMagnitudes);

  // Exponential biasing: the stronger axis gets exponentially more influence
  const biasStrength = 3.0; // Higher values = stronger biasing

  // Avoid division by zero
  const biasedX =
    maxMagnitude > 0
      ? rawX * Math.pow((axisMagnitudes[0] || 0) / maxMagnitude, biasStrength)
      : rawX;
  const biasedY =
    maxMagnitude > 0
      ? rawY * Math.pow((axisMagnitudes[1] || 0) / maxMagnitude, biasStrength)
      : rawY;
  const biasedZ =
    maxMagnitude > 0
      ? rawZ * Math.pow((axisMagnitudes[2] || 0) / maxMagnitude, biasStrength)
      : rawZ;

  return {
    rawMovement: { x: rawX, y: rawY, z: rawZ },
    axisMagnitudes,
    maxMagnitude,
    biasStrength,
    biasedMovement: { x: biasedX, y: biasedY, z: biasedZ },
  };
};

// Shared function to calculate debug axes data using the same logic as drag
const calculateDebugAxesData = (
  camera: THREE.Camera,
  mousePosition?: { x: number; y: number }
) => {
  const gameBoardCenter = new THREE.Vector3(0, 0, 0);

  // Use current mouse position if available, otherwise use (0,0)
  const mouseX = mousePosition?.x || 0;
  const mouseY = mousePosition?.y || 0;

  // Calculate using the same shared functions
  const screenProjections = calculateDragProjections(camera);
  const sensitivityData = calculateMouseSensitivity(camera, gameBoardCenter);
  const axisBiasing = calculateAxisBiasing(
    mouseX,
    mouseY,
    sensitivityData.mouseSensitivity,
    screenProjections
  );

  return {
    gameBoardCenter,
    screenProjections,
    sensitivityData,
    axisBiasing,
  };
};

const getNextGameState = (
  gameState: GameState,
  blockGridX: number,
  blockGridY: number,
  blockGridZ: number,
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

  // Place the block at the specified position if valid
  if (canPlace) {
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

  const [blockGridX, setBlockGridX] = useState(0);
  const [blockGridY, setBlockGridY] = useState(0);
  const [blockGridZ, setBlockGridZ] = useState(0);
  const [activeBlock, setActiveBlock] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<{
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const [interactionMode, setInteractionMode] = useState<"orbit" | "drag">(
    "orbit"
  );
  const [debugMode, setDebugMode] = useState<"off" | "gameboard" | "cursor">(
    "off"
  );
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

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
      setBlockGridX(dragPosition.x);
      setBlockGridY(dragPosition.y);
      setBlockGridZ(dragPosition.z);
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
      // Debug mode cycling with D key
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        setDebugMode((current) => {
          if (current === "off") return "gameboard";
          if (current === "gameboard") return "cursor";
          return "off";
        });
      }

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
        setBlockGridY((value) => Math.min(7, value + 1));
      }
      if (e.key === "Shift") {
        e.preventDefault();
        setBlockGridY((value) => Math.max(0, value - 1));
      }
      // X position controls
      if (e.key === "ArrowRight") {
        setBlockGridX((value) => Math.min(7, value + 1));
      }
      if (e.key === "ArrowLeft") {
        setBlockGridX((value) => Math.max(0, value - 1));
      }
      // Z position controls
      if (e.key === "ArrowUp") {
        setBlockGridZ((value) => Math.min(7, value + 1));
      }
      if (e.key === "ArrowDown") {
        setBlockGridZ((value) => Math.max(0, value - 1));
      }
      // Alternative Y controls (keeping PageUp/PageDown)
      if (e.key === "PageUp") {
        setBlockGridY((value) => Math.min(7, value + 1));
      }
      if (e.key === "PageDown") {
        setBlockGridY((value) => Math.max(0, value - 1));
      }
      if (e.key === "Enter" && activeBlock !== null) {
        // Place the block using keyboard
        const newGameState = getNextGameState(
          gameState,
          blockGridX,
          blockGridY,
          blockGridZ,
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
  }, [gameState, blockGridX, blockGridY, blockGridZ, activeBlock]);

  // Real-time mouse position tracking
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      // Convert screen coordinates to normalized device coordinates
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = -(event.clientY / window.innerHeight) * 2 + 1;
      setMousePosition({ x, y });
    };

    // Add mouse move listener
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div className="w-full h-screen relative">
      {/* Mode indicator */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white px-3 py-2 rounded-lg font-mono text-sm">
        Mode: {interactionMode === "orbit" ? "Orbit" : "Drag"}
        <br />
        Debug:{" "}
        {debugMode === "off"
          ? "Off"
          : debugMode === "gameboard"
          ? "Game Board"
          : "Cursor"}
        <br />
        <span className="text-xs text-gray-300">
          Press D to cycle debug modes
        </span>
      </div>
      <Canvas
        camera={{ position: [12, 12, 12], fov: 70 }}
        onContextMenu={handleRightClick}
      >
        <ambientLight intensity={0.5 * Math.PI} />
        <GameBoard board={gameState.board} />
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
            cursorPosition={{ x: blockGridX, y: blockGridY, z: blockGridZ }}
            debugMode={debugMode}
            mousePosition={mousePosition}
            setMousePosition={setMousePosition}
          />
        )}
        {/* Debug axes - rendered at world level, not inside floating block */}
        {activeBlock !== null &&
          interactionMode === "drag" &&
          debugMode !== "off" && (
            <DebugAxes
              debugMode={debugMode}
              cursorPosition={{ x: blockGridX, y: blockGridY, z: blockGridZ }}
              mousePosition={mousePosition}
              isDragging={true}
            />
          )}
        <OrbitControls
          ref={orbitControlsRef}
          enableZoom={false}
          enabled={interactionMode === "orbit"}
          target={[
            COORDINATE_SYSTEM.GAME_BOARD_CENTER,
            COORDINATE_SYSTEM.GAME_BOARD_CENTER,
            COORDINATE_SYSTEM.GAME_BOARD_CENTER,
          ]}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI - Math.PI / 6}
        />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}

const GameBoard = ({ board }: { board: boolean[][][] }) => {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
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

const DebugAxes = ({
  debugMode,
  cursorPosition,
  mousePosition,
  isDragging = false,
}: {
  debugMode: string;
  cursorPosition: { x: number; y: number; z: number };
  mousePosition?: { x: number; y: number };
  isDragging?: boolean;
}) => {
  const { camera, mouse } = useThree();

  if (debugMode === "off") return null;

  // Use current mouse position from useThree() when dragging, otherwise use prop
  const currentMousePosition = isDragging
    ? { x: mouse.x, y: mouse.y }
    : mousePosition;

  // Use shared function to calculate debug data with perfect parity
  const debugData = calculateDebugAxesData(camera, currentMousePosition);
  const { screenProjections, axisBiasing } = debugData;

  if (debugMode === "gameboard") {
    // Game board centered axes (current behavior)
    return (
      <group position={[0, 0, 0]}>
        {/* Center point */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Screen X direction (red) - shows where mouse X movement goes */}
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  0,
                  0,
                  0,
                  screenProjections.screenXToWorldX * 10,
                  screenProjections.screenXToWorldY * 10,
                  screenProjections.screenXToWorldZ * 10,
                ]),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#ff0000" linewidth={3} />
        </line>

        {/* Screen Y direction (green) - shows where mouse Y movement goes */}
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  0,
                  0,
                  0,
                  screenProjections.screenYToWorldX * 10,
                  screenProjections.screenYToWorldY * 10,
                  screenProjections.screenYToWorldZ * 10,
                ]),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#00ff00" linewidth={3} />
        </line>

        {/* World axes for reference */}
        <mesh position={[2, 0, 0]}>
          <boxGeometry args={[0.05, 0.05, 0.5]} />
          <meshBasicMaterial color="#ffaaaa" />
        </mesh>
        <mesh position={[0, 2, 0]}>
          <boxGeometry args={[0.05, 0.05, 0.5]} />
          <meshBasicMaterial color="#aaffaa" />
        </mesh>
        <mesh position={[0, 0, 2]}>
          <boxGeometry args={[0.05, 0.05, 0.5]} />
          <meshBasicMaterial color="#aaaaff" />
        </mesh>
      </group>
    );
  }

  if (debugMode === "cursor") {
    // Cursor centered axes - show actual drag directions
    // Use mouse position if available, otherwise fall back to grid position
    let centerWorldPos: [number, number, number];

    // Use current mouse position (from useThree() when dragging, otherwise from props)
    const currentMousePosition = isDragging
      ? { x: mouse.x, y: mouse.y }
      : mousePosition;

    if (currentMousePosition) {
      // Mouse coordinates are in normalized device coordinates (-1 to 1)
      // setFromCamera expects NDC coordinates, so we can use them directly
      const raycaster = new THREE.Raycaster();
      const mouseVector = new THREE.Vector2(
        currentMousePosition.x,
        currentMousePosition.y
      );
      raycaster.setFromCamera(mouseVector, camera);

      // The game board is at Y=0 with scale 0.5, so the effective Y range is -1 to +1
      // But we want to project onto the actual game board surface
      // Since the game board is centered at [0,0,0] with scale 0.5, we can use Y=0
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersection = new THREE.Vector3();

      // Check if the ray intersects the plane
      if (raycaster.ray.intersectPlane(plane, intersection)) {
        // With no scaling, grid coordinates 0-7 map directly to world coordinates 0-7
        const gridX = worldToGrid(intersection.x);
        const gridY = worldToGrid(intersection.y);
        const gridZ = worldToGrid(intersection.z);

        // Clamp to valid grid range
        const clampedX = clampGrid(gridX);
        const clampedY = clampGrid(gridY);
        const clampedZ = clampGrid(gridZ);

        // Convert back to world coordinates for display
        centerWorldPos = [
          gridToWorld(clampedX),
          gridToWorld(clampedY),
          gridToWorld(clampedZ),
        ];
      } else {
        // Fallback: project to a plane at the camera's distance
        const distance = camera.position.length();
        const direction = raycaster.ray.direction
          .clone()
          .multiplyScalar(distance);
        const point = raycaster.ray.origin.clone().add(direction);
        centerWorldPos = [point.x, point.y, point.z];
      }
    } else {
      // Fallback to grid position
      centerWorldPos = [
        gridToWorld(cursorPosition.x),
        gridToWorld(cursorPosition.y),
        gridToWorld(cursorPosition.z),
      ];
    }

    return (
      <group position={centerWorldPos}>
        {/* Center point at cursor */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Show biased directions if available, otherwise fall back to screen projections */}
        {axisBiasing ? (
          <>
            {/* X direction (red) - shows biased X movement */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[
                    new Float32Array([
                      0,
                      0,
                      0,
                      (axisBiasing?.biasedMovement.x || 0) * 10,
                      0,
                      0,
                    ]),
                    3,
                  ]}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#ff0000" linewidth={3} />
            </line>

            {/* Y direction (green) - shows biased Y movement */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[
                    new Float32Array([
                      0,
                      0,
                      0,
                      0,
                      (axisBiasing?.biasedMovement.y || 0) * 10,
                      0,
                    ]),
                    3,
                  ]}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#00ff00" linewidth={3} />
            </line>

            {/* Z direction (blue) - shows biased Z movement */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[
                    new Float32Array([
                      0,
                      0,
                      0,
                      0,
                      0,
                      (axisBiasing?.biasedMovement.z || 0) * 10,
                    ]),
                    3,
                  ]}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#0000ff" linewidth={3} />
            </line>
          </>
        ) : (
          <>
            {/* Fallback to screen projections */}
            {/* X direction (red) - shows where to move mouse to change X */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[
                    new Float32Array([
                      0,
                      0,
                      0,
                      screenProjections.screenXToWorldX * 10,
                      screenProjections.screenXToWorldY * 10,
                      screenProjections.screenXToWorldZ * 10,
                    ]),
                    3,
                  ]}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#ff0000" linewidth={3} />
            </line>

            {/* Y direction (green) - shows where to move mouse to change Y */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[
                    new Float32Array([
                      0,
                      0,
                      0,
                      screenProjections.screenYToWorldX * 10,
                      screenProjections.screenYToWorldY * 10,
                      screenProjections.screenYToWorldZ * 10,
                    ]),
                    3,
                  ]}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#00ff00" linewidth={3} />
            </line>

            {/* Z direction (blue) - shows where to move mouse to change Z */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[
                    new Float32Array([
                      0,
                      0,
                      0,
                      (screenProjections.screenXToWorldY *
                        screenProjections.screenYToWorldZ -
                        screenProjections.screenXToWorldZ *
                          screenProjections.screenYToWorldY) *
                        10,
                      (screenProjections.screenXToWorldZ *
                        screenProjections.screenYToWorldX -
                        screenProjections.screenXToWorldX *
                          screenProjections.screenYToWorldZ) *
                        10,
                      (screenProjections.screenXToWorldX *
                        screenProjections.screenYToWorldY -
                        screenProjections.screenXToWorldY *
                          screenProjections.screenYToWorldX) *
                        10,
                    ]),
                    3,
                  ]}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#0000ff" linewidth={3} />
            </line>
          </>
        )}
      </group>
    );
  }

  return null;
};

const FloatingBlock = ({
  block,
  onDrag,
  onDrop,
  gameState,
  dragPosition,
  interactionMode,
  cursorPosition,
  debugMode,
  mousePosition,
  setMousePosition,
}: {
  block: boolean[][][];
  onDrag: (x: number, y: number, z: number) => void;
  onDrop: () => void;
  gameState: GameState;
  dragPosition: { x: number; y: number; z: number } | null;
  interactionMode: "orbit" | "drag";
  cursorPosition: { x: number; y: number; z: number };
  debugMode: "off" | "gameboard" | "cursor";
  mousePosition: { x: number; y: number };
  setMousePosition: (position: { x: number; y: number }) => void;
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
    gridToWorld(currentPosition.x),
    gridToWorld(currentPosition.y),
    gridToWorld(currentPosition.z),
  ];

  const blockContent = (
    <group ref={groupRef} position={worldPosition}>
      <group position={[0, 0, 0]}>
        {block.map((layer, z) =>
          layer.map((row, y) =>
            row.map((cell, x) => (
              <mesh key={`${x}-${y}-${z}`} position={[x, y, z]}>
                <boxGeometry
                  args={[
                    COORDINATE_SYSTEM.CUBE_SIZE,
                    COORDINATE_SYSTEM.CUBE_SIZE,
                    COORDINATE_SYSTEM.CUBE_SIZE,
                  ]}
                />
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
        console.log("Mouse position:", mouse);
        console.log("Current cursor position:", cursorPosition);
        console.log("Unified mouse position:", mousePosition);

        // Update mouse position during dragging to keep grey dot following cursor
        setMousePosition({ x: mouse.x, y: mouse.y });

        // Use shared helper functions for consistent calculations
        const gameBoardCenter = new THREE.Vector3(0, 0, 0);

        // Calculate screen projections
        const screenProjections = calculateDragProjections(camera);

        // Calculate mouse sensitivity
        const sensitivityData = calculateMouseSensitivity(
          camera,
          gameBoardCenter
        );

        // Calculate axis biasing using the current mouse position from DragControls
        const axisBiasing = calculateAxisBiasing(
          mouse.x,
          mouse.y,
          sensitivityData.mouseSensitivity,
          screenProjections
        );

        console.log("Drag calculation using shared helpers:", {
          gameBoardCenter,
          screenProjections,
          sensitivityData,
          axisBiasing,
        });

        // Debug: Store info for visual display
        (window as any).debugDragInfo = {
          center: gameBoardCenter,
          screenProjections: {
            screenXToWorldX: screenProjections.screenXToWorldX,
            screenXToWorldY: screenProjections.screenXToWorldY,
            screenXToWorldZ: screenProjections.screenXToWorldZ,
            screenYToWorldX: screenProjections.screenYToWorldX,
            screenYToWorldY: screenProjections.screenYToWorldY,
            screenYToWorldZ: screenProjections.screenYToWorldZ,
          },
          mouseSensitivity: sensitivityData.mouseSensitivity,
          axisBiasing,
        };

        // Apply biased movement to world coordinates
        const worldX = cursorPosition.x + axisBiasing.biasedMovement.x;
        const worldY = cursorPosition.y + axisBiasing.biasedMovement.y;
        const worldZ = cursorPosition.z + axisBiasing.biasedMovement.z;

        console.log("World coordinate calculation:", {
          cursorPosition,
          mouseMovement: { x: mouse.x, y: mouse.y },
          mouseSensitivity: sensitivityData.mouseSensitivity,
          screenProjections: {
            screenXToWorldX: screenProjections.screenXToWorldX,
            screenXToWorldY: screenProjections.screenXToWorldY,
            screenXToWorldZ: screenProjections.screenXToWorldZ,
            screenYToWorldX: screenProjections.screenYToWorldX,
            screenYToWorldY: screenProjections.screenYToWorldY,
            screenYToWorldZ: screenProjections.screenYToWorldZ,
          },
          calculatedWorld: { worldX, worldY, worldZ },
        });

        const gridX = worldToGrid(worldX);
        const gridY = worldToGrid(worldY);
        const gridZ = worldToGrid(worldZ);
        const clampedX = clampGrid(gridX);
        const clampedY = clampGrid(gridY);
        const clampedZ = clampGrid(gridZ);

        console.log(
          "Simplified drag:",
          { mouseX: mouse.x, mouseY: mouse.y },
          { worldX, worldY, worldZ },
          { gridX, gridY, gridZ },
          { clampedX, clampedY, clampedZ }
        );

        onDrag(clampedX, clampedY, clampedZ);
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
      <mesh position={position}>
        <boxGeometry
          args={[
            COORDINATE_SYSTEM.CUBE_SIZE,
            COORDINATE_SYSTEM.CUBE_SIZE,
            COORDINATE_SYSTEM.CUBE_SIZE,
          ]}
        />
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
        <group
          position={[-(xWidth - 1) / 2, -(yHeight - 1) / 2, -(zDepth - 1) / 2]}
        >
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
