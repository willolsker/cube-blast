"use client";

import * as THREE from "three";
import {
  useRef,
  useState,
  useContext,
  createContext,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Hud,
  OrbitControls,
  RenderTexture,
  OrthographicCamera,
  PerspectiveCamera,
  Text,
  Environment,
  Edges,
} from "@react-three/drei";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { suspend } from "suspend-react";
import { getRandomBlock, layerColors } from "./blocks";

interface GameState {
  board: boolean[][][];
  nextBlocks: boolean[][][][];
}

const initialGameState: GameState = {
  board: Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => false))
  ),
  nextBlocks: Array.from({ length: 4 }, () => getRandomBlock()),
};

const context = createContext(null);

export function Game() {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const orbitControlsRef = useRef<any>(null);

  return (
    <div className="w-full h-screen">
      <Canvas>
        <ambientLight intensity={0.5 * Math.PI} />
        <GameBoard board={gameState.board} />
        <BlocksRenderer
          orbitControlsRef={orbitControlsRef}
          blocks={gameState.nextBlocks}
        />
        <OrbitControls ref={orbitControlsRef} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}

const GameBoard = ({ board }: { board: boolean[][][] }) => {
  return (
    <group position={[0, 0, 0]}>
      {/* All cubes - transparent wireframes for empty spaces, solid for filled */}
      {board.map((layer, z) =>
        layer.map((row, y) =>
          row.map((cell, x) => (
            <Cube
              key={`${x}-${y}-${z}`}
              position={[x, y, z]}
              boundingBoxDimensions={[8, 8, 8]}
              active={cell}
              isBottomLayer={y === 0}
            />
          ))
        )
      )}
    </group>
  );
};

const Cube = ({
  position,
  boundingBoxDimensions = [0, 0, 0],
  active,
  isBottomLayer,
}: {
  position: [number, number, number];
  boundingBoxDimensions: [number, number, number];
  active: boolean;
  isBottomLayer: boolean;
}) => {
  const wireframe = useMemo(() => {
    return (
      <mesh
        position={[
          position[0] - boundingBoxDimensions[0] / 2,
          position[1] - boundingBoxDimensions[1] / 2,
          position[2] - boundingBoxDimensions[2] / 2,
        ]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={0} />
        <Edges color={isBottomLayer ? "#ff0000" : "#e2e8f0"} />
      </mesh>
    );
  }, [active, isBottomLayer, boundingBoxDimensions]);

  if (active) {
    // Solid cube for active positions
    return (
      <>
        <mesh
          position={[
            position[0] - boundingBoxDimensions[0] / 2,
            position[1] - boundingBoxDimensions[1] / 2,
            position[2] - boundingBoxDimensions[2] / 2,
          ]}
        >
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <meshStandardMaterial
            color={layerColors[position[1]]}
            transparent
            opacity={1}
          />
        </mesh>
        {wireframe}
      </>
    );
  } else {
    // Wireframe cube for inactive positions - only outer edges
    return wireframe;
  }
};

const calculateBlockDimensions = (block: boolean[][][]) => {
  const zDepth = block.length;
  const yHeight = block[0]?.length ?? 0;
  const xWidth = block[0]?.[0]?.length ?? 0;
  return { xWidth, yHeight, zDepth };
};

const BlockRenderer = forwardRef(
  (
    {
      block,
      position,
      scale = 1,
    }: {
      block: boolean[][][];
      position: [number, number, number];
      scale?: number;
    },
    fref
  ) => {
    useFrame(() => {
      console.log(block, xWidth, yHeight, zDepth);
    });
    const { xWidth, yHeight, zDepth } = calculateBlockDimensions(block);

    const ref = useRef(null);
    useImperativeHandle(fref, () => ref.current, []);
    return (
      <group
        position={[position[0], position[1], position[2]]}
        scale={scale}
        ref={ref}
      >
        <group position={[0, 0, 0]}>
          {block.map((layer, z) =>
            layer.map((row, y) =>
              row.map((cell, x) => (
                <Cube
                  key={`${x}-${y}-${z}`}
                  position={[x, y, z]}
                  boundingBoxDimensions={[xWidth, yHeight, zDepth]}
                  active={cell}
                  isBottomLayer={y === 0}
                />
              ))
            )
          )}
        </group>
      </group>
    );
  }
);

function BlocksRenderer({
  orbitControlsRef,
  renderPriority = 1,
  matrix = new THREE.Matrix4(),
  blocks,
}: {
  orbitControlsRef: React.RefObject<any>;
  renderPriority?: number;
  matrix?: THREE.Matrix4;
  blocks: boolean[][][][];
}) {
  const blockGroups = useRef<THREE.Group[]>([]);
  const { viewport } = useThree();

  useFrame(() => {
    // Get the main camera from OrbitControls
    const mainCamera = orbitControlsRef.current?.object;
    const controls = orbitControlsRef.current;

    if (mainCamera && controls) {
      // Calculate zoom based on distance from target
      const distance = mainCamera.position.distanceTo(controls.target);
      const baseDistance = 10; // Adjust this to match your initial camera distance
      const zoom = baseDistance / distance;

      // Spin blockGroup to the inverse of the main camera's matrix
      matrix.copy(mainCamera.matrix).invert();
      blockGroups.current.forEach((group) => {
        group.quaternion.setFromRotationMatrix(matrix);
        group.scale.set(zoom, zoom, zoom);
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
      {blocks.map((block, index) => (
        <BlockRenderer
          key={index}
          ref={(r: THREE.Group) => void (blockGroups.current[index] = r)}
          block={block}
          position={[
            -(viewport.width / 2 - 1),
            (viewport.height / 3 - 1) * index - (viewport.height / 3 - 1) - 1,
            0,
          ]}
        />
      ))}
      <ambientLight intensity={1} />
      <pointLight position={[200, 200, 100]} intensity={0.5} />
    </Hud>
  );
}
