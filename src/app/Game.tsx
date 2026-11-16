import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useUi } from './uiStore';
import { Overlays } from './Overlays';
import { useGame } from '@/save/store';
import { recommendedPacks } from '@/content/loader';
import { currentStage } from '@/features/progression/lifeStages';
import { localDayKey } from '@/features/progression/time';
import { buildQuests, questStyle, questZones } from '@/features/quests/quests';
import { setBgm } from '@/audio/sfx';
import { resolveQuality } from '@/world/quality';
import { WorldMap2D } from '@/world/WorldMap2D';
import { Hud } from '@/ui/Hud';
import { FxLayer } from '@/ui/FxLayer';
import { AdventureHud } from '@/features/adventure/AdventureHud';
import { UpdateBanner } from './UpdateBanner';

const World3D = lazy(() => import('@/world/World3D'));

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** 3D 가 실패하면(오래된 기기 등) 2D 지도로 바꿔서 게임은 계속되게 한다. */
class WorldBoundary extends Component<{ fallback: ReactNode; children: ReactNode; onFallback: () => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch() { this.props.onFallback(); }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function Game() {
  const save = useGame((s) => s.save);
  const overlay = useUi((s) => s.overlay);
  const open = useUi((s) => s.open);
  const phase = save.world.phase;
  const stage = currentStage(save.graduated).id;
  const mbti = save.profile?.mbti ?? null;
  const quality = useMemo(() => resolveQuality(save.settings.quality), [save.settings.quality]);
  const canWebgl = useMemo(webglAvailable, []);
  const [worldFailed, setWorldFailed] = useState(false);
  const touch = useMemo(() => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0), []);
  const packs = useMemo(() => recommendedPacks(stage, mbti), [stage, mbti]);
  const zones = useMemo(() => questZones(buildQuests(save, packs, localDayKey(new Date()))), [save, packs]);
  const style = questStyle(mbti);

  // 장소·시간에 맞는 배경 음악. Bedtime 중에는 음악을 끈다(이야기 소리만).
  useEffect(() => {
    if (overlay?.type === 'bedtime') setBgm('off');
    else if (overlay?.type === 'story') setBgm('story');
    else setBgm(phase === 'night' ? 'night' : phase === 'sunset' ? 'sunset' : 'day');
  }, [overlay?.type, phase]);
  useEffect(() => () => setBgm('off'), []);

  const map2d = (
    <div className="flex h-full items-center justify-center p-4 pt-28"><WorldMap2D night={phase === 'night'} /></div>
  );

  return (
    <div className="relative h-full overflow-hidden">
      <div className="absolute inset-0" aria-hidden={overlay ? true : undefined}>
        {canWebgl && save.profile ? (
          <WorldBoundary fallback={map2d} onFallback={() => setWorldFailed(true)}>
            <Suspense fallback={<div className="flex h-full items-center justify-center text-6xl" aria-busy="true">🏫</div>}>
              <World3D
                phase={phase}
                stage={stage}
                quality={quality}
                profile={save.profile}
                questZones={zones}
                surprise={style.surpriseEvents}
                onSurprise={() => { const pick = packs[Math.floor(Math.random() * packs.length)]; if (pick) open({ type: 'story', packId: pick.meta.id }); }}
              />
            </Suspense>
          </WorldBoundary>
        ) : map2d}
        <Hud touch={touch} />
        <AdventureHud mapMode={!canWebgl || worldFailed} />
      </div>
      <Overlays />
      <FxLayer />
      <UpdateBanner />
    </div>
  );
}
