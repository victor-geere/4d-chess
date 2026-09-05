import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, GripHorizontal } from "lucide-react";
import { N } from "@/lib/cube/orient.ts";
import { FACE_NAME } from "@/lib/cube/palette.ts";
import { paintBoard } from "@/lib/cube/pieces.ts";
import { faceLayout, type Axis, type Cubie } from "@/lib/cube/state.ts";
import {
  visualColMove,
  visualColTurns,
  visualRowMove,
  visualRowTurns,
  type FaceView,
} from "@/lib/cube/view.ts";

type Props = {
  cubies: Cubie[];
  /** The face the camera is looking at, oriented as it appears on screen. */
  view: FaceView;
  boardPx: number;
  disabled?: boolean;
  floating?: boolean;
  onTurn: (axis: Axis, layer: number, turns: number) => void;
};

export function FaceGizmo({ cubies, view, boardPx, disabled, floating, onTurn }: Props) {
  const face = view.face;
  const ref = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const cell = Math.max(12, Math.floor(boardPx / N));
  const px = cell * N;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { grid, turns } = faceLayout(cubies, face);
    paintBoard(ctx, grid, px, { view, turns });
  }, [cubies, face, px, view]);

  useEffect(() => {
    if (!floating) {
      setPos(null);
      return;
    }
    const clamp = () => {
      const el = rootRef.current;
      const parent = el?.offsetParent as HTMLElement | null;
      if (!el || !parent) return;
      setPos((prev) => {
        if (!prev) return prev;
        const maxX = Math.max(8, parent.clientWidth - el.offsetWidth - 8);
        const maxY = Math.max(8, parent.clientHeight - el.offsetHeight - 8);
        return {
          x: Math.min(Math.max(8, prev.x), maxX),
          y: Math.min(Math.max(8, prev.y), maxY),
        };
      });
    };
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [floating, boardPx]);

  const fireRow = (rowFromTop: number, dir: 1 | -1) => {
    if (disabled) return;
    const { axis, layer } = visualRowMove(view, rowFromTop);
    onTurn(axis, layer, visualRowTurns(view, rowFromTop, dir));
  };
  const fireCol = (colFromLeft: number, dir: 1 | -1) => {
    if (disabled) return;
    const { axis, layer } = visualColMove(view, colFromLeft);
    onTurn(axis, layer, visualColTurns(view, colFromLeft, dir));
  };

  const arrow = (dir: "up" | "down" | "left" | "right", i: number) => {
    const Icon =
      dir === "up"
        ? ChevronUp
        : dir === "down"
          ? ChevronDown
          : dir === "left"
            ? ChevronLeft
            : ChevronRight;
    const go = () => {
      if (dir === "left" || dir === "right") fireRow(i, dir === "right" ? 1 : -1);
      else fireCol(i, dir === "up" ? 1 : -1);
    };
    return (
      <button
        key={`${dir}-${i}`}
        type="button"
        className="gizmo-arrow"
        style={{ width: cell, height: cell }}
        disabled={disabled}
        data-testid={`arrow-${dir}-${i}`}
        aria-label={
          dir === "left" || dir === "right"
            ? `Turn row ${i + 1} ${dir}`
            : `Turn column ${i + 1} ${dir}`
        }
        onClick={go}
      >
        <Icon />
      </button>
    );
  };

  const onBoardDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    swipe.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onBoardUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - rect.left - start.x;
    const dy = e.clientY - rect.top - start.y;
    const thresh = Math.max(16, cell * 0.4);
    if (Math.abs(dx) < thresh && Math.abs(dy) < thresh) return;
    const col = Math.min(N - 1, Math.max(0, Math.floor(start.x / cell)));
    const row = Math.min(N - 1, Math.max(0, Math.floor(start.y / cell)));
    if (Math.abs(dx) > Math.abs(dy)) fireRow(row, dx > 0 ? 1 : -1);
    else fireCol(col, dy < 0 ? 1 : -1);
  };

  const onHandleDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!floating) return;
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onHandleMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current || !floating) return;
    const el = rootRef.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const pr = parent.getBoundingClientRect();
    const maxX = Math.max(8, parent.clientWidth - el.offsetWidth - 8);
    const maxY = Math.max(8, parent.clientHeight - el.offsetHeight - 8);
    const x = Math.min(Math.max(8, e.clientX - pr.left - drag.current.dx), maxX);
    const y = Math.min(Math.max(8, e.clientY - pr.top - drag.current.dy), maxY);
    setPos({ x, y });
  };
  const onHandleUp = () => {
    drag.current = null;
    setDragging(false);
  };

  const style = floating && pos ? { left: pos.x, top: pos.y, right: "auto" as const } : undefined;

  return (
    <div
      ref={rootRef}
      className={`gizmo${floating ? " gizmo-float" : ""}${dragging ? " is-dragging" : ""}`}
      data-testid="cube-gizmo"
      style={style}
    >
      {floating ? (
        <button
          type="button"
          className="gizmo-handle"
          aria-label="Drag gizmo"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <GripHorizontal />
          <span>{FACE_NAME[face]}</span>
        </button>
      ) : (
        <p className="gizmo-label">{FACE_NAME[face]}</p>
      )}
      <div
        className="gizmo-frame"
        style={{
          gridTemplateColumns: `${cell}px ${px}px ${cell}px`,
          gridTemplateRows: `${cell}px ${px}px ${cell}px`,
        }}
      >
        <span />
        <div className="gizmo-edge">{Array.from({ length: N }, (_, i) => arrow("up", i))}</div>
        <span />
        <div className="gizmo-edge col">
          {Array.from({ length: N }, (_, i) => arrow("left", i))}
        </div>
        <canvas
          ref={ref}
          width={px}
          height={px}
          className="gizmo-board"
          style={{ touchAction: "none" }}
          onPointerDown={onBoardDown}
          onPointerUp={onBoardUp}
          onPointerCancel={() => {
            swipe.current = null;
          }}
        />
        <div className="gizmo-edge col">
          {Array.from({ length: N }, (_, i) => arrow("right", i))}
        </div>
        <span />
        <div className="gizmo-edge">{Array.from({ length: N }, (_, i) => arrow("down", i))}</div>
        <span />
      </div>
      <p className="gizmo-hint">
        {floating
          ? "Drag the handle · swipe a row or column"
          : "Swipe a row or column, or tap an arrow"}
      </p>
    </div>
  );
}
