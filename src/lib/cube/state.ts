import {
  FACE_FRAME,
  FACE_OUT,
  FACES,
  N,
  OUT_FACE,
  negDir,
  type Face,
  type OutDir,
  faceUvToCubie,
} from "./orient.ts";
import { stickerAt, type Sticker } from "./chess.ts";

export type Axis = "x" | "y" | "z";

export type Cubie = {
  id: number;
  x: number;
  y: number;
  z: number;
  /** Where local +x / +y / +z currently point in the world. */
  ax: OutDir;
  ay: OutDir;
  az: OutDir;
  /** Stickers keyed by *local* face, set at start and never remapped. */
  stickers: Partial<Record<OutDir, Sticker>>;
};

export function initialCubies(): Cubie[] {
  const map = new Map<string, Cubie>();
  let id = 0;
  const get = (x: number, y: number, z: number) => {
    const k = `${x},${y},${z}`;
    let c = map.get(k);
    if (!c) {
      c = {
        id: id++,
        x,
        y,
        z,
        ax: "+x",
        ay: "+y",
        az: "+z",
        stickers: {},
      };
      map.set(k, c);
    }
    return c;
  };

  for (const face of FACES) {
    for (let u = 0; u < N; u++) {
      for (let v = 0; v < N; v++) {
        const p = faceUvToCubie(face, u, v);
        const c = get(p.x, p.y, p.z);
        c.stickers[FACE_OUT[face]] = stickerAt(face, u, v);
      }
    }
  }
  return [...map.values()];
}

const X_CYCLE: OutDir[] = ["+y", "+z", "-y", "-z"];
const Y_CYCLE: OutDir[] = ["+z", "+x", "-z", "-x"];
const Z_CYCLE: OutDir[] = ["+x", "+y", "-x", "-y"];

function cycleDir(d: OutDir, cycle: OutDir[], turns: number): OutDir {
  const i = cycle.indexOf(d);
  if (i < 0) return d;
  const t = ((turns % 4) + 4) % 4;
  return cycle[(i + t) % 4]!;
}

function cycleAll(c: Cubie, cycle: OutDir[], turns: number): Pick<Cubie, "ax" | "ay" | "az"> {
  return {
    ax: cycleDir(c.ax, cycle, turns),
    ay: cycleDir(c.ay, cycle, turns),
    az: cycleDir(c.az, cycle, turns),
  };
}

/** +1 = 90° right-hand about +axis. */
export function rotateSlice(cubies: Cubie[], axis: Axis, layer: number, turns: number): Cubie[] {
  const t = ((turns % 4) + 4) % 4;
  if (t === 0) return cubies;
  const cycle = axis === "x" ? X_CYCLE : axis === "y" ? Y_CYCLE : Z_CYCLE;
  return cubies.map((c) => {
    if (c[axis] !== layer) return c;
    let { x, y, z } = c;
    for (let i = 0; i < t; i++) {
      if (axis === "x") {
        const ny = N - 1 - z;
        const nz = y;
        y = ny;
        z = nz;
      } else if (axis === "y") {
        const nx = z;
        const nz = N - 1 - x;
        x = nx;
        z = nz;
      } else {
        const nx = N - 1 - y;
        const ny = x;
        x = nx;
        y = ny;
      }
    }
    return { ...c, x, y, z, ...cycleAll(c, cycle, t) };
  });
}

export function worldDir(c: Cubie, local: OutDir): OutDir {
  const neg = local[0] === "-";
  const axis = local[1] as "x" | "y" | "z";
  const w = axis === "x" ? c.ax : axis === "y" ? c.ay : c.az;
  if (!neg) return w;
  return (w[0] === "+" ? `-${w[1]}` : `+${w[1]}`) as OutDir;
}

/** Local side of the cubie that currently points in `world`, if it carries a sticker. */
export function sideFacing(c: Cubie, world: OutDir): OutDir | undefined {
  for (const loc of Object.keys(c.stickers) as OutDir[]) {
    if (worldDir(c, loc) === world) return loc;
  }
  return undefined;
}

export function stickerFacing(c: Cubie, world: OutDir): Sticker | undefined {
  const loc = sideFacing(c, world);
  return loc === undefined ? undefined : c.stickers[loc];
}

export type QuarterTurn = 0 | 1 | 2 | 3;

/**
 * How far the sticker on local side `local` of cubie `c` is rotated, in
 * clockwise quarter turns seen from outside, relative to the frame of the
 * face it currently shows on. The 3D texture is painted upright in the
 * sticker's own (u, v) frame, so this is exactly how it looks on the cube.
 */
export function stickerTurn(c: Cubie, local: OutDir, face: Face): QuarterTurn {
  const stickerU = worldDir(c, FACE_FRAME[OUT_FACE[local]].u);
  const { u, v } = FACE_FRAME[face];
  if (stickerU === u) return 0;
  if (stickerU === negDir(v)) return 1;
  if (stickerU === negDir(u)) return 2;
  return 3;
}

export function cubieToUv(face: Face, x: number, y: number, z: number) {
  switch (face) {
    case "F":
      return { u: x, v: y };
    case "B":
      return { u: N - 1 - x, v: y };
    case "R":
      return { u: N - 1 - z, v: y };
    case "L":
      return { u: z, v: y };
    case "U":
      return { u: x, v: N - 1 - z };
    case "D":
      return { u: x, v: z };
  }
}

export type FaceLayout = {
  /** grid[v][u]: sticker showing at face-local (u, v). */
  grid: (Sticker | null)[][];
  /** turns[v][u]: how that sticker is rotated on the cube (see stickerTurn). */
  turns: QuarterTurn[][];
};

/** What a face looks like right now: which sticker is where and how it is turned. */
export function faceLayout(cubies: Cubie[], face: Face): FaceLayout {
  const grid: (Sticker | null)[][] = Array.from({ length: N }, () =>
    Array<Sticker | null>(N).fill(null),
  );
  const turns: QuarterTurn[][] = Array.from({ length: N }, () => Array<QuarterTurn>(N).fill(0));
  const out = FACE_OUT[face];
  for (const c of cubies) {
    if (c[faceAxisOf(face)] !== faceLayerOf(face)) continue;
    const loc = sideFacing(c, out);
    if (loc === undefined) continue;
    const { u, v } = cubieToUv(face, c.x, c.y, c.z);
    if (u < 0 || u >= N || v < 0 || v >= N) continue;
    grid[v]![u] = c.stickers[loc]!;
    turns[v]![u] = stickerTurn(c, loc, face);
  }
  return { grid, turns };
}

function faceAxisOf(face: Face): Axis {
  return FACE_OUT[face][1] as Axis;
}

function faceLayerOf(face: Face): number {
  return FACE_OUT[face][0] === "+" ? N - 1 : 0;
}

export function faceGrid(cubies: Cubie[], face: Face): (Sticker | null)[][] {
  return faceLayout(cubies, face).grid;
}

export function rowMove(face: Face, rowFromTop: number): { axis: Axis; layer: number } {
  const v = N - 1 - rowFromTop;
  switch (face) {
    case "F":
    case "B":
    case "L":
    case "R":
      return { axis: "y", layer: v };
    case "U":
      return { axis: "z", layer: N - 1 - v };
    case "D":
      return { axis: "z", layer: v };
  }
}

export function colMove(face: Face, colFromLeft: number): { axis: Axis; layer: number } {
  const u = colFromLeft;
  switch (face) {
    case "F":
      return { axis: "x", layer: u };
    case "B":
      return { axis: "x", layer: N - 1 - u };
    case "R":
      return { axis: "z", layer: N - 1 - u };
    case "L":
      return { axis: "z", layer: u };
    case "U":
    case "D":
      return { axis: "x", layer: u };
  }
}

/** +1 (right/up on the gizmo) pulls that neighbor onto the face. */
export function rowTurns(face: Face, sign: 1 | -1): number {
  if (face === "B" || face === "U") return sign;
  return -sign;
}

export function colTurns(face: Face, sign: 1 | -1): number {
  if (face === "F" || face === "R" || face === "D") return sign;
  return -sign;
}
