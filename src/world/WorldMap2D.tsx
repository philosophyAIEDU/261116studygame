import { useGame } from '@/save/store';
import { STAR_PARCELS, activeFestivalQuest } from '@/features/adventure/rules';
import { playerPos } from './input';
import { ZONES } from '@/config/zones';
import { useUi } from '@/app/uiStore';
import { playSfx } from '@/audio/sfx';

/**
 * 2D 학교 지도. 세 가지 용도로 쓴다:
 *  1) 키보드만으로 조작할 때의 빠른 이동 (접근성)
 *  2) WebGL 을 쓸 수 없는 기기의 대체 화면
 *  3) HUD 미니맵을 눌렀을 때의 큰 지도
 */
export function WorldMap2D({ onPick, night }: { onPick?: (zoneId: string) => void; night?: boolean }) {
  const adventure = useGame((s) => s.save.adventure);
  const open = useUi((s) => s.open);
  const requestTeleport = useUi((s) => s.requestTeleport);
  return (
    <nav aria-label="School map" className={`relative mx-auto aspect-square w-full max-w-xl overflow-hidden rounded-3xl border-4 border-honey ${night ? 'bg-night-2' : 'bg-meadow'}`}>
      <div className="absolute inset-[8%] rounded-[2rem] border-4 border-dashed border-white/30" aria-hidden="true" />
      {activeFestivalQuest(adventure)?.id === 'lost-stars' && STAR_PARCELS.filter((p) => !adventure.collected.includes(p.id)).map((p) => <button key={p.id} type="button" aria-label="Visit star parcel" className="absolute z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-honey text-2xl shadow-lg" style={{ left: `${50 + p.pos[0] / 30 * 42}%`, top: `${46 + p.pos[1] / 30 * 46}%` }} onClick={() => { playerPos.x = p.pos[0]; playerPos.z = p.pos[1]; open({ type: 'adventure', nodeId: p.id }); }}>⭐</button>)}
      {ZONES.map((z) => {
        const left = 50 + (z.pos[0] / 30) * 42;
        const top = 46 + (z.pos[1] / 30) * 46;
        return (
          <button
            key={z.id}
            type="button"
            onClick={() => {
              playSfx('open');
              requestTeleport(z.id);
              useUi.getState().setNearZone(z.id);
              if (onPick) return onPick(z.id);
              const first = z.actions[0];
              if (first) open(first.overlay);
            }}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl border-2 border-white bg-night/80 px-2 py-1 text-paper shadow-lg"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <span className="emoji text-3xl" aria-hidden="true">{z.icon}</span>
            <span className="text-sm font-bold">{z.name}</span>
          </button>
        );
      })}
    </nav>
  );
}
