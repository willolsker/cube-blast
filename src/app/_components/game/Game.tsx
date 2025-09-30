"use client";

import { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { COORDINATE_SYSTEM } from "./constants/coordinates";
import { getNextGameState, createInitialGameState } from "./utils/game-logic";
import { useKeyboardControls } from "./hooks/useKeyboardControls";
import { useMouseTracking } from "./hooks/useMouseTracking";
import { GameBoard } from "./components/GameBoard/GameBoard";
import { FloatingBlock } from "./components/FloatingBlock/FloatingBlock";
import { BlocksRenderer } from "./components/BlockPicker/BlocksRenderer";
import { DebugAxes } from "./components/Debug/DebugAxes";
import { ModeIndicator } from "./components/UI/ModeIndicator";
import { Score } from "./components/UI/Score";
import type {
  GameState,
  InteractionMode,
  DebugMode,
  Position,
} from "./types/game";

export function Game() {
  const [gameState, setGameState] = useState<GameState>(
    createInitialGameState()
  );
  const orbitControlsRef = useRef<any>(null);

  const [blockGridX, setBlockGridX] = useState(0);
  const [blockGridY, setBlockGridY] = useState(0);
  const [blockGridZ, setBlockGridZ] = useState(0);
  const [dragPosition, setDragPosition] = useState<Position | null>(null);
  const [interactionMode, setInteractionMode] =
    useState<InteractionMode>("orbit");
  const [debugMode, setDebugMode] = useState<DebugMode>("off");
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  // Handle block pickup
  const handleBlockPickup = (blockIndex: number) => {
    setGameState({ ...gameState, activeBlock: blockIndex });
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

  // Custom hooks for input handling
  useKeyboardControls({
    gameState,
    blockGridX,
    blockGridY,
    blockGridZ,
    setBlockGridX,
    setBlockGridY,
    setBlockGridZ,
    setDebugMode,
    setGameState,
    setDragPosition,
    setInteractionMode,
    getNextGameState,
  });

  useMouseTracking(setMousePosition);

  return (
    <div className="w-full h-screen relative">
      {/* Score display */}
      <Score score={gameState.score} />

      {/* Mode indicator */}
      <ModeIndicator interactionMode={interactionMode} debugMode={debugMode} />

      <Canvas
        camera={{ position: [12, 12, 12], fov: 70 }}
        onContextMenu={handleRightClick}
      >
        <ambientLight intensity={0.5 * Math.PI} />
        <GameBoard board={gameState.board} />
        <BlocksRenderer
          orbitControlsRef={orbitControlsRef}
          blocks={gameState.nextBlocks}
          activeBlock={gameState.activeBlock}
          onBlockPickup={handleBlockPickup}
        />
        {gameState.activeBlock !== null &&
          gameState.nextBlocks[gameState.activeBlock] && (
            <FloatingBlock
              block={gameState.nextBlocks[gameState.activeBlock]!}
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
        {gameState.activeBlock !== null &&
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
