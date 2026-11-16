import { useState } from 'react';
import { ALL_PACKS, findWordAnywhere } from '@/content/loader';
import { HAIR_COLORS, HAIR_STYLES, OUTFIT_COLORS } from '@/config/appearance';
import { NPCS } from '@/config/npcVoices';
import { playWord, speakLine } from '@/audio/player';
import { BADGES } from '@/features/progression/badges';
import { localDayKey } from '@/features/progression/time';
import { CardFace } from '@/features/dictionary/CardFace';
import { ReviewQuiz } from '@/features/dictionary/ReviewQuiz';
import { dueCards } from '@/features/dictionary/srs';
import { useGame } from '@/save/store';
import { Avatar2D } from '@/ui/Avatar2D';
import { Btn, Modal } from '@/ui/kit';

// 가방(인벤토리): 그림 사전 카드, 표현 주머니, 배지, 의상.

type Tab = 'dictionary' | 'phrases' | 'badges' | 'outfit';
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'dictionary', icon: '🖍️', label: 'Dictionary' },
  { id: 'phrases', icon: '💬', label: 'Phrases' },
  { id: 'badges', icon: '🏅', label: 'Badges' },
  { id: 'outfit', icon: '👕', label: 'Outfit' },
];

export function Bag({ tab: initial, onClose }: { tab?: Tab; onClose: () => void }) {
  const save = useGame((s) => s.save);
  const updateProfile = useGame((s) => s.updateProfile);
  const [tab, setTab] = useState<Tab>(initial ?? 'dictionary');
  const [review, setReview] = useState(false);
  const cards = Object.values(save.dictionary).sort((a, b) => b.createdAt - a.createdAt);
  const due = dueCards(cards, localDayKey(new Date())).filter((c) => c.value !== '').length;
  const profile = save.profile;

  return (
    <Modal title="My Bag" icon="🎒" onClose={onClose} wide>
      <div role="tablist" className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <Btn key={t.id} role="tab" aria-selected={tab === t.id} tone={tab === t.id ? 'honey' : 'ghost'} icon={t.icon} className="flex-1" onClick={() => { setTab(t.id); setReview(false); }}>
            <span className="hidden sm:inline">{t.label}</span>
          </Btn>
        ))}
      </div>

      {tab === 'dictionary' && (review ? <ReviewQuiz onDone={() => setReview(false)} /> : (
        <div className="space-y-3">
          <Btn big tone="meadow" icon="🃏" className="w-full" disabled={due === 0} onClick={() => setReview(true)}>Review ({due})</Btn>
          {cards.length === 0 ? <p className="text-center text-lg">📖 ➡️ 🖍️ Read a story and draw your first word!</p> : null}
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {cards.map((card) => (
              <li key={card.word}>
                <button type="button" onClick={() => playWord(findWordAnywhere(card.word)?.pack ?? null, card.word)} className="flex w-full flex-col items-center gap-1 rounded-2xl bg-white/10 p-2">
                  <CardFace card={card} size={84} />
                  <span className="text-base font-bold">{card.word}</span>
                  <span className="text-xs text-paper/70" aria-label={`Box ${card.box} of 5`}>{'●'.repeat(card.box)}{'○'.repeat(5 - card.box)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {tab === 'phrases' && (
        <div className="space-y-4">
          {ALL_PACKS.map((pack) => {
            const got = save.stories[pack.meta.id]?.phrases ?? [];
            if (got.length === 0) return null;
            return (
              <section key={pack.meta.id}>
                <h3 className="mb-2 text-lg font-extrabold text-honey">{pack.meta.cover} {pack.meta.title} ({got.length}/{pack.story.phrasePocket.length})</h3>
                <ul className="flex flex-wrap gap-2">
                  {got.map((phrase) => (
                    <li key={phrase}>
                      <button type="button" onClick={() => { const v = NPCS.harper?.voice; if (v) speakLine(phrase, v, save.settings.speed, false); }}
                        className="min-h-11 rounded-full bg-paper px-4 py-2 text-lg font-bold text-ink">💬 {phrase}</button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {Object.values(save.stories).every((s) => s.phrases.length === 0) ? <p className="text-center text-lg">📖 Read Along to fill your Phrase Pocket!</p> : null}
        </div>
      )}

      {tab === 'badges' && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BADGES.map((b) => {
            const owned = save.badges.includes(b.id);
            return (
              <li key={b.id} className={`flex items-center gap-3 rounded-2xl p-3 ${owned ? 'bg-lilac/30' : 'bg-white/5 opacity-60'}`}>
                <span className={`emoji text-4xl ${owned ? '' : 'grayscale'}`} aria-hidden="true">{owned ? b.icon : '🔒'}</span>
                <span><span className="block text-base font-extrabold">{b.name}</span><span className="block text-sm text-paper/80">{b.hint}</span></span>
              </li>
            );
          })}
        </ul>
      )}

      {tab === 'outfit' && profile && (
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-paper p-4 text-ink">
          <Avatar2D look={profile} size={130} />
          <div role="radiogroup" aria-label="Hair style" className="flex gap-2">
            {HAIR_STYLES.map((h, i) => <Btn key={h} role="radio" aria-checked={profile.hair === i} tone={profile.hair === i ? 'honey' : 'paper'} onClick={() => updateProfile({ hair: i })}>{h}</Btn>)}
          </div>
          {([['Hair color', HAIR_COLORS, 'hairColor'], ['Clothes color', OUTFIT_COLORS, 'outfitColor']] as const).map(([label, colors, key]) => (
            <div key={key} role="radiogroup" aria-label={label} className="flex gap-2">
              {colors.map((c, i) => (
                <button key={c} type="button" role="radio" aria-checked={profile[key] === i} aria-label={`${label} ${i + 1}`} onClick={() => updateProfile({ [key]: i })}
                  className={`h-11 w-11 rounded-full border-4 ${profile[key] === i ? 'border-ink scale-110' : 'border-white'}`} style={{ background: c }} />
              ))}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
