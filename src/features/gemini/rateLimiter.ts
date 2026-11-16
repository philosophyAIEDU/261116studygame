// 분당 요청 한도(RPM) 큐 (순수 로직, 시계를 주입받는다)
// 최근 60초 안에 보낸 요청 시각을 기억해 두고, 한도에 걸리면 "얼마나 기다려야 하는지"를 알려준다.
// 기다리는 동안 화면에서는 NPC 가 "Hmm, let me think… 🤔" 하고 생각하는 모습을 보여준다.

const WINDOW_MS = 60_000;

export class RateLimiter {
  private sent = new Map<string, number[]>();

  /**
   * 요청 1건을 예약하고, 보내기 전에 기다려야 할 시간(ms)을 돌려준다. 0 이면 바로 보내도 된다.
   * 예약된 시각도 기록하므로 연달아 호출해도 한도를 넘지 않는다.
   */
  reserve(model: string, rpm: number, now: number): number {
    const limit = Math.max(1, rpm);
    const times = (this.sent.get(model) ?? []).filter((t) => t > now - WINDOW_MS);
    let sendAt = now;
    if (times.length >= limit) {
      // limit 번째 전 요청이 창에서 빠져나가는 순간에 보낼 수 있다.
      const blocker = times[times.length - limit] as number;
      sendAt = Math.max(now, blocker + WINDOW_MS);
    }
    times.push(sendAt);
    this.sent.set(model, times);
    return sendAt - now;
  }

  reset(): void {
    this.sent.clear();
  }
}
