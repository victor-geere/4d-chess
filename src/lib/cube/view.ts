import { FACE_FRAME, FACE_OUT, FACES, N, outDirVec, type Face, faceUvToCubie } from "./orient.ts";
import type { Axis } from "./state.ts";

export type Vec3 = [number, number, number];

function frameVecs(pick: "u" | "v"): Record<Face, Vec3> {
  const out = {} as Record<Face, Vec3>;
  for (const f of FACES) out[f] = outDirVec(FACE_FRAME[f][pick]);
  return out;
}

/** Face-local u axis in world (u increases). */
export const FACE_U: Record<Face, Vec3> = frameVecs("u");

/** Face-local v axis in world (v increases). */
export const FACE_V: Record<Face, Vec3> = frameVecs("v");

export type FaceView = {
  face: Face;
  /** u = au * col + bu * row + cu  (gizmo col 0 = left, row 0 = top) */
  au: number;
  bu: number;
  cu: number;
  av: number;
  bv: number;
  cv: number;
};

function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function axisVec(axis: Axis): Vec3 {
  return axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1];
}

function faceAxis(face: Face): Axis {
  return FACE_OUT[face][1] as Axis;
}

/**
 * Map the camera-facing face so gizmo left/right/up match the 3D view.
 * Every face frame is right-handed (u × v points out of the cube), and so is
 * the camera's (right × up points at the viewer), so seen from outside the
 * face is always a pure rotation of the gizmo — never a mirror image.
 */
export function makeFaceView(face: Face, camRight: Vec3, camUp: Vec3): FaceView {
  const uDir = FACE_U[face];
  const vDir = FACE_V[face];
  const uR = dot(uDir, camRight);
  const vR = dot(vDir, camRight);
  const uUp = dot(uDir, camUp);
  const vUp = dot(vDir, camUp);

  if (Math.abs(uR) >= Math.abs(vR)) {
    const au = uR >= 0 ? 1 : -1;
    const cu = uR >= 0 ? 0 : N - 1;
    const bv = vUp >= 0 ? -1 : 1;
    const cv = vUp >= 0 ? N - 1 : 0;
    return { face, au, bu: 0, cu, av: 0, bv, cv };
  }
  const av = vR >= 0 ? 1 : -1;
  const cv = vR >= 0 ? 0 : N - 1;
  const bu = uUp >= 0 ? -1 : 1;
  const cu = uUp >= 0 ? N - 1 : 0;
  return { face, au: 0, bu, cu, av, bv: 0, cv };
}

export function uvAt(view: FaceView, col: number, row: number) {
  return {
    u: view.au * col + view.bu * row + view.cu,
    v: view.av * col + view.bv * row + view.cv,
  };
}

/** Stable identity of a view; the gizmo only needs to re-render when this changes. */
export function faceViewKey(view: FaceView) {
  return `${view.face}:${view.au}${view.bu}${view.cu}:${view.av}${view.bv}${view.cv}`;
}

/** World direction that gizmo columns increase in, i.e. screen right. */
export function screenRightOf(view: FaceView): Vec3 {
  const u = FACE_U[view.face];
  const v = FACE_V[view.face];
  return [
    view.au * u[0] + view.av * v[0],
    view.au * u[1] + view.av * v[1],
    view.au * u[2] + view.av * v[2],
  ];
}

/** World direction that gizmo rows decrease in, i.e. screen up. */
export function screenUpOf(view: FaceView): Vec3 {
  const u = FACE_U[view.face];
  const v = FACE_V[view.face];
  return [
    -(view.bu * u[0] + view.bv * v[0]),
    -(view.bu * u[1] + view.bv * v[1]),
    -(view.bu * u[2] + view.bv * v[2]),
  ];
}

/** Canvas radians (CW positive) so physical v+ of a sticker points gizmo-up. */
export function stickerRot(view: FaceView) {
  if (view.bv === -1) return 0;
  if (view.bv === 1) return Math.PI;
  if (view.av === 1) return Math.PI / 2;
  if (view.av === -1) return -Math.PI / 2;
  return 0;
}

function sliceBetween(
  face: Face,
  a: { u: number; v: number },
  b: { u: number; v: number },
): { axis: Axis; layer: number } {
  const pa = faceUvToCubie(face, a.u, a.v);
  const pb = faceUvToCubie(face, b.u, b.v);
  const skip = faceAxis(face);
  for (const k of ["x", "y", "z"] as Axis[]) {
    if (k === skip) continue;
    if (pa[k] === pb[k]) return { axis: k, layer: pa[k] };
  }
  return { axis: "y", layer: pa.y };
}

export function visualRowMove(view: FaceView, rowFromTop: number) {
  return sliceBetween(view.face, uvAt(view, 0, rowFromTop), uvAt(view, N - 1, rowFromTop));
}

export function visualColMove(view: FaceView, colFromLeft: number) {
  return sliceBetween(view.face, uvAt(view, colFromLeft, 0), uvAt(view, colFromLeft, N - 1));
}

function plusMovesToward(axis: Axis, face: Face, uv: { u: number; v: number }, toward: Vec3) {
  const p = faceUvToCubie(face, uv.u, uv.v);
  const c: Vec3 = [p.x - (N - 1) / 2, p.y - (N - 1) / 2, p.z - (N - 1) / 2];
  const motion = cross(axisVec(axis), c);
  return dot(motion, toward) > 0;
}

/** Signed quarter turns so the tiles on a gizmo row slide right (dir +1) or left (-1). */
export function visualRowTurns(view: FaceView, rowFromTop: number, dir: 1 | -1) {
  const { axis } = visualRowMove(view, rowFromTop);
  const plusRight = plusMovesToward(
    axis,
    view.face,
    uvAt(view, 3, rowFromTop),
    screenRightOf(view),
  );
  return (plusRight ? dir : -dir) as number;
}

/** Signed quarter turns so the tiles on a gizmo column slide up (dir +1) or down (-1). */
export function visualColTurns(view: FaceView, colFromLeft: number, dir: 1 | -1) {
  const { axis } = visualColMove(view, colFromLeft);
  const plusUp = plusMovesToward(axis, view.face, uvAt(view, colFromLeft, 3), screenUpOf(view));
  return (plusUp ? dir : -dir) as number;
}

export const FRONT_CAM_RIGHT: Vec3 = [1, 0, 0];
export const FRONT_CAM_UP: Vec3 = [0, 1, 0];
