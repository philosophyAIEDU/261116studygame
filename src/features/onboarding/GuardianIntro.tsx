import { ko } from '@/i18n/ko';
import { Btn } from '@/ui/kit';

/** 첫 실행 보호자 안내 (한국어). 이 화면과 설정 화면에서만 한국어를 쓴다. */
export function GuardianIntro({ onDone }: { onDone: () => void }) {
  const t = ko.intro;
  return (
    <div className="ko scroll-y h-full bg-night p-4">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-2xl font-extrabold text-honey">{t.title}</h1>
        <p className="mb-4 text-lg">{t.lead}</p>
        <ul className="space-y-3">
          {t.points.map((p) => (
            <li key={p.title} className="flex gap-3 rounded-2xl bg-white/10 p-4">
              <span className="emoji text-3xl" aria-hidden="true">{p.icon}</span>
              <div>
                <h2 className="text-lg font-bold text-paper">{p.title}</h2>
                <p className="leading-relaxed text-paper/90">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="sticky bottom-0 mt-4 bg-night py-3">
          <Btn big icon="🎮" className="w-full" onClick={onDone}>{t.start}</Btn>
        </div>
      </div>
    </div>
  );
}
