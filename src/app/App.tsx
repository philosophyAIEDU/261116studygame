import { lazy, Suspense, useEffect } from 'react';
import { useGame } from '@/save/store';
import { setInputListener, setVoiceVolume } from '@/audio/player';
import { setBgmVolume, setSfxVolume } from '@/audio/sfx';
import { GuardianIntro } from '@/features/onboarding/GuardianIntro';
import { CharacterCreate } from '@/features/onboarding/CharacterCreate';
import { WordQuestGame } from '@/features/vocabulary/WordQuestGame';
import { Prologue } from '@/features/onboarding/Prologue';

const Game = lazy(() => import('./Game').then((m) => ({ default: m.Game })));

/** 소리 크기와 "들은 시간" 기록을 세이브 저장소와 연결한다. */
function useAudioWiring() {
  const volume = useGame((s) => s.save.settings.volume);
  useEffect(() => {
    setVoiceVolume(volume.voice);
    setSfxVolume(volume.sfx);
    setBgmVolume(volume.bgm);
  }, [volume]);
  useEffect(() => {
    setInputListener((seconds) => useGame.getState().addInputSeconds(seconds));
  }, []);
}

/** 첫 실행 순서: 보호자 안내(한국어) → 캐릭터 만들기 → 프롤로그 → 게임 */
export function LegacyApp() {
  const guardianIntroSeen = useGame((s) => s.save.guardianIntroSeen);
  const hasProfile = useGame((s) => s.save.profile !== null);
  const prologueSeen = useGame((s) => s.save.prologueSeen);
  const setFlag = useGame((s) => s.setFlag);
  const createProfile = useGame((s) => s.createProfile);
  useAudioWiring();

  if (!guardianIntroSeen) return <GuardianIntro onDone={() => setFlag('guardianIntroSeen')} />;
  if (!hasProfile) return <CharacterCreate onDone={createProfile} />;
  if (!prologueSeen) return <Prologue onDone={() => setFlag('prologueSeen')} />;
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-6xl" aria-busy="true">🏫</div>}>
      <Game />
    </Suspense>
  );
}

/** 기본 앱은 수준 진단 → 단어 듣기 RPG로 바로 시작한다. 기존 이야기는 저장 데이터를 보존한다. */
export function App() {
  useAudioWiring();
  return <WordQuestGame />;
}
