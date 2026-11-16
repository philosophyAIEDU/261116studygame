import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame, type GameFx } from '@/save/store';
import { badgeDef } from '@/features/progression/badges';
import { playSfx } from '@/audio/sfx';

// RPG 연출 레이어: XP 획득, 레벨업(빛 기둥 + 팡파르), 퀘스트 완료 배너, 배지 획득.
// 저장소의 fx 큐에서 하나씩 꺼내 보여준다.

const DURATION: Record<GameFx['kind'], number> = { xp: 900, levelUp: 2600, badge: 2200, questDone: 2000 };

export function FxLayer() {
  const fx = useGame((s) => s.fx[0]);
  const shiftFx = useGame((s) => s.shiftFx);

  useEffect(() => {
    if (!fx) return;
    if (fx.kind === 'levelUp') playSfx('levelup');
    else if (fx.kind === 'badge') playSfx('star');
    else if (fx.kind === 'questDone') playSfx('quest');
    const t = setTimeout(shiftFx, DURATION[fx.kind]);
    return () => clearTimeout(t);
  }, [fx, shiftFx]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center overflow-hidden" aria-live="polite">
      <AnimatePresence mode="wait">
        {fx?.kind === 'xp' && (
          <motion.div key={`xp-${fx.amount}-${Date.now()}`} initial={{ y: 120, opacity: 0 }} animate={{ y: 70, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
            className="rounded-full border-2 border-honey bg-night px-4 py-1 text-xl font-extrabold text-honey shadow-xl">
            +{fx.amount} XP
          </motion.div>
        )}
        {fx?.kind === 'questDone' && (
          <motion.div key={`q-${fx.title}`} initial={{ y: -120 }} animate={{ y: 24 }} exit={{ y: -120 }} transition={{ type: 'spring', damping: 16 }}
            className="rounded-2xl border-4 border-honey bg-paper px-6 py-3 text-center text-ink shadow-2xl">
            <p className="text-base font-bold text-maple">⭐ QUEST COMPLETE ⭐</p>
            <p className="text-2xl font-extrabold">{fx.title}</p>
          </motion.div>
        )}
        {fx?.kind === 'badge' && (
          <motion.div key={`b-${fx.id}`} initial={{ scale: 0.3, opacity: 0, y: 80 }} animate={{ scale: 1, opacity: 1, y: 80 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 rounded-2xl border-4 border-lilac bg-night px-5 py-3 shadow-2xl">
            <span className="emoji text-5xl">{badgeDef(fx.id)?.icon ?? '🏅'}</span>
            <span><span className="block text-base font-bold text-lilac">NEW BADGE</span><span className="block text-xl font-extrabold">{badgeDef(fx.id)?.name ?? fx.id}</span></span>
          </motion.div>
        )}
        {fx?.kind === 'levelUp' && (
          <motion.div key={`lv-${fx.level}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative flex h-full w-full items-center justify-center bg-night/50">
            <div className="beam absolute bottom-0 h-full w-40 bg-gradient-to-t from-honey via-honey/60 to-transparent" />
            <motion.div initial={{ scale: 0.2 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 9 }} className="relative rounded-3xl border-4 border-honey bg-night px-10 py-6 text-center shadow-2xl">
              <p className="text-2xl font-extrabold text-honey">LEVEL UP!</p>
              <p className="text-7xl font-extrabold">{fx.level}</p>
              {fx.gradeUp && fx.grade ? <p className="mt-1 text-2xl font-bold text-meadow">🎒 Welcome to Grade {fx.grade}!</p> : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
