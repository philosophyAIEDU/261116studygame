import fs from 'node:fs';
import path from 'node:path';
import { projectRoot, readPack, resolvePackArg } from './audio/lib';

// npm run pack:art -- <packId|all> [--force]
// story.json 의 장면 정보(place, objects)로 placeholder 장면 그림(SVG)을 만든다.
// 실제 일러스트(webp)로 바꿀 때는 scenes[].image 경로만 고치면 된다. (docs/ART_BIBLE.md 7절)

const PLACE: Record<string, { top: string; bottom: string; ground: string; accent: string }> = {
  classroom: { top: '#FFE9C7', bottom: '#FFD9A0', ground: '#D9A066', accent: '#7EC8E3' },
  cafeteria: { top: '#FFF1D6', bottom: '#FFD3B0', ground: '#C9B8A0', accent: '#E8743B' },
  playground: { top: '#9ED8F0', bottom: '#D8F1FF', ground: '#7CC36A', accent: '#F6B352' },
  library: { top: '#E9DCC3', bottom: '#D7BFA0', ground: '#9B6B4A', accent: '#7CC36A' },
  home: { top: '#FCE3D0', bottom: '#F6C9A8', ground: '#B98562', accent: '#8E7CC3' },
  outside: { top: '#9FB8D8', bottom: '#D4E3F2', ground: '#6FA86A', accent: '#7EC8E3' },
  party: { top: '#FFE0EC', bottom: '#FFD1A6', ground: '#D08BB0', accent: '#F6B352' },
};
const W = 800;
const H = 500;

function sceneSvg(place: string, objects: { emoji: string; x: number; y: number; size: number }[], seed: number): string {
  const c = PLACE[place] ?? PLACE.classroom!;
  // 장면마다 살짝 다른 장식(부드러운 원)을 넣어 단조롭지 않게 한다.
  const blobs = [0, 1, 2].map((i) => {
    const x = ((seed * 97 + i * 263) % 700) + 50;
    const y = ((seed * 53 + i * 131) % 160) + 40;
    return `<circle cx="${x}" cy="${y}" r="${46 + ((seed + i) % 3) * 14}" fill="#ffffff" opacity="0.28"/>`;
  });
  const items = [...objects]
    .sort((a, b) => a.y - b.y)
    .map((o) => {
      const size = Math.round((o.size / 100) * W * 0.62);
      const x = (o.x / 100) * W;
      const y = (o.y / 100) * H;
      return `<ellipse cx="${x}" cy="${y + size * 0.42}" rx="${size * 0.36}" ry="${size * 0.08}" fill="#2B2440" opacity="0.14"/>` +
        `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central">${o.emoji}</text>`;
    });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.top}"/><stop offset="1" stop-color="${c.bottom}"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
${blobs.join('\n')}
<rect x="0" y="${H * 0.7}" width="${W}" height="${H * 0.3}" fill="${c.ground}"/>
<rect x="0" y="${H * 0.7}" width="${W}" height="10" fill="${c.accent}" opacity="0.55"/>
<g font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">
${items.join('\n')}
</g>
</svg>
`;
}

const root = projectRoot();
const force = process.argv.includes('--force');
let made = 0;
for (const id of resolvePackArg(root, process.argv[2])) {
  const pack = readPack(root, id);
  pack.story.scenes.forEach((scene, index) => {
    if (!scene.image.endsWith('.svg')) return; // 실제 일러스트로 교체된 장면은 건드리지 않는다
    const file = path.join(pack.dir, scene.image);
    if (fs.existsSync(file) && !force) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, sceneSvg(scene.place, scene.objects, index + id.length));
    made++;
  });
}
console.log(`🎨 ${made} placeholder scene image(s) written`);
