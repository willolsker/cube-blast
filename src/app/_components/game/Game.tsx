"use client";

import { useRef, useState, useEffect } from "react";
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
import { ArrowKeyIndicators } from "./components/UI/ArrowKeyIndicators";
import { GameOver } from "./components/UI/GameOver";
import { RestartButton } from "./components/UI/RestartButton";
import {
  saveGameState,
  loadGameState,
  clearGameState,
  getHighScore,
  saveHighScore,
} from "./utils/storage";
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
  const [highScore, setHighScore] = useState(0);
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

  // Load game state and high score from localStorage on mount
  useEffect(() => {
    const savedState = loadGameState();
    if (savedState) {
      setGameState(savedState);
    }
    setHighScore(getHighScore());
  }, []);

  // Save game state to localStorage whenever it changes
  useEffect(() => {
    saveGameState(gameState);

    // Update high score if current score is higher
    if (gameState.score > highScore) {
      setHighScore(gameState.score);
      saveHighScore(gameState.score);
    }
  }, [gameState, highScore]);

  // Handle restart
  const handleRestart = () => {
    const newState = createInitialGameState();
    setGameState(newState);
    clearGameState(); // Clear saved game state
    setBlockGridX(0);
    setBlockGridY(0);
    setBlockGridZ(0);
    setDragPosition(null);
    setInteractionMode("orbit");
  };

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
    orbitControlsRef,
    getNextGameState,
  });

  useMouseTracking(setMousePosition);

  return (
    <div className="w-full h-screen relative">
      {/* Game Over overlay */}
      {gameState.gameOver && (
        <GameOver score={gameState.score} onRestart={handleRestart} />
      )}

      {/* Score display */}
      <Score score={gameState.score} highScore={highScore} />

      {/* Restart button */}
      <RestartButton onRestart={handleRestart} />

      {/* Mode indicator */}
      <ModeIndicator interactionMode={interactionMode} debugMode={debugMode} />

      <Canvas
        camera={{ position: [8, 7, 8], fov: 70 }}
        onContextMenu={handleRightClick}
      >
        <ambientLight intensity={0.5 * Math.PI} />
        <GameBoard board={gameState.board} />
        <ArrowKeyIndicators orbitControlsRef={orbitControlsRef} />
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
          enablePan={false}
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
