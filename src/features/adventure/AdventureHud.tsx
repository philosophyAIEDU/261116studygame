import { useEffect, useState } from 'react';
import { useGame } from '@/save/store';
import { useUi } from '@/app/uiStore';
import { npc } from '@/config/npcVoices';
import { zoneById } from '@/config/zones';
import { speakLine } from '@/audio/player';
import { moveTarget, playerPos } from '@/world/input';
import { activeFestivalQuest, festivalQuestReady, FESTIVAL_QUESTS, STAR_PARCELS, storyOutputReady } from './rules';

/** 항상 한 가지 다음 행동만 안내한다. 키보드·터치·지도 모두 같은 임무를 쓴다. */
export function AdventureHud({ mapMode = false }: { mapMode?: boolean }) {
  const save = useGame((s) => s.save);
  const overlay = useUi((s) => s.overlay);
  const near = useUi((s) => s.nearZone);
  const [distance, setDistance] = useState(0);
  const quest = activeFestivalQuest(save.adventure);
  const ready = quest ? festivalQuestReady(save.adventure, quest.id, storyOutputReady(save.stories)) : false;
  const parcel = quest?.id === 'lost-stars' && !ready && save.adventure.started ? STAR_PARCELS.find((p) => !save.adventure.collected.includes(p.id)) : undefined;
  const destination = parcel?.pos ?? zoneById(quest?.zone ?? null)?.pos;
  useEffect(() => {
    const update = () => setDistance(destination ? Math.round(Math.hypot(destination[0] - playerPos.x, destination[1] - playerPos.z)) : 0);
    update(); const timer = setInterval(update, 200); return () => clearInterval(timer);
  }, [destination]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.code !== 'KeyE' || useUi.getState().overlay || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (parcel && Math.hypot(playerPos.x - parcel.pos[0], playerPos.z - parcel.pos[1]) <= 3) useUi.getState().open({ type: 'adventure', nodeId: parcel.id });
      else if (quest && useUi.getState().nearZone === quest.zone) useUi.getState().open({ type: 'adventure' });
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [parcel, quest]);
  if (overlay) return null;
  const who = npc(quest?.npc ?? 'leo');
  const title = !save.adventure.started ? 'Your new friend is waiting!' : !quest ? 'The festival is ready!' : ready ? `Bring the good news to ${who.name}` : parcel ? `Find star parcel ${save.adventure.collected.length + 1} of 3` : quest.title;
  const action = !save.adventure.started ? 'Meet Leo' : !quest ? 'See my rewards' : parcel ? distance <= 3 ? 'Open star parcel' : 'Follow the stars' : near === quest.zone ? ready ? 'Get my reward' : 'Start my mission' : `Meet ${who.name}`;
  const activate = () => {
    if (!save.adventure.started) { useGame.getState().beginAdventure(); useUi.getState().requestTeleport('cafeteria'); if (mapMode) useUi.getState().setNearZone('cafeteria'); useUi.getState().open({ type: 'adventure' }); return; }
    if (parcel) {
      if (mapMode) { useUi.getState().open({ type: 'map' }); return; }
      if (distance <= 3) useUi.getState().open({ type: 'adventure', nodeId: parcel.id });
      else moveTarget.point = [...parcel.pos];
    } else {
      if (quest && near !== quest.zone) { useUi.getState().requestTeleport(quest.zone); if (mapMode) useUi.getState().setNearZone(quest.zone); }
      useUi.getState().open({ type: 'adventure' });
    }
  };
  return <section className="adventure-tracker" aria-label="Your next adventure">
    <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black tracking-[.2em] text-[#bba1ce]">MAPLE FESTIVAL · {Math.min(save.adventure.claimed.length + 1, 5)} / 5</p><span className="text-xs font-extrabold text-honey">✦ {save.adventure.tokens}</span></div>
    <h2 className="mt-2 text-lg font-extrabold leading-tight text-paper">{!quest ? '🎪' : parcel ? '⭐' : quest.icon} {title}</h2>
    <div className="my-3 flex gap-1" aria-label={`${save.adventure.claimed.length} of 5 missions complete`}>{FESTIVAL_QUESTS.map((q) => <span key={q.id} className={`h-1.5 flex-1 rounded-full ${save.adventure.claimed.includes(q.id) ? 'bg-honey' : 'bg-white/15'}`} />)}</div>
    <div className="flex gap-2"><button type="button" className="adventure-next flex-1" onClick={activate}>▶ {action}</button><button type="button" className="min-h-12 min-w-12 rounded-xl bg-white/10 text-xl" aria-label="Hear what to do next" onClick={() => speakLine(`${title}. ${action}.`, who.voice, save.settings.speed)}>🔊</button></div>
    {parcel ? <p className="mt-2 text-xs text-paper/70">{distance <= 3 ? 'Press E or tap to open.' : 'Tap to walk there, or use WASD / arrow keys.'}</p> : null}
    <button type="button" className="mt-2 min-h-8 text-xs font-bold text-paper/75" onClick={() => useUi.getState().open({ type: 'adventure' })}>🧭 My journey & friends</button>
  </section>;
}
