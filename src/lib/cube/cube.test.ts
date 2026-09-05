import { test } from "node:test";
import assert from "node:assert/strict";
import { edgesArePerpendicular, FACES, N, chessDirOn, cubeEdges, isNS } from "./orient.ts";
import { initialCubies, rotateSlice, faceGrid } from "./state.ts";
import { startingPiece } from "./chess.ts";
import {
  FRONT_CAM_RIGHT,
  FRONT_CAM_UP,
  makeFaceView,
  uvAt,
  visualColMove,
  visualColTurns,
  visualRowMove,
  visualRowTurns,
} from "./view.ts";

test("every cube edge is N/S meeting E/W", () => {
  assert.equal(edgesArePerpendicular(), true);
  for (const e of cubeEdges()) {
    const ca = chessDirOn(e.a, e.da);
    const cb = chessDirOn(e.b, e.db);
    assert.equal(isNS(ca), !isNS(cb), `${e.a}${ca}-${e.b}${cb}`);
  }
});

test("initial cube has 6×64 stickers and 32 pieces per face", () => {
  const cubies = initialCubies();
  let stickers = 0;
  for (const c of cubies) stickers += Object.keys(c.stickers).length;
  assert.equal(stickers, 6 * 64);
  for (const f of FACES) {
    const g = faceGrid(cubies, f);
    let filled = 0;
    let pieces = 0;
    for (let v = 0; v < N; v++)
      for (let u = 0; u < N; u++) {
        if (g[v]![u]) filled++;
        if (g[v]![u]?.piece) pieces++;
      }
    assert.equal(filled, 64, f);
    assert.equal(pieces, 32, f);
  }
});

test("four 90° turns restore the cube", () => {
  let c = initialCubies();
  const snap = (cs: typeof c) =>
    cs
      .map((x) => `${x.id}:${x.x}${x.y}${x.z}:${x.ax}${x.ay}${x.az}`)
      .sort()
      .join("|");
  const a = snap(c);
  for (let i = 0; i < 4; i++) c = rotateSlice(c, "y", 3, 1);
  assert.equal(snap(c), a);
});

test("white back rank exists on every face", () => {
  const cubies = initialCubies();
  for (const f of FACES) {
    const g = faceGrid(cubies, f);
    let rooks = 0;
    for (const row of g)
      for (const s of row) if (s?.piece?.t === "R" && s.piece.c === "w") rooks++;
    assert.equal(rooks, 2, f);
    assert.ok(startingPiece(0, 0)?.t === "R");
  }
});

test("front-on view: gizmo top-left is physical u=0 v=7", () => {
  const view = makeFaceView("F", FRONT_CAM_RIGHT, FRONT_CAM_UP);
  assert.deepEqual(uvAt(view, 0, 0), { u: 0, v: 7 });
  assert.deepEqual(uvAt(view, 7, 7), { u: 7, v: 0 });
});

test("right arrow slides the front bottom row right (left face comes on)", () => {
  const view = makeFaceView("F", FRONT_CAM_RIGHT, FRONT_CAM_UP);
  const { axis, layer } = visualRowMove(view, 7);
  assert.equal(axis, "y");
  assert.equal(layer, 0);
  let c = initialCubies();
  c = rotateSlice(c, axis, layer, visualRowTurns(view, 7, 1, FRONT_CAM_RIGHT));
  const g = faceGrid(c, "F");
  for (let u = 0; u < N; u++) {
    assert.equal(g[0]![u]!.home, "L", `u=${u}`);
  }
});

test("up arrow slides the front left column up (down face comes on)", () => {
  const view = makeFaceView("F", FRONT_CAM_RIGHT, FRONT_CAM_UP);
  const { axis, layer } = visualColMove(view, 0);
  assert.equal(axis, "x");
  assert.equal(layer, 0);
  let c = initialCubies();
  c = rotateSlice(c, axis, layer, visualColTurns(view, 0, 1, FRONT_CAM_UP));
  const g = faceGrid(c, "F");
  for (let v = 0; v < N; v++) {
    assert.equal(g[v]![0]!.home, "D", `v=${v}`);
  }
});
