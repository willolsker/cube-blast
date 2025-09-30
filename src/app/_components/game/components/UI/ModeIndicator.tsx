import type { InteractionMode, DebugMode } from "../../types/game";

export const ModeIndicator = ({
  interactionMode,
  debugMode,
}: {
  interactionMode: InteractionMode;
  debugMode: DebugMode;
}) => {
  return (
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
  );
};
