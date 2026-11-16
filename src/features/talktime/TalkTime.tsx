import { useEffect, useMemo, useRef, useState } from 'react';
import type { Tier } from '@/types';
import { TALK_AUDIO_MAX_SECONDS, TALK_MAX_TURNS } from '@/config/geminiLimits';
import { npc } from '@/config/npcVoices';
import { ALL_PACKS, getPack, type StoryPack } from '@/content/loader';
import { speakLine, stopAll } from '@/audio/player';
import { playSfx } from '@/audio/sfx';
import { askGemini, callsLeft, hasGeminiKey } from '@/features/gemini';
import type { ChatTurn } from '@/features/gemini/client';
import { maxTierForLevel, playerLevel } from '@/features/progression/lifeStages';
import { localDayKey } from '@/features/progression/time';
import { TALK_COMPLETE_BONUS } from '@/features/progression/xp';
import { EchoPractice } from '@/features/skills/EchoPractice';
import { blobToBase64, listenOnce, recognitionSupported, recordClip, recorderSupported, type ListenHandle, type RecordHandle } from '@/features/skills/speech';
import { mentorLine } from '@/features/mentor/prompt';
import { useGame } from '@/save/store';
import { Btn, Modal, Portrait } from '@/ui/kit';
import { Typewriter } from '@/ui/Typewriter';
import {
  buildTalkSystemPrompt, parseTalkReply, planTalk, scoreTurn, sessionsUsedToday, summarizeTalk, talkSchema, type TalkReply, type TurnRecord,
} from './session';

// 🎙️ Talk Time — 학생이 말하면 Gemini 가 캐릭터로서 대답한다.
//   🎤 말하기 → (음성 인식) 글자 확인 → 전송 → Gemini → NPC 말풍선(타자 효과) + 음성 → 다시 학생 차례
//  · 1회 최대 6턴. 남은 호출이 부족하면 줄이고, 0이면 잠그고 기기 안 연습(따라 말하기)으로 안내한다.
//  · 대화 내용은 화면(메모리)에만 있고 저장하지 않는다. 저장하는 것은 통계뿐이다.
//  · 기본은 인식된 "글자만" 보낸다. 녹음은 보호자가 설정에서 동의했을 때만 보낸다.

interface Message {
  id: number;
  who: 'npc' | 'me';
  text: string;
  recast?: string | null;
  cheer?: string;
}

const CAREER_SCENES: Record<string, string> = {
  teacher: 'A job interview at a school. You want to be a teacher.',
  doctor: 'A job interview at a hospital. You want to be a doctor.',
  reporter: 'A job interview at a news room. You want to be a reporter.',
  gamedev: 'A job interview at a game studio. You want to be a game developer.',
  diplomat: 'A practice meeting. You want to be a diplomat and introduce your country.',
  chef: 'A job interview at a restaurant. You want to be a chef.',
};

/** 대화의 배경이 될 이야기: 지정된 팩 → 가장 최근에 표현을 모은 이야기 → 첫 이야기 */
function pickPack(packId: string, stories: Record<string, { phrases: string[] }>): StoryPack {
  const direct = getPack(packId);
  if (direct) return direct;
  const withPhrases = [...ALL_PACKS].reverse().find((p) => (stories[p.meta.id]?.phrases.length ?? 0) > 0);
  return withPhrases ?? (ALL_PACKS[0] as StoryPack);
}

export function TalkTime({ packId, npcId, career, onClose }: { packId: string; npcId?: string; career?: boolean; onClose: () => void }) {
  const save = useGame((s) => s.save);
  const game = useGame.getState;
  const pack = useMemo(() => pickPack(packId, save.stories), [packId, save.stories]);
  const who = npc(career ? 'boss' : npcId ?? pack.story.talk.npc);
  const level = playerLevel(save.xp, save.graduated).level;
  const tier: Tier = career ? maxTierForLevel(level) : (pack.meta.level as Tier);
  const speed = save.settings.speed;
  const pocket = pack.story.phrasePocket;

  // 대화를 시작할 때의 예산을 고정한다.
  const budget = useMemo(
    () => planTalk({
      hasKey: hasGeminiKey(),
      remainingCalls: callsLeft(career ? 'roleplay' : 'talk'),
      sessionsToday: sessionsUsedToday(save.talk, localDayKey(new Date())),
      maxSessionsPerDay: save.settings.maxTalkSessionsPerDay,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const leftAtStart = useMemo(() => callsLeft(career ? 'roleplay' : 'talk'), [career]);

  const [phase, setPhase] = useState<'intro' | 'chat' | 'summary' | 'practice'>('intro');
  const [messages, setMessages] = useState<Message[]>([]);
  const [turns, setTurns] = useState<TurnRecord[]>([]);
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState<'no' | 'yes' | 'queue'>('no');
  const [hints, setHints] = useState<string[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [tip, setTip] = useState<string | null>(null);
  const [tipBusy, setTipBusy] = useState(false);
  const history = useRef<ChatTurn[]>([]);
  const listener = useRef<ListenHandle | null>(null);
  const recorder = useRef<RecordHandle | null>(null);
  const lastClip = useRef<Blob | null>(null);
  const nextId = useRef(1);
  const bottom = useRef<HTMLDivElement>(null);

  const canRecognize = recognitionSupported();
  // 음성 인식이 안 되는 브라우저 + 보호자 동의 → 녹음을 Gemini 로 보내 받아쓰기와 대답을 한 번에 받는다.
  const audioMode = !canRecognize && save.settings.sendAudioToGemini && recorderSupported();
  const wantsPronunciation = save.settings.pronunciationFeedback && tier >= 4 && recorderSupported();
  const turnsLeft = budget.turns - turns.length;

  useEffect(() => () => { stopAll(); listener.current?.stop(); recorder.current?.stop(); }, []);
  useEffect(() => { bottom.current?.scrollIntoView?.({ block: 'end' }); }, [messages, thinking]);

  const say = (text: string, slow = false) => speakLine(text, who.voice, slow ? 'slow' : speed);
  const push = (m: Omit<Message, 'id'>) => setMessages((prev) => [...prev, { ...m, id: nextId.current++ }]);

  const begin = () => {
    const opener = career ? 'Hello! Thank you for coming. Please tell me about yourself.' : npcId ? 'Hi! How are you today?' : pack.story.talk.opener;
    game().startTalkSession();
    history.current = [{ role: 'model', text: opener }];
    push({ who: 'npc', text: opener });
    say(opener);
    setHints(pocket.slice(0, 2));
    setPhase('chat');
  };


  const send = async (text: string, clip: Blob | null) => {
    const said = text.trim();
    if ((said.length === 0 && !clip) || thinking !== 'no' || turnsLeft <= 0) return;
    setDraft('');
    setHints([]);
    if (said) push({ who: 'me', text: said });
    setThinking('yes');
    const system = buildTalkSystemPrompt({
      npcPersona: who.persona,
      scene: career ? CAREER_SCENES[save.career ?? 'teacher'] ?? pack.story.talk.scene : pack.story.talk.scene,
      level,
      mbti: save.profile?.mbti ?? null,
      phrasePocket: pocket,
      dictionaryWords: Object.keys(save.dictionary).slice(-12),
      withTranscript: clip !== null,
    });
    const audio = clip ? { base64: await blobToBase64(clip), mimeType: clip.type.split(';')[0] || 'audio/webm' } : undefined;
    const result = await askGemini(
      { kind: career ? 'roleplay' : 'talk', system, history: history.current, user: said, schema: talkSchema(clip !== null), audio },
      () => setThinking('queue'),
    );
    setThinking('no');

    if (!result.ok) {
      if (result.reason === 'limit' || result.reason === 'no-key') {
        push({ who: 'npc', text: mentorLine('limit', 0) });
        setTimeout(() => finishWith(turns), 600);
      } else {
        const sorry = "Sorry, I didn't catch that. Can you say it again?";
        push({ who: 'npc', text: sorry });
        say(sorry);
      }
      return;
    }

    const reply: TalkReply = parseTalkReply(result.text);
    const heard = said || reply.transcript || '';
    if (!said && heard) push({ who: 'me', text: heard });
    const record = scoreTurn({ said: heard, reply, pocket, tier, speed });
    history.current = [...history.current, { role: 'user' as const, text: heard }, { role: 'model' as const, text: reply.reply }].slice(-12);
    setMessages((prev) => {
      const out = [...prev];
      // 고쳐 말하기는 "틀렸어"가 아니라 학생 말풍선 아래의 작은 도움말로 보여준다.
      for (let i = out.length - 1; i >= 0; i--) {
        const m = out[i];
        if (m && m.who === 'me') { out[i] = { ...m, recast: reply.recast }; break; }
      }
      return [...out, { id: nextId.current++, who: 'npc', text: reply.reply, cheer: reply.encouragement }];
    });
    setHints(reply.suggestedNext);
    game().awardXp(record.xp);
    game().recordTalkTurn(record.phrases.length);
    if (record.phrases.length > 0) playSfx('collect');
    say(reply.reply);
    const next = [...turns, record];
    setTurns(next);
    if (next.length >= budget.turns) setTimeout(() => finishWith(next), 900);
  };

  const finishWith = (all: TurnRecord[]) => {
    const summary = summarizeTalk(all, budget.turns);
    if (summary.completed) game().awardXp(TALK_COMPLETE_BONUS);
    game().advanceActivity();
    setPhase('summary');
    playSfx('quest');
  };
  const finish = () => finishWith(turns);

  const toggleMic = () => {
    if (listening) {
      listener.current?.stop();
      recorder.current?.stop();
      return;
    }
    stopAll();
    setListening(true);
    if (audioMode || (wantsPronunciation && canRecognize)) {
      const rec = recordClip(TALK_AUDIO_MAX_SECONDS);
      recorder.current = rec;
      void rec.clip.then((blob) => {
        lastClip.current = blob;
        if (audioMode) { setListening(false); if (blob) void send('', blob); }
      });
    }
    if (canRecognize) {
      const handle = listenOnce({ onInterim: setDraft, silenceMs: save.settings.autoSendSpeech ? 1500 : 0, maxMs: 15000 });
      listener.current = handle;
      void handle.result.then((text) => {
        recorder.current?.stop();
        setListening(false);
        setDraft(text);
        // 설정에 따라: 1.5초 정적 후 자동 전송, 또는 학생이 확인하고 전송
        if (save.settings.autoSendSpeech && text.trim()) void send(text, null);
      });
    }
  };

  const askPronunciation = async () => {
    const clip = lastClip.current;
    const last = turns[turns.length - 1];
    if (!clip || !last || tipBusy) return;
    setTipBusy(true);
    const result = await askGemini({
      kind: 'pronunciation',
      system: 'You are a kind English pronunciation coach for a child. Listen to the recording. In very easy English (at most 30 words, no Korean): give ONE thing that sounded good and ONE sound to practice. Never say "wrong".',
      user: `The child tried to say: "${last.said}"`,
      audio: { base64: await blobToBase64(clip), mimeType: clip.type.split(';')[0] || 'audio/webm' },
    });
    setTipBusy(false);
    setTip(result.ok ? parseTalkReply(result.text).reply : mentorLine('limit', 1));
  };

  const title = career ? 'Interview Practice' : `Talk Time with ${who.name}`;
  const summary = summarizeTalk(turns, budget.turns);
  const practicePhrases = pocket.slice(0, 3);

  return (
    <Modal title={title} icon="💬" onClose={() => { stopAll(); onClose(); }}>
      {phase === 'intro' && (
        <div className="space-y-4 text-center">
          <div className="flex justify-center"><Portrait emoji={who.portrait} size={96} /></div>
          <p className="text-xl font-extrabold">{who.name}</p>
          <p className="text-lg">{career ? CAREER_SCENES[save.career ?? 'teacher'] : pack.story.talk.scene}</p>
          {budget.blocked === null ? (
            <>
              <p className="rounded-2xl bg-white/10 p-3 text-base" aria-label="Call budget">
                🤖 This talk: up to <b>{budget.turns}</b> {budget.turns === 1 ? 'turn' : 'turns'} · <b>{leftAtStart}</b> calls left today
              </p>
              <Btn big icon="🎤" className="w-full" onClick={begin}>Start talking</Btn>
            </>
          ) : (
            <>
              <p role="status" className="rounded-2xl bg-white/10 p-3 text-lg">
                {budget.blocked === 'no-key' ? `🔑 ${who.name} can not chat yet. Ask a grown-up to open ⚙️.`
                  : budget.blocked === 'daily-limit' ? '🌙 That is enough talking for today. See you tomorrow!'
                  : `😴 ${mentorLine('limit', 0)}`}
              </p>
              <Btn big tone="sky" icon="🎤" className="w-full" onClick={() => setPhase('practice')}>Practice saying phrases</Btn>
            </>
          )}
        </div>
      )}

      {phase === 'practice' && (
        practiceIndex < practicePhrases.length ? (
          <EchoPractice key={practiceIndex} text={practicePhrases[practiceIndex] as string} speed={speed} voice={who.voice}
            onResult={(accuracy) => { game().skillDone({ skill: 'speaking', tier, accuracy, speed }); setPracticeIndex((i) => i + 1); }} />
        ) : (
          <div className="space-y-3 text-center">
            <p className="emoji text-6xl">🎉</p>
            <p className="text-xl font-bold">Great practice!</p>
            <Btn big tone="meadow" icon="✅" onClick={onClose}>OK</Btn>
          </div>
        )
      )}

      {phase === 'chat' && (
        <div className="flex flex-col gap-3">
          <p className="text-center text-base font-bold" aria-label="Turns left">💬 {Math.max(0, turnsLeft)}/{budget.turns}{budget.turns < TALK_MAX_TURNS ? ' (short talk)' : ''}</p>
          <ul className="space-y-3" aria-live="polite">
            {messages.map((m, i) => (
              <li key={m.id} className={`flex items-end gap-2 ${m.who === 'me' ? 'flex-row-reverse' : ''}`}>
                {m.who === 'npc' ? <Portrait emoji={who.portrait} size={48} /> : null}
                <div className={`max-w-[80%] rounded-2xl p-3 text-lg ${m.who === 'npc' ? 'bg-paper text-ink' : 'bg-honey text-ink'}`}>
                  {m.who === 'npc' ? <p className="mb-1 text-sm font-bold text-maple">{who.name}</p> : null}
                  <p className="font-bold leading-relaxed">{m.who === 'npc' && i === messages.length - 1 ? <Typewriter text={m.text} /> : m.text}</p>
                  {m.cheer ? <p className="mt-1 text-base">{m.cheer}</p> : null}
                  {m.recast ? <p className="mt-2 rounded-xl bg-white/70 p-2 text-base" aria-label="A nice way to say it">💡 You can say: <b>{m.recast}</b></p> : null}
                  {m.who === 'npc' ? (
                    <div className="mt-2 flex gap-2">
                      <Btn tone="sky" icon="🔁" aria-label="Hear it again" onClick={() => say(m.text)} />
                      <Btn tone="sky" icon="🐢" aria-label="Hear it slowly" onClick={() => say(m.text, true)} />
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
            {thinking !== 'no' ? (
              <li className="flex items-end gap-2" role="status">
                <Portrait emoji={who.portrait} size={48} />
                <p className="animate-pulse rounded-2xl bg-paper p-3 text-lg font-bold text-ink">{thinking === 'queue' ? 'Hmm, let me think… 🤔' : '…'}</p>
              </li>
            ) : null}
          </ul>
          <div ref={bottom} />

          {hints.length > 0 && thinking === 'no' ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Hints: listen and say">
              {hints.map((h) => (
                // 힌트는 대신 말해 주지 않는다. 들려주기만 하고, 학생이 직접 따라 말한다.
                <button key={h} type="button" onClick={() => say(h)} className="min-h-11 rounded-full border-2 border-dashed border-honey px-3 py-1 text-base font-bold">👂 {h}</button>
              ))}
            </div>
          ) : null}

          <div className="sticky bottom-0 space-y-2 rounded-2xl bg-night-2 p-2">
            <div className="flex gap-2">
              <label htmlFor="talk-input" className="sr-only">Your words</label>
              <input id="talk-input" value={draft} maxLength={300} autoComplete="off" placeholder={canRecognize || audioMode ? 'Tap 🎤 and speak, or type' : 'Type your words'}
                onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(draft, null); }}
                className="min-h-12 flex-1 rounded-xl border-2 border-white/30 bg-white px-3 text-lg text-ink" />
              <Btn tone="meadow" icon="📨" aria-label="Send" disabled={draft.trim().length === 0 || thinking !== 'no' || listening} onClick={() => void send(draft, null)} />
            </div>
            <div className="flex gap-2">
              {canRecognize || audioMode ? (
                <Btn big tone={listening ? 'berry' : 'honey'} icon={listening ? '⏹️' : '🎤'} className="flex-1" disabled={thinking !== 'no'} onClick={toggleMic}>
                  {listening ? 'Done' : 'Speak'}
                </Btn>
              ) : null}
              <Btn tone="ghost" icon="🏁" onClick={finish}>End</Btn>
            </div>
          </div>
        </div>
      )}

      {phase === 'summary' && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-paper p-4 text-ink" aria-label="Talk summary">
            <p className="mb-2 text-center text-2xl font-extrabold">🎉 Nice talk!</p>
            <ul className="space-y-1 text-lg">
              <li>🗣️ Sentences I said: <b>{summary.sentences}</b></li>
              <li>💬 Pocket phrases I used: <b>{summary.phrases.length}</b>{summary.phrases.length > 0 ? ` — ${summary.phrases.join(' · ')}` : ''}</li>
              <li>⭐ XP: <b>{summary.xp}</b>{summary.completed ? ' (full talk bonus!)' : ''}</li>
            </ul>
            {summary.recasts.length > 0 ? (
              <div className="mt-3">
                <p className="font-bold">💡 Nice ways to say it:</p>
                <ul className="space-y-1">
                  {summary.recasts.map((r, i) => (
                    <li key={i} className="rounded-xl bg-white p-2 text-base"><span className="text-ink/60">{r.said}</span> → <b>{r.better}</b></li>
                  ))}
                </ul>
              </div>
            ) : null}
            {tip ? <p className="mt-3 rounded-xl bg-sky/40 p-2 text-base">🎧 {tip}</p> : null}
          </div>
          {wantsPronunciation && lastClip.current && !tip ? (
            <Btn tone="sky" icon="🎧" className="w-full" disabled={tipBusy} onClick={() => void askPronunciation()}>Pronunciation tip</Btn>
          ) : null}
          <Btn big tone="meadow" icon="✅" className="w-full" onClick={onClose}>OK</Btn>
        </div>
      )}
    </Modal>
  );
}
