import type { GameState } from "../types/game";

const STORAGE_KEYS = {
  GAME_STATE: "cube-blast-game-state",
  HIGH_SCORE: "cube-blast-high-score",
} as const;

/**
 * Save game state to localStorage
 */
export const saveGameState = (gameState: GameState): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(gameState));
  } catch (error) {
    console.error("Failed to save game state:", error);
  }
};

/**
 * Load game state from localStorage
 */
export const loadGameState = (): GameState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
    if (!saved) return null;
    return JSON.parse(saved) as GameState;
  } catch (error) {
    console.error("Failed to load game state:", error);
    return null;
  }
};

/**
 * Clear saved game state
 */
export const clearGameState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.GAME_STATE);
  } catch (error) {
    console.error("Failed to clear game state:", error);
  }
};

/**
 * Get high score from localStorage
 */
export const getHighScore = (): number => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.HIGH_SCORE);
    if (!saved) return 0;
    return parseInt(saved, 10) || 0;
  } catch (error) {
    console.error("Failed to get high score:", error);
    return 0;
  }
};

/**
 * Save high score to localStorage
 */
export const saveHighScore = (score: number): void => {
  try {
    const currentHigh = getHighScore();
    if (score > currentHigh) {
      localStorage.setItem(STORAGE_KEYS.HIGH_SCORE, score.toString());
    }
  } catch (error) {
    console.error("Failed to save high score:", error);
  }
};
