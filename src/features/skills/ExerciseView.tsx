import { useEffect, useMemo, useRef, useState } from 'react';
import type { Speed } from '@/types';
import { getPack, type StoryPack } from '@/content/loader';
import type { StorySentence } from '@/content/schema';
import { SPEAKER_VOICES, type VoiceProfile } from '@/config/npcVoices';
import { playSentence, playWord, stopAll } from '@/audio/player';
import { playSfx } from '@/audio/sfx';
import { validateEnglishInput } from '@/features/dictionary/hangul';
import { HANGUL_GUIDE } from '@/features/dictionary/WordEditor';
import { DrawingCanvas } from '@/features/dictionary/DrawingCanvas';
import { askGemini, hasGeminiKey } from '@/features/gemini';
import { buildWritingFeedbackPrompt, mentorLine } from '@/features/mentor/prompt';
import { useGame, selectLevel } from '@/save/store';
import { Btn } from '@/ui/kit';
import { EchoPractice } from './EchoPractice';
import { rewriteScore, spellingScore, type Exercise } from './exercises';
import { freeResponseScore } from './scoring';
import { listenOnce, recognitionSupported, type ListenHandle } from './speech';

// 연습 문제 한 개를 보여주고 정확도(0~1)를 돌려준다. 스킬 연습과 졸업 시험이 함께 쓴다.
// 보기는 그림이나 쉬운 영어뿐이다. 쓰기 입력에 한글이 있으면 저장하지 않고 부드럽게 안내한다.

function sentencesOf(pack: StoryPack, ids: readonly string[]): StorySentence[] {
  return ids.map((id) => pack.story.sentences.find((s) => s.id === id)).filter((s): s is StorySentence => !!s);
}

function SceneChoice({ pack, sceneId, onPick, mark, badge }: { pack: StoryPack; sceneId: string; onPick: () => void; mark: 'none' | 'right' | 'wrong'; badge?: number }) {
  const scene = pack.story.scenes.find((s) => s.id === sceneId);
  if (!scene) return null;
  return (
    <button type="button" aria-label={`Picture ${sceneId}`} onClick={onPick}
      className={`relative overflow-hidden rounded-2xl border-4 ${mark === 'right' ? 'border-meadow' : mark === 'wrong' ? 'border-berry opacity-50' : 'border-honey'}`}>
      <img src={`${pack.baseUrl}${scene.image}`} alt="" className="aspect-[8/5] w-full object-cover" draggable={false} />
      {badge ? <span className="absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-honey text-xl font-extrabold text-ink">{badge}</span> : null}
    </button>
  );
}

/** 영어로 쓰는 문제 공통 틀 (한글 차단 + 선택적 AI 첨삭) */
function WritingTask({ label, rows = 3, score, aiTask, onDone }: {
  label: string;
  rows?: number;
  score: (text: string) => number;
  /** 4~5단계만: Ms. Harper 의 AI 첨삭 과제 설명 */
  aiTask?: string;
  onDone: (accuracy: number) => void;
}) {
  const level = useGame((s) => selectLevel(s.save).level);
  const [text, setText] = useState('');
  const [guide, setGuide] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState<number | null>(null);

  const submit = () => {
    const result = validateEnglishInput(text);
    if (!result.ok) {
      if (result.reason === 'hangul') setGuide(HANGUL_GUIDE);
      return;
    }
    const accuracy = score(result.value);
    if (!aiTask) return onDone(accuracy);
    setAccepted(accuracy);
  };
  const askHarper = async () => {
    setBusy(true);
    const result = hasGeminiKey()
      ? await askGemini({ kind: 'writing', system: buildWritingFeedbackPrompt(level, aiTask ?? ''), user: text })
      : null;
    setBusy(false);
    setFeedback(result?.ok ? result.text.trim() : mentorLine(result && !result.ok && result.reason === 'limit' ? 'limit' : 'noKey', 0));
  };

  return (
    <div className="space-y-2 rounded-2xl bg-paper p-3 text-ink">
      <label htmlFor="writing-task" className="text-lg font-bold">✍️ {label}</label>
      <textarea id="writing-task" value={text} rows={rows} maxLength={500} readOnly={accepted !== null}
        onChange={(e) => { setText(e.target.value); setGuide(null); }}
        className="w-full rounded-xl border-2 border-ink/30 bg-white px-3 py-2 text-xl" />
      {guide ? <p role="alert" className="flex items-center gap-2 rounded-xl bg-honey/40 p-2 text-lg font-bold"><span className="emoji text-2xl">✏️</span>{guide}</p> : null}
      {accepted === null ? (
        <Btn big tone="meadow" icon="✅" className="w-full" disabled={text.trim().length === 0} onClick={submit}>Done</Btn>
      ) : (
        <div className="space-y-2">
          {feedback ? <p className="rounded-xl bg-sky/40 p-3 text-lg" aria-label="Feedback from Ms. Harper">👩‍🏫 {feedback}</p> : (
            <Btn tone="sky" icon="👩‍🏫" className="w-full" disabled={busy} onClick={() => void askHarper()}>{busy ? 'Reading…' : 'Ask Ms. Harper'}</Btn>
          )}
          <Btn big tone="meadow" icon="➡️" className="w-full" onClick={() => onDone(accepted)}>Next</Btn>
        </div>
      )}
    </div>
  );
}

export function ExerciseView({ exercise, speed, onDone, onRoleplay }: {
  exercise: Exercise;
  speed: Speed;
  onDone: (accuracy: number) => void;
  onRoleplay?: (packId: string) => void;
}) {
  const pack = 'packId' in exercise ? getPack(exercise.packId) : undefined;
  const [picked, setPicked] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [spoken, setSpoken] = useState('');
  const [listening, setListening] = useState(false);
  const listener = useRef<ListenHandle | null>(null);
  const run = useRef(0);

  const audioIds = exercise.type === 'sentenceScene' && exercise.mode === 'listen' ? exercise.sentenceIds
    : exercise.type === 'sceneOrder' || exercise.type === 'keyWords' ? exercise.sentenceIds : null;

  const playAudio = useMemo(() => async () => {
    if (!pack) return;
    const id = ++run.current;
    if (exercise.type === 'wordPicture') { playWord(pack, exercise.word, speed); return; }
    if (!audioIds) return;
    for (const s of sentencesOf(pack, audioIds)) {
      const ok = await playSentence(pack, s, speed).done;
      if (!ok || id !== run.current) return;
    }
  }, [pack, exercise, audioIds, speed]);

  useEffect(() => {
    void playAudio();
    return () => { run.current++; stopAll(); listener.current?.stop(); };
  }, [playAudio]);

  const answerChoice = (option: string, answer: string) => {
    if (picked) return;
    setPicked(option);
    const right = option === answer;
    playSfx(right ? 'correct' : 'wrong');
    setTimeout(() => onDone(right ? 1 : 0), import.meta.env.MODE === 'test' ? 0 : 900);
  };
  const again = audioIds || exercise.type === 'wordPicture'
    ? <div className="flex justify-center"><Btn big tone="sky" icon="🔊" onClick={() => void playAudio()}>Listen</Btn></div>
    : null;

  switch (exercise.type) {
    case 'wordPicture':
      return (
        <div className="space-y-3">
          {again}
          <div className="grid grid-cols-2 gap-3" role="group" aria-label="Pick the picture">
            {exercise.options.map((emoji) => (
              <button key={emoji} type="button" aria-label={`Picture ${emoji}`} onClick={() => answerChoice(emoji, exercise.answer)}
                className={`emoji flex min-h-28 items-center justify-center rounded-2xl border-4 bg-white text-6xl ${picked === null ? 'border-honey' : emoji === exercise.answer ? 'border-meadow' : emoji === picked ? 'border-berry opacity-50' : 'border-white/30 opacity-60'}`}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
      );

    case 'sentenceScene':
      if (!pack) return null;
      return (
        <div className="space-y-3">
          {again}
          {exercise.mode === 'read' ? (
            <div className="rounded-2xl bg-paper p-3 text-ink">
              {sentencesOf(pack, exercise.sentenceIds).map((s) => <p key={s.id} className="text-2xl font-bold leading-relaxed">{s.text}</p>)}
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-2">
            {exercise.options.map((id) => (
              <SceneChoice key={id} pack={pack} sceneId={id} onPick={() => answerChoice(id, exercise.answer)}
                mark={picked === null ? 'none' : id === exercise.answer ? 'right' : id === picked ? 'wrong' : 'none'} />
            ))}
          </div>
        </div>
      );

    case 'definition':
      return (
        <div className="space-y-3">
          <p className="rounded-2xl bg-paper p-4 text-center text-2xl font-bold text-ink">❓ = {exercise.easyEnglish}</p>
          <div className="grid grid-cols-2 gap-2">
            {exercise.options.map((w) => (
              <Btn key={w} big tone={picked === null ? 'paper' : w === exercise.answer ? 'meadow' : w === picked ? 'berry' : 'ghost'} onClick={() => answerChoice(w, exercise.answer)}>{w}</Btn>
            ))}
          </div>
        </div>
      );

    case 'sceneOrder': {
      if (!pack) return null;
      const tap = (id: string) => {
        if (order.includes(id)) return;
        const next = [...order, id];
        setOrder(next);
        if (next.length === exercise.answer.length) {
          const right = next.filter((x, i) => x === exercise.answer[i]).length;
          playSfx(right === next.length ? 'correct' : 'wrong');
          setTimeout(() => onDone(right / next.length), import.meta.env.MODE === 'test' ? 0 : 900);
        }
      };
      return (
        <div className="space-y-3">
          {again}
          <p className="text-center text-lg font-bold">1️⃣ 2️⃣ 3️⃣ Tap the pictures in the order you heard.</p>
          <div className="grid grid-cols-3 gap-2">
            {exercise.options.map((id) => (
              <SceneChoice key={id} pack={pack} sceneId={id} onPick={() => tap(id)} mark="none" badge={order.includes(id) ? order.indexOf(id) + 1 : undefined} />
            ))}
          </div>
        </div>
      );
    }

    case 'keyWords': {
      const toggle = (w: string) => { if (!checked) setChosen((c) => (c.includes(w) ? c.filter((x) => x !== w) : [...c, w])); };
      const check = () => {
        const hits = chosen.filter((w) => exercise.answers.includes(w)).length;
        const misses = chosen.filter((w) => !exercise.answers.includes(w)).length;
        const accuracy = Math.max(0, (hits - misses) / exercise.answers.length);
        setChecked(true);
        playSfx(accuracy >= 0.6 ? 'correct' : 'wrong');
        setTimeout(() => onDone(accuracy), import.meta.env.MODE === 'test' ? 0 : 1200);
      };
      return (
        <div className="space-y-3">
          {again}
          <p className="text-center text-lg font-bold">👂 Which words did you hear?</p>
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Words">
            {exercise.options.map((w) => {
              const on = chosen.includes(w);
              const right = exercise.answers.includes(w);
              return (
                <button key={w} type="button" aria-pressed={on} onClick={() => toggle(w)}
                  className={`min-h-12 rounded-full border-4 px-4 text-xl font-bold ${checked ? (right ? 'border-meadow bg-meadow/30' : on ? 'border-berry bg-berry/30' : 'border-white/20') : on ? 'border-honey bg-honey text-ink' : 'border-white/30 bg-white/10'}`}>
                  {w}
                </button>
              );
            })}
          </div>
          <Btn big tone="meadow" icon="✅" className="w-full" disabled={chosen.length === 0 || checked} onClick={check}>Check</Btn>
        </div>
      );
    }

    case 'echo': {
      const s = pack?.story.sentences.find((x) => x.id === exercise.sentenceId);
      if (!s) return null;
      const voice = SPEAKER_VOICES[s.speaker] ?? (SPEAKER_VOICES.narrator as VoiceProfile);
      return <EchoPractice text={s.text} speed={speed} voice={voice} mode={exercise.mode} onResult={onDone} />;
    }

    case 'describe': {
      const scene = pack?.story.scenes.find((x) => x.id === exercise.sceneId);
      if (!pack || !scene) return null;
      const finish = (text: string) => {
        const result = validateEnglishInput(text);
        if (result.ok) onDone(freeResponseScore(result.value, exercise.targetWords, 5));
      };
      return (
        <div className="space-y-3">
          <img src={`${pack.baseUrl}${scene.image}`} alt="" className="mx-auto aspect-[8/5] w-full max-w-md rounded-2xl border-4 border-honey object-cover" />
          <p className="text-center text-lg font-bold">🗣️ What do you see? Tell me about the picture!</p>
          <p className="min-h-12 rounded-xl bg-paper p-2 text-lg text-ink" aria-live="polite">🎙️ {spoken || '...'}</p>
          {recognitionSupported() ? (
            <Btn big tone={listening ? 'berry' : 'honey'} icon={listening ? '⏹️' : '🎤'} className="w-full"
              onClick={() => {
                if (listening) return listener.current?.stop();
                setListening(true);
                const h = listenOnce({ onInterim: setSpoken, silenceMs: 2000, maxMs: 20000 });
                listener.current = h;
                void h.result.then((t) => { setSpoken(t); setListening(false); });
              }}>
              {listening ? 'Done' : 'Speak'}
            </Btn>
          ) : (
            <>
              <label htmlFor="describe-input" className="sr-only">Describe the picture</label>
              <input id="describe-input" value={spoken} maxLength={200} onChange={(e) => setSpoken(e.target.value)} placeholder="I see a..." className="min-h-12 w-full rounded-xl border-2 border-white/30 bg-white px-3 text-lg text-ink" />
            </>
          )}
          <Btn big tone="meadow" icon="✅" className="w-full" disabled={spoken.trim().length === 0 || listening} onClick={() => finish(spoken)}>Done</Btn>
        </div>
      );
    }

    case 'roleplay':
      return (
        <div className="space-y-3 text-center">
          <p className="emoji text-6xl">💬</p>
          <p className="text-xl font-bold">Use your pocket phrases in a real talk!</p>
          <Btn big icon="🎤" className="w-full" onClick={() => onRoleplay?.(exercise.packId)}>Talk Time</Btn>
        </div>
      );

    case 'pictureWord':
      return (
        <div className="space-y-3">
          <p className="emoji text-center text-8xl" aria-hidden="true">{exercise.emoji}</p>
          <WritingTask label="What is this? Write the word." rows={1} score={(t) => spellingScore(exercise.word, t)} onDone={onDone} />
        </div>
      );

    case 'rewrite': {
      const s = pack?.story.sentences.find((x) => x.id === exercise.sentenceId);
      if (!s) return null;
      return (
        <div className="space-y-3">
          <p className="rounded-2xl bg-white/10 p-3 text-center text-2xl font-bold">“{s.text}”</p>
          <WritingTask label="Change one or two words and write a new sentence." rows={2} score={(t) => rewriteScore(s.text, t)} onDone={onDone} />
        </div>
      );
    }

    case 'diary':
      return (
        <div className="space-y-3">
          <p className="text-center text-lg font-bold">🖍️ My picture diary: draw your day, then write about it.</p>
          <DiaryCanvas />
          <WritingTask label="Write 1 or 2 sentences about your picture." score={(t) => freeResponseScore(t, [], 6)} onDone={onDone} />
        </div>
      );

    case 'continue': {
      const s = pack?.story.sentences.find((x) => x.id === exercise.sentenceId);
      return (
        <div className="space-y-3">
          <p className="rounded-2xl bg-white/10 p-3 text-center text-xl font-bold">{pack?.meta.cover} “{s?.text}”</p>
          <WritingTask label="What happens next? Continue the story." rows={4} score={(t) => freeResponseScore(t, pack?.story.words.map((w) => w.word) ?? [], 15)} aiTask="continue a short story" onDone={onDone} />
        </div>
      );
    }

    case 'email':
      return (
        <div className="space-y-3">
          <p className="rounded-2xl bg-white/10 p-3 text-center text-xl font-bold">📧 {exercise.prompt}</p>
          <WritingTask label="Write it here." rows={6} score={(t) => freeResponseScore(t, [], 30)} aiTask={exercise.prompt} onDone={onDone} />
        </div>
      );
  }
}

/** 그림 일기의 그림 칸. 그림은 그리는 동안만 화면에 있고 저장하지 않는다. */
function DiaryCanvas() {
  const [saved, setSaved] = useState<string | null>(null);
  if (saved) return <img src={saved} alt="My diary drawing" className="mx-auto w-full max-w-60 rounded-2xl border-4 border-honey bg-white" />;
  return <DrawingCanvas onSave={setSaved} />;
}
