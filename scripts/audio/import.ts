import { importPack, printReport, projectRoot, resolvePackArg } from './lib';

// npm run audio:import -- <packId|all>
// audio 폴더 검사 → ffmpeg 로 형식·음량 정리 → audio-manifest.json 생성
const root = projectRoot();
const arg = process.argv[2];
if (!arg) {
  console.error('Usage: npm run audio:import -- <packId|all>');
  process.exit(2);
}
let failed = false;
for (const id of resolvePackArg(root, arg)) {
  const { report, processed, manifest } = importPack(root, id);
  printReport(report);
  if (manifest) console.log(`  🎚️  normalized ${processed} file(s), manifest lists ${Object.keys(manifest.files).length} sentence file(s)${manifest.full ? ' + full story' : ''}`);
  if (report.errors.length > 0) failed = true;
}
process.exit(failed ? 1 : 0);
