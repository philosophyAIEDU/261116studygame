// "Real Talk" 이벤트 대본: 카페테리아·운동장에서 친구들이 원어민 속도로 나누는 짧은 잡담.
// 연음·축약(gonna, wanna, whatcha …)이 들어 있다. 레벨이 오를수록 길어지고 빨라진다.
// 모두 이 게임의 오리지널 대사다.

export interface RealTalkScript {
  id: string;
  /** 이 레벨부터 나온다 */
  minLevel: number;
  lines: { npc: 'leo' | 'ava'; text: string }[];
  /** 들린 핵심 단어 (정답) */
  keyWords: string[];
  /** 나오지 않은 단어 (오답 보기) */
  distractors: string[];
}

export const REAL_TALK: readonly RealTalkScript[] = [
  {
    id: 'rt-lunch', minLevel: 1,
    lines: [{ npc: 'leo', text: "Hey, whatcha eating?" }, { npc: 'ava', text: "Pizza! Wanna try some?" }],
    keyWords: ['eating', 'pizza', 'try'], distractors: ['milk', 'sleep', 'book'],
  },
  {
    id: 'rt-tag', minLevel: 1,
    lines: [{ npc: 'ava', text: "Wanna play tag?" }, { npc: 'leo', text: "Sure! You're it!" }],
    keyWords: ['play', 'tag', 'sure'], distractors: ['rain', 'pencil', 'hungry'],
  },
  {
    id: 'rt-ball', minLevel: 5,
    lines: [{ npc: 'leo', text: "I'm gonna get the ball. Wait here!" }, { npc: 'ava', text: "Okay, but hurry up. Recess is almost over." }],
    keyWords: ['ball', 'wait', 'hurry', 'recess'], distractors: ['lunch', 'dragon', 'window'],
  },
  {
    id: 'rt-homework', minLevel: 9,
    lines: [
      { npc: 'ava', text: "Didja finish your homework?" },
      { npc: 'leo', text: "Not yet. I kinda forgot about it." },
      { npc: 'ava', text: "Lemme help you after school." },
    ],
    keyWords: ['homework', 'forgot', 'help', 'school'], distractors: ['birthday', 'puddle', 'cake'],
  },
  {
    id: 'rt-movie', minLevel: 21,
    lines: [
      { npc: 'leo', text: "Whatcha doing this weekend?" },
      { npc: 'ava', text: "I dunno. Maybe I'm gonna see a movie with my cousin." },
      { npc: 'leo', text: "Cool! Lemme know if you wanna hang out after." },
    ],
    keyWords: ['weekend', 'movie', 'cousin', 'hang'], distractors: ['library', 'candle', 'boots'],
  },
  {
    id: 'rt-test', minLevel: 36,
    lines: [
      { npc: 'ava', text: "I can't believe the test is tomorrow. I haven't even started studying." },
      { npc: 'leo', text: "Don't worry about it. We could go over the notes together if you want." },
      { npc: 'ava', text: "That'd be great. I'll bring snacks, you bring the notes." },
    ],
    keyWords: ['test', 'tomorrow', 'studying', 'notes', 'snacks'], distractors: ['rocket', 'rainbow', 'swing'],
  },
  {
    id: 'rt-work', minLevel: 51,
    lines: [
      { npc: 'leo', text: "So, how'd the interview go? Did they say when they're gonna call you back?" },
      { npc: 'ava', text: "Pretty well, I think. They said they'd let me know by Friday, so I'm kinda nervous." },
      { npc: 'leo', text: "You've got this. Whatever happens, we oughta celebrate this weekend." },
    ],
    keyWords: ['interview', 'call', 'friday', 'nervous', 'celebrate'], distractors: ['doorbell', 'pirate', 'tray'],
  },
];

/** 지금 레벨에서 나올 수 있는 대본 (레벨에 맞는 가장 어려운 것 위주로 2~3개) */
export function realTalkFor(level: number): RealTalkScript[] {
  const available = REAL_TALK.filter((s) => s.minLevel <= level);
  return available.slice(-3);
}
