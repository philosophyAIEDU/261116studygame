import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Tier } from '@/types';
import { ALL_PACKS, type StoryPack } from '@/content/loader';
import { fullStoryTime, playFullStory, playSentence, setVoiceVolume, stopAll } from '@/audio/player';
import { useGame } from '@/save/store';
import { Btn } from '@/ui/kit';
import { clearBedtimeMedia, setBedtimeMedia, setBedtimePlaying } from './mediaSession';
import { fadeFactor, remainingSeconds, sceneIndexAt, SLEEP_TIMER_MINUTES } from './sleepTimer';

// ④ Bedtime Listening — 잠들기 전 편하게 듣기 (철학 4번)
//  · 글자·퀴즈·점수가 없다. 확인 버튼을 누르게 하지도 않는다(잠드는 시간이므로).
//  · 보상은 "들은 시간"으로만 준다(1분당 2XP, 하루 60분까지). 재생 중일 때만 인정한다.
//  · 화면이 꺼져도 재생이 이어지도록 Media Session 을 설정한다.

const STARS = Array.from({ length: 28 }, (_, i) => ({ left: (i * 37) % 100, top: (i * 53) % 55, delay: (i % 7) * 0.4, size: 2 + (i % 3) }));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, import.meta.env.MODE === 'test' ? 0 : ms));

export function Bedtime({ initialPackId, onClose }: { initialPackId?: string; onClose: () => void }) {
  const save = useGame((s) => s.save);
  const addBedtimeSeconds = useGame((s) => s.addBedtimeSeconds);
  const recordListen = useGame((s) => s.recordListen);
  const completeStep = useGame((s) => s.completeStep);
  const speed = save.settings.speed;
  const baseVolume = save.settings.volume.voice;

  // 지금까지 읽기를 끝낸 이야기 + 지금 퀘스트 중인 이야기
  const eligible = useMemo(
    () => ALL_PACKS.filter((p) => p.meta.id === initialPackId || save.stories[p.meta.id]?.steps.read),
    // 재생 중에 목록이 흔들리지 않게 처음 한 번만 계산한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialPackId],
  );
  const [selected, setSelected] = useState<string[]>(() => (initialPackId ? [initialPackId] : eligible.map((p) => p.meta.id)));
  const [repeat, setRepeat] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [timerMin, setTimerMin] = useState<number | null>(null);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remain, setRemain] = useState<number | null>(null);
  const [view, setView] = useState<{ pack: StoryPack; sceneIndex: number } | null>(null);
  const run = useRef(0);
  const skip = useRef(false);
  const playingRef = useRef(false);

  const playlist = useMemo(() => eligible.filter((p) => selected.includes(p.meta.id)), [eligible, selected]);

  const stop = useCallback(() => {
    run.current++;
    stopAll();
    playingRef.current = false;
    setPlaying(false);
    setBedtimePlaying(false);
    setVoiceVolume(baseVolume);
  }, [baseVolume]);

  const start = useCallback(async () => {
    if (playlist.length === 0) return;
    const id = ++run.current;
    playingRef.current = true;
    setPlaying(true);
    setBedtimePlaying(true);
    let p = 0;
    while (id === run.current) {
      const pack = playlist[p % playlist.length] as StoryPack;
      const scenes = pack.story.scenes;
      setBedtimeMedia(pack.meta.title, { play: () => void start(), pause: stop, next: () => { skip.current = true; stopAll(); } });
      let finished = true;
      skip.current = false;
      const full = speed === 'natural' ? playFullStory(pack) : null;
      if (full) {
        // 전체 낭독 파일: 재생 위치로 장면을 맞춘다.
        const stamps = (pack.manifest?.full?.timestamps ?? []).map((t) => ({
          start: t.start,
          sceneIndex: Math.max(0, scenes.findIndex((sc) => sc.id === pack.story.sentences.find((s) => s.id === t.sentenceId)?.sceneId)),
        }));
        const poll = setInterval(() => {
          setView({ pack, sceneIndex: sceneIndexAt({ time: fullStoryTime(), duration: pack.manifest?.full?.duration ?? 0, sceneCount: scenes.length, stamps }) });
        }, 500);
        setView({ pack, sceneIndex: 0 });
        finished = await full.done;
        clearInterval(poll);
      } else {
        for (const s of pack.story.sentences) {
          setView({ pack, sceneIndex: Math.max(0, scenes.findIndex((sc) => sc.id === s.sceneId)) });
          const ok = await playSentence(pack, s, speed).done;
          if (id !== run.current) return;
          if (!ok) { finished = false; break; }
          await sleep(650);
          if (id !== run.current) return;
        }
      }
      if (id !== run.current) return;
      if (finished) {
        // 한 편을 끝까지 들었다 → 청취 1회. (XP 는 시간 기반이라 조용히 기록만 한다)
        recordListen(pack.meta.id, speed, pack.meta.level as Tier, true);
        completeStep(pack.meta.id, 'bedtime');
      } else if (!skip.current) {
        break; // 재생 실패 → 멈춘다
      }
      p++;
      if (p >= playlist.length && !repeat) break;
      await sleep(1800);
    }
    if (id === run.current) stop();
  }, [playlist, speed, repeat, stop, recordListen, completeStep]);

  // 재생 중일 때만 시간을 센다: XP 장부(15초마다 반영) + 수면 타이머 + 볼륨 줄이기
  useEffect(() => {
    let last = Date.now();
    let pending = 0;
    const tick = setInterval(() => {
      const now = Date.now();
      const delta = Math.min(65, (now - last) / 1000); // 백그라운드에서 타이머가 느려져도 최대 65초까지만 인정
      last = now;
      if (!playingRef.current) return;
      pending += delta;
      if (pending >= 15) { addBedtimeSeconds(pending); pending = 0; }
      const left = remainingSeconds(endAt, now);
      setRemain(left);
      setVoiceVolume(baseVolume * fadeFactor(left));
      if (left !== null && left <= 0) { setEndAt(null); setTimerMin(null); stop(); }
    }, 1000);
    return () => {
      clearInterval(tick);
      if (pending > 0) addBedtimeSeconds(pending);
    };
  }, [endAt, baseVolume, addBedtimeSeconds, stop]);

  useEffect(() => () => { run.current++; stopAll(); setVoiceVolume(baseVolume); clearBedtimeMedia(); }, [baseVolume]);

  const chooseTimer = (min: number) => {
    const next = timerMin === min ? null : min;
    setTimerMin(next);
    setEndAt(next === null ? null : Date.now() + next * 60000);
    setRemain(next === null ? null : next * 60);
  };
  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const scene = view ? view.pack.story.scenes[view.sceneIndex] : null;

  return (
    <div role="dialog" aria-label="Bedtime Listening" className="fixed inset-0 z-40 flex flex-col bg-gradient-to-b from-[#0d1126] via-night to-night-2 text-paper">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {STARS.map((s, i) => (
          <span key={i} className="twinkle absolute rounded-full bg-white" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
        ))}
        <span className="emoji absolute right-6 top-6 text-5xl opacity-80">🌙</span>
      </div>

      <div className="relative flex items-center justify-between p-3">
        <Btn tone="ghost" icon="☀️" aria-label="Wake up" onClick={() => { stop(); onClose(); }} />
        {remain !== null ? <span className="rounded-full bg-white/10 px-3 py-1 text-base" aria-label="Sleep timer">⏲️ {Math.ceil(remain / 60)}</span> : null}
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
        {scene && view ? (
          <div className="aspect-[8/5] w-full max-w-2xl overflow-hidden rounded-3xl opacity-80 shadow-2xl">
            <img key={`${view.pack.meta.id}-${scene.id}`} src={`${view.pack.baseUrl}${scene.image}`} alt="" className="kenburns h-full w-full object-cover brightness-75 saturate-[.8]" />
          </div>
        ) : (
          <span className="emoji text-8xl opacity-70" aria-hidden="true">🛏️</span>
        )}
      </div>

      <div className="relative space-y-3 p-4">
        {eligible.length === 0 ? (
          <p className="text-center text-lg">📖 ➡️ 🌙</p>
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Stories to play">
              {eligible.map((p) => (
                <button key={p.meta.id} type="button" aria-pressed={selected.includes(p.meta.id)} aria-label={p.meta.title} title={p.meta.title} onClick={() => toggle(p.meta.id)}
                  className={`emoji h-12 w-12 rounded-2xl text-2xl transition ${selected.includes(p.meta.id) ? 'bg-lilac' : 'bg-white/10 opacity-50'}`}>
                  {p.meta.cover}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-3">
              <Btn tone={repeat ? 'lilac' : 'ghost'} icon="🔁" aria-label="Repeat" aria-pressed={repeat} onClick={() => setRepeat((r) => !r)} />
              <Btn big tone="lilac" icon={playing ? '⏸️' : '▶️'} aria-label={playing ? 'Pause' : 'Play'} className="!min-h-16 !min-w-24" disabled={playlist.length === 0}
                onClick={() => (playing ? stop() : void start())} />
              <Btn tone="ghost" icon="⏭️" aria-label="Next story" disabled={!playing || playlist.length < 2} onClick={() => { skip.current = true; stopAll(); }} />
            </div>
            <div className="flex items-center justify-center gap-2" role="group" aria-label="Sleep timer minutes">
              <span className="emoji text-xl" aria-hidden="true">⏲️</span>
              {SLEEP_TIMER_MINUTES.map((m) => (
                <button key={m} type="button" aria-pressed={timerMin === m} aria-label={`${m} minutes`} onClick={() => chooseTimer(m)}
                  className={`min-h-11 min-w-11 rounded-full px-3 text-base font-bold ${timerMin === m ? 'bg-lilac text-white' : 'bg-white/10'}`}>
                  {m}
                </button>
              ))}
            </div>
          </>
        )}
        <p className="text-center text-xs text-paper/60">Relax. Don't translate. Just see the pictures.</p>
      </div>
    </div>
  );
}
