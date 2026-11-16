import { STORY_STEPS } from '@/types';
import { recommendedPacks } from '@/content/loader';
import { currentStage } from '@/features/progression/lifeStages';
import { useGame } from '@/save/store';
import { useUi } from '@/app/uiStore';
import { playSfx } from '@/audio/sfx';
import { Modal } from '@/ui/kit';
import { emptyStoryProgress, medalIcon } from './unlock';

/** 이야기 고르기. MBTI 취향(S: 일상 / N: 모험)에 맞는 이야기를 앞에 추천한다. */
export function StoryList({ onClose }: { onClose: () => void }) {
  const save = useGame((s) => s.save);
  const open = useUi((s) => s.open);
  const packs = recommendedPacks(currentStage(save.graduated).id, save.profile?.mbti ?? null);
  return (
    <Modal title="Story Quests" icon="📚" onClose={onClose} wide>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {packs.map((pack, i) => {
          const p = save.stories[pack.meta.id] ?? emptyStoryProgress();
          const done = STORY_STEPS.filter((s) => p.steps[s]).length;
          return (
            <li key={pack.meta.id}>
              <button type="button" onClick={() => { playSfx('open'); open({ type: 'story', packId: pack.meta.id }); }}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-honey bg-paper p-3 text-left text-ink">
                <span className="emoji text-5xl" aria-hidden="true">{pack.meta.cover}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xl font-extrabold">{pack.meta.title}</span>
                  <span className="flex items-center gap-1" aria-label={`${done} of 5 steps done`}>
                    {STORY_STEPS.map((s) => <span key={s} className={`h-2.5 w-5 rounded-full ${p.steps[s] ? 'bg-meadow' : 'bg-ink/15'}`} />)}
                  </span>
                  <span className="block text-base font-bold">👂 × {p.listenCount} <span className="emoji">{medalIcon(p.medal)}</span>{i === 0 && done === 0 ? ' ⭐ For you!' : ''}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
