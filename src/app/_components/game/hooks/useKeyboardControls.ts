import { useEffect } from "react";
import type { GameState, DebugMode } from "../types/game";
import { getNextGameState } from "../utils/game-logic";

export const useKeyboardControls = ({
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
}: {
  gameState: GameState;
  blockGridX: number;
  blockGridY: number;
  blockGridZ: number;
  setBlockGridX: (value: number | ((prev: number) => number)) => void;
  setBlockGridY: (value: number | ((prev: number) => number)) => void;
  setBlockGridZ: (value: number | ((prev: number) => number)) => void;
  setDebugMode: (value: DebugMode | ((prev: DebugMode) => DebugMode)) => void;
  setGameState: (value: GameState) => void;
  setDragPosition: (value: { x: number; y: number; z: number } | null) => void;
  setInteractionMode: (value: "orbit" | "drag") => void;
  getNextGameState: (
    gameState: GameState,
    blockGridX: number,
    blockGridY: number,
    blockGridZ: number
  ) => GameState;
}) => {
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
        setGameState({
          ...gameState,
          activeBlock:
            gameState.activeBlock === null
              ? 0
              : (gameState.activeBlock + 1) % gameState.nextBlocks.length,
        });
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
      if (e.key === "Enter" && gameState.activeBlock !== null) {
        // Place the block using keyboard
        const newGameState = getNextGameState(
          gameState,
          blockGridX,
          blockGridY,
          blockGridZ
        );
        setGameState(newGameState);
      }
      if (e.key === "Escape" && gameState.activeBlock !== null) {
        // Cancel drag
        setGameState({ ...gameState, activeBlock: null });
        setDragPosition(null);
        setInteractionMode("orbit");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
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
  ]);
};
