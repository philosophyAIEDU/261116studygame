import { ko } from '@/i18n/ko';
import { isIos, isStandalone, useInstall } from '@/app/install';
import { isTauri } from '@/app/registerUpdate';
import { Btn, Modal } from '@/ui/kit';

// 설치 안내 (보호자용, 한국어).
//  · 안드로이드·PC: 브라우저가 설치를 허용하면 "지금 설치하기" 버튼이 뜬다.
//  · iOS: Safari 의 "공유 → 홈 화면에 추가"를 그림으로 안내한다.

const t = ko.install;

function Steps({ title, icon, steps }: { title: string; icon: string; steps: readonly string[] }) {
  return (
    <section className="mb-4 rounded-2xl bg-white/10 p-4">
      <h3 className="mb-2 text-lg font-extrabold text-honey"><span className="emoji">{icon}</span> {title}</h3>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-3 text-base leading-relaxed">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-honey font-extrabold text-ink">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function InstallGuide({ onClose }: { onClose: () => void }) {
  const canInstall = useInstall((s) => s.canInstall);
  const promptInstall = useInstall((s) => s.promptInstall);
  const installed = isStandalone() || isTauri();
  const ios = isIos();
  return (
    <Modal title={t.title} icon="📲" onClose={onClose} ko>
      <p className="mb-4 text-base leading-relaxed">{t.lead}</p>
      {installed ? <p role="status" className="mb-4 rounded-2xl bg-meadow/25 p-3 text-lg font-bold">✅ {t.installed}</p> : null}
      {canInstall && !installed ? <Btn big tone="meadow" icon="⬇️" className="mb-4 w-full" onClick={() => void promptInstall()}>{t.installNow}</Btn> : null}

      {ios ? (
        <>
          <div className="emoji mb-3 flex items-center justify-center gap-3 rounded-2xl bg-paper p-4 text-4xl" aria-hidden="true">
            <span>🧭</span><span className="text-2xl">➡️</span><span>⬆️</span><span className="text-2xl">➡️</span><span>➕</span><span className="text-2xl">➡️</span><span>🏫</span>
          </div>
          <Steps title={t.iosTitle} icon="🍎" steps={t.iosSteps} />
          <p className="mb-4 text-sm leading-relaxed text-paper/80">{t.iosNote}</p>
          <Steps title={t.androidTitle} icon="🤖" steps={t.androidSteps} />
        </>
      ) : (
        <>
          <Steps title={t.androidTitle} icon="🤖" steps={t.androidSteps} />
          <Steps title={t.iosTitle} icon="🍎" steps={t.iosSteps} />
          <p className="mb-4 text-sm leading-relaxed text-paper/80">{t.iosNote}</p>
        </>
      )}
      <section className="rounded-2xl bg-white/10 p-4">
        <h3 className="mb-2 text-lg font-extrabold text-honey"><span className="emoji">💻</span> {t.pcTitle}</h3>
        <p className="text-base leading-relaxed">{t.pcBody}</p>
      </section>
    </Modal>
  );
}
