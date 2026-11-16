import type { Speed } from '@/types';
import { SPEEDS } from '@/types';
import { SPEED_ICON, SPEED_LABEL } from '@/audio/speedLadder';
import { playSfx } from '@/audio/sfx';

/** 속도 사다리 선택: 🐢 Slow → 🚶 Natural → 🚀 Native */
export function SpeedPicker({ value, onChange, dark }: { value: Speed; onChange: (s: Speed) => void; dark?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Speed" className={`inline-flex rounded-2xl p-1 ${dark ? 'bg-white/10' : 'bg-ink/10'}`}>
      {SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          aria-label={SPEED_LABEL[s]}
          title={SPEED_LABEL[s]}
          onClick={() => { playSfx('tap'); onChange(s); }}
          className={`emoji min-h-11 min-w-11 rounded-xl px-2 text-2xl transition ${value === s ? 'bg-honey shadow' : 'opacity-60'}`}
        >
          {SPEED_ICON[s]}
        </button>
      ))}
    </div>
  );
}
