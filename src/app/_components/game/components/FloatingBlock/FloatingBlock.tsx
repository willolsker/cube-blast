import { useRef, useState, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { DragControls } from "@react-three/drei";
import * as THREE from "three";
import { FloatingBlockGridLines } from "./FloatingBlockGridLines";
import {
  COORDINATE_SYSTEM,
  gridToWorld,
  worldToGrid,
  clampGrid,
} from "../../constants/coordinates";
import { calculateBlockDimensions } from "../../utils/block-utils";
import {
  calculateDragProjections,
  calculateMouseSensitivity,
  calculateAxisBiasing,
} from "../../utils/drag-calculations";
import { layerColors } from "../../blocks";
import type { GameState, InteractionMode, Position } from "../../types/game";

export const FloatingBlock = ({
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
  dragPosition: Position | null;
  interactionMode: InteractionMode;
  cursorPosition: Position;
  debugMode: "off" | "gameboard" | "cursor";
  mousePosition: { x: number; y: number };
  setMousePosition: (position: { x: number; y: number }) => void;
}) => {
  const { camera, raycaster, mouse } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const dragStartMouseRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartCursorRef = useRef<Position | null>(null);
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
