import { useRef, useState } from 'react';
import { joystick, moveTarget } from './input';

/** 모바일용 가상 조이스틱 (왼쪽 아래). 누른 채 끌면 그 방향으로 걷는다. */
export function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(false);

  const update = (e: React.PointerEvent) => {
    const rect = base.current?.getBoundingClientRect();
    if (!rect) return;
    const r = rect.width / 2;
    let x = (e.clientX - rect.left - r) / r;
    let y = (e.clientY - rect.top - r) / r;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    joystick.x = x;
    joystick.y = y;
    moveTarget.point = null;
    setKnob({ x, y });
  };
  const release = () => {
    active.current = false;
    joystick.x = 0;
    joystick.y = 0;
    setKnob({ x: 0, y: 0 });
  };

  return (
    <div
      ref={base}
      aria-hidden="true"
      className="pointer-events-auto relative h-28 w-28 touch-none rounded-full border-2 border-white/50 bg-night/40"
      onPointerDown={(e) => { active.current = true; e.currentTarget.setPointerCapture(e.pointerId); update(e); }}
      onPointerMove={(e) => { if (active.current) update(e); }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-honey shadow-lg" style={{ transform: `translate(calc(-50% + ${knob.x * 32}px), calc(-50% + ${knob.y * 32}px))` }} />
    </div>
  );
}
