import type { Face } from "./orient.ts";

/** Equal-tone complementary pairs (primary ↔ secondary). Hex for canvas/WebGL. */
export const FACE_COLORS: Record<Face, [string, string]> = {
  F: ["#e57262", "#2fb57a"],
  B: ["#2fb57a", "#e57262"],
  R: ["#4f90e0", "#e09038"],
  L: ["#e09038", "#4f90e0"],
  U: ["#d0b430", "#c45ec8"],
  D: ["#c45ec8", "#d0b430"],
};

export const FACE_NAME: Record<Face, string> = {
  F: "Front · red / green",
  B: "Back · green / red",
  R: "Right · blue / orange",
  L: "Left · orange / blue",
  U: "Up · yellow / purple",
  D: "Down · purple / yellow",
};

export const TEAL = "#cfeee6";
export const INK = "#1a2a28";
