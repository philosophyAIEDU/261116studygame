import { useUi } from './uiStore';
import { Overlays } from './Overlays';
import { useGame } from '@/save/store';
import { WorldMap2D } from '@/world/WorldMap2D';

/** (M3 임시) 2D 지도 + 창. M4 에서 3D 월드와 HUD 로 바뀐다. */
export function Game() {
  const phase = useGame((s) => s.save.world.phase);
  const overlay = useUi((s) => s.overlay);
  return (
    <div className="flex h-full flex-col items-center justify-center p-4">
      <div className="w-full" aria-hidden={overlay ? true : undefined}>
        <WorldMap2D night={phase === 'night'} />
      </div>
      <Overlays />
    </div>
  );
}
