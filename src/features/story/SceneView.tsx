import type { StoryPack } from '@/content/loader';
import type { StoryScene } from '@/content/schema';

/** 이야기 장면 그림 + 탭할 수 있는 사물 영역. 글자는 그리지 않는다(Look & Listen 은 글 없는 단계). */
export function SceneView({ pack, scene, onTapObject, className = '' }: {
  pack: StoryPack;
  scene: StoryScene;
  onTapObject?: (word: string) => void;
  className?: string;
}) {
  return (
    <div className={`relative mx-auto aspect-[8/5] w-full overflow-hidden rounded-2xl border-4 border-honey bg-paper ${className}`} style={{ maxWidth: 'calc(56vh * 1.6)' }}>
      <img src={`${pack.baseUrl}${scene.image}`} alt="" className="h-full w-full object-cover" draggable={false} />
      {onTapObject
        ? scene.objects.map((o, i) => (
            <button
              key={`${o.word}-${i}`}
              type="button"
              aria-label={o.word}
              onClick={() => onTapObject(o.word)}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition hover:bg-white/25 active:scale-110 active:bg-honey/40"
              style={{ left: `${o.x}%`, top: `${o.y}%`, width: `${Math.max(12, o.size)}%`, aspectRatio: '1' }}
            />
          ))
        : null}
    </div>
  );
}
