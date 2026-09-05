import { create } from "zustand";
import type { Face } from "./orient.ts";
import { initialCubies, rotateSlice, type Axis, type Cubie } from "./state.ts";
import {
  FRONT_CAM_RIGHT,
  FRONT_CAM_UP,
  faceViewKey,
  makeFaceView,
  type FaceView,
  type Vec3,
} from "./view.ts";

type CubeStore = {
  cubies: Cubie[];
  /** The face nearest the camera and how it sits on screen. */
  view: FaceView;
  busy: boolean;
  setView: (face: Face, camRight: Vec3, camUp: Vec3) => void;
  setBusy: (b: boolean) => void;
  turn: (axis: Axis, layer: number, turns: number) => void;
  reset: () => void;
};

export const useCube = create<CubeStore>((set, get) => ({
  cubies: initialCubies(),
  view: makeFaceView("F", FRONT_CAM_RIGHT, FRONT_CAM_UP),
  busy: false,
  setView: (face, camRight, camUp) => {
    const view = makeFaceView(face, camRight, camUp);
    if (faceViewKey(get().view) === faceViewKey(view)) return;
    set({ view });
  },
  setBusy: (busy) => set({ busy }),
  turn: (axis, layer, turns) => {
    set({ cubies: rotateSlice(get().cubies, axis, layer, turns) });
  },
  reset: () => set({ cubies: initialCubies(), busy: false }),
}));
