import { useEffect, useRef, useState } from 'react';
import type { Speed } from '@/types';
import type { VoiceProfile } from '@/config/npcVoices';
import { speakLine, stopAll } from '@/audio/player';
import { playSfx } from '@/audio/sfx';
import { Btn } from '@/ui/kit';
import { speechAccuracy } from './scoring';
import { listenOnce, recognitionSupported, recordClip, recorderSupported, type ListenHandle, type RecordHandle } from './speech';

// 따라 말하기(echo) · 쉐도잉(shadow) 연습. 채점은 기기 안에서만 한다(API 사용 없음).
//  - 음성 인식이 되면: 인식 결과와 목표 문장의 단어 일치율로 별점
//  - 안 되면: 녹음 → 내 목소리 다시 듣기 → 스스로 평가

export function stars(accuracy: number): string {
  return accuracy >= 0.8 ? '⭐⭐⭐' : accuracy >= 0.6 ? '⭐⭐' : '⭐';
}

interface Props {
  text: string;
  speed: Speed;
  voice: VoiceProfile;
  /** shadow: 오디오와 동시에 말한다 */
  mode?: 'echo' | 'shadow';
  /** 글자를 숨기고 소리만 (듣고 따라 말하기) */
  hideText?: boolean;
  onResult: (accuracy: number) => void;
}

export function EchoPractice({ text, speed, voice, mode = 'echo', hideText, onResult }: Props) {
  const canRecognize = recognitionSupported();
  const canRecord = recorderSupported();
  const [phase, setPhase] = useState<'idle' | 'listening' | 'scored' | 'review'>('idle');
  const [heard, setHeard] = useState('');
  const [accuracy, setAccuracy] = useState(0);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const listener = useRef<ListenHandle | null>(null);
  const recorder = useRef<RecordHandle | null>(null);

  useEffect(() => {
    setPhase('idle');
    setHeard('');
    speakLine(text, voice, speed);
    return () => { stopAll(); listener.current?.stop(); recorder.current?.stop(); };
  }, [text, voice, speed]);
  useEffect(() => () => { if (clipUrl) URL.revokeObjectURL(clipUrl); }, [clipUrl]);

  const startSpeaking = () => {
    setHeard('');
    setPhase('listening');
    if (mode === 'shadow') speakLine(text, voice, speed);
    else stopAll();
    if (canRecognize) {
      const handle = listenOnce({ onInterim: setHeard, silenceMs: 1500, maxMs: 12000 });
      listener.current = handle;
      void handle.result.then((said) => {
        const acc = speechAccuracy(text, said);
        setHeard(said);
        setAccuracy(acc);
        setPhase('scored');
        playSfx(acc >= 0.6 ? 'correct' : 'wrong');
      });
    } else if (canRecord) {
      const handle = recordClip(10);
      recorder.current = handle;
      void handle.clip.then((blob) => {
        setClipUrl(blob ? URL.createObjectURL(blob) : null);
        setPhase('review');
      });
    } else {
      setPhase('review');
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-paper p-4 text-ink">
      <div className="flex items-center gap-3">
        <Btn tone="sky" icon="🔊" aria-label="Listen again" onClick={() => speakLine(text, voice, speed)} />
        <p className="flex-1 text-2xl font-extrabold leading-snug">{hideText ? '👂 Listen and say it!' : text}</p>
      </div>

      {phase === 'idle' && (
        <Btn big tone="honey" icon="🎤" className="w-full" onClick={startSpeaking}>{mode === 'shadow' ? 'Say it together!' : 'Say it!'}</Btn>
      )}

      {phase === 'listening' && (
        <div className="space-y-2">
          <p className="min-h-8 rounded-xl bg-white p-2 text-lg" aria-live="polite">🎙️ {heard || '...'}</p>
          <Btn big tone="berry" icon="⏹️" className="w-full" onClick={() => { listener.current?.stop(); recorder.current?.stop(); }}>Done</Btn>
        </div>
      )}

      {phase === 'scored' && (
        <div className="space-y-2 text-center">
          <p className="emoji text-4xl" aria-label={`${Math.round(accuracy * 100)} percent`}>{stars(accuracy)}</p>
          <p className="rounded-xl bg-white p-2 text-lg">🎙️ {heard || '...'}</p>
          <div className="flex gap-2">
            <Btn tone="paper" icon="🔁" className="flex-1" onClick={startSpeaking}>Again</Btn>
            <Btn tone="meadow" icon="➡️" className="flex-1" onClick={() => onResult(accuracy)}>Next</Btn>
          </div>
        </div>
      )}

      {phase === 'review' && (
        <div className="space-y-2">
          {clipUrl ? <audio src={clipUrl} controls className="w-full" aria-label="My voice" /> : null}
          <p className="text-center text-lg font-bold">How was it?</p>
          <div className="flex gap-2">
            <Btn tone="paper" icon="🔁" className="flex-1" onClick={startSpeaking}>Again</Btn>
            <Btn tone="meadow" icon="👍" className="flex-1" onClick={() => onResult(0.8)}>I said it!</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
