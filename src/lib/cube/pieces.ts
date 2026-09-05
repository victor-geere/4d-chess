import { FACE_ROT, N } from "./orient.ts";
import { FACE_COLORS } from "./palette.ts";
import { stickerAt, squareIsLight, type Piece, type PieceType, type Sticker } from "./chess.ts";
import { stickerRot, uvAt, type FaceView } from "./view.ts";

const PATHS: Record<PieceType, string[]> = {
  P: [
    "M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z",
  ],
  R: [
    "M9 39h27v-3H9v3zM12.5 32V18.5h4V25h4v-6.5h4V25h4v-6.5h4V32h-20zM12 14.5V9h4v2h4V9h5v2h4V9h4v5.5H12z",
  ],
  N: [
    "M9 36c3.38-.63 10.11-.74 13.5-3.5 3.39 2.76 10.12 2.87 13.5 3.5 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.38-.87-10.11-.76-13.5 1.5-3.39-2.26-10.12-2.37-13.5-1.5-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2z",
    "M15 32c2.5-1.5 7.5-1.5 7.5-1.5s5 0 7.5 2l-2.5-10.5-2-1s2-4 0-6.5-6-2-6-2 2-2.5 0-4.5-6 0.5-6 0.5-2-1.5-3 0-0.5 4 0.5 4l-1.5 1.5s-3 2.5-1.5 7.5 6 5.5 6 5.5l2.5-3s-.5 3.5 1.5 3.5 1-3.5 1-3.5l2 0z",
  ],
  B: [
    "M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.86-10.11.54-13.5-1-3.39 1.54-10.11.14-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2z",
    "M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z",
  ],
  Q: [
    "M12.8 13.2a1.85 1.85 0 1 0 0.01 0zM17.6 10.2a1.85 1.85 0 1 0 0.01 0zM22.5 8.6a1.95 1.95 0 1 0 0.01 0zM27.4 10.2a1.85 1.85 0 1 0 0.01 0zM32.2 13.2a1.85 1.85 0 1 0 0.01 0z",
    "M13 16.2 17.2 13.4 22.5 11.8 27.8 13.4 32 16.2 27.2 18.4 22.5 17.2 17.8 18.4z",
    "M14.2 37.8h16.6v-2.4H14.2v2.4z",
    "M15.2 35.4c0-2.2 2.4-4.6 3-6.6.5-1.6.2-3-.4-3.8h9.4c-.6.8-.9 2.2-.4 3.8.6 2 3 4.4 3 6.6H15.2z",
    "M14.6 24.6c2.4-1.1 13.4-1.1 15.8 0v2.4c-2.4 1.1-13.4 1.1-15.8 0v-2.4z",
  ],
  K: [
    "M22.5 11.63V6M20 8h5",
    "M22.5 25s4.5-7.5 4.5-10.5c0-3-1.5-4.5-4.5-4.5s-4.5 1.5-4.5 4.5c0 3 4.5 10.5 4.5 10.5",
    "M12.5 37c5.5-2.5 14.5-2.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z",
  ],
};

function hexRgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function appearanceKey(sticker: Sticker) {
  const light = squareIsLight(sticker.file, sticker.rank) ? "l" : "d";
  return `${sticker.home}:${light}:${sticker.piece?.t ?? ""}:${sticker.piece?.c ?? ""}`;
}

export function drawSticker(
  ctx: CanvasRenderingContext2D,
  sticker: Sticker,
  size: number,
  glass = false,
) {
  const [a, b] = FACE_COLORS[sticker.home];
  const light = squareIsLight(sticker.file, sticker.rank);
  const fill = light ? a : b;
  if (glass) {
    ctx.fillStyle = hexRgba(fill, 0.78);
    ctx.fillRect(0, 0, size, size);
    const glow = ctx.createRadialGradient(
      size * 0.32,
      size * 0.28,
      size * 0.05,
      size * 0.5,
      size * 0.55,
      size * 0.8,
    );
    glow.addColorStop(0, "rgba(255,255,255,0.38)");
    glow.addColorStop(0.45, "rgba(255,255,255,0.06)");
    glow.addColorStop(1, "rgba(8,6,10,0.18)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(16, 10, 14, 0.92)";
    ctx.lineWidth = Math.max(2, size * 0.11);
    ctx.strokeRect(0, 0, size, size);
  } else {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(16, 18, 16, 0.28)";
    ctx.lineWidth = Math.max(1, size * 0.03);
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  }
  if (!sticker.piece) return;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  const steps = FACE_ROT[sticker.home] + (sticker.piece.c === "b" ? 2 : 0);
  ctx.rotate((steps * Math.PI) / 2);
  ctx.translate(-size / 2, -size / 2);
  drawPiece(ctx, sticker.piece, size);
  ctx.restore();
}

export function drawPiece(ctx: CanvasRenderingContext2D, piece: Piece, size: number) {
  const white = piece.c === "w";
  ctx.save();
  const s = (size / 45) * 0.92;
  ctx.translate(size / 2, size / 2 + size * 0.02);
  ctx.scale(s, s);
  ctx.translate(-22.5, -22.5);
  ctx.fillStyle = white ? "#fffaf0" : "#12100e";
  ctx.strokeStyle = white ? "#12100e" : "#fffaf0";
  ctx.lineWidth = 1.85;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const d of PATHS[piece.t]) {
    const p = new Path2D(d);
    ctx.fill(p);
    ctx.stroke(p);
  }
  ctx.restore();
}

export function paintBoard(
  ctx: CanvasRenderingContext2D,
  grid: (Sticker | null)[][],
  size: number,
  opts?: { view?: FaceView; glass?: boolean },
) {
  const cell = size / N;
  const view = opts?.view;
  const glass = opts?.glass ?? false;
  const rot = view ? stickerRot(view) : 0;
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      const uv = view ? uvAt(view, col, row) : { u: col, v: N - 1 - row };
      const st = grid[uv.v]![uv.u];
      if (!st) continue;
      ctx.save();
      ctx.translate(col * cell, row * cell);
      if (rot) {
        ctx.translate(cell / 2, cell / 2);
        ctx.rotate(rot);
        ctx.translate(-cell / 2, -cell / 2);
      }
      drawSticker(ctx, st, cell, glass);
      ctx.restore();
    }
  }
}

export function faceStartGrid(face: Sticker["home"]): Sticker[][] {
  return Array.from({ length: N }, (_, v) =>
    Array.from({ length: N }, (_, u) => stickerAt(face, u, v)),
  );
}
