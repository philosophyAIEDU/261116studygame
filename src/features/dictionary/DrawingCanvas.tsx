import { useEffect, useRef, useState } from 'react';
import { Btn } from '@/ui/kit';

// 그림 사전용 그리기 캔버스 (Pointer Events → 마우스·터치·펜 모두 지원).
// 아이가 직접 그린 그림이 단어 카드의 앞면이 된다. 저장 크기는 512px PNG.

const SIZE = 512;
const COLORS = ['#2b2440', '#e0526b', '#e8743b', '#f6b352', '#7cc36a', '#7ec8e3', '#8e7cc3'];

export function DrawingCanvas({ onSave }: { onSave: (dataUrl: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0] as string);
  const [eraser, setEraser] = useState(false);
  const [dirty, setDirty] = useState(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, SIZE, SIZE);
    setDirty(false);
  };
  useEffect(clear, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * SIZE, y: ((e.clientY - rect.top) / rect.height) * SIZE };
  };
  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }, pressure: number) => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = eraser ? '#ffffff' : color;
    ctx.lineWidth = eraser ? 44 : 10 + pressure * 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={ref}
        width={SIZE}
        height={SIZE}
        aria-label="Drawing area"
        className="aspect-square w-full max-w-80 touch-none rounded-2xl border-4 border-honey bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          const p = point(e);
          last.current = p;
          stroke(p, { x: p.x + 0.1, y: p.y + 0.1 }, e.pressure || 0.5);
          setDirty(true);
        }}
        onPointerMove={(e) => {
          if (!last.current) return;
          const p = point(e);
          stroke(last.current, p, e.pressure || 0.5);
          last.current = p;
        }}
        onPointerUp={() => { last.current = null; }}
        onPointerCancel={() => { last.current = null; }}
      />
      <div className="flex flex-wrap items-center justify-center gap-2" role="radiogroup" aria-label="Color">
        {COLORS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={!eraser && color === c} aria-label={`Color ${c}`}
            onClick={() => { setColor(c); setEraser(false); }}
            className={`h-10 w-10 rounded-full border-4 ${!eraser && color === c ? 'border-ink scale-110' : 'border-white'}`} style={{ background: c }} />
        ))}
        <Btn tone={eraser ? 'honey' : 'paper'} icon="🧽" aria-label="Eraser" aria-pressed={eraser} onClick={() => setEraser((v) => !v)} />
        <Btn tone="paper" icon="🗑️" aria-label="Clear" onClick={clear} />
      </div>
      <Btn big tone="meadow" icon="✅" className="w-full max-w-80" disabled={!dirty}
        onClick={() => { const url = ref.current?.toDataURL('image/png'); if (url) onSave(url); }}>
        Save my drawing
      </Btn>
    </div>
  );
}
