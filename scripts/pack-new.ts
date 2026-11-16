import fs from 'node:fs';
import path from 'node:path';

// npm run pack:new -- <packId>
// 새 이야기 팩 템플릿을 만든다. 예) npm run pack:new -- elem-g2-07-snow-day
const id = process.argv[2];
if (!id || !/^[a-z0-9-]+$/.test(id)) {
  console.error('Usage: npm run pack:new -- <packId>   (lowercase letters, numbers, hyphens)');
  process.exit(2);
}
const dir = path.join(process.cwd(), 'content', 'packs', id);
if (fs.existsSync(dir)) {
  console.error(`Pack already exists: ${id}`);
  process.exit(1);
}
const existing = fs.existsSync(path.dirname(dir)) ? fs.readdirSync(path.dirname(dir)).length : 0;
fs.mkdirSync(path.join(dir, 'images'), { recursive: true });
fs.mkdirSync(path.join(dir, 'audio'), { recursive: true });
fs.writeFileSync(path.join(dir, 'audio', '.gitkeep'), '');

const meta = { id, title: 'New Story', stage: 'elementary', level: 1, order: existing + 1, theme: 'daily', version: 1, speeds: ['slow', 'natural', 'native'], cover: '📖' };
const story = {
  packId: id,
  title: 'New Story',
  level: 1,
  scenes: [
    { id: 'sc01', image: 'images/sc01.svg', place: 'classroom', objects: [{ word: 'book', emoji: '📘', x: 50, y: 60, size: 20 }] },
  ],
  sentences: [
    { id: 's001', sceneId: 'sc01', speaker: 'narrator', voiceStyle: 'calm', text: 'Mina opens a new book.' },
    { id: 's002', sceneId: 'sc01', speaker: 'girl', voiceStyle: 'excited', text: 'I am going to read it now!', nativeText: "I'm gonna read it now!" },
  ],
  words: [{ word: 'book', easyEnglish: 'it has pages and a story', imageKey: 'book', emoji: '📘' }],
  phrasePocket: ['I am going to read it now!'],
  talk: { npc: 'leo', scene: 'In the classroom. Leo asks about your book.', opener: 'Hi! What are you reading?' },
};
fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify(meta, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'story.json'), JSON.stringify(story, null, 2) + '\n');
console.log(`✅ Created content/packs/${id}`);
console.log('Next: edit story.json → npm run pack:art -- ' + id + ' → npm run audio:todo -- ' + id);
