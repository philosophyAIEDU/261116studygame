import { useEffect, useState } from 'react';
import { useGame } from '@/save/store';
import { useUi } from '@/app/uiStore';
import { ALL_PACKS } from '@/content/loader';
import { NPCS, npc } from '@/config/npcVoices';
import { CHARACTER_DESIGNS } from '@/config/characters';
import { speakLine, stopAll } from '@/audio/player';
import { playSfx } from '@/audio/sfx';
import { playerPos } from '@/world/input';
import { EchoPractice } from '@/features/skills/EchoPractice';
import { containsHangul } from '@/features/dictionary/hangul';
import { Avatar2D } from '@/ui/Avatar2D';
import { Bar, Btn, Modal, Portrait } from '@/ui/kit';
import { activeFestivalQuest, FESTIVAL_QUESTS, FESTIVAL_SHOP, festivalQuestReady, INVITATION_LINES, STAR_PARCELS, storyOutputReady } from './rules';

export function Adventure({ nodeId, onClose }: { nodeId?: string; onClose: () => void }) {
  const save = useGame((s) => s.save);
  const near = useUi((s) => s.nearZone);
  const [tab, setTab] = useState<'quest' | 'shop'>('quest');
  const [tip, setTip] = useState('');
  const [draft, setDraft] = useState('');
  const [found, setFound] = useState(false);
  const [heardClue, setHeardClue] = useState(false);
  const adventure = save.adventure;
  const quest = activeFestivalQuest(adventure);
  const who = npc(quest?.npc ?? 'leo');
  const ready = quest ? festivalQuestReady(adventure, quest.id, storyOutputReady(save.stories)) : false;
  const node = STAR_PARCELS.find((n) => n.id === nodeId);
  const atFriend = quest?.zone === near;
  const say = (text: string) => speakLine(text, who.voice, save.settings.speed);
  useEffect(() => () => stopAll(), []);
  const goFriend = () => {
    if (!quest) return;
    useUi.getState().requestTeleport(quest.zone);
    if (!document.querySelector('canvas')) useUi.getState().setNearZone(quest.zone);
    onClose();
  };
  const taskDone = (id: string, answer: string) => {
    const ok = useGame.getState().finishAdventureTask(id, answer);
    playSfx(ok ? 'correct' : 'tap');
    setTip(ok ? 'You did it! Bring the good news to your friend.' : 'Almost! Try once more. You can do it!');
  };
  const storyPack = ALL_PACKS.find((p) => save.stories[p.meta.id] && !storyOutputReady({ [p.meta.id]: save.stories[p.meta.id]! })) ?? ALL_PACKS[0];
  const voiceIndex = adventure.tasks.includes('voice-0') ? 1 : 0;
  const inputPack = ALL_PACKS.find((p) => save.stories[p.meta.id] && storyOutputReady({ [p.meta.id]: save.stories[p.meta.id]! }));
  const pocket = inputPack ? save.stories[inputPack.meta.id]!.phrases : [];
  const voiceLines = pocket.length >= 2 ? pocket : inputPack?.story.phrasePocket ?? INVITATION_LINES;
  return (
    <Modal title={node ? 'A star parcel!' : 'The Maple Festival'} icon={node ? '⭐' : '🎪'} onClose={onClose} wide={!node}>
      {node ? <div className="space-y-5 text-center">
        <p className="text-sm font-bold tracking-widest text-honey">LISTEN · DISCOVER · COLLECT</p>
        <p className="text-xl font-bold">Listen to Leo. Which picture matches?</p>
        <Btn big icon="🔊" onClick={() => { say(node.clue); setHeardClue(true); }}>Hear the clue</Btn>
        {!found ? <div className="grid grid-cols-3 gap-3">
          {node.options.map((option) => <button key={option} type="button" aria-label={`Choose ${option}`} disabled={!heardClue} className="parcel-choice disabled:opacity-50" onClick={() => {
            const ok = useGame.getState().collectAdventureParcel(node.id, option, playerPos);
            if (ok) { setFound(true); setTip('A star sticker! Leo will be so happy.'); playSfx('collect'); }
            else { setTip(Math.hypot(playerPos.x - node.pos[0], playerPos.z - node.pos[1]) > 3 ? 'Walk closer to the parcel first.' : 'Listen again. Which picture do you hear?'); playSfx('tap'); }
          }}>{option}</button>)}
        </div> : <div className="festival-found"><span className="text-7xl">⭐</span><p className="mt-3 text-2xl font-black">Star sticker found!</p><p className="mt-2">{adventure.collected.length} / 3</p><Btn big className="mt-5" onClick={onClose}>Keep exploring</Btn></div>}
        {tip ? <p role="status" className="rounded-2xl bg-white/10 p-3 text-lg">{tip}</p> : null}
      </div> : <>
        <div className="festival-banner mb-5 flex items-center gap-4 rounded-2xl p-4">
          <span className="text-3xl sm:text-5xl" aria-hidden="true">🎪</span><div className="min-w-0 flex-1"><p className="text-xs font-black tracking-[.2em] text-[#76618d]">CHAPTER 01 · A PLACE TO BELONG</p><p className="mt-1 text-lg font-black text-ink sm:text-2xl"><span className="hidden sm:inline">Let's bring the festival to life.</span><span className="sm:hidden">Our Maple Festival</span></p><p className="mt-1 text-sm font-bold text-[#76618d]">Listen → Read → Speak → Write</p></div>
          <span className="rounded-full bg-white/75 px-3 py-2 font-black text-ink">✦ {adventure.tokens}</span>
        </div>
        <div className="mb-5 flex gap-2" role="tablist" aria-label="Festival">
          <Btn role="tab" aria-selected={tab === 'quest'} tone={tab === 'quest' ? 'honey' : 'ghost'} onClick={() => setTab('quest')}>🧭 My adventure</Btn>
          <Btn role="tab" aria-selected={tab === 'shop'} tone={tab === 'shop' ? 'honey' : 'ghost'} onClick={() => setTab('shop')}>🎀 Dress up</Btn>
        </div>
        {tab === 'quest' ? <div className="grid gap-5 md:grid-cols-[1fr_220px]">
          <div className="space-y-4">
            {quest ? <>
              <div className="flex items-start gap-3"><Portrait emoji={who.portrait} size={76} /><div className="min-w-0 flex-1 rounded-2xl bg-paper p-4 text-ink"><p className="text-xs font-black tracking-widest text-[#76618d]">{who.name} · {'♥'.repeat(1 + adventure.claimed.filter((id) => FESTIVAL_QUESTS.find((q) => q.id === id)?.npc === who.id).length)}</p><p className="mt-2 text-base font-bold leading-relaxed sm:text-lg"><span className="hidden sm:inline">{quest.line}</span><span className="sm:hidden">{quest.subtitle}</span></p><button className="mt-2 min-h-11 font-bold text-[#76518b]" onClick={() => say(quest.line)} aria-label="Hear your mission">🔊 Hear it</button></div></div>
              <h3 className="text-2xl font-black">{quest.icon} {quest.title}</h3>
              {quest.id === 'lost-stars' && <div className="rounded-2xl bg-white/10 p-4"><p className="mb-3 hidden text-lg sm:block">Follow the glowing stars around the school. Walk close and open a parcel.</p><Bar value={adventure.collected.length} max={3} label="Star stickers found" /><p className="mt-2 font-bold text-honey">{adventure.collected.length} / 3 star stickers</p>{!ready && <Btn big className="mt-4 w-full" icon="🧭" onClick={onClose}>Find the glowing stars</Btn>}</div>}
              {quest.id === 'secret-letter' && !adventure.tasks.includes('letter') && <div className="festival-letter space-y-4 rounded-2xl p-5 text-ink"><p className="text-lg leading-relaxed">Dear friend,<br />Meet me where the books live.<br />We can read a story together.<br />Love, Ava ♡</p><p className="font-extrabold">Where will you meet Ava?</p><div className="grid grid-cols-3 gap-2">{[['library', '📚', 'Library'], ['playground', '⚽', 'Playground'], ['cafeteria', '🍕', 'Cafeteria']].map(([id, icon, name]) => <Btn key={id} tone="paper" onClick={() => taskDone('letter', id ?? '')}><span className="flex flex-col"><span className="text-3xl">{icon}</span><span className="text-sm">{name}</span></span></Btn>)}</div></div>}
              {quest.id === 'story-lantern' && <div className="space-y-3 rounded-2xl bg-lilac/20 p-4"><p className="text-lg">A lantern needs a story inside. Explore steps 1–4 and listen three times. Repeated listening makes the light grow!</p><div className="flex gap-2 text-2xl" aria-label="Story lantern steps">👂 → 📖 → 🎨 → 🌙</div><Btn big className="w-full" onClick={() => { if (storyPack) useUi.getState().open({ type: 'story', packId: storyPack.meta.id }); }}>📖 Open my story</Btn></div>}
              {quest.id === 'friendly-voice' && !ready && <div className="space-y-3"><p className="text-lg font-bold">🎤 Use your story words to welcome a friend! {adventure.tasks.includes('voice-0') ? '2' : '1'} / 2</p>{storyOutputReady(save.stories) ? <EchoPractice key={voiceIndex} text={voiceLines[voiceIndex] ?? INVITATION_LINES[voiceIndex]} speed={save.settings.speed} voice={NPCS.harper!.voice} onResult={(accuracy) => taskDone(`voice-${voiceIndex}`, String(accuracy))} /> : <p>👂 Revisit your story first. Your words will be ready soon!</p>}</div>}
              {quest.id === 'festival-card' && !ready && <div className="festival-letter space-y-3 rounded-2xl p-5 text-ink"><span className="text-4xl" aria-hidden="true">✉️ 🌼 🎪</span><label htmlFor="festival-invitation" className="block text-xl font-black">Write an invitation for your friends.</label><p className="text-base">Try these words: come · play · friends · school · festival</p><textarea id="festival-invitation" className="min-h-32 w-full rounded-xl border-2 border-[#d9cadd] bg-white/80 p-3 text-xl" value={draft} maxLength={300} placeholder="Come and..." onChange={(e) => { setDraft(e.target.value); setTip(''); }} /><Btn big className="w-full" onClick={() => { if (containsHangul(draft)) return setTip('Try drawing it, or use English words!'); taskDone('invitation', draft); }}>✉️ Send my invitation</Btn></div>}
              {tip ? <p role="status" className="rounded-2xl bg-white/10 p-3 text-lg">{tip}</p> : null}
              {ready ? <div className="space-y-3 rounded-2xl border-2 border-honey bg-honey/10 p-4"><p className="text-xl font-black text-honey">✨ Mission ready!</p><p>Bring the good news to {who.name}.</p><Btn big className="w-full" onClick={() => { if (!atFriend) return goFriend(); if (useGame.getState().claimAdventureQuest(quest.id, near)) { setTip(''); playSfx('quest'); } }}>{atFriend ? `🎁 Claim ${quest.reward} stars + ${quest.xp} XP` : `🧭 Meet ${who.name}`}</Btn></div> : <p className="text-sm font-bold text-paper/75">Reward: ✦ {quest.reward} festival stars · +{quest.xp} XP</p>}
            </> : <div className="festival-found rounded-3xl p-6 text-center"><p className="text-7xl">🎪</p><h3 className="mt-4 text-3xl font-black">You made it happen!</h3><p className="mt-3 text-lg">You listened, read, spoke, and wrote. Your friends are ready for the Maple Festival!</p><div className="my-5 flex justify-center gap-3">{['leo', 'ava', 'harper', 'mrbooks'].map((id) => <Avatar2D key={id} look={CHARACTER_DESIGNS[id]!} size={70} />)}</div><div className="flex flex-wrap justify-center gap-3"><Btn big onClick={() => setTab('shop')}>🎀 Choose a little reward</Btn><Btn big tone="sky" onClick={() => { const pack = ALL_PACKS.find((p) => save.stories[p.meta.id] && storyOutputReady({ [p.meta.id]: save.stories[p.meta.id]! })); if (pack) useUi.getState().open({ type: 'talk', packId: pack.meta.id, npcId: 'leo' }); }}>💬 Keep talking with Leo</Btn><Btn big tone="paper" onClick={() => useUi.getState().open({ type: 'storyList' })}>📚 My next story</Btn></div></div>}
          </div>
          <aside className="rounded-2xl bg-white/5 p-4"><p className="mb-3 text-xs font-black tracking-[.2em] text-honey">YOUR JOURNEY</p><ol className="space-y-4">{FESTIVAL_QUESTS.map((q, i) => <li key={q.id} className={`flex items-start gap-3 ${adventure.claimed.includes(q.id) ? 'text-meadow' : quest?.id === q.id ? 'text-paper' : 'text-paper/45'}`}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current text-sm font-bold">{adventure.claimed.includes(q.id) ? '✓' : i + 1}</span><span><span className="block text-[10px] font-black tracking-widest">{q.skill}</span><span className="block text-base font-bold">{q.title}</span></span></li>)}</ol></aside>
        </div> : <div className="grid gap-5 md:grid-cols-[220px_1fr]">
          <div className="rounded-3xl bg-[#f8f0e7] p-5 text-center text-ink">{save.profile && <Avatar2D look={{ ...save.profile, accessory: adventure.equipped ?? undefined }} size={170} />}<p className="mt-2 font-black">{save.profile?.nickname}</p><p className="text-sm">A little more you.</p></div>
          <div className="grid grid-cols-2 gap-3">{FESTIVAL_SHOP.map((item) => { const owned = adventure.owned.includes(item.id); const equipped = adventure.equipped === item.id; return <div key={item.id} className="rounded-2xl border border-white/15 bg-white/5 p-4"><p className="text-4xl">{item.icon}</p><h3 className="my-2 font-extrabold">{item.label}</h3><Btn className="w-full" tone={equipped ? 'meadow' : 'honey'} disabled={equipped || (!owned && adventure.tokens < item.cost)} onClick={() => { if (useGame.getState().buyAdventureItem(item.id)) playSfx('collect'); }}>{equipped ? 'Wearing' : owned ? 'Wear' : `✦ ${item.cost}`}</Btn></div>; })}</div>
        </div>}
      </>}
    </Modal>
  );
}
