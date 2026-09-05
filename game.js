/* 4D Chess — game logic + UI.
 * Pure logic lives in the top section (exported, DOM-free). The UI bootstrap
 * at the bottom only runs in a browser. The module also works under Node for
 * tests (`node --test tests/`).
 */

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export const SIZE = 4;
export const CELLS = SIZE ** 4; // 256
export const AXES = ['x', 'y', 'z', 'w'];

export const idx = (x, y, z, w) => x + 4 * y + 16 * z + 64 * w;
export const coords = (i) => [i & 3, (i >> 2) & 3, (i >> 4) & 3, (i >> 6) & 3];
export const inBounds = (c) => c.every((v) => v >= 0 && v < SIZE);
export const cellName = (i) => {
  const [x, y, z, w] = coords(i);
  return `x${x}y${y}z${z}w${w}`;
};
export const parseCell = (name) => {
  const m = /^x(\d)y(\d)z(\d)w(\d)$/.exec(name);
  if (!m) throw new Error(`Bad cell name: ${name}`);
  return idx(+m[1], +m[2], +m[3], +m[4]);
};

function buildDirections() {
  const all = [];
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++)
        for (let w = -1; w <= 1; w++) {
          const v = [x, y, z, w];
          const k = v.filter((c) => c !== 0).length;
          if (k > 0) all.push(v);
        }
  return all;
}

/** All 80 non-zero vectors in {-1,0,1}^4. */
export const DIRS = buildDirections();
export const nonZeroCount = (v) => v.filter((c) => c !== 0).length;
/** DIRS_BY_K[k] = vectors with exactly k non-zero components. */
export const DIRS_BY_K = { 1: [], 2: [], 3: [], 4: [] };
for (const v of DIRS) DIRS_BY_K[nonZeroCount(v)].push(v);

function buildKnightJumps() {
  const out = [];
  for (let a = 0; a < 4; a++)
    for (let b = 0; b < 4; b++) {
      if (a === b) continue;
      for (const sa of [-2, 2])
        for (const sb of [-1, 1]) {
          const v = [0, 0, 0, 0];
          v[a] = sa;
          v[b] = sb;
          out.push(v);
        }
    }
  return out;
}

/** 48 knight jump vectors: one component ±2, one other ±1. */
export const KNIGHT_JUMPS = buildKnightJumps();

export const SLIDE_DIRS = {
  R: DIRS_BY_K[1],
  B: DIRS_BY_K[2],
  Q: DIRS,
};

const add = (c, v) => [c[0] + v[0], c[1] + v[1], c[2] + v[2], c[3] + v[3]];
const toIdx = (c) => idx(c[0], c[1], c[2], c[3]);

// ---------------------------------------------------------------------------
// Pieces / board / state
// ---------------------------------------------------------------------------

export const WHITE = 'w';
export const BLACK = 'b';
export const opponent = (c) => (c === WHITE ? BLACK : WHITE);
export const piece = (t, c) => ({ t, c });

export const PIECE_NAMES = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn' };
export const PIECE_VALUES = { K: 0, Q: 9, R: 5, B: 3, N: 3, P: 1 };

export function emptyBoard() {
  return new Array(CELLS).fill(null);
}

/** Starting position. White on w=0, Black mirrored on w=3 (same x,y,z). */
export function initialBoard() {
  const b = emptyBoard();
  const backRanks = { 0: ['R', 'N', 'K', 'B'], 1: ['B', 'Q', 'N', 'R'] };
  for (const [c, w] of [[WHITE, 0], [BLACK, 3]]) {
    for (const z of [0, 1]) {
      backRanks[z].forEach((t, x) => { b[idx(x, 0, z, w)] = piece(t, c); });
      for (let x = 0; x < 4; x++) b[idx(x, 1, z, w)] = piece('P', c);
    }
  }
  return b;
}

export function makeState(board, turn = WHITE) {
  return { board, turn, history: [], captured: { w: [], b: [] } };
}

export function initialState() {
  return makeState(initialBoard(), WHITE);
}

export function findKing(board, color) {
  for (let i = 0; i < CELLS; i++) {
    const p = board[i];
    if (p && p.t === 'K' && p.c === color) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Move generation
// ---------------------------------------------------------------------------

const pawnForward = (color) => (color === WHITE ? 1 : -1);
const promotionRank = (color) => (color === WHITE ? SIZE - 1 : 0);

/** Pseudo-legal moves for the piece at `from` (ignores check). */
export function pseudoMoves(board, from) {
  const p = board[from];
  if (!p) return [];
  const c = coords(from);
  const moves = [];
  const push = (to, extra = {}) => {
    const target = board[to];
    moves.push({ from, to, piece: p, captured: target || null, ...extra });
  };

  if (p.t === 'P') {
    const f = pawnForward(p.c);
    const fwd = add(c, [0, 0, 0, f]);
    if (inBounds(fwd)) {
      const promo = fwd[3] === promotionRank(p.c) ? 'Q' : null;
      const to = toIdx(fwd);
      if (!board[to]) push(to, { promo });
      for (let a = 0; a < 3; a++) {
        for (const s of [-1, 1]) {
          const v = [0, 0, 0, f];
          v[a] = s;
          const t = add(c, v);
          if (!inBounds(t)) continue;
          const ti = toIdx(t);
          const q = board[ti];
          if (q && q.c !== p.c) push(ti, { promo });
        }
      }
    }
    return moves;
  }

  if (p.t === 'N') {
    for (const v of KNIGHT_JUMPS) {
      const t = add(c, v);
      if (!inBounds(t)) continue;
      const ti = toIdx(t);
      const q = board[ti];
      if (!q || q.c !== p.c) push(ti);
    }
    return moves;
  }

  if (p.t === 'K') {
    for (const v of DIRS) {
      const t = add(c, v);
      if (!inBounds(t)) continue;
      const ti = toIdx(t);
      const q = board[ti];
      if (!q || q.c !== p.c) push(ti);
    }
    return moves;
  }

  // Sliders
  for (const v of SLIDE_DIRS[p.t]) {
    let t = add(c, v);
    while (inBounds(t)) {
      const ti = toIdx(t);
      const q = board[ti];
      if (!q) push(ti);
      else {
        if (q.c !== p.c) push(ti);
        break;
      }
      t = add(t, v);
    }
  }
  return moves;
}

/** Is `cell` attacked by any piece of colour `by`? */
export function isAttacked(board, cell, by) {
  const c = coords(cell);
  // Sliding pieces and adjacent king along the 80 rays.
  for (const v of DIRS) {
    const k = nonZeroCount(v);
    let t = add(c, v);
    let dist = 1;
    while (inBounds(t)) {
      const q = board[toIdx(t)];
      if (q) {
        if (q.c === by) {
          if (q.t === 'Q') return true;
          if (q.t === 'R' && k === 1) return true;
          if (q.t === 'B' && k === 2) return true;
          if (q.t === 'K' && dist === 1) return true;
        }
        break;
      }
      t = add(t, v);
      dist++;
    }
  }
  // Knights
  for (const v of KNIGHT_JUMPS) {
    const t = add(c, v);
    if (!inBounds(t)) continue;
    const q = board[toIdx(t)];
    if (q && q.c === by && q.t === 'N') return true;
  }
  // Pawns: an enemy pawn at cell - (side, forward) attacks this cell.
  const f = pawnForward(by);
  for (let a = 0; a < 3; a++) {
    for (const s of [-1, 1]) {
      const v = [0, 0, 0, -f];
      v[a] = s;
      const t = add(c, v);
      if (!inBounds(t)) continue;
      const q = board[toIdx(t)];
      if (q && q.c === by && q.t === 'P') return true;
    }
  }
  return false;
}

export function inCheck(boardOrState, color) {
  const board = Array.isArray(boardOrState) ? boardOrState : boardOrState.board;
  const k = findKing(board, color);
  if (k < 0) return false;
  return isAttacked(board, k, opponent(color));
}

/** Apply a move to a board, returning a new board. */
export function boardAfter(board, move) {
  const b = board.slice();
  const p = b[move.from];
  b[move.from] = null;
  b[move.to] = move.promo ? piece(move.promo, p.c) : p;
  return b;
}

/** Legal moves for the piece at `cell` (never leaves own king in check). */
export function legalMoves(state, cell) {
  const board = Array.isArray(state) ? state : state.board;
  const p = board[cell];
  if (!p) return [];
  return pseudoMoves(board, cell).filter((m) => !inCheck(boardAfter(board, m), p.c));
}

/** All legal moves for `color` (defaults to side to move). */
export function allLegalMoves(state, color = state.turn) {
  const board = Array.isArray(state) ? state : state.board;
  const out = [];
  for (let i = 0; i < CELLS; i++) {
    const p = board[i];
    if (p && p.c === color) out.push(...legalMoves(board, i));
  }
  return out;
}

/** Status of the side to move. */
export function gameStatus(state) {
  const { board, turn } = state;
  const wk = findKing(board, WHITE);
  const bk = findKing(board, BLACK);
  if (wk < 0 || bk < 0) {
    const winner = wk < 0 ? BLACK : WHITE;
    return { over: true, winner, check: false, checkmate: false, stalemate: false, kingCaptured: true };
  }
  const check = inCheck(board, turn);
  const hasMoves = allLegalMoves(state, turn).length > 0;
  const checkmate = check && !hasMoves;
  const stalemate = !check && !hasMoves;
  return {
    over: checkmate || stalemate,
    winner: checkmate ? opponent(turn) : null,
    check,
    checkmate,
    stalemate,
    kingCaptured: false,
  };
}

export function moveNotation(move, suffix = '') {
  let s = `${move.piece.t}${cellName(move.from)}→${cellName(move.to)}`;
  if (move.captured) s += `×${move.captured.t}`;
  if (move.promo) s += `=${move.promo}`;
  return s + suffix;
}

/** Apply a move to a state, returning a new state (with history + status). */
export function applyMove(state, move) {
  const board = boardAfter(state.board, move);
  const turn = opponent(state.turn);
  const next = {
    board,
    turn,
    history: state.history.slice(),
    captured: { w: state.captured.w.slice(), b: state.captured.b.slice() },
  };
  if (move.captured) next.captured[move.piece.c].push(move.captured);
  const status = gameStatus(next);
  const suffix = status.checkmate ? '#' : status.check ? '+' : '';
  next.history.push({ move, notation: moveNotation(move, suffix), by: move.piece.c });
  next.status = status;
  return next;
}

export const Chess4D = {
  SIZE, CELLS, AXES, DIRS, DIRS_BY_K, KNIGHT_JUMPS, SLIDE_DIRS,
  idx, coords, cellName, parseCell, inBounds,
  emptyBoard, initialBoard, initialState, makeState, piece, findKing,
  pseudoMoves, legalMoves, allLegalMoves, isAttacked, inCheck,
  boardAfter, applyMove, gameStatus, moveNotation,
};

// ---------------------------------------------------------------------------
// UI (browser only)
// ---------------------------------------------------------------------------

const GLYPHS = {
  w: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
  b: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' },
};

function bootstrap() {
  window.Chess4D = Chess4D;

  const $ = (id) => document.getElementById(id);
  const boardEl = $('board');
  const turnEl = $('turn');
  const statusEl = $('status');
  const capWEl = $('captured-w');
  const capBEl = $('captured-b');
  const movesEl = $('moves');
  const undoBtn = $('undo');
  const newBtn = $('new-game');

  let stack = [initialState()];
  let selected = -1;
  let targets = new Map(); // to -> move
  const cellEls = new Array(CELLS);

  const current = () => stack[stack.length - 1];

  // Build DOM once. Outer grid: columns = z, rows = w (w=3 on top so White
  // advances up the page). Inner: columns = x, rows = y.
  function build() {
    boardEl.innerHTML = '';
    for (let w = SIZE - 1; w >= 0; w--) {
      for (let z = 0; z < SIZE; z++) {
        const bd = document.createElement('div');
        bd.className = 'mini-board';
        bd.dataset.z = z;
        bd.dataset.w = w;
        const label = document.createElement('div');
        label.className = 'board-label';
        label.textContent = `z${z} w${w}`;
        bd.appendChild(label);
        const grid = document.createElement('div');
        grid.className = 'grid';
        for (let y = 0; y < SIZE; y++) {
          for (let x = 0; x < SIZE; x++) {
            const i = idx(x, y, z, w);
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'cell ' + ((x + y + z + w) % 2 === 0 ? 'light' : 'dark');
            cell.dataset.i = i;
            cell.title = cellName(i);
            const span = document.createElement('span');
            span.className = 'piece';
            cell.appendChild(span);
            grid.appendChild(cell);
            cellEls[i] = cell;
          }
        }
        bd.appendChild(grid);
        boardEl.appendChild(bd);
      }
    }
  }

  function render() {
    const st = current();
    const status = st.status || gameStatus(st);
    st.status = status;
    const last = st.history[st.history.length - 1];
    const kingInCheck = status.check ? findKing(st.board, st.turn) : -1;

    for (let i = 0; i < CELLS; i++) {
      const el = cellEls[i];
      const p = st.board[i];
      const span = el.firstChild;
      if (p) {
        span.textContent = GLYPHS[p.c][p.t];
        span.className = `piece ${p.c === WHITE ? 'white' : 'black'}`;
        el.setAttribute('aria-label', `${p.c === WHITE ? 'White' : 'Black'} ${PIECE_NAMES[p.t]} at ${cellName(i)}`);
      } else {
        span.textContent = '';
        span.className = 'piece';
        el.setAttribute('aria-label', `Empty ${cellName(i)}`);
      }
      el.classList.toggle('selected', i === selected);
      const t = targets.get(i);
      el.classList.toggle('target', !!t && !t.captured);
      el.classList.toggle('capture', !!t && !!t.captured);
      el.classList.toggle('last-from', !!last && last.move.from === i);
      el.classList.toggle('last-to', !!last && last.move.to === i);
      el.classList.toggle('in-check', i === kingInCheck);
    }

    const turnName = st.turn === WHITE ? 'White' : 'Black';
    turnEl.textContent = status.over ? 'Game over' : `${turnName} to move`;
    turnEl.dataset.turn = st.turn;

    let msg = '';
    if (status.kingCaptured) msg = `King captured — ${status.winner === WHITE ? 'White' : 'Black'} wins!`;
    else if (status.checkmate) msg = `Checkmate! ${status.winner === WHITE ? 'White' : 'Black'} wins.`;
    else if (status.stalemate) msg = 'Stalemate — draw.';
    else if (status.check) msg = 'Check!';
    statusEl.textContent = msg;
    statusEl.className = 'status' + (status.over ? ' over' : status.check ? ' check' : '');

    const renderCaptured = (el, list, color) => {
      el.innerHTML = '';
      const sorted = list.slice().sort((a, b) => PIECE_VALUES[b.t] - PIECE_VALUES[a.t]);
      for (const p of sorted) {
        const s = document.createElement('span');
        s.className = `piece ${color === WHITE ? 'white' : 'black'}`;
        s.textContent = GLYPHS[color][p.t];
        el.appendChild(s);
      }
      if (!sorted.length) el.textContent = '—';
    };
    renderCaptured(capWEl, st.captured.w, BLACK); // pieces White has taken (black glyphs)
    renderCaptured(capBEl, st.captured.b, WHITE);

    movesEl.innerHTML = '';
    st.history.forEach((h, n) => {
      const li = document.createElement('li');
      li.className = h.by;
      li.textContent = `${n + 1}. ${h.by === WHITE ? 'W' : 'B'} ${h.notation}`;
      movesEl.appendChild(li);
    });
    movesEl.scrollTop = movesEl.scrollHeight;

    undoBtn.disabled = stack.length <= 1;
  }

  function select(i) {
    const st = current();
    selected = i;
    targets = new Map();
    if (i >= 0) for (const m of legalMoves(st, i)) targets.set(m.to, m);
  }

  function onCellClick(i) {
    const st = current();
    if (st.status && st.status.over) return;
    const p = st.board[i];
    if (targets.has(i)) {
      const move = targets.get(i);
      stack.push(applyMove(st, move));
      select(-1);
      render();
      return;
    }
    if (p && p.c === st.turn && i !== selected) select(i);
    else select(-1);
    render();
  }

  boardEl.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    onCellClick(+cell.dataset.i);
  });

  undoBtn.addEventListener('click', () => {
    if (stack.length > 1) stack.pop();
    select(-1);
    render();
  });

  newBtn.addEventListener('click', () => {
    stack = [initialState()];
    select(-1);
    render();
  });

  build();
  render();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
  else bootstrap();
}
