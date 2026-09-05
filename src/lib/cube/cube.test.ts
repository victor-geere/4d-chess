import { test } from "node:test";
import assert from "node:assert/strict";
import {
  edgesArePerpendicular,
  FACE_FRAME,
  FACE_OUT,
  FACES,
  N,
  chessDirOn,
  cubeEdges,
  isNS,
  outDirVec,
} from "./orient.ts";
import { initialCubies, rotateSlice, faceGrid, faceLayout } from "./state.ts";
import { startingPiece } from "./chess.ts";
import {
  FRONT_CAM_RIGHT,
  FRONT_CAM_UP,
  makeFaceView,
  stickerRot,
  uvAt,
  visualColMove,
  visualColTurns,
  visualRowMove,
  visualRowTurns,
  type Vec3,
} from "./view.ts";

function cross(a: Vec3, b: Vec3): Vec3 {
  // `+ 0` folds -0 into 0 so deepEqual (which uses Object.is) compares cleanly.
  return [
    a[1] * b[2] - a[2] * b[1] + 0,
    a[2] * b[0] - a[0] * b[2] + 0,
    a[0] * b[1] - a[1] * b[0] + 0,
  ];
}

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
    for (const row of g) for (const s of row) if (s?.piece?.t === "R" && s.piece.c === "w") rooks++;
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
  c = rotateSlice(c, axis, layer, visualRowTurns(view, 7, 1));
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
  c = rotateSlice(c, axis, layer, visualColTurns(view, 0, 1));
  const g = faceGrid(c, "F");
  for (let v = 0; v < N; v++) {
    assert.equal(g[v]![0]!.home, "D", `v=${v}`);
  }
});

test("every face frame is right-handed: u × v points out of the cube", () => {
  for (const f of FACES) {
    const u = outDirVec(FACE_FRAME[f].u);
    const v = outDirVec(FACE_FRAME[f].v);
    assert.deepEqual(cross(u, v), outDirVec(FACE_OUT[f]), f);
  }
});

test("a fresh cube shows every sticker upright on its own face", () => {
  const cubies = initialCubies();
  for (const f of FACES) {
    const { turns } = faceLayout(cubies, f);
    for (const row of turns) for (const t of row) assert.equal(t, 0, f);
  }
});

test("stickers carry their rotation with them around a column turn", () => {
  // Turn the x=0 column so Front → Up → Back → Down (-1 about +x).
  const c = rotateSlice(initialCubies(), "x", 0, -1);
  const up = faceLayout(c, "U");
  const back = faceLayout(c, "B");
  for (let v = 0; v < N; v++) {
    // Front stickers arrive on Up still upright...
    assert.equal(up.grid[v]![0]!.home, "F");
    assert.equal(up.turns[v]![0], 0);
    // ...while Up stickers go over the top edge and land on Back upside down.
    assert.equal(back.grid[v]![N - 1]!.home, "U");
    assert.equal(back.turns[v]![N - 1], 2);
  }
});

test("a z turn lands Right stickers on Up rotated a quarter turn anticlockwise", () => {
  const c = rotateSlice(initialCubies(), "z", N - 1, 1);
  const up = faceLayout(c, "U");
  for (let u = 0; u < N; u++) {
    assert.equal(up.grid[0]![u]!.home, "R", `u=${u}`);
    assert.equal(up.turns[0]![u], 3, `u=${u}`);
  }
});

test("facing Right: right arrow on the bottom row pulls Front on", () => {
  // Looking at +x with +y up, screen right is -z.
  const view = makeFaceView("R", [0, 0, -1], [0, 1, 0]);
  assert.equal(stickerRot(view), 0);
  assert.deepEqual(uvAt(view, 0, 0), { u: 0, v: 7 });
  const { axis, layer } = visualRowMove(view, 7);
  const c = rotateSlice(initialCubies(), axis, layer, visualRowTurns(view, 7, 1));
  const g = faceGrid(c, "R");
  for (let u = 0; u < N; u++) assert.equal(g[0]![u]!.home, "F", `u=${u}`);
});

test("facing Up from the front: up arrow slides a column toward Back, Front comes on", () => {
  // Camera above the cube on the +z side: screen right +x, screen up -z.
  const view = makeFaceView("U", [1, 0, 0], [0, 0, -1]);
  assert.equal(stickerRot(view), 0);
  const { axis, layer } = visualColMove(view, 2);
  assert.equal(axis, "x");
  assert.equal(layer, 2);
  const c = rotateSlice(initialCubies(), axis, layer, visualColTurns(view, 2, 1));
  const g = faceGrid(c, "U");
  for (let v = 0; v < N; v++) assert.equal(g[v]![2]!.home, "F", `v=${v}`);
});

test("facing Up from the right: the face is a quarter turn and rows become x-layers", () => {
  // Camera above the cube on the +x side: screen right -z, screen up -x.
  const view = makeFaceView("U", [0, 0, -1], [-1, 0, 0]);
  assert.equal(Math.abs(stickerRot(view)), Math.PI / 2);
  // Screen up is -x (toward Left) and screen left is +z (toward Front), so the
  // top-left of the gizmo is the corner nearest Left and Front: u=0, v=0.
  assert.deepEqual(uvAt(view, 0, 0), { u: 0, v: 0 });
  assert.deepEqual(uvAt(view, 7, 7), { u: 7, v: 7 });
  const { axis } = visualRowMove(view, 0);
  assert.equal(axis, "x");
  // Sliding the top row right (toward -z = Back) pulls Front on.
  const m = visualRowMove(view, 0);
  const c = rotateSlice(initialCubies(), m.axis, m.layer, visualRowTurns(view, 0, 1));
  const layout = faceLayout(c, "U");
  for (let col = 0; col < N; col++) {
    const { u, v } = uvAt(view, col, 0);
    assert.equal(layout.grid[v]![u]!.home, "F", `col=${col}`);
  }
});
