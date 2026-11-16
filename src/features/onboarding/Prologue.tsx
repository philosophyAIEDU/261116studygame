import { useEffect, useState } from 'react';
import { NPCS } from '@/config/npcVoices';
import { speakLine, stopAll } from '@/audio/player';
import { Btn, Portrait } from '@/ui/kit';

// 프롤로그 컷신: 인천공항 → 미국 도착 → 홈스테이 → 첫 등교.
// 핵심 연출: 주인공도 처음에는 원어민의 빠른 말을 못 알아듣는다(말풍선이 뭉개짐).
// 멘토가 "아기들도 처음엔 이래" 하고 위로한다 → 이 게임이 왜 "듣기부터"인지 몸으로 느끼게 한다.

interface Slide {
  art: string;
  bg: string;
  speaker?: string;
  text: string;
  /** 빠르게 흘러가서 알아듣지 못하는 말 */
  fast?: boolean;
  portrait?: string;
}

const SLIDES: readonly Slide[] = [
  { art: '🛫', bg: 'from-sky to-paper', text: 'Goodbye, Korea! A long, long flight...' },
  { art: '🗽', bg: 'from-honey to-paper', text: 'Hello, America! Everything is new.' },
  { art: '🏡', bg: 'from-meadow to-paper', speaker: 'Host Mom', portrait: '👩', text: 'Welcome home! This is your room.' },
  { art: '🏫', bg: 'from-maple to-honey', text: 'First day at Maple Grove Elementary.' },
  { art: '🧒👧👦', bg: 'from-maple to-honey', speaker: 'Kids', portrait: '🧒', fast: true, text: "Hey, whatcha doin'? Wanna come hang out with us at recess? We're gonna play tag, c'mon!" },
  { art: '😵‍💫', bg: 'from-night-2 to-night', text: '...What? Too fast! I can not understand.' },
  { art: '👩‍🏫', bg: 'from-lilac to-paper', speaker: NPCS.harper?.name, portrait: '👩‍🏫', text: "It's okay. Babies don't understand at first, either. They listen and listen... and one day, they talk." },
  { art: '👂📖🖍️🌙🎤', bg: 'from-honey to-paper', speaker: NPCS.harper?.name, portrait: '👩‍🏫', text: "Let's fill your ears first! Listen. Read. Draw. Sleep. Then speak." },
];

export function Prologue({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index] as Slide;
  const last = index === SLIDES.length - 1;

  useEffect(() => {
    const voice = slide.portrait === '👩‍🏫' || slide.portrait === '👩' ? NPCS.harper?.voice : slide.fast ? NPCS.leo?.voice : NPCS.harper?.voice;
    if (voice) speakLine(slide.text, voice, slide.fast ? 'native' : 'slow', false);
    return () => stopAll();
  }, [slide]);

  return (
    <div className={`flex h-full flex-col items-center justify-between bg-gradient-to-b ${slide.bg} p-4 text-ink`}>
      <div className="flex w-full justify-end">
        <Btn tone="ghost" className="!text-ink" icon="⏭️" onClick={onDone}>Skip</Btn>
      </div>
      <div className="emoji text-center text-[5.5rem] leading-tight sm:text-[8rem]" aria-hidden="true">{slide.art}</div>
      <div className="w-full max-w-2xl">
        <div className="flex items-end gap-3 rounded-3xl border-4 border-honey bg-paper p-4 shadow-xl">
          {slide.portrait ? <Portrait emoji={slide.portrait} /> : null}
          <div className="min-w-0 flex-1">
            {slide.speaker ? <p className="mb-1 inline-block rounded-lg bg-maple px-2 text-base font-bold text-white">{slide.speaker}</p> : null}
            <p
              className={`text-xl font-bold leading-relaxed sm:text-2xl ${slide.fast ? 'animate-pulse whitespace-nowrap blur-[3px]' : ''}`}
              aria-label={slide.fast ? 'Very fast talking. You can not understand it yet.' : undefined}
            >
              {slide.text}
            </p>
            {slide.fast ? <p className="mt-1 text-2xl">❓❓❓</p> : null}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Btn tone="paper" icon="⬅️" aria-label="Back" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))} />
          {last
            ? <Btn big icon="🎒" className="flex-1" onClick={onDone}>Go to school!</Btn>
            : <Btn big icon="➡️" className="flex-1" onClick={() => setIndex((i) => i + 1)}>Next</Btn>}
        </div>
      </div>
    </div>
  );
}
