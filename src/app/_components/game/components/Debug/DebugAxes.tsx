import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { calculateDebugAxesData } from "../../utils/drag-calculations";
import { gridToWorld, COORDINATE_SYSTEM } from "../../constants/coordinates";
import type { DebugMode, Position } from "../../types/game";

export const DebugAxes = ({
  debugMode,
  cursorPosition,
  mousePosition,
  isDragging = false,
}: {
  debugMode: DebugMode;
  cursorPosition: Position;
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
