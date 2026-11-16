import { recommendedPacks } from '@/content/loader';
import { currentStage } from '@/features/progression/lifeStages';
import { localDayKey } from '@/features/progression/time';
import { useGame } from '@/save/store';
import { useUi } from '@/app/uiStore';
import { zoneById } from '@/config/zones';
import { playSfx } from '@/audio/sfx';
import { Modal } from '@/ui/kit';
import { buildQuests, listeningPlan, questStyle, recommendForStyle, type Quest } from './quests';

// 퀘스트 로그: 메인 / 서브 / 일일. 퀘스트를 누르면 그 장소로 이동해 바로 시작한다.
// J 성향은 "오늘의 체크리스트 + 듣기 계획표"가 먼저, P 성향은 메인 퀘스트가 먼저 보인다.

function QuestRow({ q }: { q: Quest }) {
  const open = useUi((s) => s.open);
  const requestTeleport = useUi((s) => s.requestTeleport);
  const zone = zoneById(q.zoneId);
  return (
    <li>
      <button type="button" disabled={q.locked || !q.overlay}
        onClick={() => { if (!q.overlay) return; playSfx('open'); requestTeleport(q.zoneId); open(q.overlay); }}
        className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left ${q.done ? 'border-meadow bg-meadow/15' : q.locked ? 'border-white/15 bg-white/5 opacity-70' : 'border-honey bg-honey/10'}`}>
        <span className="emoji text-3xl" aria-hidden="true">{q.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold">{q.title}</span>
          <span className="block text-base text-paper/85">{q.detail}{zone ? ` · ${zone.icon} ${zone.name}` : ''}</span>
        </span>
        <span className="emoji text-2xl" aria-label={q.done ? 'done' : q.locked ? 'locked' : 'go'}>{q.done ? '✅' : q.locked ? '🔒' : '▶️'}</span>
      </button>
    </li>
  );
}

function Section({ title, quests }: { title: string; quests: Quest[] }) {
  if (quests.length === 0) return null;
  return (
    <section className="mb-4">
      <h3 className="mb-2 text-lg font-extrabold text-honey">{title}</h3>
      <ul className="space-y-2">{quests.map((q) => <QuestRow key={q.id} q={q} />)}</ul>
    </section>
  );
}

export function QuestLog({ onClose }: { onClose: () => void }) {
  const save = useGame((s) => s.save);
  const mbti = save.profile?.mbti ?? null;
  const quests = recommendForStyle(buildQuests(save, recommendedPacks(currentStage(save.graduated).id, mbti), localDayKey(new Date())), mbti);
  const style = questStyle(mbti);
  const plan = listeningPlan(save);
  const main = <Section key="main" title="⭐ Main Quests" quests={quests.filter((q) => q.kind === 'main')} />;
  const daily = (
    <div key="daily">
      <Section title="📋 Today" quests={quests.filter((q) => q.kind === 'daily')} />
      {style.checklistFirst && plan && plan.hoursLeft > 0 ? (
        <p className="mb-4 rounded-2xl bg-lilac/25 p-3 text-base">🗓️ My listening plan: <b>{plan.minutesPerDay} min</b> a day → graduation goal in <b>{plan.daysLeft}</b> days ({plan.hoursLeft}h left)</p>
      ) : null}
    </div>
  );
  return (
    <Modal title="Quest Log" icon="📜" onClose={onClose}>
      {style.checklistFirst ? [daily, main] : [main, daily]}
      <Section title="🧭 Side Quests" quests={quests.filter((q) => q.kind === 'sub')} />
      {style.surpriseEvents ? <p className="rounded-2xl bg-white/10 p-3 text-base">🎲 Explore! Find the dice for a surprise story.</p> : null}
    </Modal>
  );
}
