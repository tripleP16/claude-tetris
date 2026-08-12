'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Skin registry: each skin supplies a full palette (indices 1-7 are the seven
// tetromino piece colors, index 8 is the wildcard color used by the Tint
// power-up) plus enough rendering info for drawBlock() to render it distinctly.
const SKINS = {
  retro: {
    label: 'Retro',
    icon: '🟦',
    palette: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#64b5f6', // J - light blue
      '#ffb74d', // L - orange
      '#ffd700', // 8 - wildcard (Tint power-up)
    ],
    highlight: 'rgba(255,255,255,0.12)',
  },
  neon: {
    label: 'Neon',
    icon: '💠',
    palette: [
      null,
      '#00e5ff', '#fff700', '#e040fb', '#00e676',
      '#ff1744', '#2979ff', '#ff9100', '#ffea00',
    ],
    highlight: 'rgba(255,255,255,0.35)',
    glow: true,
  },
  pastel: {
    label: 'Pastel',
    icon: '🌸',
    palette: [
      null,
      '#a8dadc', '#ffe8a1', '#d8bbff', '#b5e8b0',
      '#ffb3ba', '#a9c9ff', '#ffd8a8', '#fff2b2',
    ],
    highlight: 'rgba(255,255,255,0.4)',
    rounded: true,
  },
  pixel: {
    label: 'Pixel art',
    icon: '🕹️',
    palette: [
      null,
      '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784',
      '#e57373', '#64b5f6', '#ffb74d', '#ffd700',
    ],
    highlight: 'rgba(255,255,255,0.12)',
    texture: true,
  },
};
const DEFAULT_SKIN = 'retro';

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
const skinPickerEl = document.getElementById('skin-picker');
const skinButtons = skinPickerEl ? Array.from(skinPickerEl.querySelectorAll('.skin-btn')) : [];
const powerupQueueEl = document.getElementById('powerup-queue');
const powerupFreezeEl = document.getElementById('powerup-freeze');
const powerupFreezeTimeEl = document.getElementById('powerup-freeze-time');
const comboEl = document.getElementById('combo');
const bestComboEl = document.getElementById('best-combo');
const bestLinesEl = document.getElementById('best-lines');

const STATS_KEY = 'tetris-stats';

function loadStats() {
  try {
    const stored = JSON.parse(localStorage.getItem(STATS_KEY));
    if (stored && typeof stored === 'object') {
      return {
        bestCombo: Number(stored.bestCombo) || 0,
        bestLines: Number(stored.bestLines) || 0,
      };
    }
  } catch (e) {
    // ignore malformed data
  }
  return { bestCombo: 0, bestLines: 0 };
}

const pauseMenu = document.getElementById('pause-menu');
const pauseMainView = document.getElementById('pause-main-view');
const pauseControlsView = document.getElementById('pause-controls-view');
const pauseControlsList = document.getElementById('pause-controls-list');
const resumeBtn = document.getElementById('resume-btn');
const restartPauseBtn = document.getElementById('restart-pause-btn');
const controlsToggleBtn = document.getElementById('controls-toggle-btn');
const pauseBackBtn = document.getElementById('pause-back-btn');
const startLevelSelect = document.getElementById('start-level-select');

const startScreen = document.getElementById('start-screen');
const startHighscoresBodyEl = document.getElementById('start-highscores-body');
const playBtn = document.getElementById('play-btn');
const highscoreEntryEl = document.getElementById('highscore-entry');
const highscoreNameInput = document.getElementById('highscore-name-input');
const highscoreSaveBtn = document.getElementById('highscore-save-btn');
const highscoresSectionEl = document.getElementById('highscores-section');
const highscoresBodyEl = document.getElementById('highscores-body');
const highscoreStatsEl = document.getElementById('highscore-stats');
const clearHighscoresBtn = document.getElementById('clear-highscores-btn');

const THEME_KEY = 'tetris-theme';
const START_LEVEL_KEY = 'tetris-start-level';
const HIGHSCORES_KEY = 'tetris-highscores';
const MAX_HIGHSCORES = 5;
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

const SKIN_KEY = 'tetris-skin';
let currentSkin = DEFAULT_SKIN;

function getPreferredSkin() {
  const stored = localStorage.getItem(SKIN_KEY);
  return SKINS[stored] ? stored : DEFAULT_SKIN;
}

function applySkin(skin) {
  currentSkin = SKINS[skin] ? skin : DEFAULT_SKIN;
  document.documentElement.setAttribute('data-skin', currentSkin);
  // Grid line color is theme-driven CSS; re-read it in case skin CSS overrides it too.
  gridLineColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim();
  skinButtons.forEach(btn => {
    const active = btn.dataset.skin === currentSkin;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function setSkin(skin) {
  localStorage.setItem(SKIN_KEY, skin);
  applySkin(skin);
}

applySkin(getPreferredSkin());

skinButtons.forEach(btn => {
  btn.addEventListener('click', () => setSkin(btn.dataset.skin));
});

let clearHighscoresConfirmPending = false;
let clearHighscoresConfirmTimer = null;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function loadHighscores() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(e => e && typeof e.score === 'number' && typeof e.name === 'string')
      .slice(0, MAX_HIGHSCORES);
  } catch (err) {
    return [];
  }
}

function saveHighscoresList(list) {
  localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
}

function qualifiesForHighscore(candidateScore) {
  const list = loadHighscores();
  if (list.length < MAX_HIGHSCORES) return true;
  return candidateScore > list[list.length - 1].score;
}

function renderHighscores(containerEl, highlightEntry) {
  if (!containerEl) return;
  const list = loadHighscores();
  if (!list.length) {
    containerEl.innerHTML = '<tr><td colspan="3">Sin records aún</td></tr>';
    return;
  }
  containerEl.innerHTML = list.map((entry, i) => {
    const isNew = !!highlightEntry &&
      entry.name === highlightEntry.name &&
      entry.score === highlightEntry.score &&
      entry.lines === highlightEntry.lines &&
      entry.level === highlightEntry.level;
    return `<tr class="${isNew ? 'highscore-new' : ''}">
      <td>${i + 1}</td>
      <td>${escapeHtml(entry.name)}</td>
      <td>${entry.score.toLocaleString()}</td>
    </tr>`;
  }).join('');
}

function renderHighscoreStats(containerEl) {
  if (!containerEl) return;
  const combo = bestStats.bestCombo > 0 ? bestStats.bestCombo : '—';
  const bestLines = bestStats.bestLines > 0 ? bestStats.bestLines : '—';
  containerEl.textContent = `Mejor combo: ${combo}  ·  Máx. líneas: ${bestLines}`;
}

function saveHighscore() {
  const raw = highscoreNameInput.value.trim();
  const name = (raw || 'Jugador').slice(0, 12);
  const entry = { name, score, lines, level };
  const list = loadHighscores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  saveHighscoresList(list.slice(0, MAX_HIGHSCORES));
  highscoreEntryEl.classList.add('hidden');
  renderHighscores(highscoresBodyEl, entry);
}

highscoreSaveBtn.addEventListener('click', saveHighscore);
highscoreNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveHighscore();
  }
});

function resetClearHighscoresBtn() {
  clearHighscoresConfirmPending = false;
  clearHighscoresBtn.textContent = 'Borrar records';
  if (clearHighscoresConfirmTimer) {
    clearTimeout(clearHighscoresConfirmTimer);
    clearHighscoresConfirmTimer = null;
  }
}

clearHighscoresBtn.addEventListener('click', () => {
  if (!clearHighscoresConfirmPending) {
    clearHighscoresConfirmPending = true;
    clearHighscoresBtn.textContent = '¿Seguro?';
    clearHighscoresConfirmTimer = setTimeout(resetClearHighscoresBtn, 3000);
    return;
  }
  resetClearHighscoresBtn();
  localStorage.removeItem(HIGHSCORES_KEY);
  renderHighscores(highscoresBodyEl, null);
});

function showStartScreen() {
  renderHighscores(startHighscoresBodyEl);
  startScreen.classList.remove('hidden');
}

function hideStartScreen() {
  startScreen.classList.add('hidden');
}

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let powerupQueue, linesSincePowerup, powerupThreshold, freezeUntil;
let combo, maxCombo, maxLinesInClear, bestStats;

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
  return cleared;
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
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    maxLinesInClear = Math.max(maxLinesInClear, cleared);
  } else {
    combo = 0;
  }
  updateHUD();
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
  comboEl.textContent = combo > 1 ? `x${combo}` : '—';
  comboEl.classList.toggle('active', combo > 1);
  bestComboEl.textContent = `Combo: ${bestStats.bestCombo}`;
  bestLinesEl.textContent = `Líneas: ${bestStats.bestLines}`;
}

function drawPixelTexture(context, px, py, s) {
  const cell = Math.max(3, Math.floor(s / 5));
  context.fillStyle = 'rgba(0,0,0,0.18)';
  for (let ty = 0; ty * cell < s; ty++) {
    for (let tx = 0; tx * cell < s; tx++) {
      if ((tx + ty) % 2 === 0) continue;
      const w = Math.min(cell, s - tx * cell);
      const h = Math.min(cell, s - ty * cell);
      context.fillRect(px + tx * cell, py + ty * cell, w, h);
    }
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin] || SKINS[DEFAULT_SKIN];
  const color = skin.palette[colorIndex] || SKINS[DEFAULT_SKIN].palette[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;

  context.save();
  context.globalAlpha = alpha ?? 1;

  if (skin.glow) {
    context.shadowBlur = size * 0.5;
    context.shadowColor = color;
  }

  context.fillStyle = color;
  if (skin.rounded) {
    const r = Math.min(6, s / 4);
    context.beginPath();
    if (context.roundRect) context.roundRect(px, py, s, s, r);
    else context.rect(px, py, s, s);
    context.fill();
  } else {
    context.fillRect(px, py, s, s);
  }

  // Texture/highlight overlays should not inherit the glow blur.
  context.shadowBlur = 0;

  if (skin.texture) drawPixelTexture(context, px, py, s);

  // highlight
  context.fillStyle = skin.highlight;
  if (skin.rounded) {
    const r = Math.min(6, s / 4);
    context.beginPath();
    if (context.roundRect) context.roundRect(px, py, s, 4, [r, r, 0, 0]);
    else context.rect(px, py, s, 4);
    context.fill();
  } else {
    context.fillRect(px, py, s, 4);
  }

  context.restore();
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

  resetClearHighscoresBtn();
  highscoresSectionEl.classList.remove('hidden');
  renderHighscoreStats(highscoreStatsEl);
  renderHighscores(highscoresBodyEl, null);

  if (qualifiesForHighscore(score)) {
    highscoreNameInput.value = '';
    highscoreEntryEl.classList.remove('hidden');
    setTimeout(() => highscoreNameInput.focus(), 0);
  } else {
    highscoreEntryEl.classList.add('hidden');
  }

  overlay.classList.remove('hidden');

  const stats = loadStats();
  stats.bestCombo = Math.max(stats.bestCombo, maxCombo);
  stats.bestLines = Math.max(stats.bestLines, maxLinesInClear);
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  bestStats = stats;
  updateHUD();

  resetClearHighscoresBtn();
  highscoresSectionEl.classList.remove('hidden');
  renderHighscoreStats(highscoreStatsEl);
  renderHighscores(highscoresBodyEl, null);

  if (qualifiesForHighscore(score)) {
    highscoreNameInput.value = '';
    highscoreEntryEl.classList.remove('hidden');
    setTimeout(() => highscoreNameInput.focus(), 0);
  } else {
    highscoreEntryEl.classList.add('hidden');
  }
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
  if (!startScreen.classList.contains('hidden')) return;
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
  combo = 0;
  maxCombo = 0;
  maxLinesInClear = 0;
  bestStats = loadStats();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  highscoresSectionEl.classList.add('hidden');
  highscoreEntryEl.classList.add('hidden');
  resetClearHighscoresBtn();
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
  if (e.target && e.target.tagName === 'INPUT') return;
  if (!startScreen.classList.contains('hidden')) return;
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

playBtn.addEventListener('click', () => {
  hideStartScreen();
  init();
});

showStartScreen();
