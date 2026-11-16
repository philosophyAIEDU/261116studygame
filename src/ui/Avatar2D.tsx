import { useId } from 'react';
import type { CharacterDesign } from '@/config/characters';
import { hairColor, outfitColor, SKIN_COLOR } from '@/config/appearance';

/** 오프라인에서도 선명한 오리지널 일러스트. 월드와 동일한 외형 값을 쓴다. */
export function Avatar2D({ look, size = 120, bust = false, label = 'Your character' }: {
  look: CharacterDesign & { gender?: string }; size?: number; bust?: boolean; label?: string;
}) {
  const id = useId().replace(/:/g, '');
  const hair = hairColor(look.hairColor);
  const outfit = outfitColor(look.outfitColor);
  const skin = look.skin ?? SKIN_COLOR;
  const fill = (name: string) => `url(#${id}-${name})`;
  return (
    <svg viewBox={bust ? '16 12 128 128' : '0 0 160 206'} width={size} height={bust ? size : size * 206 / 160} role="img" aria-label={label} className="character-art">
      <defs>
        <linearGradient id={`${id}-hair`} x1="0" y1="0" x2="0.8" y2="1"><stop stopColor={hair} /><stop offset="1" stopColor="#30273e" /></linearGradient>
        <linearGradient id={`${id}-shirt`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="white" /><stop offset="0.18" stopColor={outfit} /><stop offset="1" stopColor={outfit} /></linearGradient>
        <radialGradient id={`${id}-skin`} cx="40%" cy="28%" r="80%"><stop stopColor={skin} /><stop offset="1" stopColor={skin} stopOpacity="0.92" /></radialGradient>
        <linearGradient id={`${id}-eye`} x2="0" y2="1"><stop stopColor="#302639" /><stop offset="1" stopColor="#986948" /></linearGradient>
        <radialGradient id={`${id}-blush`}><stop stopColor="#ed8d90" stopOpacity="0.7" /><stop offset="1" stopColor="#ed8d90" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="80" cy="197" rx="40" ry="6" fill="#62617c" opacity="0.13" />
      <rect x="42" y="112" width="76" height="54" rx="20" fill="#d49b66" stroke="#bb8158" strokeWidth="2" />
      {look.hair === 1 && <path d="M30 65Q22 18 80 17Q138 18 130 67L135 110Q111 123 80 112Q49 123 25 110Z" fill={fill('hair')} />}
      {look.hair === 2 && <g><path d="M119 49Q157 37 148 78Q145 103 125 110Q139 80 117 73Z" fill={fill('hair')} /><path d="M127 59Q145 68 135 89" fill="none" stroke={hair} strokeWidth="4" /></g>}
      {[60, 96].map((x) => <g key={x}><rect x={x - 8} y="157" width="17" height="28" rx="7" fill="#49435f" /><path d={`M${x-7} 174h15v10h-15Z`} fill="#fff8eb" /><path d={`M${x-9} 183q8-5 18 0l4 9q-11 6-26 0Z`} fill="#fdf9ee" stroke="#c5c6d4" strokeWidth="1.5" /><path d={`M${x-10} 190h22M${x-3} 183h8M${x-3} 186h8`} stroke={outfit} strokeWidth="2" strokeLinecap="round" /></g>)}
      <path d="M51 115Q80 102 109 115L115 158Q80 175 45 158Z" fill={fill('shirt')} stroke={outfit} strokeWidth="2" />
      <path d="M52 117Q37 115 33 140L43 145L55 129M108 117Q123 115 127 140L117 145L105 129" fill={outfit} stroke={outfit} strokeWidth="6" strokeLinejoin="round" />
      <ellipse cx="37" cy="147" rx="8" ry="10" fill={skin} /><ellipse cx="123" cy="147" rx="8" ry="10" fill={skin} />
      <path d="M53 116L64 143M107 116L96 143" stroke="#ac7358" strokeWidth="5" strokeLinecap="round" />
      <path d="M65 113L80 129L95 113" fill="#fffaf0" stroke="#f0e3d2" strokeWidth="1.5" />
      <path d="M70 112L80 123L90 112" fill={skin} />
      <path d="M80 129v29M51 158q29 10 58 0" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2" />
      <rect x="85" y="138" width="14" height="15" rx="5" fill="#fff8e8" /><path d="m92 141 1.4 3 3.3.5-2.4 2.3.6 3.3-2.9-1.6-2.9 1.6.6-3.3-2.4-2.3 3.3-.5Z" fill="#edb351" />
      <ellipse cx="32" cy="76" rx="9" ry="12" fill={skin} /><ellipse cx="128" cy="76" rx="9" ry="12" fill={skin} />
      <ellipse cx="33" cy="77" rx="4" ry="6" fill="#de9b89" opacity="0.5" /><ellipse cx="127" cy="77" rx="4" ry="6" fill="#de9b89" opacity="0.5" />
      <path d="M33 62Q30 28 80 27Q130 28 127 62L124 85Q117 113 80 116Q43 113 36 85Z" fill={fill('skin')} />
      <ellipse cx="49" cy="89" rx="16" ry="10" fill={fill('blush')} /><ellipse cx="111" cy="89" rx="16" ry="10" fill={fill('blush')} />
      <path d="M48 64q8-5 16-1M96 63q8-4 16 1" fill="none" stroke={hair} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <g className="character-eyes">
        {[58, 102].map((x) => <g key={x}><ellipse cx={x} cy="78" rx="8.5" ry="11" fill="white" /><ellipse cx={x} cy="79" rx="6.8" ry="9.5" fill={fill('eye')} /><ellipse cx={x - 2} cy="75" rx="2.6" ry="3.2" fill="white" /><circle cx={x + 2} cy="83" r="1.3" fill="#f9d8aa" /><path d={`M${x-8} 72q8-8 16 0`} fill="none" stroke="#342939" strokeWidth="2.5" strokeLinecap="round" /></g>)}
      </g>
      <path d="M78 85q2 3 5 0" fill="none" stroke="#cc8c78" strokeWidth="2" strokeLinecap="round" />
      <path d="M70 94q10 13 20 0" fill="#a95b65" stroke="#a95b65" strokeWidth="2" strokeLinejoin="round" /><path d="M74 95h12q-6 5-12 0" fill="white" />
      {look.accessory === 'glasses' && <g fill="none" stroke="#685a7a" strokeWidth="2.5"><circle cx="57" cy="79" r="14" /><circle cx="103" cy="79" r="14" /><path d="M71 78q9-5 18 0M33 74l11 3M117 77l10-3" /></g>}
      <path d={look.hair === 0 ? 'M31 67Q22 33 45 25Q50 10 75 17Q110 9 126 35L130 67L111 53L106 42L91 57L76 41L65 57L54 43L42 64Z' : 'M29 68Q20 20 79 17Q138 20 131 68L117 59L108 36Q87 64 58 60L68 43Q49 54 42 72Z'} fill={fill('hair')} />
      <path d="M43 37Q58 22 78 26M89 26q17-1 28 15" fill="none" stroke="white" strokeOpacity="0.16" strokeWidth="5" strokeLinecap="round" />
      {look.accessory === 'bow' || (!look.accessory && look.hair === 2) ? <g fill="#f2a1af" stroke="#d97791" strokeWidth="1.4"><path d="M121 52q-20-19-17 3q4 12 17 0q19 18 19-3q-3-10-19 0" /><circle cx="121" cy="54" r="4" fill="#ffe2c5" /></g> : null}
      {look.accessory === 'flower' ? <g fill="#fff4dc">{[0, 60, 120, 180, 240, 300].map((a) => <ellipse key={a} cx="119" cy="44" rx="4" ry="8" transform={`rotate(${a} 119 52)`} />)}<circle cx="119" cy="52" r="5" fill="#eeba52" /></g> : null}
      {look.accessory === 'star' || (!look.accessory && look.hair === 0) ? <path d="m41 49 2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8Z" fill="#ffdc8a" stroke="#ce9851" strokeWidth="1" /> : null}
    </svg>
  );
}
