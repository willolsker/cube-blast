import { useEffect } from "react";
import type { GameState, DebugMode } from "../types/game";
import { getNextGameState } from "../utils/game-logic";
import * as THREE from "three";

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
  orbitControlsRef,
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
  orbitControlsRef: React.RefObject<any>;
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

      // Camera-relative position controls
      const camera = orbitControlsRef.current?.object;
      if (camera) {
        // Helper function to apply movement with bounds checking
        const applyMovement = (dx: number, dz: number) => {
          const newX = blockGridX + dx;
          const newZ = blockGridZ + dz;
          setBlockGridX(Math.max(0, Math.min(7, newX)));
          setBlockGridZ(Math.max(0, Math.min(7, newZ)));
        };

        // Get camera's forward direction (where it's looking)
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);

        // Project forward vector onto XZ plane and normalize
        forward.y = 0;
        forward.normalize();

        // Right vector is perpendicular to forward on XZ plane
        const right = new THREE.Vector3(-forward.z, 0, forward.x);

        // Choose dominant axis (only move in one direction at a time)
        const getDominantDirection = (vector: THREE.Vector3) => {
          if (Math.abs(vector.x) > Math.abs(vector.z)) {
            return { x: Math.sign(vector.x), z: 0 };
          }
          return { x: 0, z: Math.sign(vector.z) };
        };

        // Arrow key controls (camera-relative, single axis)
        if (e.key === "ArrowUp") {
          const dir = getDominantDirection(forward);
          applyMovement(dir.x, dir.z);
        } else if (e.key === "ArrowDown") {
          const dir = getDominantDirection(forward);
          applyMovement(-dir.x, -dir.z);
        } else if (e.key === "ArrowRight") {
          const dir = getDominantDirection(right);
          applyMovement(dir.x, dir.z);
        } else if (e.key === "ArrowLeft") {
          const dir = getDominantDirection(right);
          applyMovement(-dir.x, -dir.z);
        }
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
    orbitControlsRef,
  ]);
};
