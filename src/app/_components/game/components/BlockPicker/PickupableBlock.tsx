import { useRef, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { Cube } from "../GameBoard/Cube";
import { calculateBlockDimensions } from "../../utils/block-utils";

export const PickupableBlock = forwardRef(
  (
    {
      block,
      position,
      scale = 1,
      selected,
      onPickup,
    }: {
      block: boolean[][][];
      position: [number, number, number];
      scale?: number;
      selected: boolean;
      onPickup: () => void;
    },
    fref
  ) => {
    const { xWidth, yHeight, zDepth } = calculateBlockDimensions(block);

    const ref = useRef(null);
    useImperativeHandle(fref, () => ref.current, []);

    const handleClick = (e: any) => {
      e.stopPropagation();
      // Always pick up the block when clicked
      onPickup();
    };

    return (
      <group
        position={[position[0], position[1], position[2]]}
        scale={scale}
        ref={ref}
        onClick={handleClick}
      >
        <group
          position={[-(xWidth - 1) / 2, -(yHeight - 1) / 2, -(zDepth - 1) / 2]}
        >
          {block.map((layer, z) =>
            layer.map((row, y) =>
              row.map((cell, x) => (
                <Cube
                  key={`${x}-${y}-${z}`}
                  position={[x, y, z]}
                  boundingBoxDimensions={[xWidth, yHeight, zDepth]}
                  active={cell}
                  selected={selected}
                />
              ))
            )
          )}
        </group>
      </group>
    );
  }
);
