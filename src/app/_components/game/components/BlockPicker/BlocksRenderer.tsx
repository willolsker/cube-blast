import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { PickupableBlock } from "./PickupableBlock";
import type { ThreeDimensionalBooleanArray } from "../../types/game";

export function BlocksRenderer({
  orbitControlsRef,
  renderPriority = 1,
  matrix = new THREE.Matrix4(),
  blocks,
  activeBlock,
  onBlockPickup,
}: {
  orbitControlsRef: React.RefObject<any>;
  renderPriority?: number;
  matrix?: THREE.Matrix4;
  blocks: (ThreeDimensionalBooleanArray | null)[];
  activeBlock: number | null;
  onBlockPickup: (index: number) => void;
}) {
  const blockGroups = useRef<THREE.Group[]>([]);
  const { viewport } = useThree();

  useFrame(() => {
    // Get the main camera from OrbitControls
    const mainCamera = orbitControlsRef.current?.object;
    const controls = orbitControlsRef.current;

    if (mainCamera && controls) {
      // Spin blockGroup to the inverse of the main camera's matrix
      matrix.copy(mainCamera.matrix).invert();
      blockGroups.current.forEach((group) => {
        group?.quaternion.setFromRotationMatrix(matrix);
      });
    }
  });

  return (
    <Hud renderPriority={renderPriority}>
      <ambientLight intensity={Math.PI / 2} />
      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        decay={0}
        intensity={Math.PI}
      />
      <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
      <PerspectiveCamera makeDefault position={[0, 0, 10]} />
      {blocks.map((block, index) =>
        block ? (
          <PickupableBlock
            key={index}
            ref={(r: THREE.Group) => void (blockGroups.current[index] = r)}
            block={block}
            position={[-6, 2 - index * 2, -2]}
            scale={0.5}
            selected={activeBlock === index}
            onPickup={() => onBlockPickup(index)}
          />
        ) : null
      )}
      <ambientLight intensity={1} />
      <pointLight position={[200, 200, 100]} intensity={0.5} />
    </Hud>
  );
}
