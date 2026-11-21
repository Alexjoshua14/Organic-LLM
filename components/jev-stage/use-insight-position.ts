import { useCallback, useEffect, useRef, useState } from "react";

const KEYBOARD_STEP = 16;

type Offset = { x: number; y: number };

export function useInsightPosition() {
  const panel = useRef<HTMLElement>(null);
  const origin = useRef<Offset | null>(null);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });

  const move = useCallback((next?: Offset) => {
    const card = panel.current;
    const boundary = card?.parentElement;

    if (!card || !boundary || !card.offsetWidth) return;
    const left = card.offsetLeft;
    const top = card.offsetTop;
    const right = boundary.clientWidth - left - card.offsetWidth;
    const bottom = boundary.clientHeight - top - card.offsetHeight;

    setOffset((current) => {
      const x = Math.max(-left, Math.min(next?.x ?? current.x, right));
      const y = Math.max(-top, Math.min(next?.y ?? current.y, bottom));

      return current.x === x && current.y === y ? current : { x, y };
    });
  }, []);

  useEffect(() => {
    const boundary = panel.current?.parentElement;

    if (!boundary) return;
    const observer = new ResizeObserver(() => move());

    observer.observe(boundary);

    return () => observer.disconnect();
  }, [move]);

  return {
    panel,
    offset,
    handle: {
      onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
        if (event.button !== 0 || !event.isPrimary) return;
        origin.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
        if (!origin.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        move({ x: event.clientX - origin.current.x, y: event.clientY - origin.current.y });
      },
      onLostPointerCapture() {
        origin.current = null;
      },
      onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
        const step = KEYBOARD_STEP;
        const moves: Record<string, Offset> = {
          ArrowLeft: { x: offset.x - step, y: offset.y },
          ArrowRight: { x: offset.x + step, y: offset.y },
          ArrowUp: { x: offset.x, y: offset.y - step },
          ArrowDown: { x: offset.x, y: offset.y + step },
          Home: { x: 0, y: 0 },
        };
        const next = moves[event.key];

        if (!next) return;
        event.preventDefault();
        move(next);
      },
    },
  };
}
