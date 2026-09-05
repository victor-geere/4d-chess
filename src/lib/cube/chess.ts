import type { Face } from "./orient.ts";
import { physToChess } from "./orient.ts";

export type PieceType = "K" | "Q" | "R" | "B" | "N" | "P";
export type PieceColor = "w" | "b";
export type Piece = { t: PieceType; c: PieceColor };

const BACK: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];

export function startingPiece(file: number, rank: number): Piece | null {
  if (rank === 0) return { t: BACK[file]!, c: "w" };
  if (rank === 1) return { t: "P", c: "w" };
  if (rank === 6) return { t: "P", c: "b" };
  if (rank === 7) return { t: BACK[file]!, c: "b" };
  return null;
}

export type Sticker = {
  home: Face;
  u: number;
  v: number;
  file: number;
  rank: number;
  piece: Piece | null;
};

export function stickerAt(home: Face, u: number, v: number): Sticker {
  const { file, rank } = physToChess(home, u, v);
  return { home, u, v, file, rank, piece: startingPiece(file, rank) };
}

export function squareIsLight(file: number, rank: number) {
  return (file + rank) % 2 === 1;
}
