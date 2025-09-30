import * as THREE from "three";
import { COORDINATE_SYSTEM } from "../constants/coordinates";

export const calculateDragProjections = (camera: THREE.Camera) => {
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

export const calculateMouseSensitivity = (
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

export const calculateAxisBiasing = (
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
export const calculateDebugAxesData = (
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
