import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CELLS, DIRS, KNIGHT_JUMPS, idx, coords, cellName, parseCell,
  emptyBoard, initialState, makeState, piece,
  pseudoMoves, legalMoves, allLegalMoves, inCheck, applyMove, gameStatus,
} from '../game.js';

const count = (board, pred) => board.filter((p) => p && pred(p)).length;

test('geometry: 80 directions, 48 knight jumps, index roundtrip', () => {
  assert.equal(DIRS.length, 80);
  assert.equal(KNIGHT_JUMPS.length, 48);
  for (let i = 0; i < CELLS; i++) assert.equal(idx(...coords(i)), i);
  assert.equal(parseCell(cellName(idx(1, 2, 3, 0))), idx(1, 2, 3, 0));
});

test('initial position: 16 pieces per side with correct composition', () => {
  const { board } = initialState();
  for (const c of ['w', 'b']) {
    assert.equal(count(board, (p) => p.c === c), 16);
    const want = { K: 1, Q: 1, R: 2, B: 2, N: 2, P: 8 };
    for (const [t, n] of Object.entries(want)) {
      assert.equal(count(board, (p) => p.c === c && p.t === t), n, `${c} ${t}`);
    }
  }
  // White on w=0, Black on w=3, boards z=2,3 empty.
  assert.equal(count(board, (p) => p.c === 'w' && coords(board.indexOf(p))[3] === 0), 16);
  for (let i = 0; i < CELLS; i++) {
    const [, , z, w] = coords(i);
    if (board[i]) {
      assert.ok(z <= 1, 'pieces only on z=0,1');
      assert.equal(w, board[i].c === 'w' ? 0 : 3);
    }
  }
});

function lone(t, c = 'w', at = idx(1, 1, 1, 1)) {
  const b = emptyBoard();
  b[at] = piece(t, c);
  return { b, at };
}

test('rook from (1,1,1,1) on empty board has 12 moves', () => {
  const { b, at } = lone('R');
  assert.equal(pseudoMoves(b, at).length, 12);
});

test('bishop from (1,1,1,1) on empty board has 30 moves', () => {
  const { b, at } = lone('B');
  assert.equal(pseudoMoves(b, at).length, 30);
});

test('queen from (1,1,1,1) equals union of all slide directions', () => {
  const { b, at } = lone('Q');
  const moves = pseudoMoves(b, at);
  // 1 step in every direction with any negative component, up to 2 in all-positive ones.
  let expected = 0;
  for (const v of DIRS) expected += v.some((c) => c < 0) ? 1 : 2;
  assert.equal(moves.length, expected);
  assert.ok(moves.length > 80);
});

test('king from (1,1,1,1) on empty board has 80 moves; from corner 15', () => {
  const { b, at } = lone('K');
  assert.equal(pseudoMoves(b, at).length, 80);
  const c = lone('K', 'w', idx(0, 0, 0, 0));
  assert.equal(pseudoMoves(c.b, c.at).length, 15);
});

test('knight from (1,1,1,1) has 24 moves; from (2,2,2,2) has 24; from centre-ish all unique', () => {
  const { b, at } = lone('N');
  const moves = pseudoMoves(b, at);
  assert.equal(moves.length, 24);
  assert.equal(new Set(moves.map((m) => m.to)).size, moves.length);
  const c = lone('N', 'w', idx(2, 2, 2, 2));
  assert.equal(pseudoMoves(c.b, c.at).length, 24);
});

test('sliding stops at first piece: capture enemy, blocked by friendly', () => {
  const b = emptyBoard();
  const r = idx(0, 0, 0, 0);
  b[r] = piece('R', 'w');
  b[idx(2, 0, 0, 0)] = piece('P', 'b'); // enemy at distance 2 on x
  b[idx(0, 1, 0, 0)] = piece('P', 'w'); // friendly adjacent on y
  const moves = pseudoMoves(b, r);
  const tos = new Set(moves.map((m) => m.to));
  assert.ok(tos.has(idx(1, 0, 0, 0)));
  assert.ok(tos.has(idx(2, 0, 0, 0)));
  assert.ok(!tos.has(idx(3, 0, 0, 0)), 'cannot pass through enemy');
  assert.ok(!tos.has(idx(0, 1, 0, 0)), 'blocked by friendly');
  assert.ok(!tos.has(idx(0, 2, 0, 0)));
  assert.equal(moves.length, 2 + 3 + 3); // x: 2, z: 3, w: 3
});

test('pawn: single step forward, captures forward+side only, promotion', () => {
  const b = emptyBoard();
  const p = idx(1, 1, 1, 1);
  b[p] = piece('P', 'w');
  b[idx(2, 1, 1, 2)] = piece('N', 'b'); // capturable (x+1, w+1)
  b[idx(1, 1, 1, 2)] = null;
  b[idx(2, 1, 1, 1)] = piece('N', 'b'); // sideways: not capturable
  b[idx(2, 2, 1, 2)] = piece('N', 'b'); // two side axes: not capturable
  b[idx(1, 2, 1, 2)] = piece('N', 'w'); // friendly: not capturable
  const moves = pseudoMoves(b, p);
  const tos = new Set(moves.map((m) => m.to));
  assert.equal(moves.length, 2);
  assert.ok(tos.has(idx(1, 1, 1, 2)), 'forward');
  assert.ok(tos.has(idx(2, 1, 1, 2)), 'diagonal capture');
  assert.ok(!tos.has(idx(1, 1, 1, 3)), 'no double step');

  // Blocked forward.
  b[idx(1, 1, 1, 2)] = piece('P', 'b');
  assert.equal(pseudoMoves(b, p).filter((m) => !m.captured).length, 0);

  // Black moves -w.
  const bb = emptyBoard();
  bb[idx(0, 0, 0, 2)] = piece('P', 'b');
  const bm = pseudoMoves(bb, idx(0, 0, 0, 2));
  assert.equal(bm.length, 1);
  assert.equal(bm[0].to, idx(0, 0, 0, 1));

  // Promotion.
  const pb = emptyBoard();
  pb[idx(0, 0, 0, 2)] = piece('P', 'w');
  pb[idx(3, 3, 3, 3)] = piece('K', 'w');
  pb[idx(3, 3, 3, 0)] = piece('K', 'b');
  const st = makeState(pb, 'w');
  const m = legalMoves(st, idx(0, 0, 0, 2))[0];
  assert.equal(m.promo, 'Q');
  const next = applyMove(st, m);
  assert.deepEqual(next.board[idx(0, 0, 0, 3)], { t: 'Q', c: 'w' });
  assert.equal(next.turn, 'b');
  assert.match(next.history[0].notation, /^Px0y0z0w2→x0y0z0w3=Q/);
});

test('check filtering: pinned piece cannot move, king cannot step into attack', () => {
  const b = emptyBoard();
  b[idx(0, 0, 0, 0)] = piece('K', 'w');
  b[idx(1, 0, 0, 0)] = piece('R', 'w'); // pinned along x by black rook
  b[idx(3, 0, 0, 0)] = piece('R', 'b');
  b[idx(3, 3, 3, 3)] = piece('K', 'b');
  const st = makeState(b, 'w');
  assert.equal(inCheck(b, 'w'), false);
  const rookMoves = legalMoves(st, idx(1, 0, 0, 0));
  assert.ok(rookMoves.every((m) => coords(m.to)[1] === 0 && coords(m.to)[2] === 0 && coords(m.to)[3] === 0),
    'pinned rook may only move along the pin line');
  assert.ok(rookMoves.some((m) => m.to === idx(3, 0, 0, 0)), 'may capture the pinner');
  const kingMoves = legalMoves(st, idx(0, 0, 0, 0));
  // Rook at (3,0,0,0) is blocked by the white rook, so (0,1,0,0) is fine, but
  // put a black rook on the y-axis to test stepping into attack.
  b[idx(0, 3, 0, 0)] = piece('R', 'b');
  const km2 = legalMoves(makeState(b, 'w'), idx(0, 0, 0, 0));
  assert.ok(kingMoves.length > km2.length);
  assert.ok(km2.every((m) => m.to !== idx(0, 1, 0, 0) && m.to !== idx(0, 2, 0, 0)));

  // In check: only moves that resolve it are legal.
  b[idx(1, 0, 0, 0)] = null; // now rook on x attacks the king
  const st3 = makeState(b, 'w');
  assert.equal(inCheck(st3, 'w'), true);
  assert.equal(gameStatus(st3).check, true);
  for (const m of allLegalMoves(st3)) {
    const after = st3.board.slice();
    after[m.from] = null; after[m.to] = m.piece;
    assert.equal(inCheck(after, 'w'), false);
  }
});

test('checkmate detection on a constructed position', () => {
  const b = emptyBoard();
  b[idx(0, 0, 0, 0)] = piece('K', 'b');
  b[idx(1, 1, 1, 1)] = piece('Q', 'w'); // attacks king and every escape cell
  b[idx(2, 2, 2, 2)] = piece('Q', 'w'); // defends the first queen
  b[idx(3, 0, 0, 3)] = piece('K', 'w');
  const st = makeState(b, 'b');
  const s = gameStatus(st);
  assert.equal(s.check, true);
  assert.equal(allLegalMoves(st).length, 0);
  assert.equal(s.checkmate, true);
  assert.equal(s.stalemate, false);
  assert.equal(s.over, true);
  assert.equal(s.winner, 'w');
});

test('stalemate detection on a constructed position', () => {
  const b = emptyBoard();
  b[idx(0, 0, 0, 0)] = piece('K', 'b');
  b[idx(1, 1, 1, 1)] = piece('B', 'w'); // covers the 6 two-axis neighbours; defended by queen
  b[idx(2, 2, 2, 2)] = piece('Q', 'w');
  for (const c of [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]) b[idx(...c)] = piece('P', 'b');
  // Knights covering the four three-axis neighbours.
  b[idx(3, 1, 1, 1)] = piece('N', 'w'); // -> (1,1,1,0)
  b[idx(3, 1, 0, 0)] = piece('N', 'w'); // -> (1,1,0,1)
  b[idx(3, 0, 1, 0)] = piece('N', 'w'); // -> (1,0,1,1)
  b[idx(0, 3, 1, 0)] = piece('N', 'w'); // -> (0,1,1,1)
  b[idx(3, 3, 3, 3)] = piece('K', 'w');
  const st = makeState(b, 'b');
  const s = gameStatus(st);
  assert.equal(s.check, false, 'not in check');
  assert.deepEqual(allLegalMoves(st).map((m) => `${cellName(m.from)}>${cellName(m.to)}`), []);
  assert.equal(s.stalemate, true);
  assert.equal(s.over, true);
});

test('applyMove: turn flips, capture recorded, notation, king-capture fallback', () => {
  const st = initialState();
  const moves = allLegalMoves(st);
  assert.ok(moves.length > 0);
  const pawnMove = moves.find((m) => m.piece.t === 'P');
  const next = applyMove(st, pawnMove);
  assert.equal(next.turn, 'b');
  assert.equal(next.history.length, 1);
  assert.equal(st.history.length, 0, 'original state untouched');
  assert.match(next.history[0].notation, /^Px\dy\dz\dw0→x\dy\dz\dw1$/);

  // Capture tracking.
  const b = emptyBoard();
  b[idx(0, 0, 0, 0)] = piece('R', 'w');
  b[idx(0, 0, 0, 2)] = piece('N', 'b');
  b[idx(3, 3, 3, 3)] = piece('K', 'w');
  b[idx(3, 3, 3, 0)] = piece('K', 'b');
  const s2 = makeState(b, 'w');
  const cap = legalMoves(s2, idx(0, 0, 0, 0)).find((m) => m.captured);
  const n2 = applyMove(s2, cap);
  assert.equal(n2.captured.w.length, 1);
  assert.equal(n2.captured.w[0].t, 'N');
  assert.equal(n2.history[0].notation, 'Rx0y0z0w0→x0y0z0w2×N');

  // Missing king -> game over.
  const b3 = emptyBoard();
  b3[idx(0, 0, 0, 0)] = piece('K', 'w');
  const s3 = gameStatus(makeState(b3, 'b'));
  assert.equal(s3.over, true);
  assert.equal(s3.kingCaptured, true);
  assert.equal(s3.winner, 'w');
});
