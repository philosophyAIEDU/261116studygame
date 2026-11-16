import type { Profile } from '@/types';
import { hairColor, outfitColor, SKIN_COLOR } from '@/config/appearance';

/** 2D 아바타 (캐릭터 만들기 미리보기, 대화창 초상화). 3D 캐릭터와 같은 외형 값을 쓴다. */
export function Avatar2D({ look, size = 120 }: { look: Pick<Profile, 'hair' | 'hairColor' | 'outfitColor' | 'gender'>; size?: number }) {
  const hair = hairColor(look.hairColor);
  const outfit = outfitColor(look.outfitColor);
  return (
    <svg viewBox="0 0 120 140" width={size} height={(size * 140) / 120} role="img" aria-label="Your character">
      <ellipse cx="60" cy="134" rx="30" ry="5" fill="#000" opacity="0.15" />
      {/* 몸 */}
      <rect x="36" y="82" width="48" height="44" rx="16" fill={outfit} />
      <rect x="44" y="120" width="12" height="12" rx="4" fill="#3b3355" />
      <rect x="64" y="120" width="12" height="12" rx="4" fill="#3b3355" />
      {look.gender === 'girl' ? <path d="M36 104 h48 l6 18 h-60 z" fill={outfit} opacity="0.85" /> : null}
      {/* 뒷머리 */}
      {look.hair === 1 ? <rect x="24" y="30" width="72" height="62" rx="26" fill={hair} /> : null}
      {look.hair === 2 ? <ellipse cx="96" cy="58" rx="10" ry="22" fill={hair} /> : null}
      {/* 얼굴 */}
      <circle cx="60" cy="54" r="32" fill={SKIN_COLOR} />
      {/* 앞머리 */}
      <path d="M28 52 Q30 18 60 18 Q90 18 92 52 Q76 36 60 38 Q44 36 28 52 Z" fill={hair} />
      <circle cx="49" cy="58" r="3.4" fill="#2b2440" />
      <circle cx="71" cy="58" r="3.4" fill="#2b2440" />
      <circle cx="42" cy="66" r="4" fill="#f4a7a0" opacity="0.7" />
      <circle cx="78" cy="66" r="4" fill="#f4a7a0" opacity="0.7" />
      <path d="M52 69 Q60 76 68 69" stroke="#2b2440" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
