import { create } from "zustand";
import type { Face } from "./orient.ts";
import {
  initialCubies,
  rotateSlice,
  type Axis,
  type Cubie,
} from "./state.ts";
import { FRONT_CAM_RIGHT, FRONT_CAM_UP, viewKey, type Vec3 } from "./view.ts";

type CubeStore = {
  cubies: Cubie[];
  facing: Face;
  camRight: Vec3;
  camUp: Vec3;
  viewKey: string;
  busy: boolean;
  setView: (face: Face, right: Vec3, up: Vec3) => void;
  setBusy: (b: boolean) => void;
  turn: (axis: Axis, layer: number, turns: number) => void;
  reset: () => void;
};

export const useCube = create<CubeStore>((set, get) => ({
  cubies: initialCubies(),
  facing: "F",
  camRight: FRONT_CAM_RIGHT,
  camUp: FRONT_CAM_UP,
  viewKey: viewKey("F", FRONT_CAM_RIGHT, FRONT_CAM_UP),
  busy: false,
  setView: (facing, camRight, camUp) => {
    const key = viewKey(facing, camRight, camUp);
    if (get().viewKey === key) return;
    set({ facing, camRight, camUp, viewKey: key });
  },
  setBusy: (busy) => set({ busy }),
  turn: (axis, layer, turns) => {
    set({ cubies: rotateSlice(get().cubies, axis, layer, turns) });
  },
  reset: () => set({ cubies: initialCubies(), busy: false }),
}));
