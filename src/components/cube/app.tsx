import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCube } from "@/lib/cube/store.ts";
import { CubeScene } from "./scene";
import { FaceGizmo } from "./gizmo";
import type { Axis } from "@/lib/cube/state.ts";

type Handle = {
  turn: (axis: Axis, layer: number, turns: number) => void;
  reset: () => void;
};

export function CubeApp() {
  const cubies = useCube((s) => s.cubies);
  const view = useCube((s) => s.view);
  const busy = useCube((s) => s.busy);
  const setView = useCube((s) => s.setView);
  const handle = useRef<Handle | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const [boardPx, setBoardPx] = useState(176);
  const [desktop, setDesktop] = useState(false);

  const onReady = useCallback((h: Handle) => {
    handle.current = h;
  }, []);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isDesk = vw >= 801;
      setDesktop(isDesk);
      if (!isDesk) {
        const availW = Math.max(200, vw - 24);
        const leftover = Math.max(220, vh - 72);
        const gizmoBudget = leftover * 0.46;
        const fromH = Math.floor(((gizmoBudget - 56) * 8) / 10);
        const fromW = Math.floor(availW / 10) * 8;
        setBoardPx(Math.max(120, Math.min(fromW, fromH, 240)));
        return;
      }
      const side = Math.min(el.clientWidth, el.clientHeight);
      setBoardPx(Math.max(144, Math.min(Math.round(side * 0.32), 248)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div className="cube-shell">
      <header className="cube-top">
        <div>
          <h1>Chess Cube</h1>
          <p className="lede">
            Drag to orbit. On desktop, drag the gizmo anywhere. Arrows or a swipe turn a row or
            column 90°.
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => handle.current?.reset()}
          disabled={busy}
        >
          <RotateCcw />
          Reset
        </Button>
      </header>
      <div className="stage">
        <div className="viewport" ref={viewRef}>
          <CubeScene onView={setView} onReady={onReady} />
        </div>
        <FaceGizmo
          cubies={cubies}
          view={view}
          boardPx={boardPx}
          disabled={busy}
          floating={desktop}
          onTurn={(axis, layer, turns) => handle.current?.turn(axis, layer, turns)}
        />
      </div>
    </div>
  );
}
