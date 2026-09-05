import { useEffect, useRef } from "react";
import {
  Animation,
  ArcRotateCamera,
  Color3,
  Color4,
  CubicEase,
  DirectionalLight,
  EasingFunction,
  Engine,
  HemisphericLight,
  Matrix,
  Mesh,
  MeshBuilder,
  Quaternion,
  RawTexture,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  VertexBuffer,
} from "@babylonjs/core";
import { FACES, N, type Face, type OutDir } from "@/lib/cube/orient.ts";
import { TEAL } from "@/lib/cube/palette.ts";
import { faceStartGrid, paintBoard } from "@/lib/cube/pieces.ts";
import { type Axis, type Cubie } from "@/lib/cube/state.ts";
import { useCube } from "@/lib/cube/store.ts";
import {
  makeFaceView,
  visualColMove,
  visualColTurns,
  visualRowMove,
  visualRowTurns,
  type Vec3,
} from "@/lib/cube/view.ts";

const HALF = 3.5;
const SIZE = 0.985;
const FACE_PX = 1024;
const FACE_NORMAL: Record<Face, [number, number, number]> = {
  F: [0, 0, 1],
  B: [0, 0, -1],
  U: [0, 1, 0],
  D: [0, -1, 0],
  R: [1, 0, 0],
  L: [-1, 0, 0],
};

const _x = new Vector3();
const _y = new Vector3();
const _z = new Vector3();
const _m = new Matrix();
const _right = new Vector3();
const _up = new Vector3();
const CAM_RIGHT = new Vector3(1, 0, 0);
const CAM_UP = new Vector3(0, 1, 0);

function setVec(out: Vector3, d: OutDir) {
  const s = d[0] === "+" ? 1 : -1;
  if (d[1] === "x") out.set(s, 0, 0);
  else if (d[1] === "y") out.set(0, s, 0);
  else out.set(0, 0, s);
  return out;
}

function cellPos(c: Cubie, out = new Vector3()) {
  return out.set(c.x - HALF, c.y - HALF, c.z - HALF);
}

function cubieQuat(c: Cubie) {
  Matrix.FromXYZAxesToRef(setVec(_x, c.ax), setVec(_y, c.ay), setVec(_z, c.az), _m);
  return Quaternion.FromRotationMatrix(_m);
}

function hexToColor4(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return new Color4(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1);
}

function applyCellUv(mesh: Mesh, u: number, v: number) {
  const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
  if (!uvs) return;
  const u0 = u / N;
  const u1 = (u + 1) / N;
  const v0 = v / N;
  const v1 = (v + 1) / N;
  for (let i = 0; i < uvs.length; i += 2) {
    uvs[i] = u0 + uvs[i]! * (u1 - u0);
    uvs[i + 1] = v0 + uvs[i + 1]! * (v1 - v0);
  }
  mesh.setVerticesData(VertexBuffer.UVKind, uvs, true);
}

export type CubeHandle = {
  turn: (axis: Axis, layer: number, turns: number) => void;
  reset: () => void;
};

type CubeProbe = CubeHandle & {
  facing: () => Face;
  busy: () => boolean;
  rowTurn: (rowFromTop: number, dir: 1 | -1) => void;
  colTurn: (colFromLeft: number, dir: 1 | -1) => void;
};

declare global {
  interface Window {
    __cube?: CubeProbe;
  }
}

export function CubeScene({
  onView,
  onReady,
}: {
  onView: (face: Face, right: Vec3, up: Vec3) => void;
  onReady: (h: CubeHandle) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onViewRef = useRef(onView);
  const onReadyRef = useRef(onReady);
  onViewRef.current = onView;
  onReadyRef.current = onReady;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: false,
      powerPreference: "high-performance",
      adaptToDeviceRatio: true,
    });
    const scene = new Scene(engine);
    scene.clearColor = hexToColor4(TEAL);
    scene.skipPointerMovePicking = true;
    scene.autoClear = true;

    const camera = new ArcRotateCamera(
      "cam",
      Math.PI / 2 + 0.42,
      Math.PI / 2 - 0.38,
      18,
      Vector3.Zero(),
      scene,
    );
    camera.lowerBetaLimit = 0.4;
    camera.upperBetaLimit = Math.PI - 0.4;
    camera.lowerRadiusLimit = 13;
    camera.upperRadiusLimit = 28;
    camera.wheelPrecision = 60;
    camera.pinchPrecision = 90;
    camera.panningSensibility = 0;
    camera.inertia = 0.78;
    camera.fov = 0.72;
    camera.minZ = 0.5;
    camera.maxZ = 120;
    camera.allowUpsideDown = false;
    camera.attachControl(canvas, true);

    let framed = false;
    const frameCube = () => {
      engine.resize();
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      const aspect = w / h;
      const vFov = camera.fov;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
      const fit = 7.2;
      const byV = fit / Math.tan(vFov / 2);
      const byH = fit / Math.tan(hFov / 2);
      const r = Math.max(14, Math.max(byV, byH) * 1.08);
      camera.lowerRadiusLimit = Math.max(13, r * 0.82);
      camera.upperRadiusLimit = r * 1.65;
      if (!framed) {
        camera.radius = r;
        framed = true;
      } else if (camera.radius < camera.lowerRadiusLimit!) {
        camera.radius = camera.lowerRadiusLimit!;
      }
    };

    const hemi = new HemisphericLight("h", new Vector3(0.2, 1, 0.35), scene);
    hemi.intensity = 0.72;
    hemi.groundColor = new Color3(0.45, 0.55, 0.6);
    const sun = new DirectionalLight("s", new Vector3(-0.55, -0.7, -0.4), scene);
    sun.intensity = 0.9;

    const nodes = new Map<number, TransformNode>();
    let cubies = useCube.getState().cubies;
    let busy = false;
    let lastFace: Face = "F";
    let lastRight: Vec3 = [1, 0, 0];
    let lastUp: Vec3 = [0, 1, 0];

    const localPose: Record<OutDir, { p: Vector3; rx: number; ry: number; rz: number }> = {
      "+z": { p: new Vector3(0, 0, SIZE / 2 + 0.003), rx: 0, ry: 0, rz: 0 },
      "-z": { p: new Vector3(0, 0, -SIZE / 2 - 0.003), rx: 0, ry: Math.PI, rz: 0 },
      "+x": { p: new Vector3(SIZE / 2 + 0.003, 0, 0), rx: 0, ry: Math.PI / 2, rz: 0 },
      "-x": { p: new Vector3(-SIZE / 2 - 0.003, 0, 0), rx: 0, ry: -Math.PI / 2, rz: 0 },
      "+y": { p: new Vector3(0, SIZE / 2 + 0.003, 0), rx: -Math.PI / 2, ry: 0, rz: 0 },
      "-y": { p: new Vector3(0, -SIZE / 2 - 0.003, 0), rx: Math.PI / 2, ry: 0, rz: 0 },
    };

    const faceMat = {} as Record<Face, StandardMaterial>;
    for (const face of FACES) {
      const paper = document.createElement("canvas");
      paper.width = FACE_PX;
      paper.height = FACE_PX;
      const pctx = paper.getContext("2d", { willReadFrequently: true })!;
      pctx.clearRect(0, 0, FACE_PX, FACE_PX);
      paintBoard(pctx, faceStartGrid(face), FACE_PX);
      const img = pctx.getImageData(0, 0, FACE_PX, FACE_PX);
      const bytes = new Uint8Array(img.data);
      const tex = RawTexture.CreateRGBATexture(
        bytes,
        FACE_PX,
        FACE_PX,
        scene,
        true,
        true,
        Texture.TRILINEAR_SAMPLINGMODE,
      );
      tex.hasAlpha = false;
      tex.wrapU = Texture.CLAMP_ADDRESSMODE;
      tex.wrapV = Texture.CLAMP_ADDRESSMODE;
      tex.anisotropicFilteringLevel = 8;
      const m = new StandardMaterial(`mat-${face}`, scene);
      m.diffuseTexture = tex;
      m.emissiveTexture = tex;
      m.emissiveColor = new Color3(0.5, 0.5, 0.5);
      m.diffuseColor = Color3.White();
      m.specularColor = new Color3(0.18, 0.18, 0.16);
      m.specularPower = 64;
      m.backFaceCulling = true;
      m.twoSidedLighting = false;
      faceMat[face] = m;
    }

    const posScratch = new Vector3();
    function snapNode(c: Cubie) {
      const n = nodes.get(c.id);
      if (!n) return;
      n.unfreezeWorldMatrix();
      n.position.copyFrom(cellPos(c, posScratch));
      n.rotationQuaternion = cubieQuat(c);
      n.freezeWorldMatrix();
    }

    const coreMat = new StandardMaterial("core", scene);
    coreMat.diffuseColor = new Color3(0.07, 0.09, 0.09);
    coreMat.specularColor = Color3.Black();
    coreMat.emissiveColor = new Color3(0.02, 0.025, 0.025);
    coreMat.freeze();

    for (const c of cubies) {
      const node = new TransformNode(`c${c.id}`, scene);
      node.position = cellPos(c);
      node.rotationQuaternion = cubieQuat(c);
      for (const [local, st] of Object.entries(c.stickers) as [
        OutDir,
        NonNullable<Cubie["stickers"][OutDir]>,
      ][]) {
        const pose = localPose[local]!;
        const plane = MeshBuilder.CreatePlane(
          `${c.id}${local}`,
          { size: SIZE, sideOrientation: Mesh.FRONTSIDE },
          scene,
        );
        plane.position.copyFrom(pose.p);
        plane.rotation.set(pose.rx, pose.ry, pose.rz);
        plane.parent = node;
        plane.isPickable = false;
        plane.material = faceMat[st.home];
        applyCellUv(plane, st.u, st.v);
        plane.doNotSyncBoundingInfo = true;
      }
      const core = MeshBuilder.CreateBox(`b${c.id}`, { size: SIZE * 0.9 }, scene);
      core.material = coreMat;
      core.parent = node;
      core.isPickable = false;
      core.doNotSyncBoundingInfo = true;
      node.freezeWorldMatrix();
      nodes.set(c.id, node);
    }

    scene.blockMaterialDirtyMechanism = false;

    const ease = new CubicEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

    function applyTurn(axis: Axis, layer: number, turns: number) {
      if (busy || !turns) return;
      let t = ((turns % 4) + 4) % 4;
      if (t === 0) return;
      const signed = turns < 0 || t === 3 ? (t === 3 ? -1 : t) : t;
      const angle = (signed * Math.PI) / 2;
      busy = true;
      useCube.getState().setBusy(true);

      const pivot = new TransformNode("pivot", scene);
      pivot.rotation.set(0, 0, 0);
      const moving: TransformNode[] = [];
      for (const c of cubies) {
        if (c[axis] !== layer) continue;
        const n = nodes.get(c.id);
        if (!n) continue;
        n.unfreezeWorldMatrix();
        n.setParent(pivot);
        moving.push(n);
      }

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(failSafe);
        for (const n of moving) n.setParent(null);
        pivot.dispose();
        useCube.getState().turn(axis, layer, turns);
        cubies = useCube.getState().cubies;
        for (const c of cubies) snapNode(c);
        busy = false;
        useCube.getState().setBusy(false);
      };

      const prop = axis === "x" ? "rotation.x" : axis === "y" ? "rotation.y" : "rotation.z";
      const anim = Animation.CreateAndStartAnimation(
        "spin",
        pivot,
        prop,
        60,
        22,
        0,
        angle,
        Animation.ANIMATIONLOOPMODE_CONSTANT,
        ease,
        finish,
      );
      const failSafe = window.setTimeout(finish, 900);
      if (!anim) finish();
    }

    function reset() {
      if (busy) return;
      useCube.getState().reset();
      cubies = useCube.getState().cubies;
      for (const c of cubies) snapNode(c);
    }

    const handle: CubeProbe = {
      turn: applyTurn,
      reset,
      facing: () => lastFace,
      busy: () => busy,
      rowTurn: (rowFromTop, dir) => {
        const view = makeFaceView(lastFace, lastRight, lastUp);
        const { axis, layer } = visualRowMove(view, rowFromTop);
        applyTurn(axis, layer, visualRowTurns(view, rowFromTop, dir, lastRight));
      },
      colTurn: (colFromLeft, dir) => {
        const view = makeFaceView(lastFace, lastRight, lastUp);
        const { axis, layer } = visualColMove(view, colFromLeft);
        applyTurn(axis, layer, visualColTurns(view, colFromLeft, dir, lastUp));
      },
    };
    window.__cube = handle;
    onReadyRef.current(handle);

    scene.onBeforeRenderObservable.add(() => {
      const p = camera.position;
      let best: Face = "F";
      let score = -2;
      (Object.keys(FACE_NORMAL) as Face[]).forEach((f) => {
        const n = FACE_NORMAL[f]!;
        const d = p.x * n[0] + p.y * n[1] + p.z * n[2];
        if (d > score) {
          score = d;
          best = f;
        }
      });
      camera.getDirectionToRef(CAM_RIGHT, _right);
      camera.getDirectionToRef(CAM_UP, _up);
      lastFace = best;
      lastRight = [_right.x, _right.y, _right.z];
      lastUp = [_up.x, _up.y, _up.z];
      onViewRef.current(best, lastRight, lastUp);
    });

    const onResize = () => frameCube();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(() => frameCube());
    ro.observe(canvas);
    engine.setHardwareScalingLevel(1);
    engine.runRenderLoop(() => scene.render());
    frameCube();

    return () => {
      if (window.__cube === handle) delete window.__cube;
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="cube-canvas"
      style={{ touchAction: "none" }}
    />
  );
}
