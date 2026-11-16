import { useEffect, useState } from 'react';

/** RPG 대화창의 타자 효과. 화면 읽기 프로그램에는 전체 문장을 바로 알려준다. */
export function Typewriter({ text, cps = 40 }: { text: string; cps?: number }) {
  const instant = import.meta.env.MODE === 'test';
  const [count, setCount] = useState(instant ? text.length : 0);
  useEffect(() => {
    if (instant) { setCount(text.length); return; }
    setCount(0);
    const timer = setInterval(() => {
      setCount((c) => {
        if (c >= text.length) { clearInterval(timer); return c; }
        return c + 1;
      });
    }, 1000 / cps);
    return () => clearInterval(timer);
  }, [text, cps, instant]);
  return (
    <span aria-label={text}>
      <span aria-hidden="true">{text.slice(0, count)}</span>
    </span>
  );
}
