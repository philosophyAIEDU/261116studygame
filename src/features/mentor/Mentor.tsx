import { useEffect, useRef, useState } from 'react';
import { NPCS } from '@/config/npcVoices';
import { recommendedPacks } from '@/content/loader';
import { speakLine, stopAll } from '@/audio/player';
import { askGemini, hasGeminiKey } from '@/features/gemini';
import type { ChatTurn } from '@/features/gemini/client';
import { currentStage, playerLevel } from '@/features/progression/lifeStages';
import { skillLock } from '@/features/progression/skillUnlock';
import { localDayKey } from '@/features/progression/time';
import { buildQuests, currentStoryPack } from '@/features/quests/quests';
import { useGame } from '@/save/store';
import { useUi } from '@/app/uiStore';
import { Btn, Modal, Portrait } from '@/ui/kit';
import { Typewriter } from '@/ui/Typewriter';
import { buildMentorSystemPrompt, mentorLine } from './prompt';

// AI 멘토 Ms. Harper.
//  · 인사·격려·다음 할 일 안내 같은 정형 대사는 기기 안의 대사 풀에서 꺼낸다(API 사용 없음).
//  · 자유 질문만 Gemini(Flash-Lite)로 보낸다. 한국어로 물어봐도 되지만 답은 쉬운 영어로 온다.

interface Bubble {
  id: number;
  who: 'harper' | 'me';
  text: string;
}

export function Mentor({ onClose }: { onClose: () => void }) {
  const save = useGame((s) => s.save);
  const open = useUi((s) => s.open);
  const harper = NPCS.harper;
  const level = playerLevel(save.xp, save.graduated).level;
  const mbti = save.profile?.mbti ?? null;
  const packs = recommendedPacks(currentStage(save.graduated).id, mbti);
  const story = currentStoryPack(save, packs);
  const night = save.world.phase === 'night';
  const [bubbles, setBubbles] = useState<Bubble[]>(() => [{ id: 0, who: 'harper', text: mentorLine(night ? 'night' : 'greeting') }]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<'no' | 'yes' | 'queue'>('no');
  const history = useRef<ChatTurn[]>([]);
  const nextId = useRef(1);
  const bottom = useRef<HTMLDivElement>(null);
  const speakingLocked = !skillLock('speaking', {
    listeningDone: save.skills.listening.done, readingDone: save.skills.reading.done, speakingDone: save.skills.speaking.done, inputSeconds: save.input.totalSeconds,
  }).unlocked;

  const harperSays = (text: string) => {
    setBubbles((prev) => [...prev, { id: nextId.current++, who: 'harper', text }]);
    if (harper) speakLine(text, harper.voice, save.settings.speed);
  };

  useEffect(() => {
    const first = bubbles[0];
    if (first && harper) speakLine(first.text, harper.voice, save.settings.speed);
    return () => stopAll();
    // 처음 한 번만 인사한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { bottom.current?.scrollIntoView?.({ block: 'end' }); }, [bubbles, busy]);

  /** "다음에 뭘 하지?" — 퀘스트 로그에서 계산한다(API 사용 없음). */
  const whatNext = () => {
    const quest = buildQuests(save, packs, localDayKey(new Date())).find((q) => q.kind === 'main' && !q.locked && !q.done);
    harperSays(quest ? `Next: ${quest.icon} ${quest.title} — ${quest.detail}. ${speakingLocked ? mentorLine('ears') : 'You can do it! 💪'}` : mentorLine('cheer'));
  };

  const ask = async () => {
    const question = draft.trim();
    if (!question || busy !== 'no') return;
    setDraft('');
    setBubbles((prev) => [...prev, { id: nextId.current++, who: 'me', text: question }]);
    if (!hasGeminiKey()) return harperSays(mentorLine('noKey'));
    setBusy('yes');
    const result = await askGemini(
      {
        kind: 'mentor',
        system: buildMentorSystemPrompt({ level, mbti, recentWords: Object.keys(save.dictionary).slice(-10), currentStory: story?.meta.title ?? null, speakingLocked }),
        history: history.current,
        user: question,
        cache: true,
      },
      () => setBusy('queue'),
    );
    setBusy('no');
    if (!result.ok) return harperSays(mentorLine(result.reason === 'limit' ? 'limit' : 'noKey'));
    history.current = [...history.current, { role: 'user' as const, text: question }, { role: 'model' as const, text: result.text }].slice(-12);
    harperSays(result.text.trim());
  };

  return (
    <Modal title={harper?.name ?? 'Mentor'} icon="👩‍🏫" onClose={onClose}>
      <ul className="space-y-3" aria-live="polite">
        {bubbles.map((b, i) => (
          <li key={b.id} className={`flex items-end gap-2 ${b.who === 'me' ? 'flex-row-reverse' : ''}`}>
            {b.who === 'harper' ? <Portrait emoji="👩‍🏫" size={48} /> : null}
            <div className={`max-w-[82%] rounded-2xl p-3 text-lg font-bold leading-relaxed text-ink ${b.who === 'harper' ? 'bg-paper' : 'bg-honey'}`}>
              {b.who === 'harper' && i === bubbles.length - 1 ? <Typewriter text={b.text} /> : b.text}
              {b.who === 'harper' ? (
                <div className="mt-2"><Btn tone="sky" icon="🔁" aria-label="Hear it again" onClick={() => harper && speakLine(b.text, harper.voice, save.settings.speed)} /></div>
              ) : null}
            </div>
          </li>
        ))}
        {busy !== 'no' ? (
          <li className="flex items-end gap-2" role="status">
            <Portrait emoji="👩‍🏫" size={48} />
            <p className="animate-pulse rounded-2xl bg-paper p-3 text-lg font-bold text-ink">{busy === 'queue' ? 'Hmm, let me think… 🤔' : '…'}</p>
          </li>
        ) : null}
      </ul>
      <div ref={bottom} />

      <div className="sticky bottom-0 mt-4 space-y-2 rounded-2xl bg-night-2 p-2">
        <div className="flex flex-wrap gap-2">
          <Btn tone="honey" icon="🧭" onClick={whatNext}>What's next?</Btn>
          <Btn tone="paper" icon="🌟" onClick={() => harperSays(mentorLine('cheer'))}>Cheer me up</Btn>
          {story ? <Btn tone="paper" icon={story.meta.cover} onClick={() => open({ type: 'story', packId: story.meta.id })}>My story</Btn> : null}
        </div>
        <div className="flex gap-2">
          <label htmlFor="mentor-input" className="sr-only">Ask Ms. Harper</label>
          <input id="mentor-input" value={draft} maxLength={500} autoComplete="off" placeholder="Ask Ms. Harper anything..."
            onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void ask(); }}
            className="min-h-12 flex-1 rounded-xl border-2 border-white/30 bg-white px-3 text-lg text-ink" />
          <Btn tone="meadow" icon="📨" aria-label="Send" disabled={draft.trim().length === 0 || busy !== 'no'} onClick={() => void ask()} />
        </div>
      </div>
    </Modal>
  );
}
