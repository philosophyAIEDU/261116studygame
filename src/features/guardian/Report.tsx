import { useState } from 'react';
import { ALL_PACKS } from '@/content/loader';
import { ko } from '@/i18n/ko';
import { currentStage, graduationCheck, playerLevel } from '@/features/progression/lifeStages';
import { formatInputTime } from '@/features/progression/inputHours';
import { useGame } from '@/save/store';
import { Bar, Btn, Modal } from '@/ui/kit';

// 보호자 리포트 (한국어, PIN 잠금): 누적 듣기 시간, 이야기별 반복 횟수, 그림 사전, 입력:출력 비율.

const t = ko.report;

/** 입력:출력 비율 계산 — 입력 = 듣기·읽기 활동 수, 출력 = 말하기·쓰기 활동 수 */
export function ioRatio(skills: { listening: { done: number }; reading: { done: number }; speaking: { done: number }; writing: { done: number } }, output: { spokenTurns: number; writtenPieces: number }) {
  const input = skills.listening.done + skills.reading.done;
  const out = skills.speaking.done + output.spokenTurns + output.writtenPieces;
  const total = input + out;
  return { input, output: out, inputPct: total === 0 ? 100 : Math.round((input / total) * 100) };
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 text-center">
      <p className="emoji text-3xl" aria-hidden="true">{icon}</p>
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="text-sm text-paper/80">{label}</p>
    </div>
  );
}

export function Report({ onClose }: { onClose: () => void }) {
  const save = useGame((s) => s.save);
  const patchSettings = useGame((s) => s.patchSettings);
  const pin = save.settings.guardianPin;
  const [entered, setEntered] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [wrong, setWrong] = useState(false);

  const submitPin = () => {
    if (!/^\d{4}$/.test(entered)) return;
    if (pin === null) { patchSettings({ guardianPin: entered }); setUnlocked(true); }
    else if (entered === pin) setUnlocked(true);
    else { setWrong(true); setEntered(''); }
  };

  if (!unlocked) {
    return (
      <Modal title={t.title} icon="📊" onClose={onClose} ko>
        <div className="mx-auto max-w-xs space-y-3 text-center">
          <label htmlFor="pin" className="block text-lg font-bold">{pin === null ? t.pinSet : t.pinEnter}</label>
          <input id="pin" type="password" inputMode="numeric" maxLength={4} value={entered} autoComplete="off"
            onChange={(e) => { setEntered(e.target.value.replace(/\D/g, '')); setWrong(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') submitPin(); }}
            className="h-14 w-full rounded-xl bg-white text-center text-3xl tracking-[0.5em] text-ink" />
          {wrong ? <p role="alert" className="font-bold text-berry">{t.pinWrong}</p> : null}
          <Btn big className="w-full" disabled={entered.length !== 4} onClick={submitPin}>{ko.common.confirm}</Btn>
        </div>
      </Modal>
    );
  }

  const level = playerLevel(save.xp, save.graduated).level;
  const stage = currentStage(save.graduated);
  const grad = graduationCheck(save.xp, save.graduated, save.input.totalSeconds);
  const cards = Object.values(save.dictionary);
  const ratio = ioRatio(save.skills, save.output);
  const hours = Math.floor(save.input.totalSeconds / 360) / 10;

  return (
    <Modal title={t.title} icon="📊" onClose={onClose} ko wide>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="👂" label={t.inputHours} value={formatInputTime(save.input.totalSeconds)} />
        <Stat icon="⭐" label={`${t.level} · ${stage.icon}`} value={`Lv ${level}`} />
        <Stat icon="🔥" label={t.streak} value={`${save.streak.days}${t.days}`} />
        <Stat icon="🖍️" label={`${t.dictWords} (${t.drawn} ${cards.filter((c) => c.kind === 'drawing').length})`} value={String(cards.length)} />
      </div>

      {stage.inputHoursGoal !== null ? (
        <section className="mt-4 rounded-2xl bg-white/10 p-4">
          <h3 className="mb-2 text-lg font-extrabold text-honey">{t.nextGoal}</h3>
          <p className="mb-1 text-base">👂 {hours} / {grad.needHours} {t.hours}</p>
          <Bar value={hours} max={grad.needHours} tone="lilac" label={t.inputHours} />
          <p className="mb-1 mt-2 text-base">⭐ Lv {level} / {grad.needLevel}</p>
          <Bar value={level} max={grad.needLevel} label={t.level} />
        </section>
      ) : null}

      <section className="mt-4 rounded-2xl bg-white/10 p-4">
        <h3 className="mb-2 text-lg font-extrabold text-honey">{t.ratio}</h3>
        <div className="flex h-8 overflow-hidden rounded-full" role="img" aria-label={`${t.input} ${ratio.inputPct}% / ${t.output} ${100 - ratio.inputPct}%`}>
          <div className="flex items-center justify-center bg-lilac text-sm font-bold" style={{ width: `${ratio.inputPct}%` }}>{ratio.inputPct}%</div>
          <div className="flex items-center justify-center bg-honey text-sm font-bold text-ink" style={{ width: `${100 - ratio.inputPct}%` }}>{100 - ratio.inputPct > 8 ? `${100 - ratio.inputPct}%` : ''}</div>
        </div>
        <p className="mt-2 text-base">🟣 {t.input}: {ratio.input}{t.times} · 🟡 {t.output}: {ratio.output}{t.times} · 💬 {t.talk}: {save.talk.totalSessions}{t.times}</p>
        <p className="mt-1 text-sm leading-relaxed text-paper/80">{t.ratioHint}</p>
      </section>

      <section className="mt-4 rounded-2xl bg-white/10 p-4">
        <h3 className="mb-2 text-lg font-extrabold text-honey">{t.stories}</h3>
        <ul className="space-y-2">
          {ALL_PACKS.map((pack) => {
            const count = save.stories[pack.meta.id]?.listenCount ?? 0;
            return (
              <li key={pack.meta.id} className="flex items-center gap-2">
                <span className="emoji text-2xl" aria-hidden="true">{pack.meta.cover}</span>
                <span className="w-40 truncate text-base font-bold">{pack.meta.title}</span>
                <span className="flex-1"><Bar value={count} max={10} tone="meadow" label={pack.meta.title} /></span>
                <span className="w-20 text-right text-sm">{count}{t.listens}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-4"><Btn tone="ghost" onClick={() => { patchSettings({ guardianPin: null }); onClose(); }}>{t.pinChange}</Btn></div>
    </Modal>
  );
}
