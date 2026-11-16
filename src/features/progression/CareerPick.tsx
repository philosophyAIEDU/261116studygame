import { CAREERS } from '@/config/careers';
import { useGame } from '@/save/store';
import { playSfx } from '@/audio/sfx';
import { Modal } from '@/ui/kit';

/** 대학 졸업 후 직업 고르기. 나중에 다시 바꿀 수 있다. */
export function CareerPick({ onClose }: { onClose: () => void }) {
  const career = useGame((s) => s.save.career);
  const setCareer = useGame((s) => s.setCareer);
  const pushFx = useGame((s) => s.pushFx);
  return (
    <Modal title="Choose your job" icon="💼" onClose={onClose}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CAREERS.map((c) => (
          <li key={c.id}>
            <button type="button" aria-pressed={career === c.id}
              onClick={() => { setCareer(c.id); playSfx('quest'); pushFx({ kind: 'questDone', title: `New job: ${c.name}` }); onClose(); }}
              className={`flex w-full flex-col items-center gap-1 rounded-2xl border-4 p-3 text-center ${career === c.id ? 'border-meadow bg-meadow/20' : 'border-honey bg-paper text-ink'}`}>
              <span className="emoji text-5xl" aria-hidden="true">{c.icon}</span>
              <span className="text-lg font-extrabold">{c.name}</span>
              <span className="text-sm">{c.line}</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
