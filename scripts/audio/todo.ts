import fs from 'node:fs';
import path from 'node:path';
import { buildTodo, projectRoot, resolvePackArg } from './lib';

// npm run audio:todo -- <packId|all>
// 아직 오디오가 없는 문장 목록을 scripts/audio/audio-todo.json 으로 내보낸다.
const root = projectRoot();
const ids = resolvePackArg(root, process.argv[2]);
const todo = buildTodo(root, ids);
const out = path.join(root, 'scripts', 'audio', 'audio-todo.json');
fs.writeFileSync(out, JSON.stringify(todo, null, 2) + '\n');

const byPack = new Map<string, number>();
for (const t of todo) byPack.set(t.packId, (byPack.get(t.packId) ?? 0) + 1);
for (const id of ids) console.log(`📦 ${id}: ${byPack.get(id) ?? 0} file(s) to make`);
console.log(`\n📝 ${todo.length} item(s) → ${path.relative(root, out)}`);
