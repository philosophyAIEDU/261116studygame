import { useMemo, useState } from 'react';
import type { StoryPack } from '@/content/loader';
import { ALL_PACKS, findWord, sentenceForWord } from '@/content/loader';
import { playWord, speakLine } from '@/audio/player';
import { playSfx } from '@/audio/sfx';
import { NPCS } from '@/config/npcVoices';
import { useGame } from '@/save/store';
import { Btn } from '@/ui/kit';
import { validateEnglishInput } from './hangul';
import { putDrawing } from './db';
import { DrawingCanvas } from './DrawingCanvas';

// My Picture Dictionary 등록 화면.
// 뜻을 남기는 방법 3가지: 직접 그리기 / 그림 카드 고르기 / 쉬운 영어로 쓰기.
// 한국어로는 남길 수 없다(입력 차단) — 꾸짖지 않고 연필 아이콘과 음성으로 부드럽게 안내한다.

export const HANGUL_GUIDE = 'Try drawing it, or use English words!';

type Mode = 'draw' | 'pick' | 'write';

function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function WordEditor({ pack, word, onDone, onCancel }: { pack: StoryPack; word: string; onDone: () => void; onCancel: () => void }) {
  const info = findWord(pack.story, word);
  const sentence = sentenceForWord(pack.story, word);
  const addDictCard = useGame((s) => s.addDictCard);
  const [mode, setMode] = useState<Mode>('draw');
  const [text, setText] = useState('');
  const [guide, setGuide] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);

  // 그림 카드 보기: 정답 1 + 다른 단어의 그림 3
  const choices = useMemo(() => {
    if (!info) return [];
    const others = [...new Set(ALL_PACKS.flatMap((p) => p.story.words.map((w) => w.emoji)))].filter((e) => e !== info.emoji);
    return shuffle([info.emoji, ...shuffle(others, word.length).slice(0, 3)], word.length * 7 + 3);
  }, [info, word]);

  const finish = (kind: 'drawing' | 'picture' | 'english', value: string) => {
    addDictCard({ word, packId: pack.meta.id, kind, value });
    playSfx('collect');
    onDone();
  };

  const saveText = () => {
    const result = validateEnglishInput(text);
    if (result.ok) return finish('english', result.value);
    if (result.reason === 'hangul') {
      // 저장하지 않고 안내만 한다.
      setGuide(HANGUL_GUIDE);
      const voice = NPCS.harper?.voice;
      if (voice) speakLine(HANGUL_GUIDE, voice, 'slow', false);
    }
  };

  return (
    <div className="space-y-3 text-ink">
      <div className="flex items-center gap-3 rounded-2xl bg-paper p-3">
        <Btn tone="sky" icon="🔊" aria-label={`Hear ${word}`} onClick={() => playWord(pack, word)} />
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-extrabold">{word}</p>
          {info ? <p className="text-lg">= {info.easyEnglish}</p> : null}
          {sentence ? <p className="text-base italic text-ink/75">“{sentence.text}”</p> : null}
        </div>
        <Btn tone="paper" icon="✖️" aria-label="Cancel" onClick={onCancel} />
      </div>

      <div role="tablist" aria-label="How to remember" className="flex gap-2">
        <Btn role="tab" aria-selected={mode === 'draw'} tone={mode === 'draw' ? 'honey' : 'ghost'} icon="🖍️" className="flex-1" onClick={() => setMode('draw')}>Draw</Btn>
        {info ? <Btn role="tab" aria-selected={mode === 'pick'} tone={mode === 'pick' ? 'honey' : 'ghost'} icon="🖼️" className="flex-1" onClick={() => setMode('pick')}>Pick</Btn> : null}
        <Btn role="tab" aria-selected={mode === 'write'} tone={mode === 'write' ? 'honey' : 'ghost'} icon="✏️" className="flex-1" onClick={() => setMode('write')}>Write</Btn>
      </div>

      {mode === 'draw' && (
        <DrawingCanvas onSave={(dataUrl) => { void putDrawing(word, dataUrl).then(() => finish('drawing', word.toLowerCase())); }} />
      )}

      {mode === 'pick' && info && (
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Pick the picture">
          {choices.map((emoji) => (
            <button key={emoji} type="button" aria-label={`Picture ${emoji}`}
              onClick={() => {
                if (emoji === info.emoji) return finish('picture', emoji);
                playSfx('wrong');
                setWrong(emoji);
              }}
              className={`emoji flex min-h-28 items-center justify-center rounded-2xl border-4 bg-white text-6xl ${wrong === emoji ? 'border-ink/20 opacity-40' : 'border-honey'}`}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      {mode === 'write' && (
        <div className="space-y-2 rounded-2xl bg-paper p-3">
          <label htmlFor="easy" className="font-bold">✏️ Easy English</label>
          <input id="easy" value={text} maxLength={60} autoComplete="off" placeholder="very, very big"
            onChange={(e) => { setText(e.target.value); setGuide(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') saveText(); }}
            className="w-full rounded-xl border-2 border-ink/30 bg-white px-3 py-3 text-xl" />
          {guide ? <p role="alert" className="flex items-center gap-2 rounded-xl bg-honey/40 p-2 text-lg font-bold"><span className="emoji text-2xl">✏️</span>{guide}</p> : null}
          <Btn big tone="meadow" icon="✅" className="w-full" disabled={text.trim().length === 0} onClick={saveText}>Save</Btn>
        </div>
      )}
    </div>
  );
}
