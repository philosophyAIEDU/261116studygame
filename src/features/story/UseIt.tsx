import { useState } from 'react';
import type { Tier } from '@/types';
import type { StoryPack } from '@/content/loader';
import { npc } from '@/config/npcVoices';
import { playSfx } from '@/audio/sfx';
import { useGame } from '@/save/store';
import { validateEnglishInput } from '@/features/dictionary/hangul';
import { HANGUL_GUIDE } from '@/features/dictionary/WordEditor';
import { EchoPractice } from '@/features/skills/EchoPractice';
import { freeResponseScore } from '@/features/skills/scoring';
import { Btn } from '@/ui/kit';
import { SceneView } from './SceneView';
import { detectPhrasesUsed } from './phrases';

// ⑤ Use It! — 이 이야기에서 모은 표현으로 말하고 쓴다 (철학 6번).
//  1) Say it: 주머니 표현 따라 말하기 (기기 안에서 채점)
//  2) Write it: 장면을 보고 짧게 쓰기 (한글 입력은 저장하지 않고 부드럽게 안내)
// AI 대화(Talk Time)는 이 단계를 끝낸 뒤 퀘스트 화면에서 보너스로 열린다.

const SAY_COUNT = 3;

export function UseIt({ pack, onComplete, onExit }: { pack: StoryPack; onComplete: () => void; onExit: () => void }) {
  const save = useGame((s) => s.save);
  const skillDone = useGame((s) => s.skillDone);
  const speed = save.settings.speed;
  const tier = pack.meta.level as Tier;
  const collected = save.stories[pack.meta.id]?.phrases ?? [];
  const phrases = (collected.length >= SAY_COUNT ? collected : pack.story.phrasePocket).slice(0, SAY_COUNT);
  const voice = npc(pack.story.talk.npc).voice;

  const [said, setSaid] = useState(0);
  const [text, setText] = useState('');
  const [guide, setGuide] = useState<string | null>(null);
  const scene = pack.story.scenes[Math.min(2, pack.story.scenes.length - 1)];

  const submitWriting = () => {
    const result = validateEnglishInput(text);
    if (!result.ok) {
      if (result.reason === 'hangul') setGuide(HANGUL_GUIDE);
      return;
    }
    const used = detectPhrasesUsed(result.value, pack.story.phrasePocket).length;
    const score = Math.min(1, freeResponseScore(result.value, pack.story.words.map((w) => w.word), 4) + used * 0.2);
    skillDone({ skill: 'writing', tier, accuracy: score });
    playSfx('quest');
    onComplete();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Btn tone="ghost" icon="⬅️" aria-label="Back to quest" onClick={onExit} />
        <p className="flex-1 text-center text-lg font-bold">{said < phrases.length ? `🎤 ${said + 1}/${phrases.length}` : '✍️ Write it!'}</p>
      </div>

      {said < phrases.length ? (
        <EchoPractice
          key={said}
          text={phrases[said] as string}
          speed={speed}
          voice={voice}
          onResult={(accuracy) => {
            skillDone({ skill: 'speaking', tier, accuracy, speed });
            setSaid((n) => n + 1);
          }}
        />
      ) : (
        <div className="space-y-3">
          {scene ? <SceneView pack={pack} scene={scene} className="mx-auto max-w-md" /> : null}
          <div className="space-y-2 rounded-2xl bg-paper p-3 text-ink">
            <label htmlFor="useit-write" className="text-lg font-bold">✍️ Write about the picture. Use a pocket phrase!</label>
            <div className="flex flex-wrap gap-2">
              {pack.story.phrasePocket.slice(0, 4).map((p) => (
                <span key={p} className="rounded-full bg-honey/50 px-3 py-1 text-base font-bold">💬 {p}</span>
              ))}
            </div>
            <textarea id="useit-write" value={text} rows={2} maxLength={200}
              onChange={(e) => { setText(e.target.value); setGuide(null); }}
              className="w-full rounded-xl border-2 border-ink/30 bg-white px-3 py-2 text-xl" />
            {guide ? <p role="alert" className="flex items-center gap-2 rounded-xl bg-honey/40 p-2 text-lg font-bold"><span className="emoji text-2xl">✏️</span>{guide}</p> : null}
            <Btn big tone="meadow" icon="✅" className="w-full" disabled={text.trim().length === 0} onClick={submitWriting}>Done</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
