import { useEffect, useRef, useState } from 'react';
import { useGame } from '@/save/store';
import { useUi } from '@/app/uiStore';
import { ZONES, zoneById } from '@/config/zones';
import { currentStage, playerLevel, stageTitle } from '@/features/progression/lifeStages';
import { formatInputTime } from '@/features/progression/inputHours';
import { playerPos } from '@/world/input';
import { activeFestivalQuest } from '@/features/adventure/rules';
import { Joystick } from '@/world/Joystick';
import { Avatar2D } from './Avatar2D';
import { Bar, Btn } from './kit';

// 게임 HUD: 초상화·레벨·XP, 누적 듣기 시간(크게), Gemini 사용량, 미니맵, 메뉴 버튼, 장소 행동 버튼.

const PHASE_ICON = { morning: '🌅', day: '☀️', sunset: '🌇', night: '🌙' } as const;

function Minimap() {
  const dot = useRef<HTMLSpanElement>(null);
  const open = useUi((s) => s.open);
  useEffect(() => {
    const t = setInterval(() => {
      if (!dot.current) return;
      dot.current.style.left = `${50 + (playerPos.x / 36) * 50}%`;
      dot.current.style.top = `${50 + (playerPos.z / 36) * 50}%`;
    }, 150);
    return () => clearInterval(t);
  }, []);
  return (
    <button type="button" aria-label="Open the map" onClick={() => open({ type: 'map' })}
      className="pointer-events-auto relative h-24 w-24 overflow-hidden rounded-full border-2 border-honey bg-night/70 sm:h-28 sm:w-28">
      {ZONES.map((z) => (
        <span key={z.id} className="emoji absolute -translate-x-1/2 -translate-y-1/2 text-sm" style={{ left: `${50 + (z.pos[0] / 36) * 50}%`, top: `${50 + (z.pos[1] / 36) * 50}%` }} aria-hidden="true">{z.icon}</span>
      ))}
      <span ref={dot} className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-berry" style={{ left: '50%', top: '50%' }} />
    </button>
  );
}

export function Hud({ touch }: { touch: boolean }) {
  const save = useGame((s) => s.save);
  const nearZone = useUi((s) => s.nearZone);
  const open = useUi((s) => s.open);
  const requestTeleport = useUi((s) => s.requestTeleport);
  const [nightDismissed, setNightDismissed] = useState(false);
  const profile = save.profile;
  const level = playerLevel(save.xp, save.graduated);
  const stage = currentStage(save.graduated);
  const zone = zoneById(nearZone);
  const festival = activeFestivalQuest(save.adventure);
  const phase = save.world.phase;
  // 현실 시간이 저녁 7시 이후면 밤 장면을 제안한다 (설정에서 끌 수 있음).
  const evening = new Date().getHours() >= 19;
  const suggestNight = phase === 'night' || (save.settings.autoNight && evening && !nightDismissed);

  const goToBed = () => {
    useGame.getState().setPhase('night');
    requestTeleport('home');
    open({ type: 'bedtime' });
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-2 sm:p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border-2 border-honey bg-night/85 p-2 pr-3">
          <div className="h-14 w-12 overflow-hidden rounded-xl bg-paper">{profile ? <Avatar2D look={{ ...profile, accessory: save.adventure.equipped ?? undefined }} size={48} bust /> : null}</div>
          <div className="w-36 sm:w-44">
            <p className="truncate text-base font-extrabold">{profile?.nickname} <span className="text-honey">Lv {level.level}</span></p>
            <p className="text-sm text-paper/90">{stage.icon} {stageTitle(level.level, stage.id)}</p>
            <Bar value={level.into} max={level.need} label="XP to next level" />
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border-2 border-lilac bg-night/85 px-3 py-1" aria-label={`Input hours: ${formatInputTime(save.input.totalSeconds)}`}>
            <span className="emoji text-2xl" aria-hidden="true">👂</span>
            <span className="text-2xl font-extrabold">{formatInputTime(save.input.totalSeconds)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="rounded-full bg-night/80 px-2 py-1 text-sm font-bold" aria-label={`${save.streak.days} day streak`}>🔥 {save.streak.days}</span>
            <span className="emoji rounded-full bg-night/80 px-2 py-1 text-sm" aria-label={`Time of day: ${phase}`}>{PHASE_ICON[phase]}</span>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-2">
          <Minimap />
          {touch ? <Joystick /> : null}
        </div>

        <div className="flex flex-1 flex-col items-center gap-2 pb-1">
          {suggestNight && (phase === 'night' || save.adventure.claimed.includes('secret-letter')) ? (
            <div className="pointer-events-auto flex items-center gap-1">
              <Btn tone="lilac" icon="🌙" onClick={goToBed}>Bedtime Listening</Btn>
              {phase !== 'night' ? <Btn tone="ghost" icon="✖️" aria-label="Not now" onClick={() => setNightDismissed(true)} /> : null}
            </div>
          ) : null}
          {zone ? (
            <div className="pointer-events-auto flex flex-wrap justify-center gap-2 rounded-2xl border-2 border-honey bg-night/85 p-2" role="group" aria-label={zone.name}>
              <p className="w-full text-center text-base font-extrabold text-honey">{zone.icon} {zone.name}</p>
              {festival && save.adventure.started && zone.npcId ? <Btn icon="💬" onClick={() => open({ type: 'adventure' })}>Meet my friend</Btn> : zone.actions.map((a) => (
                <Btn key={a.label} icon={a.icon} onClick={() => open(a.overlay)}>{a.label}</Btn>
              ))}
            </div>
          ) : null}
        </div>

        <nav aria-label="Menu" className="pointer-events-auto flex flex-col gap-2">
          <Btn tone="paper" icon="🎪" aria-label="Festival adventure" onClick={() => open({ type: 'adventure' })} />
          <Btn tone="honey" icon="📜" aria-label="Quest log" onClick={() => open({ type: 'quests' })} />
          <Btn tone="paper" icon="🎒" aria-label="Bag" onClick={() => open({ type: 'bag' })} />
          <Btn tone="ghost" icon="⚙️" aria-label="Settings" onClick={() => open({ type: 'settings' })} />
        </nav>
      </div>
    </div>
  );
}
