# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

This is a zero-dependency Tetris implementation using vanilla JavaScript and HTML5 Canvas. No build step is needed—just open a local server:

```bash
# Python 3
python3 -m http.server 8000

# Node.js (npx)
npx serve .

# PHP
php -S localhost:8000
```

Then navigate to `http://localhost:8000` in your browser. You can also open `index.html` directly, though a server is recommended for consistency.

## Project Architecture

The game consists of three files:

- **`game.js`** (~300 lines): Complete game logic. Everything runs through a `requestAnimationFrame` loop.
- **`index.html`**: DOM structure with two canvas elements (main board at 300×600px, next-piece preview at 120×120px) and UI panels for score/lines/level/controls.
- **`style.css`**: Dark arcade-theme styling using flexbox, CSS variables for colors, and `backdrop-filter`.

## Key Game Mechanics (in `game.js`)

### Board & State
- **Board**: 10×20 grid stored as a 2D array. Each cell holds `0` (empty) or a color index (1–7).
- **Current piece**: Object with `{ type, shape, x, y }`. The shape is a 2D array representing the piece's bounding box.
- **Next piece**: Randomly generated and previewed in a separate canvas before the player sees it on the board.

### Core Functions

| Function | Purpose |
|----------|---------|
| `collide(shape, ox, oy)` | Checks if a piece at position (ox, oy) hits walls or existing blocks. Returns `true` if collision detected. |
| `rotateCW(shape)` | Rotates a piece 90° clockwise by transposing and reversing rows. |
| `tryRotate()` | Attempts rotation with wall kicks (tries offsets of 0, ±1, ±2). |
| `merge()` | Locks the current piece into the board. |
| `clearLines()` | Scans board bottom-up; removes complete rows and inserts empty rows at top. Updates score/level. |
| `ghostY()` | Calculates where the current piece would land (used for ghost piece rendering). |
| `hardDrop()` | Instantly drops piece and awards points. |
| `softDrop()` | Drops piece one row, awards 1 point. |
| `lockPiece()` | Merges current piece, clears lines, spawns next piece. |
| `spawn()` | Moves next to current, generates new next. If current collides at spawn position, game over. |
| `loop(ts)` | Main game loop using `requestAnimationFrame`. Accumulates time and drops piece when `dropAccum ≥ dropInterval`. |

### Scoring & Progression
- **Line clears**: Multiply `LINE_SCORES[lineCount]` by current level. 1–4 lines award 100/300/500/800 points respectively.
- **Hard drop**: 2 points per cell dropped.
- **Soft drop**: 1 point per cell dropped.
- **Level**: Increases every 10 lines. `dropInterval = max(100, 1000 - (level - 1) × 90)` ms.

### Key Constants (at top of `game.js`)
| Constant | Default | Notes |
|----------|---------|-------|
| `COLS` | 10 | Board width. If changed, update canvas width in HTML. |
| `ROWS` | 20 | Board height. If changed, update canvas height in HTML. |
| `BLOCK` | 30 | Pixel size of each cell. Remember to update canvas dimensions. |
| `COLORS` | Array of 7 hex codes | One null (unused) + one per piece type. |
| `PIECES` | 7 tetromino shapes | Each as 4×4 matrix with piece ID at non-zero positions. |
| `LINE_SCORES` | `[0,100,300,500,800]` | Points for clearing 0, 1, 2, 3, 4 lines. |

## Control Flow

```
init()
  ├─ createBoard() → 20×10 grid of zeros
  ├─ next = randomPiece()
  ├─ spawn() → moves next to current, creates new next
  └─ requestAnimationFrame(loop)
       ↓
  loop(timestamp)
    ├─ Accumulates elapsed time in dropAccum
    ├─ When dropAccum ≥ dropInterval:
    │  ├─ Try to move piece down
    │  └─ If blocked, call lockPiece()
    ├─ draw() → renders grid, board, ghost, current piece
    └─ Schedules next frame
    
  keydown events → mover/rotate/drop actions
```

Game over occurs when `spawn()` detects the new current piece collides at its starting position.

## Rendering Details

- **Canvas drawing** uses `fillRect` for blocks. Each block renders with a subtle white highlight on top (`rgba(255,255,255,0.12)`).
- **Ghost piece** uses `globalAlpha = 0.2` to show where the piece will land.
- **Grid lines** drawn at `#22222e` with 0.5px width.
- **Next piece preview**: Centered in a 120×120 canvas using 30px blocks and offsets to center a 4×4 shape.

## Common Customizations

### Change Board Dimensions
1. Modify `COLS` and `ROWS` in `game.js`.
2. Update `<canvas id="board" width="…" height="…">` in `index.html`:
   - `width = COLS × BLOCK`
   - `height = ROWS × BLOCK`

### Adjust Game Speed
- Initial speed: change `dropInterval = 1000` in `init()` (milliseconds).
- Speed scaling per level: modify the formula in `clearLines()`: `dropInterval = Math.max(100, 1000 - (level - 1) * 90)`.

### Modify Scoring
- Edit `LINE_SCORES` array and/or the multipliers in `softDrop()` and `hardDrop()`.

### Change Colors
- Edit the `COLORS` array. Each entry is a hex color string. Index matches piece type (1–7).
- The entry at index 0 is unused (null placeholder).

## Testing

There are no automated tests. Manual testing should cover:
- Piece movement and rotation (including wall kicks near edges).
- Line clears at various board states (single, double, triple, tetris).
- Score progression with levels.
- Pause/resume and game over states.
- Ghost piece alignment with actual drop position.

## Notes for Future Work

- **Collision optimization**: `collide()` runs on every frame; consider early-exit flags if performance becomes an issue.
- **No AI/animations**: The game is straightforward—no particle effects, no smooth transitions between states.
- **Keyboard-only**: No mouse input; touch controls would require additional event handling.
- **No persistence**: Score/stats are not saved between sessions.
