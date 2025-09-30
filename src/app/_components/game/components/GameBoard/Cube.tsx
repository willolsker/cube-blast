import { COORDINATE_SYSTEM } from "../../constants/coordinates";
import { layerColors } from "../../blocks";

export const Cube = ({
  position,
  boundingBoxDimensions = [0, 0, 0],
  active,
  selected,
}: {
  position: [number, number, number];
  boundingBoxDimensions: [number, number, number];
  active: boolean;
  selected: boolean;
}) => {
  // Solid cube for active positions
  return (
    <>
      <mesh position={position}>
        <boxGeometry
          args={[
            COORDINATE_SYSTEM.CUBE_SIZE,
            COORDINATE_SYSTEM.CUBE_SIZE,
            COORDINATE_SYSTEM.CUBE_SIZE,
          ]}
        />
        <meshLambertMaterial
          color={layerColors[position[1]]}
          transparent
          opacity={active ? 1 : 0}
          emissive={selected ? layerColors[position[1]] : "#000000"}
          emissiveIntensity={selected ? 1 : 0}
        />
      </mesh>
    </>
  );
};
