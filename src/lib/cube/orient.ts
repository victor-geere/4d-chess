/** Cube-face compass so every physical edge is N/S meeting E/W (never NN/SS/EE/WW/NS/EW). */

export const N = 8;
export const FACES = ["F", "B", "U", "D", "L", "R"] as const;
export type Face = (typeof FACES)[number];
export const DIRS = ["N", "E", "S", "W"] as const;
export type Dir = (typeof DIRS)[number];

/** Default neighbor of a face in a physical compass dir (chess North = physical up, r=0). */
export const NEIGHBOR: Record<Face, Record<Dir, Face>> = {
  F: { N: "U", E: "R", S: "D", W: "L" },
  B: { N: "U", E: "L", S: "D", W: "R" },
  U: { N: "B", E: "R", S: "F", W: "L" },
  D: { N: "F", E: "R", S: "B", W: "L" },
  L: { N: "U", E: "F", S: "D", W: "B" },
  R: { N: "U", E: "B", S: "D", W: "F" },
};

/** 90° CW steps of the chessboard on each face. Baked from brute-force search. */
export const FACE_ROT: Record<Face, 0 | 1 | 2 | 3> = {
  F: 1,
  B: 1,
  U: 0,
  D: 0,
  L: 0,
  R: 0,
};

export function rotDir(d: Dir, k: number): Dir {
  return DIRS[((DIRS.indexOf(d) + k) % 4 + 4) % 4]!;
}

/** Chess compass sitting on a physical edge after FACE_ROT. */
export function chessDirOn(face: Face, physical: Dir): Dir {
  return rotDir(physical, -FACE_ROT[face]);
}

export function isNS(d: Dir) {
  return d === "N" || d === "S";
}

export function cubeEdges(): { a: Face; da: Dir; b: Face; db: Dir }[] {
  const out: { a: Face; da: Dir; b: Face; db: Dir }[] = [];
  const seen = new Set<string>();
  for (const a of FACES) {
    for (const da of DIRS) {
      const b = NEIGHBOR[a][da];
      const key = a < b ? `${a}${b}` : `${b}${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const db = DIRS.find((d) => NEIGHBOR[b][d] === a)!;
      out.push({ a, da, b, db });
    }
  }
  return out;
}

export function edgesArePerpendicular() {
  return cubeEdges().every(({ a, da, b, db }) => {
    const ca = chessDirOn(a, da);
    const cb = chessDirOn(b, db);
    return isNS(ca) !== isNS(cb);
  });
}

/**
 * Physical (u east, v north) on a face → chess (file, rank).
 * Inverse of r× 90° CW of the board on the face.
 */
export function physToChess(face: Face, u: number, v: number): { file: number; rank: number } {
  let x = u;
  let y = v;
  const r = FACE_ROT[face];
  for (let i = 0; i < r; i++) {
    const nx = N - 1 - y;
    const ny = x;
    x = nx;
    y = ny;
  }
  return { file: x, rank: y };
}

/** Map face-local (u, v) onto cubie (x,y,z). */
export function faceUvToCubie(
  face: Face,
  u: number,
  v: number,
): { x: number; y: number; z: number } {
  switch (face) {
    case "F":
      return { x: u, y: v, z: N - 1 };
    case "B":
      return { x: N - 1 - u, y: v, z: 0 };
    case "R":
      return { x: N - 1, y: v, z: N - 1 - u };
    case "L":
      return { x: 0, y: v, z: u };
    case "U":
      return { x: u, y: N - 1, z: N - 1 - v };
    case "D":
      return { x: u, y: 0, z: v };
  }
}

export type OutDir = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

export const FACE_OUT: Record<Face, OutDir> = {
  F: "+z",
  B: "-z",
  U: "+y",
  D: "-y",
  R: "+x",
  L: "-x",
};

export const OUT_FACE: Record<OutDir, Face> = {
  "+z": "F",
  "-z": "B",
  "+y": "U",
  "-y": "D",
  "+x": "R",
  "-x": "L",
};
