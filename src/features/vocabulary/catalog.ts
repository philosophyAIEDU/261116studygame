export type WordLevel = 1 | 2 | 3 | 4;
export interface QuestWord { id: string; word: string; picture: string; hint: string; level: WordLevel }

// 단어 뜻은 그림과 짧은 영어 설명으로만 전달한다. 한국어 번역 필드는 두지 않는다.
const groups: readonly (readonly [string, string, string][])[] = [
  [
    ['apple','🍎','A round fruit.'], ['cat','🐈','A small animal that says meow.'], ['car','🚗','Ride in it on the road.'],
    ['dog','🐕','An animal that says woof.'], ['banana','🍌','A long yellow fruit.'], ['sun','☀️','It makes the day bright.'],
    ['fish','🐟','An animal that swims.'], ['ball','⚽','A round toy for playing.'], ['bird','🐦','An animal with wings.'],
    ['moon','🌙','Look for it in the night sky.'], ['tree','🌳','A tall plant with leaves.'], ['house','🏠','A place to live.'],
    ['bus','🚌','Many people ride in it.'], ['egg','🥚','A food with a shell.'], ['cake','🎂','A sweet birthday treat.'],
    ['flower','🌼','A colorful part of a plant.'], ['bear','🐻','A big animal with thick fur.'], ['rabbit','🐇','An animal with long ears.'],
    ['milk','🥛','A white drink.'], ['hat','🧢','Wear it on your head.'], ['shoe','👟','Wear it on your foot.'],
    ['star','⭐','A little light in the night sky.'], ['boat','⛵','Ride in it on water.'], ['key','🔑','Use it to open a lock.'],
  ],
  [
    ['pencil','✏️','Use it to write.'], ['bread','🍞','Slice it to make a sandwich.'], ['door','🚪','Open it to go inside.'],
    ['book','📖','Open it and read.'], ['chair','🪑','Sit on it.'], ['clock','🕒','It tells you the time.'],
    ['window','🪟','Look through it to see outside.'], ['water','💧','Drink it when you feel thirsty.'], ['rain','🌧️','Water falling from clouds.'],
    ['train','🚆','It travels on tracks.'], ['bicycle','🚲','Ride it by pushing the pedals.'], ['school','🏫','A place to learn together.'],
    ['teacher','🧑‍🏫','A person who helps you learn.'], ['family','👪','People who care for each other at home.'], ['garden','🌷','A place to grow flowers.'],
    ['cookie','🍪','A small sweet baked treat.'], ['orange','🍊','A round fruit with orange skin.'], ['elephant','🐘','A very big animal with a trunk.'],
    ['turtle','🐢','An animal with a hard shell.'], ['umbrella','☂️','Hold it to stay dry in the rain.'], ['bed','🛏️','Lie on it to sleep.'],
    ['bag','🎒','Carry your things in it.'], ['gift','🎁','Something you give to another person.'], ['pizza','🍕','A food with cheese on a flat base.'],
  ],
  [
    ['climb','🧗','Go up using your hands and feet.'], ['blanket','🛌','It keeps you warm in bed.'], ['thunder','⛈️','A loud sound during a storm.'],
    ['forest','🌲','A large place full of trees.'], ['mountain','🏔️','A very high part of the land.'], ['river','🏞️','Water flowing across the land.'],
    ['bridge','🌉','A way to cross over water.'], ['island','🏝️','Land with water all around it.'], ['castle','🏰','A large old building with towers.'],
    ['feather','🪶','A soft part of a bird.'], ['whisper','🤫','Speak very quietly.'], ['laugh','😄','Make a happy sound.'],
    ['sleepy','😴','Ready to fall asleep.'], ['hungry','😋','Wanting something to eat.'], ['empty','🪣','With nothing inside.'],
    ['heavy','🏋️','Hard to lift.'], ['bright','🔆','Full of light.'], ['gentle','🕊️','Soft and kind.'],
    ['collect','🧺','Bring things together.'], ['discover','🔎','Find something for the first time.'], ['follow','👣','Go after someone or something.'],
    ['arrive','🏁','Get to a place.'], ['borrow','📚','Use something and give it back later.'], ['careful','⚠️','Thinking about how to stay safe.'],
  ],
  [
    ['journey','🧭','A trip from one place to another.'], ['protect','🛡️','Keep someone or something safe.'], ['curious','🔭','Wanting to learn or know more.'],
    ['imagine','💭','Make a picture in your mind.'], ['improve','📈','Become better than before.'], ['remember','🧠','Keep something in your mind.'],
    ['prepare','🧰','Get ready for something.'], ['explain','💬','Help someone understand an idea.'], ['compare','⚖️','Look at how things are alike or different.'],
    ['decide','🪧','Choose what to do.'], ['patient','⏳','Able to wait calmly.'], ['confident','🦁','Feeling that you can do something.'],
    ['creative','🎨','Good at making new ideas.'], ['generous','🤲','Happy to give and share.'], ['responsible','✅','Someone others can trust to do the right thing.'],
    ['different','🦋','Not the same as something else.'], ['ordinary','🪨','Usual, with nothing special about it.'], ['possible','🌈','Something that can happen.'],
    ['challenge','🧩','Something that takes effort to do.'], ['solution','💡','A way to solve a problem.'], ['reason','❓','Why something happens.'],
    ['discoverer','🧑‍🚀','A person who finds something new.'], ['experience','🎟️','Something you do or live through.'], ['community','🏘️','People who live or work together.'],
  ],
];
export const WORDS: readonly QuestWord[] = groups.flatMap((group, i) => group.map(([word, picture, hint]) => ({ id: word, word, picture, hint, level: (i + 1) as WordLevel })));
export function questWord(id: string): QuestWord { const word = WORDS.find((w) => w.id === id); if (!word) throw new Error(`Unknown word: ${id}`); return word; }
export const PLACEMENT_WORDS = [ ['apple','cat','car'], ['pencil','bread','door'], ['climb','blanket','thunder'], ['journey','protect','curious'] ] as const;
