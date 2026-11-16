import { useState } from 'react';
import { MBTI_TYPES, type Gender, type Mbti, type Profile } from '@/types';
import { HAIR_COLORS, HAIR_STYLES, OUTFIT_COLORS } from '@/config/appearance';
import { containsHangul } from '@/features/dictionary/hangul';
import { MBTI_QUESTIONS, mbtiFromAnswers } from '@/features/mbti/style';
import { Avatar2D } from '@/ui/Avatar2D';
import { Btn, Paper } from '@/ui/kit';
import { playSfx } from '@/audio/sfx';

// 캐릭터 만들기: 닉네임 → 성별·외형 → MBTI(모르면 그림 4문항)
// 글을 못 읽는 아이도 할 수 있게 그림·색 버튼 위주로 구성한다.

function Swatches({ colors, value, onChange, label }: { colors: readonly string[]; value: number; onChange: (i: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {colors.map((c, i) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${label} ${i + 1}`}
          onClick={() => { playSfx('tap'); onChange(i); }}
          className={`h-11 w-11 rounded-full border-4 ${value === i ? 'border-ink scale-110' : 'border-white'} transition`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

export function CharacterCreate({ onDone }: { onDone: (p: Profile) => void }) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<Gender>('girl');
  const [hair, setHair] = useState(0);
  const [hairColorIdx, setHairColorIdx] = useState(0);
  const [outfit, setOutfit] = useState(0);
  const [mbti, setMbti] = useState<Mbti | null>(null);
  const [quiz, setQuiz] = useState<string[] | null>(null);

  const name = nickname.trim();
  const nameOk = name.length >= 1 && name.length <= 12 && !containsHangul(name);
  const look = { gender, hair, hairColor: hairColorIdx, outfitColor: outfit };

  const answer = (letter: string) => {
    const next = [...(quiz ?? []), letter];
    if (next.length >= MBTI_QUESTIONS.length) {
      setMbti(mbtiFromAnswers(next));
      setQuiz(null);
    } else setQuiz(next);
  };
  const question = quiz ? MBTI_QUESTIONS[quiz.length] : undefined;

  return (
    <div className="scroll-y flex h-full items-start justify-center bg-gradient-to-b from-sky to-paper p-4 sm:items-center">
      <Paper className="w-full max-w-xl">
        <h1 className="mb-3 text-center text-2xl font-extrabold">✨ Make Your Hero</h1>
        <div className="mb-3 flex justify-center"><Avatar2D look={look} size={130} /></div>

        {step === 0 && (
          <div className="space-y-3">
            <label className="block text-lg font-bold" htmlFor="nick">🏷️ Nickname</label>
            <input
              id="nick"
              value={nickname}
              maxLength={12}
              autoComplete="off"
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Star, Tiger, Moon..."
              className="w-full rounded-xl border-2 border-ink/30 bg-white px-3 py-3 text-xl"
            />
            <p className="text-base text-ink/80">🙈 Use a fun nickname, not your real name.</p>
            {containsHangul(name) ? <p role="alert" className="text-base font-bold text-maple">✏️ English letters, please!</p> : null}
            <Btn big icon="➡️" className="w-full" disabled={!nameOk} onClick={() => setStep(1)}>Next</Btn>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div role="radiogroup" aria-label="Boy or girl" className="flex gap-2">
              {(['girl', 'boy'] as const).map((g) => (
                <Btn key={g} role="radio" aria-checked={gender === g} tone={gender === g ? 'honey' : 'paper'} icon={g === 'girl' ? '👧' : '👦'} className="flex-1" onClick={() => setGender(g)}>
                  {g === 'girl' ? 'Girl' : 'Boy'}
                </Btn>
              ))}
            </div>
            <div>
              <p className="mb-1 font-bold">💇 Hair</p>
              <div role="radiogroup" aria-label="Hair style" className="mb-2 flex gap-2">
                {HAIR_STYLES.map((h, i) => (
                  <Btn key={h} role="radio" aria-checked={hair === i} tone={hair === i ? 'honey' : 'paper'} className="flex-1" onClick={() => setHair(i)}>{h}</Btn>
                ))}
              </div>
              <Swatches colors={HAIR_COLORS} value={hairColorIdx} onChange={setHairColorIdx} label="Hair color" />
            </div>
            <div>
              <p className="mb-1 font-bold">👕 Clothes</p>
              <Swatches colors={OUTFIT_COLORS} value={outfit} onChange={setOutfit} label="Clothes color" />
            </div>
            <div className="flex gap-2">
              <Btn tone="paper" icon="⬅️" aria-label="Back" onClick={() => setStep(0)} />
              <Btn big icon="➡️" className="flex-1" onClick={() => setStep(2)}>Next</Btn>
            </div>
          </div>
        )}

        {step === 2 && !question && (
          <div className="space-y-3">
            <p className="text-lg font-bold">🧩 Your style {mbti ? <span className="rounded-lg bg-honey px-2">{mbti}</span> : null}</p>
            <div role="radiogroup" aria-label="MBTI" className="grid grid-cols-4 gap-2">
              {MBTI_TYPES.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={mbti === m} onClick={() => { playSfx('tap'); setMbti(m); }}
                  className={`min-h-11 rounded-xl border-2 text-base font-bold ${mbti === m ? 'border-maple bg-honey' : 'border-ink/20 bg-white'}`}>
                  {m}
                </button>
              ))}
            </div>
            <Btn tone="sky" icon="❓" className="w-full" onClick={() => setQuiz([])}>I don't know. Help me!</Btn>
            <div className="flex gap-2">
              <Btn tone="paper" icon="⬅️" aria-label="Back" onClick={() => setStep(1)} />
              <Btn big icon="🚀" className="flex-1" disabled={!mbti} onClick={() => mbti && onDone({ nickname: name, mbti, ...look })}>Start!</Btn>
            </div>
          </div>
        )}

        {step === 2 && question && (
          <div className="space-y-3">
            <p className="text-center text-xl font-bold">{question.prompt}</p>
            <div className="grid grid-cols-2 gap-3">
              {[question.a, question.b].map((o) => (
                <button key={o.letter} type="button" onClick={() => { playSfx('tap'); answer(o.letter); }}
                  className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-4 border-honey bg-white p-3 text-lg font-bold">
                  <span className="emoji text-6xl" aria-hidden="true">{o.icon}</span>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Paper>
    </div>
  );
}
