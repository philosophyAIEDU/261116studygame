import { lazy, Suspense } from 'react';
import { useUi } from './uiStore';
import { useGame } from '@/save/store';
import { StoryList } from '@/features/story/StoryList';
import { StoryQuest } from '@/features/story/StoryQuest';
import { Bedtime } from '@/features/bedtime/Bedtime';

// 떠 있는 창을 그린다. 자주 쓰지 않는 창은 필요할 때 내려받는다(lazy) → 첫 화면이 빨리 뜬다.
const Adventure = lazy(() => import('@/features/adventure/Adventure').then((m) => ({ default: m.Adventure })));
const Bag = lazy(() => import('@/features/quests/Bag').then((m) => ({ default: m.Bag })));
const QuestLog = lazy(() => import('@/features/quests/QuestLog').then((m) => ({ default: m.QuestLog })));
const MapOverlay = lazy(() => import('@/features/quests/MapOverlay').then((m) => ({ default: m.MapOverlay })));
const Mentor = lazy(() => import('@/features/mentor/Mentor').then((m) => ({ default: m.Mentor })));
const TalkTime = lazy(() => import('@/features/talktime/TalkTime').then((m) => ({ default: m.TalkTime })));
const SkillPractice = lazy(() => import('@/features/skills/SkillPractice').then((m) => ({ default: m.SkillPractice })));
const RealTalk = lazy(() => import('@/features/skills/RealTalk').then((m) => ({ default: m.RealTalk })));
const GradExam = lazy(() => import('@/features/progression/GradExam').then((m) => ({ default: m.GradExam })));
const CareerPick = lazy(() => import('@/features/progression/CareerPick').then((m) => ({ default: m.CareerPick })));
const Settings = lazy(() => import('@/features/guardian/Settings').then((m) => ({ default: m.Settings })));
const Report = lazy(() => import('@/features/guardian/Report').then((m) => ({ default: m.Report })));
const InstallGuide = lazy(() => import('@/features/guardian/InstallGuide').then((m) => ({ default: m.InstallGuide })));

export function Overlays() {
  const overlay = useUi((s) => s.overlay);
  const close = useUi((s) => s.close);
  const open = useUi((s) => s.open);
  if (!overlay) return null;

  const content = (() => {
    switch (overlay.type) {
      case 'adventure': return <Adventure key={overlay.nodeId ?? 'board'} nodeId={overlay.nodeId} onClose={close} />;
      case 'storyList': return <StoryList onClose={close} />;
      case 'story': return <StoryQuest key={overlay.packId} packId={overlay.packId} onClose={() => open({ type: useUi.getState().storyReturnToAdventure ? 'adventure' : 'storyList' })} />;
      case 'bedtime':
        return (
          <Bedtime
            initialPackId={overlay.packId}
            onClose={() => {
              // 아침이 밝는다 → 새 하루
              if (useGame.getState().save.world.phase === 'night') useGame.getState().newDay();
              if (overlay.packId) open({ type: 'story', packId: overlay.packId });
              else close();
            }}
          />
        );
      case 'bag': return <Bag tab={overlay.tab} onClose={close} />;
      case 'quests': return <QuestLog onClose={close} />;
      case 'map': return <MapOverlay onClose={close} />;
      case 'mentor': return <Mentor onClose={close} />;
      case 'talk': return <TalkTime packId={overlay.packId} npcId={overlay.npcId} career={overlay.career} onClose={() => (overlay.packId && !overlay.npcId ? open({ type: 'story', packId: overlay.packId }) : close())} />;
      case 'skills': return <SkillPractice skill={overlay.skill} onClose={close} />;
      case 'realTalk': return <RealTalk onClose={close} />;
      case 'exam':
      case 'graduation': return <GradExam onClose={close} />;
      case 'career': return <CareerPick onClose={close} />;
      case 'settings': return <Settings onClose={close} />;
      case 'report': return <Report onClose={() => open({ type: 'settings' })} />;
      case 'install': return <InstallGuide onClose={() => open({ type: 'settings' })} />;
    }
  })();

  return <Suspense fallback={<div className="fixed inset-0 z-40 flex items-center justify-center bg-night/70 text-5xl" aria-busy="true">⏳</div>}>{content}</Suspense>;
}
