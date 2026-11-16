import { Avatar2D } from '@/ui/Avatar2D';
import type { VocabularyState } from './rules';

/** 문제의 정답 그림과 분리된 오리지널 모험 배경. 소리를 듣기 전에 시각 단서를 누설하지 않는다. */
export function QuestScene({ state, solved = 0, battle = false, hit = false }: { state: VocabularyState; solved?: number; battle?: boolean; hit?: boolean }) {
  const colors = [ ['#d9efcd','#92c487','#f3d89b'], ['#d3ece4','#6bb5a6','#eddaa4'], ['#e3dff2','#9b93b9','#d6c4d8'], ['#dceefa','#a1c8df','#f3d1a0'] ][state.level - 1]!;
  return <div className={`word-scene ${battle ? 'word-scene-battle' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <defs><linearGradient id="quest-sky" x2="0" y2="1"><stop stopColor={colors[0]} /><stop offset="1" stopColor="#fff5df" /></linearGradient><linearGradient id="quest-ground" x2="0" y2="1"><stop stopColor={colors[1]} /><stop offset="1" stopColor={colors[0]} /></linearGradient></defs>
      <rect width="1000" height="400" fill="url(#quest-sky)" />
      <circle cx="805" cy="72" r="43" fill="#fff5c8" /><circle cx="805" cy="72" r="58" fill="#fff9df" opacity=".3" />
      <g fill="white" opacity=".65"><ellipse cx="165" cy="76" rx="60" ry="14" /><ellipse cx="137" cy="66" rx="26" ry="24" /><ellipse cx="178" cy="67" rx="35" ry="26" /><ellipse cx="660" cy="110" rx="72" ry="14" /><ellipse cx="642" cy="98" rx="30" ry="24" /></g>
      <path d="M0 240Q150 60 350 220Q520 45 720 190Q900 80 1000 225V400H0Z" fill={colors[1]} opacity=".42" />
      <path d="M0 275Q230 180 470 270Q700 180 1000 225V400H0Z" fill="url(#quest-ground)" />
      <path d="M80 402Q210 275 410 307T675 263T930 190" fill="none" stroke={colors[2]} strokeWidth="48" strokeLinecap="round" />
      <path d="M80 402Q210 275 410 307T675 263T930 190" fill="none" stroke="#fff6d8" strokeWidth="2" strokeDasharray="3 14" strokeLinecap="round" />
      {[70, 320, 750, 945].map((x, i) => <g key={x} transform={`translate(${x} ${165 + i % 2 * 40})`}><rect x="-7" y="10" width="14" height="80" rx="5" fill="#aa896b" /><ellipse cy="-10" rx="36" ry="49" fill={colors[1]} /><ellipse cx="-17" cy="12" rx="30" ry="35" fill={colors[1]} /><ellipse cx="15" cy="17" rx="34" ry="39" fill={colors[1]} /><ellipse cx="-10" cy="-24" rx="14" ry="26" fill="white" opacity=".12" /></g>)}
      {Array.from({ length: 16 }, (_, i) => <g key={i} transform={`translate(${(i * 173 + 37) % 1000} ${310 + i % 3 * 29})`}><path d="M0 12V0" stroke="#6f9b76" strokeWidth="2" /><circle r="5" fill={i % 2 ? '#f7d289' : '#e6b6ca'} /><circle r="2" fill="#fff7df" /></g>)}
      {!battle && [220, 390, 560, 735, 890].map((x, i) => <g key={x} transform={`translate(${x} ${320 - i * 24})`}><ellipse cy="8" rx="23" ry="8" fill="#56776b" opacity=".15" /><circle r="17" fill={i < solved ? '#ffd782' : '#fff6df'} stroke="white" strokeWidth="4" /><text textAnchor="middle" y="6" fill="#5c5970" fontSize="17" fontWeight="bold">{i < solved ? '✓' : i + 1}</text></g>)}
    </svg>
    <div className={`word-hero ${battle ? 'word-hero-battle' : ''}`}><Avatar2D look={{ ...state.look, accessory: state.equipped ?? undefined }} size={battle ? 110 : 135} /></div>
    <div className={`fog-friend ${hit ? 'fog-friend-hit' : ''} ${solved === 5 ? 'fog-friend-cleared' : ''}`}>
      <svg viewBox="0 0 180 160"><ellipse cx="90" cy="146" rx="56" ry="9" fill="#514969" opacity=".12" /><path d="M27 108Q8 78 36 60Q25 25 61 28Q79 0 103 25Q139 8 144 44Q179 48 157 81Q183 117 144 125Q115 149 90 132Q45 151 42 124Q21 127 27 108Z" fill={solved === 5 ? '#ffe2a1' : '#c1b5da'} /><path d="M39 66Q24 37 66 39Q88 10 112 37" fill="none" stroke="white" strokeOpacity=".3" strokeWidth="8" strokeLinecap="round" /><ellipse cx="66" cy="80" rx="6" ry="8" fill="#584667" /><ellipse cx="113" cy="80" rx="6" ry="8" fill="#584667" /><circle cx="64" cy="77" r="2" fill="white" /><circle cx="111" cy="77" r="2" fill="white" /><ellipse cx="52" cy="96" rx="9" ry="5" fill="#e3a9bb" /><ellipse cx="129" cy="96" rx="9" ry="5" fill="#e3a9bb" /><path d="M82 96Q90 104 98 96" fill="none" stroke="#836382" strokeWidth="3" strokeLinecap="round" /></svg>
    </div>
  </div>;
}
