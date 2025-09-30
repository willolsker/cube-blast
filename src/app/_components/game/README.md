# Cube Blast Game Module

This directory contains the 3D block-stacking game implementation built with React Three Fiber.

## Architecture Overview

The game module has been structured following **separation of concerns** principles:

- **Types**: TypeScript interfaces and type definitions
- **Constants**: Configuration values and helper functions
- **Utils**: Pure utility functions (game logic, calculations)
- **Hooks**: React hooks for encapsulating stateful logic
- **Components**: React components organized by feature

## Directory Structure

```
game/
├── Game.tsx                  # Main game orchestrator (~160 lines)
├── blocks.tsx                # Block definitions and generation
├── README.md                 # This file
│
├── types/
│   └── game.ts              # GameState, Position, BlockDimensions, etc.
│
├── constants/
│   ├── coordinates.ts       # Grid system, coordinate conversions
│   └── rendering.ts         # Visual constants (colors, opacity)
│
├── utils/
│   ├── drag-calculations.ts # Camera projections, mouse sensitivity
│   ├── game-logic.ts        # Game state transitions, collision detection
│   └── block-utils.ts       # Block dimension calculations
│
├── hooks/
│   ├── useKeyboardControls.ts  # Keyboard input handling
│   └── useMouseTracking.ts     # Mouse position tracking
│
└── components/
    ├── GameBoard/
    │   ├── GameBoard.tsx           # Main board container
    │   ├── GameBoardBoundingBox.tsx # Grid visualization
    │   └── Cube.tsx                 # Individual cube rendering
    │
    ├── FloatingBlock/
    │   ├── FloatingBlock.tsx        # Draggable block logic
    │   └── FloatingBlockGridLines.tsx # Grid visualization
    │
    ├── BlockPicker/
    │   ├── BlocksRenderer.tsx      # HUD with pickable blocks
    │   ├── PickupableBlock.tsx     # Interactive block in picker
    │   └── BlockRenderer.tsx       # Static block renderer
    │
    ├── Debug/
    │   └── DebugAxes.tsx           # Debug visualization tools
    │
    └── UI/
        └── ModeIndicator.tsx       # Mode display overlay
```

## Key Components

### Game.tsx

The main orchestrator component. Manages:

- Game state (board, next blocks)
- Cursor position (x, y, z)
- Interaction modes (orbit/drag)
- Event handlers for block pickup/drag/drop

### GameBoard

Renders the 8x8x8 game grid with:

- Dynamic opacity bounding box (faces adjust based on camera angle)
- Filled/empty cubes based on game state
- Grid line visualization

### FloatingBlock

Handles the draggable block that follows the cursor:

- Perspective-aware drag calculations
- Scroll-wheel support for depth movement
- Collision detection and validation
- Visual feedback (green/red emissive)

### BlockPicker (BlocksRenderer)

HUD overlay showing available blocks:

- Billboard rotation (always faces camera)
- Click to select blocks
- Visual selection indicator

### Debug Tools

Press `D` to cycle through debug modes:

- **Off**: No debug visualization
- **Gameboard**: Shows screen-to-world projections at origin
- **Cursor**: Shows projections at cursor position

## Coordinate System

The game uses a grid-based coordinate system:

- Grid coordinates: 0-7 (integers)
- World coordinates: Same as grid (1:1 mapping)
- Board center: (3.5, 3.5, 3.5)

Helper functions in `constants/coordinates.ts`:

- `gridToWorld(n)`: Convert grid to world coordinates
- `worldToGrid(n)`: Convert world to grid coordinates
- `clampGrid(n)`: Clamp to valid grid range (0-7)

## Game Logic

Game state management is in `utils/game-logic.ts`:

1. **Block Placement**: Check collisions, validate bounds, place block
2. **Layer Clearing**: Detect complete horizontal layers (Y-axis)
3. **Block Dropping**: Move blocks down when layers cleared
4. **Next Blocks**: Generate new random blocks

## Input Controls

### Keyboard

- **Tab**: Cycle through available blocks
- **Arrow Keys**: Move cursor (X/Z axes)
- **Space/Shift**: Move cursor up/down (Y axis)
- **PageUp/PageDown**: Alternative Y controls
- **Enter**: Place block at cursor
- **Escape**: Cancel block placement
- **D**: Cycle debug modes

### Mouse

- **Click Block**: Pick up block from HUD
- **Drag**: Move block in 3D space
- **Scroll Wheel**: Move block toward/away from camera (while dragging)
- **Right Click**: Toggle orbit/drag mode

## Drag Behavior

The drag system uses camera-relative calculations:

1. **Screen Projections**: Maps mouse X/Y to world X/Y/Z based on camera orientation
2. **Mouse Sensitivity**: Adjusts based on camera distance for consistent feel
3. **Scroll Offset**: Allows movement perpendicular to the screen plane

See `utils/drag-calculations.ts` for implementation details.

## Adding New Features

### New Block Type

1. Add to `possibleBlocks` array in `blocks.tsx`
2. Define as 3D boolean array `[z][y][x]`
3. Will automatically be rotated randomly when generated

### New Game Rule

1. Update `getNextGameState()` in `utils/game-logic.ts`
2. Add logic after block placement or layer clearing

### New Keyboard Control

1. Add handler in `hooks/useKeyboardControls.ts`
2. Access game state and setters via hook parameters

### New Visual Element

1. Create component in appropriate `components/` subfolder
2. Import and use in `Game.tsx` or parent component

## Performance Considerations

- Grid lines use `depthTest={false}` for consistent visibility
- Block picker uses separate HUD render pass
- Opacity calculations run in `useFrame` (every frame)
- Game state updates are batched in React state

## Testing

To test individual modules:

```typescript
// Example: Testing block dimensions
import { calculateBlockDimensions } from "./utils/block-utils";

const block = [[[true, true]], [[true, true]]];
const dims = calculateBlockDimensions(block);
// dims = { xWidth: 2, yHeight: 1, zDepth: 2 }
```

## Dependencies

- **three**: 3D rendering engine
- **@react-three/fiber**: React renderer for Three.js
- **@react-three/drei**: Useful helpers (OrbitControls, Hud, etc.)

## Future Improvements

Potential enhancements:

- [ ] Score tracking system
- [ ] Block rotation controls (R key)
- [ ] Undo/redo functionality
- [ ] Particle effects for layer clearing
- [ ] Sound effects
- [ ] Mobile touch controls
- [ ] Multiplayer support
