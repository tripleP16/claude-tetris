'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - light blue
  '#ffb74d', // L - orange
  '#ffd700', // 8 - wildcard (Tint power-up)
];

const POWERUPS = {
  bomb: { icon: '💣' },
  lightning: { icon: '⚡' },
  tint: { icon: '🌈' },
  gravity: { icon: '⬇️' },
  freeze: { icon: '❄️' },
};
const POWERUP_TYPES = Object.keys(POWERUPS);
const WILDCARD = 8;
const FREEZE_MS = 5000;
const POWERUP_QUEUE_MAX = 6;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const powerupQueueEl = document.getElementById('powerup-queue');
const powerupFreezeEl = document.getElementById('powerup-freeze');
const powerupFreezeTimeEl = document.getElementById('powerup-freeze-time');

const pauseMenu = document.getElementById('pause-menu');
const pauseMainView = document.getElementById('pause-main-view');
const pauseControlsView = document.getElementById('pause-controls-view');
const pauseControlsList = document.getElementById('pause-controls-list');
const resumeBtn = document.getElementById('resume-btn');
const restartPauseBtn = document.getElementById('restart-pause-btn');
const controlsToggleBtn = document.getElementById('controls-toggle-btn');
const pauseBackBtn = document.getElementById('pause-back-btn');
const startLevelSelect = document.getElementById('start-level-select');

const THEME_KEY = 'tetris-theme';
const START_LEVEL_KEY = 'tetris-start-level';
let gridLineColor = '#22222e';
let menuOpen = false;

// Reuse the same key list already shown in the side panel's controls section.
pauseControlsList.innerHTML = document.querySelector('.controls ul').innerHTML;

function getStoredStartLevel() {
  const stored = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
  if (Number.isInteger(stored) && stored >= 1 && stored <= 15) return stored;
  return 1;
}

function setStoredStartLevel(lvl) {
  localStorage.setItem(START_LEVEL_KEY, String(lvl));
}

function getPreferredTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  gridLineColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim();
  themeToggleBtn.textContent = theme === 'light' ? '🌙' : '☀️';
  themeToggleBtn.setAttribute('aria-label', theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro');
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

applyTheme(getPreferredTheme());

themeToggleBtn.addEventListener('click', () => {
  const activeTheme = document.documentElement.getAttribute('data-theme');
  setTheme(activeTheme === 'light' ? 'dark' : 'light');
});

window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
  if (!localStorage.getItem(THEME_KEY)) applyTheme(e.matches ? 'light' : 'dark');
});

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let powerupQueue, linesSincePowerup, powerupThreshold, freezeUntil;

function randomPowerupThreshold() {
  return 1 + Math.floor(Math.random() * 2); // 1-2 lines
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    linesSincePowerup += cleared;
    while (linesSincePowerup >= powerupThreshold) {
      linesSincePowerup -= powerupThreshold;
      powerupThreshold = randomPowerupThreshold();
      grantPowerup();
    }
    updateHUD();
  }
}

function grantPowerup() {
  if (powerupQueue.length >= POWERUP_QUEUE_MAX) return;
  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  powerupQueue.push(type);
}

function usePowerup() {
  if (!powerupQueue.length) return;
  const type = powerupQueue.shift();
  switch (type) {
    case 'bomb': applyBomb(); break;
    case 'lightning': applyLightning(); break;
    case 'tint': applyTint(); break;
    case 'gravity': applyGravity(); break;
    case 'freeze': applyFreeze(); break;
  }
  updateHUD();
}

function powerupTargetCol() {
  const w = current.shape[0].length;
  return Math.min(COLS - 1, Math.max(0, current.x + Math.floor(w / 2)));
}

function powerupTargetRow() {
  const h = current.shape.length;
  const gy = ghostY();
  return Math.min(ROWS - 1, Math.max(0, gy + Math.floor(h / 2)));
}

function applyBomb() {
  const tc = powerupTargetCol();
  const tr = powerupTargetRow();
  for (let r = tr - 1; r <= tr + 1; r++) {
    if (r < 0 || r >= ROWS) continue;
    for (let c = tc - 1; c <= tc + 1; c++) {
      if (c < 0 || c >= COLS) continue;
      board[r][c] = 0;
    }
  }
  clearLines();
}

function applyLightning() {
  if (Math.random() < 0.5) {
    const tr = Math.min(ROWS - 1, ghostY());
    board[tr] = new Array(COLS).fill(0);
  } else {
    const tc = powerupTargetCol();
    for (let r = 0; r < ROWS; r++) board[r][tc] = 0;
  }
  clearLines();
}

function applyTint() {
  const present = new Set();
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] && board[r][c] !== WILDCARD) present.add(board[r][c]);
  if (!present.size) return;
  const colors = [...present];
  const target = colors[Math.floor(Math.random() * colors.length)];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] === target) board[r][c] = WILDCARD;
}

function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    const values = [];
    for (let r = 0; r < ROWS; r++) if (board[r][c]) values.push(board[r][c]);
    for (let r = 0; r < ROWS; r++) {
      const idx = r - (ROWS - values.length);
      board[r][c] = idx >= 0 ? values[idx] : 0;
    }
  }
  clearLines();
}

function applyFreeze() {
  freezeUntil = performance.now() + FREEZE_MS;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  powerupQueueEl.textContent = powerupQueue.length
    ? powerupQueue.map(type => POWERUPS[type].icon).join(' ')
    : '—';
  const freezeRemaining = Math.max(0, freezeUntil - performance.now());
  powerupFreezeEl.classList.toggle('hidden', freezeRemaining <= 0);
  if (freezeRemaining > 0) powerupFreezeTimeEl.textContent = (freezeRemaining / 1000).toFixed(1);
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridLineColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  drawPowerupAim();
}

function drawPowerupAim() {
  const type = powerupQueue[0];
  if (type !== 'bomb' && type !== 'lightning') return;
  ctx.fillStyle = type === 'bomb' ? 'rgba(255,100,60,0.25)' : 'rgba(255,235,80,0.25)';
  if (type === 'bomb') {
    const tc = powerupTargetCol();
    const tr = powerupTargetRow();
    for (let r = tr - 1; r <= tr + 1; r++) {
      if (r < 0 || r >= ROWS) continue;
      for (let c = tc - 1; c <= tc + 1; c++) {
        if (c < 0 || c >= COLS) continue;
        ctx.fillRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);
      }
    }
  } else {
    const tc = powerupTargetCol();
    const tr = Math.min(ROWS - 1, ghostY());
    for (let c = 0; c < COLS; c++) ctx.fillRect(c * BLOCK, tr * BLOCK, BLOCK, BLOCK);
    for (let r = 0; r < ROWS; r++) ctx.fillRect(tc * BLOCK, r * BLOCK, BLOCK, BLOCK);
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function showPauseMenu() {
  menuOpen = true;
  paused = true;
  cancelAnimationFrame(animId);
  pauseMainView.classList.remove('hidden');
  pauseControlsView.classList.add('hidden');
  startLevelSelect.value = String(getStoredStartLevel());
  pauseMenu.classList.remove('hidden');
}

function hidePauseMenu() {
  menuOpen = false;
  paused = false;
  pauseMenu.classList.add('hidden');
  lastTime = performance.now();
  loop(lastTime);
}

function togglePause() {
  if (gameOver) return;
  if (menuOpen) {
    hidePauseMenu();
  } else {
    showPauseMenu();
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (ts >= freezeUntil) {
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  } else {
    updateHUD();
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = getStoredStartLevel();
  paused = false;
  menuOpen = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  powerupQueue = [];
  linesSincePowerup = 0;
  powerupThreshold = randomPowerupThreshold();
  freezeUntil = 0;
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

resumeBtn.addEventListener('click', hidePauseMenu);

restartPauseBtn.addEventListener('click', () => {
  menuOpen = false;
  pauseMenu.classList.add('hidden');
  init();
});

controlsToggleBtn.addEventListener('click', () => {
  pauseMainView.classList.add('hidden');
  pauseControlsView.classList.remove('hidden');
});

pauseBackBtn.addEventListener('click', () => {
  pauseControlsView.classList.add('hidden');
  pauseMainView.classList.remove('hidden');
});

startLevelSelect.addEventListener('change', () => {
  setStoredStartLevel(parseInt(startLevelSelect.value, 10));
});

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (menuOpen) return;
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyF':
      usePowerup();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

init();
