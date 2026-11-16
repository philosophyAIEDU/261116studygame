import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { playSfx } from '@/audio/sfx';

// RPG 풍 UI 부품 모음 (아트 바이블 5절).
// 글을 못 읽는 아이도 쓸 수 있게: 큰 아이콘 + 짧은 영어 한두 단어, 최소 48px 터치 영역.

type Tone = 'honey' | 'meadow' | 'sky' | 'lilac' | 'ghost' | 'berry' | 'paper';

const TONE: Record<Tone, string> = {
  honey: 'bg-honey text-ink border-b-4 border-maple',
  meadow: 'bg-meadow text-ink border-b-4 border-green-700',
  sky: 'bg-sky text-ink border-b-4 border-cyan-700',
  lilac: 'bg-lilac text-white border-b-4 border-indigo-900',
  berry: 'bg-berry text-white border-b-4 border-rose-900',
  paper: 'bg-paper text-ink border-b-4 border-amber-300',
  ghost: 'bg-white/10 text-paper border border-white/25',
};

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: string;
  tone?: Tone;
  big?: boolean;
  children?: ReactNode;
}

export function Btn({ icon, tone = 'honey', big, children, className = '', onClick, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      onClick={(e) => { playSfx('tap'); onClick?.(e); }}
      className={`inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-2xl px-4 font-bold transition active:translate-y-0.5 disabled:opacity-40 ${big ? 'py-3 text-xl' : 'py-2 text-base'} ${TONE[tone]} ${className}`}
    >
      {icon ? <span className="emoji text-2xl leading-none" aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  );
}

/** Night 바탕 + Honey 테두리의 기본 패널 */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border-2 border-honey bg-night/90 p-4 shadow-xl backdrop-blur ${className}`}>{children}</div>;
}

/** 책·대화 내용용 종이 패널 */
export function Paper({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-paper p-4 text-ink shadow-lg ${className}`}>{children}</div>;
}

interface ModalProps {
  title: string;
  icon?: string;
  onClose?: () => void;
  children: ReactNode;
  /** 한국어 보호자 화면이면 true */
  ko?: boolean;
  wide?: boolean;
}

/** 전체 화면을 덮는 창 (퀘스트·가방·설정 등) */
export function Modal({ title, icon, onClose, children, ko, wide }: ModalProps) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className={`fixed inset-0 z-40 flex items-center justify-center bg-night/80 p-2 sm:p-4 ${ko ? 'ko' : ''}`}>
      <div className={`flex max-h-full w-full flex-col rounded-3xl border-2 border-honey bg-night shadow-2xl ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
        <header className="flex items-center gap-3 border-b border-white/15 px-4 py-3">
          {icon ? <span className="emoji text-3xl" aria-hidden="true">{icon}</span> : null}
          <h2 className="flex-1 text-xl font-extrabold text-honey">{title}</h2>
          {onClose ? <Btn tone="ghost" icon="✖️" aria-label="Close" onClick={onClose} /> : null}
        </header>
        <div className="scroll-y flex-1 p-4">{children}</div>
      </div>
    </div>
  );
}

export function Bar({ value, max, tone = 'honey', label }: { value: number; max: number; tone?: 'honey' | 'meadow' | 'lilac' | 'berry'; label?: string }) {
  const pct = max <= 0 ? 100 : Math.max(0, Math.min(100, (value / max) * 100));
  const color = tone === 'honey' ? 'bg-honey' : tone === 'meadow' ? 'bg-meadow' : tone === 'lilac' ? 'bg-lilac' : 'bg-berry';
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className="h-3 w-full overflow-hidden rounded-full bg-white/20">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Portrait({ emoji, size = 64 }: { emoji: string; size?: number }) {
  return (
    <div className="emoji flex shrink-0 items-center justify-center rounded-full border-4 border-honey bg-paper" style={{ width: size, height: size, fontSize: size * 0.56 }} aria-hidden="true">
      {emoji}
    </div>
  );
}

/** 잠긴 퀘스트 안내 (꾸짖지 않고, 왜 기다리는지 알려준다) */
export function Locked({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/5 p-4 text-lg">
      <span className="emoji text-3xl" aria-hidden="true">🔒</span>
      <span>{text}</span>
    </div>
  );
}
