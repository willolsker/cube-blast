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

  // No biasing - just use raw movement
  return {
    rawMovement: { x: rawX, y: rawY, z: rawZ },
    axisMagnitudes: [Math.abs(rawX), Math.abs(rawY), Math.abs(rawZ)],
    maxMagnitude: Math.max(Math.abs(rawX), Math.abs(rawY), Math.abs(rawZ)),
    biasStrength: 0,
    biasedMovement: { x: rawX, y: rawY, z: rawZ },
  };
};

// Shared function to calculate debug axes data using the same logic as drag
const calculateDebugAxesData = (
  camera: THREE.Camera,
  mousePosition?: { x: number; y: number }
) => {
  const gameBoardCenter = new THREE.Vector3(
    COORDINATE_SYSTEM.GAME_BOARD_CENTER,
    COORDINATE_SYSTEM.GAME_BOARD_CENTER,
    COORDINATE_SYSTEM.GAME_BOARD_CENTER
  );

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

const GameBoardBoundingBox = () => {
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

const GameBoard = ({ board }: { board: boolean[][][] }) => {
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

      // The game board center is at Y=3.5 (GAME_BOARD_CENTER)
      // We want to project onto a horizontal plane at the center of the game board
      // Plane equation: normal dot (point - planePoint) = 0, which becomes: y - 3.5 = 0
      const plane = new THREE.Plane(
        new THREE.Vector3(0, 1, 0),
        -COORDINATE_SYSTEM.GAME_BOARD_CENTER
      );
      const intersection = new THREE.Vector3();

      // Check if the ray intersects the plane
      if (raycaster.ray.intersectPlane(plane, intersection)) {
        // The intersection is in world space where cubes are at 0-7
        // Just display the grey dot at the raw intersection point to see where it actually is
        console.log(
          "[DebugAxes] Raw intersection:",
          intersection.x,
          intersection.y,
          intersection.z
        );

        // For now, just use the raw intersection to see where it appears
        centerWorldPos = [intersection.x, intersection.y, intersection.z];
        console.log("[DebugAxes] Using raw intersection as centerWorldPos");
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

// Constants for floating block grid visualization
const GRID_OPACITY = {
  MIN: 0.15, // Back-facing grids
  MAX: 0.6, // Front-facing grids
  PLANE_MULTIPLIER: 0.5, // Plane opacity relative to grid lines
} as const;

const GRID_COLORS = {
  VALID: "#00ff88", // Cyan/green for valid placement
  INVALID: "#ff0000", // Red for out of bounds
} as const;

const GRID_LINE_WIDTH = 1;

const FloatingBlockGridLines = ({
  blockDimensions,
  worldPosition,
  block,
  gameState,
}: {
  blockDimensions: { xWidth: number; yHeight: number; zDepth: number };
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
  const dragStartMouseRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartCursorRef = useRef<{ x: number; y: number; z: number } | null>(
    null
  );
  const scrollOffsetRef = useRef<number>(0);
  const { xWidth, yHeight, zDepth } = calculateBlockDimensions(block);

  // Track scroll offset changes
  const [scrollOffset, setScrollOffset] = useState(0);

  // Add wheel event listener for inward/outward movement while dragging
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Only handle scroll when in drag mode and actually dragging
      if (interactionMode === "drag" && dragStartMouseRef.current) {
        e.preventDefault();

        // Calculate perspective-aware scroll sensitivity
        const gameBoardCenter = new THREE.Vector3(
          COORDINATE_SYSTEM.GAME_BOARD_CENTER,
          COORDINATE_SYSTEM.GAME_BOARD_CENTER,
          COORDINATE_SYSTEM.GAME_BOARD_CENTER
        );
        const distanceToCamera = camera.position.distanceTo(gameBoardCenter);
        const fovRadians =
          (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
        const screenHeight = 2 * Math.tan(fovRadians / 2) * distanceToCamera;
        const scrollSensitivity = screenHeight / 1000; // Adjust divisor for desired sensitivity

        // Reverse direction: negative deltaY = away from camera (outward)
        const scrollDelta = -e.deltaY * scrollSensitivity;
        const newScrollOffset = scrollOffsetRef.current + scrollDelta;
        scrollOffsetRef.current = newScrollOffset;
        setScrollOffset(newScrollOffset);
        console.log(
          "Scroll offset:",
          newScrollOffset,
          "sensitivity:",
          scrollSensitivity
        );
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, [interactionMode, camera]);

  // Recalculate drag position when scroll offset or mouse position changes
  useEffect(() => {
    if (
      interactionMode !== "drag" ||
      !dragStartMouseRef.current ||
      !dragStartCursorRef.current
    ) {
      return;
    }

    // Calculate mouse delta from drag start
    const mouseDeltaX = mouse.x - dragStartMouseRef.current.x;
    const mouseDeltaY = mouse.y - dragStartMouseRef.current.y;

    // Use shared helper functions for consistent calculations
    const gameBoardCenter = new THREE.Vector3(
      COORDINATE_SYSTEM.GAME_BOARD_CENTER,
      COORDINATE_SYSTEM.GAME_BOARD_CENTER,
      COORDINATE_SYSTEM.GAME_BOARD_CENTER
    );

    // Calculate screen projections
    const screenProjections = calculateDragProjections(camera);

    // Calculate mouse sensitivity
    const sensitivityData = calculateMouseSensitivity(camera, gameBoardCenter);

    // Calculate axis biasing using the mouse DELTA from drag start
    const axisBiasing = calculateAxisBiasing(
      mouseDeltaX,
      mouseDeltaY,
      sensitivityData.mouseSensitivity,
      screenProjections
    );

    // Apply biased movement to world coordinates, starting from the drag start cursor position
    let worldX = dragStartCursorRef.current.x + axisBiasing.biasedMovement.x;
    let worldY = dragStartCursorRef.current.y + axisBiasing.biasedMovement.y;
    let worldZ = dragStartCursorRef.current.z + axisBiasing.biasedMovement.z;

    // Apply scroll offset along the camera's forward direction
    if (scrollOffset !== 0) {
      // Get camera's forward direction (looking away from camera)
      const cameraForward = new THREE.Vector3();
      camera.getWorldDirection(cameraForward);

      // Apply scroll offset along camera forward direction
      worldX += cameraForward.x * scrollOffset;
      worldY += cameraForward.y * scrollOffset;
      worldZ += cameraForward.z * scrollOffset;
    }

    const gridX = worldToGrid(worldX);
    const gridY = worldToGrid(worldY);
    const gridZ = worldToGrid(worldZ);
    const clampedX = clampGrid(gridX);
    const clampedY = clampGrid(gridY);
    const clampedZ = clampGrid(gridZ);

    console.log("useEffect drag update:", {
      mouseDelta: { x: mouseDeltaX, y: mouseDeltaY },
      scrollOffset,
      world: { worldX, worldY, worldZ },
      grid: { gridX, gridY, gridZ },
      clamped: { clampedX, clampedY, clampedZ },
    });

    onDrag(clampedX, clampedY, clampedZ);
  }, [
    scrollOffset,
    mousePosition,
    interactionMode,
    camera,
    onDrag,
    mouse.x,
    mouse.y,
  ]);

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
    <>
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
                </mesh>
              ))
            )
          )}
        </group>
      </group>
      <FloatingBlockGridLines
        blockDimensions={{ xWidth, yHeight, zDepth }}
        worldPosition={worldPosition}
        block={block}
        gameState={gameState}
      />
    </>
  );

  return interactionMode === "drag" ? (
    <DragControls
      onDragStart={() => {
        // Capture the initial mouse position and cursor position when drag starts
        dragStartMouseRef.current = { x: mouse.x, y: mouse.y };
        dragStartCursorRef.current = { ...cursorPosition };
        console.log(
          "Drag started at mouse:",
          dragStartMouseRef.current,
          "cursor:",
          dragStartCursorRef.current
        );
      }}
      onDrag={(e) => {
        console.log("DragControls onDrag event (Matrix4):", e);

        // If we don't have a drag start position, initialize it now
        if (!dragStartMouseRef.current || !dragStartCursorRef.current) {
          dragStartMouseRef.current = { x: mouse.x, y: mouse.y };
          dragStartCursorRef.current = { ...cursorPosition };
        }

        // Update mouse position during dragging to keep grey dot following cursor
        // The useEffect will handle the actual drag calculation
        setMousePosition({ x: mouse.x, y: mouse.y });
      }}
      onDragEnd={() => {
        console.log("DragControls onDragEnd called");
        // Reset drag start refs and scroll offset
        dragStartMouseRef.current = null;
        dragStartCursorRef.current = null;
        scrollOffsetRef.current = 0;
        setScrollOffset(0);
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
          opacity={active ? 1 : 0}
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
