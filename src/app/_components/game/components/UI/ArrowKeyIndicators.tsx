import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { COORDINATE_SYSTEM } from "../../constants/coordinates";
import { Text } from "@react-three/drei";

export function ArrowKeyIndicators({
  orbitControlsRef,
}: {
  orbitControlsRef: React.RefObject<any>;
}) {
  const arrowGroupRef = useRef<THREE.Group>(null);

  // Update arrow group position every frame
  useFrame(() => {
    if (!arrowGroupRef.current) return;

    const camera = orbitControlsRef.current?.object;
    if (!camera) return;

    // Calculate camera's right direction (projected onto XZ plane)
    const cameraRight = new THREE.Vector3();
    camera.getWorldDirection(cameraRight);
    cameraRight.cross(new THREE.Vector3(0, 1, 0)); // Cross with up to get right
    cameraRight.y = 0;
    cameraRight.normalize();

    // Get the board center
    const center = COORDINATE_SYSTEM.GAME_BOARD_CENTER;
    const boardSize = COORDINATE_SYSTEM.GRID_SIZE;
    const rightOffset = 3; // Distance from board edge (to the right)
    const forwardOffset = 2; // Distance towards the camera (front of face)

    // Position the arrow group to the right of the rightmost face
    // Find the rightmost edge by projecting in camera-right direction
    const rightmostX = center + cameraRight.x * (boardSize / 2 + rightOffset);
    const rightmostZ = center + cameraRight.z * (boardSize / 2 + rightOffset);

    // Also move towards the front (camera direction)
    const cameraForward = new THREE.Vector3();
    camera.getWorldDirection(cameraForward);
    cameraForward.y = 0;
    cameraForward.normalize();

    const finalX = rightmostX - cameraForward.x * forwardOffset;
    const finalZ = rightmostZ - cameraForward.z * forwardOffset;

    arrowGroupRef.current.position.set(finalX, 0.1, finalZ);

    // Rotate arrow group to counter-rotate against the board
    // Calculate the azimuthal angle of the camera around the board
    const cameraAngle = Math.atan2(
      camera.position.x - center,
      camera.position.z - center
    );

    // Snap to nearest π/2 and counter-rotate
    // This keeps the arrows aligned with the cardinal directions
    const counterRotation =
      Math.round(cameraAngle / (Math.PI / 2)) * (Math.PI / 2);

    // Apply opposite rotation, accounting for board's initial 45-degree rotation
    arrowGroupRef.current.rotation.y = counterRotation;
  });

  // Arrow key spacing in physical keyboard layout (inverted-T pattern)
  const keySpacing = 0.55;

  return (
    <group ref={arrowGroupRef}>
      {/* Up Arrow - top row, center */}
      <Arrow position={[0, 0, -keySpacing]} label="←" rotation={-Math.PI / 2} />

      {/* Bottom row: Left, Down, Right */}
      <Arrow position={[-keySpacing, 0, 0]} label="←" rotation={0} />
      <Arrow position={[0, 0, 0]} label="←" rotation={Math.PI / 2} />
      <Arrow position={[keySpacing, 0, 0]} label="←" rotation={Math.PI} />
    </group>
  );
}

function Arrow({
  position,
  label,
  rotation = 0,
}: {
  position: [number, number, number];
  label: string;
  rotation?: number;
}) {
  return (
    <group position={position}>
      {/* Key base (slightly rounded box) */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[0.5, 0.3, 0.5]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Key top surface (lighter) */}
      <mesh position={[0, 0.31, 0]}>
        <boxGeometry args={[0.48, 0.02, 0.48]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Arrow symbol on top */}
      <Text
        position={[0, 0.33, 0]}
        rotation={[-Math.PI / 2, 0, rotation]}
        fontSize={0.25}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}
