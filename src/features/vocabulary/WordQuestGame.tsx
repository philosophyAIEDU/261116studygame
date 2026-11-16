import { useEffect, useRef, useState } from 'react';
import { useGame } from '@/save/store';
import { Avatar2D } from '@/ui/Avatar2D';
import { loadEnglishVoices, playQuestWord, stopWordVoice } from '@/audio/wordVoice';
import { playSfx, setBgm } from '@/audio/sfx';
import { WORD_QUEST_COPY as t } from '@/i18n/wordQuest';
import { questWord, type QuestWord } from './catalog';
import { learningSummary, missionReady, WORD_SHOP, placementProgress, wordOptions, type WordFeedback } from './rules';
import { QuestScene } from './QuestScene';
import { UpdateBanner } from '@/app/UpdateBanner';

type View = 'sound' | 'placement' | 'result' | 'home' | 'mission' | 'report' | 'wardrobe';
const HEROES = [{ hair: 0, hairColor: 1, outfitColor: 1 }, { hair: 1, hairColor: 1, outfitColor: 3 }, { hair: 2, hairColor: 3, outfitColor: 2 }, { hair: 0, hairColor: 2, outfitColor: 0 }];

function WordQuestion({ word, seed, feedback, onPick, onNext, onSound, placement = false }: {
  word: QuestWord; seed: number; feedback?: WordFeedback | null; onPick: (id: string, heard: string) => void; onNext?: () => void; onSound: () => void; placement?: boolean;
}) {
  const voiceURI = useGame((s) => s.save.vocabulary.voiceURI);
  const volume = useGame((s) => s.save.settings.volume.voice);
  const [audio, setAudio] = useState<'idle' | 'playing' | 'ready' | 'error'>('idle');
  const request = useRef(0);
  const heard = useRef(false);
  const feedbackPanel = useRef<HTMLDivElement>(null);
  useEffect(() => { if (feedback) feedbackPanel.current?.scrollIntoView?.({ block: 'nearest', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }, [feedback]);
  useEffect(() => () => { request.current++; stopWordVoice(); }, []);
  const listen = async (slow = false) => {
    const serial = ++request.current; setAudio('playing');
    const played = await playQuestWord(word.word, { voiceURI, slow, volume }).done;
    if (serial !== request.current) return;
    if (played) heard.current = true;
    setAudio(played ? 'ready' : 'error');
  };
  const options = wordOptions(word.id, seed);
  const allowed = heard.current && audio !== 'playing' && !feedback;
  return <section className="word-question" aria-label={placement ? t.placement : t.missionGoal}>
    <div className="word-question-heading"><span className="word-step-label">{t.readyToHear}</span><h2>{feedback ? feedback.correct ? t.correct : t.wrong : heard.current ? t.chooseNext : t.listenFirst}</h2></div>
    <div className="word-audio-row"><button type="button" className="word-listen" disabled={audio === 'playing'} onClick={() => void listen()}><span aria-hidden="true">{audio === 'playing' ? '◌' : '🔊'}</span>{audio === 'playing' ? t.playing : heard.current ? t.again : t.listen}</button><button type="button" className="word-slow" disabled={audio === 'playing'} onClick={() => void listen(true)}>🐢 {t.slow}</button></div>
    {audio === 'error' && <div role="alert" className="word-audio-error"><p>{t.voiceFailure}</p>{volume === 0 && <button type="button" className="word-secondary" onClick={() => useGame.getState().setVolume('voice', 1)}>{t.volumeOn}</button>}<button type="button" className="word-secondary" onClick={onSound}>{t.sound}</button></div>}
    <p className="word-question-instruction">{word.level <= 2 ? t.pictureInstruction : t.wordInstruction}</p>
    <div className="word-choices" role="group" aria-label={t.chooseNext}>
      {options.map((option, i) => <button type="button" key={option.id} data-testid={`word-choice-${option.id}`} disabled={!allowed} aria-label={word.level <= 2 ? `Picture ${option.picture}` : option.word} className={`word-choice ${word.level <= 2 ? 'word-choice-picture' : ''} ${feedback && option.id === word.id ? 'word-choice-right' : feedback?.picked === option.id ? 'word-choice-wrong' : ''}`} onClick={() => { onPick(option.id, heard.current ? word.id : ''); }}>
        <span className="word-choice-number">{i + 1}</span>{word.level <= 2 ? <span className="word-choice-emoji" aria-hidden="true">{option.picture}</span> : <span className="word-choice-spelling">{option.word}</span>}
        {feedback && option.id === word.id && <span className="word-correct-marker" aria-hidden="true">✓</span>}
      </button>)}
    </div>
    {placement ? <button type="button" className="word-dont-know" disabled={!allowed} onClick={() => onPick('unknown', heard.current ? word.id : '')}>{t.unknown}</button> : feedback && <div ref={feedbackPanel} className="word-feedback" role="status"><div className="word-feedback-word"><span className="text-4xl" aria-hidden="true">{word.picture}</span><div><strong>{word.word}</strong><p>{word.hint}</p></div></div>{!feedback.correct && <p className="word-review-hint">🔁 {t.reviewHint}</p>}<button type="button" className="word-primary w-full" onClick={onNext}>{t.next} →</button></div>}
  </section>;
}

export function WordQuestGame() {
  const save = useGame((s) => s.save);
  const state = save.vocabulary;
  const game = useGame.getState;
  const [view, setView] = useState<View>(() => state.placement ? state.mission && !state.mission.claimed ? 'mission' : 'home' : state.assessment.length ? 'placement' : 'sound');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [sample, setSample] = useState<'idle' | 'playing' | 'ready' | 'error'>('idle');
  const sampleRequest = useRef(0);
  const refresh = () => { void loadEnglishVoices().then(setVoices); };
  useEffect(() => { setBgm('off'); refresh(); return () => { sampleRequest.current++; stopWordVoice(); }; }, []);
  const go = (next: View) => { sampleRequest.current++; stopWordVoice(); setView(next); };
  const start = (review = false) => { game().vocabularyStart(Date.now(), review); go('mission'); };
  const playSample = async () => {
    const serial = ++sampleRequest.current; setSample('playing');
    const ok = await playQuestWord('apple', { voiceURI: state.voiceURI, volume: save.settings.volume.voice }).done;
    if (serial === sampleRequest.current) setSample(ok ? 'ready' : 'error');
  };
  const progress = placementProgress(state.assessment);
  const mission = state.mission;
  const summary = learningSummary(state, Date.now());
  const levelName = t.levels[state.level - 1];
  const headingView = view === 'placement' && state.placement ? 'result' : view;
  const missionFinished = missionReady(mission);
  const missionCurrent = mission?.queue[mission.cursor];
  const levelChanged = mission?.claimed && mission.level !== state.level;

  return <div className="word-app scroll-y">
    {view === 'home' && <UpdateBanner />}
    <header className="word-header"><div className="word-brand"><span className="word-brand-symbol" aria-hidden="true">✦</span><div><span className="word-brand-en">MAPLE WORD QUEST</span><h1>{t.brand}</h1></div></div><div className="word-header-tools">{state.placement && <><span className="word-level-badge">Lv.{state.level}</span><button type="button" className="word-coins" aria-label={`${t.wardrobe} · Coins ${state.coins}`} onClick={() => go('wardrobe')}>✦ {state.coins}</button></>}<button type="button" className="word-icon-button" onClick={() => { setSample('idle'); refresh(); go('sound'); }} aria-label={t.sound}>🔊</button></div></header>

    {headingView === 'sound' && <main className="word-sound-layout">
      <section className="word-intro"><p className="word-eyebrow">LISTEN · CHOOSE · GROW</p><h2>{state.placement ? t.sound : t.introTitle}</h2><p>{state.placement ? t.soundIntro : t.introBody}</p><div className="word-intro-hero"><Avatar2D look={{ ...state.look, accessory: state.equipped ?? undefined }} size={180} /><span className="word-intro-bubble">apple 🍎</span></div><ol className="word-how"><li>{t.how1}</li><li>{t.how2}</li><li>{t.how3}</li></ol></section>
      <section className="word-panel word-sound-panel"><span className="word-step-label">SOUND CHECK</span><h2>{t.sound}</h2><p>{t.soundIntro}</p><label className="word-field-label" htmlFor="word-voice">{t.voice}</label><select id="word-voice" value={state.voiceURI || voices[0]?.voiceURI || ''} onChange={(event) => { stopWordVoice(); setSample('idle'); game().vocabularyVoice(event.target.value); }}>{voices.length ? voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}</option>) : <option value="">{t.noVoice}</option>}</select><button type="button" className="word-text-button" onClick={refresh}>{t.refreshVoices}</button><label className="word-field-label" htmlFor="word-volume">{t.volume}</label><input id="word-volume" type="range" min={0} max={1} step={0.1} value={save.settings.volume.voice} onChange={(e) => { setSample('idle'); game().setVolume('voice', Number(e.target.value)); }} /><button type="button" className="word-sample" disabled={sample === 'playing'} onClick={() => void playSample()}><span aria-hidden="true">{sample === 'playing' ? '◌' : '🔊'}</span>{sample === 'playing' ? t.playing : t.sample}</button>{sample === 'error' && <div role="alert" className="word-audio-error">{t.voiceFailure}<p className="mt-2">{t.voiceHelp}</p></div>}<p className="word-muted">{sample === 'ready' ? '✓ apple' : t.soundConfirm}</p><button type="button" className="word-primary w-full" disabled={state.placement ? false : sample !== 'ready'} onClick={() => go(state.placement ? mission && !mission.claimed ? 'mission' : 'home' : 'placement')}>{state.placement ? t.soundBack : t.soundReady} →</button></section>
    </main>}

    {headingView === 'placement' && progress.next && <main className="word-play-layout"><section className="word-placement-aside"><span className="word-step-label">LEVEL CHECK</span><h2>{t.placementTitle}</h2><p>{t.placementIntro}</p><div className="word-assessment-counter"><strong>{state.assessment.length + 1}</strong><span>/ 12 {t.questions}</span></div><div className="word-progress-track">{Array.from({ length: 12 }, (_, i) => <span key={i} className={i < state.assessment.length ? 'is-complete' : ''} />)}</div><Avatar2D look={{ ...state.look, accessory: state.equipped ?? undefined }} size={140} /><p className="word-muted">{t.assessmentNote}</p></section><WordQuestion key={`placement-${progress.next}`} word={questWord(progress.next)} seed={17} placement onSound={() => go('sound')} onPick={(picked, heard) => { game().vocabularyPlacementAnswer(picked, heard); playSfx('tap'); if (game().save.vocabulary.placement) go('result'); }} /></main>}

    {headingView === 'result' && state.placement && <main className="word-result-wrap"><section className="word-panel word-placement-result"><p className="word-eyebrow">YOUR STARTING TRAIL</p><h2>{t.result}</h2><div className="word-result-level">Lv.{state.level}<span>{levelName}</span></div><p>{t.descriptions[state.level - 1]}</p><p className="word-muted">{state.placement.total} {t.questions} · {t.firstCorrect} {state.placement.correct}{t.wordsUnit}</p><p>{t.resultBody}</p><h3>{t.hero}</h3><div className="word-hero-options">{HEROES.map((look, index) => <button type="button" key={index} aria-label={`Hero ${index + 1}`} aria-pressed={JSON.stringify(look) === JSON.stringify(state.look)} onClick={() => game().vocabularyLook(look)}><Avatar2D look={look} size={65} /></button>)}</div><button type="button" className="word-primary w-full" onClick={() => start()}>{t.startAdventure} →</button><p className="word-muted">{t.assessmentNote}</p></section></main>}

    {headingView === 'home' && <main className="word-home-layout"><section className="word-home-map"><div className="word-home-title"><p className="word-eyebrow">STAGE {state.cleared + 1} · {levelName}</p><h2>{t.homeTitle}</h2><p>{t.missionGoal}</p></div><QuestScene state={state} /><div className="word-home-start"><button type="button" className="word-primary" onClick={() => start()}>▶ {mission && !mission.claimed ? t.resume : t.newMission}</button><p>{t.descriptions[state.level - 1]}</p></div></section><aside className="word-home-aside"><section className="word-panel"><span className="word-step-label">MY LEARNING</span><h2>{t.learning}</h2><div className="word-learning-stat"><span>{t.encountered}</span><strong>{summary.encountered}</strong></div><div className="word-learning-stat"><span>{t.firstCorrect}</span><strong>{summary.independentlyCorrect}</strong></div><div className="word-learning-stat"><span>{t.familiar}</span><strong>{summary.familiar}</strong></div><div className="word-learning-stat"><span>{t.due}</span><strong>{summary.due}</strong></div><button type="button" className="word-secondary w-full" onClick={() => go('report')}>{t.report} →</button>{summary.due > 0 && (!mission || mission.claimed) && <button type="button" className="word-text-button" onClick={() => start(true)}>🔁 {t.reviewNow}</button>}</section><section className="word-learning-explainer"><span aria-hidden="true">👂</span><h3>{t.why}</h3><p>{t.whyBody}</p></section></aside></main>}

    {headingView === 'mission' && mission && <main className="word-mission-wrap"><div className="word-mission-top"><button type="button" className="word-secondary" onClick={() => go('home')}>← {t.home}</button><p>{mission.mode === 'review' ? t.reviewMission : t.stage} {state.cleared + (mission.claimed ? 0 : 1)} · {t.levels[mission.level - 1]}</p><span>{t.fog} <b>{mission.solved.length}/5</b></span></div><QuestScene state={state} solved={mission.solved.length} battle hit={!!mission.feedback?.correct} /><div className="word-fog-meter" aria-label={`${t.fog} ${mission.solved.length} / 5`}>{Array.from({ length: 5 }, (_, i) => <span key={i} className={i < mission.solved.length ? 'is-complete' : ''}>{i < mission.solved.length ? '✦' : '◇'}</span>)}</div>{missionFinished ? <section className="word-panel word-clear-panel"><span className="word-clear-star" aria-hidden="true">✦</span><h2>{t.completed}</h2><div className="word-clear-stats"><div><strong>{mission.firstCorrect} / 5</strong><span>{t.firstCorrect}</span></div><div><strong>{mission.wrong.length}</strong><span>{t.reencounter}</span></div></div><div className="word-clear-words">{mission.solved.map((id) => <span key={id}>{questWord(id).picture} {questWord(id).word}</span>)}</div><p>{t.growthHint}</p>{levelChanged && <p className="word-level-change">{state.level > mission.level ? t.advanced : t.eased} · Lv.{state.level}</p>}<button type="button" className="word-primary w-full" onClick={() => { if (mission.claimed) start(); else { game().vocabularyClaim(); playSfx('quest'); } }}>{mission.claimed ? `${t.nextMission} →` : `${t.reward} · ✦ ${25 + mission.firstCorrect * 5} / +${30 + mission.firstCorrect * 10} XP`}</button>{mission.claimed && <p className="word-muted">✓ {t.rewardClaimed}</p>}<button type="button" className="word-text-button" onClick={() => go('report')}>{t.learning} →</button></section> : missionCurrent && <WordQuestion key={`${mission.id}-${mission.cursor}`} word={questWord(missionCurrent)} seed={mission.id} feedback={mission.feedback} onSound={() => go('sound')} onPick={(picked, heard) => { game().vocabularyAnswer(picked, heard); playSfx(picked === heard ? 'collect' : 'tap'); }} onNext={() => game().vocabularyContinue()} />}</main>}

    {headingView === 'wardrobe' && <main className="word-report-wrap"><button type="button" className="word-secondary" onClick={() => go('home')}>← {t.home}</button><section className="word-panel word-wardrobe mt-5"><div><p className="word-eyebrow">YOUR LITTLE REWARDS</p><h2>{t.wardrobe}</h2><p>{t.wardrobeIntro}</p><Avatar2D look={{ ...state.look, accessory: state.equipped ?? undefined }} size={170} /><div className="word-hero-options">{HEROES.map((look, index) => <button type="button" key={index} aria-label={`Hero ${index + 1}`} aria-pressed={JSON.stringify(look) === JSON.stringify(state.look)} onClick={() => game().vocabularyLook(look)}><Avatar2D look={look} size={50} /></button>)}</div></div><div className="word-shop-grid">{WORD_SHOP.map((item) => <div key={item.id}><span className="text-5xl" aria-hidden="true">{item.icon}</span><h3>{t.items[item.id]}</h3><button type="button" className="word-secondary" disabled={state.equipped === item.id || !state.owned.includes(item.id) && state.coins < item.cost} onClick={() => { game().vocabularyBuy(item.id); playSfx('collect'); }}>{state.equipped === item.id ? t.wearing : state.owned.includes(item.id) ? t.wear : `✦ ${item.cost}`}</button></div>)}</div></section></main>}

    {headingView === 'report' && <main className="word-report-wrap"><button type="button" className="word-secondary" onClick={() => go(mission && !mission.claimed ? 'mission' : 'home')}>← {t.back}</button><section className="word-panel mt-5"><p className="word-eyebrow">SOUND → PICTURE → WORD</p><h2>{t.learning}</h2><p>{t.meaningHelp}</p><div className="word-report-stats"><div><strong>{summary.encountered}</strong><span>{t.encountered}</span></div><div><strong>{summary.independentlyCorrect}</strong><span>{t.firstCorrect}</span></div><div><strong>{summary.familiar}</strong><span>{t.familiar}</span></div></div>{!summary.encountered ? <p className="word-muted">{t.emptyReport}</p> : <ul className="word-memory-list">{Object.entries(state.cards).map(([id, card]) => { const word = questWord(id); return <li key={id}><span className="text-3xl" aria-hidden="true">{word.picture}</span><div><strong>{word.word}</strong><p>{word.hint}</p><span>{card.streak >= 3 ? t.familiarLabel : card.streak === 0 ? t.needsPractice : t.practiced} · {'★'.repeat(Math.min(card.streak, 3))}{'☆'.repeat(Math.max(0, 3 - card.streak))}</span></div><button type="button" className="word-icon-button" aria-label={`Hear ${word.word}`} onClick={() => { void playQuestWord(word.word, { voiceURI: state.voiceURI, volume: save.settings.volume.voice }); }}>🔊</button></li>; })}</ul>}<div className="word-retest"><p>{t.retestNote}</p><button type="button" className="word-secondary" disabled={!!mission && !mission.claimed} onClick={() => { game().vocabularyRetest(); go('placement'); }}>{t.retest}</button></div></section></main>}
    <footer className="word-footer">Maple Word Quest · v{__APP_VERSION__} · <a href="./guide/" target="_blank" rel="noreferrer">Installation & help ↗</a></footer>
  </div>;
}
