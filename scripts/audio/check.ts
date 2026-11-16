import { inspectPack, listPackIds, printReport, projectRoot } from './lib';

// npm run audio:check
// 모든 팩의 오디오 누락·오류 리포트. 누락은 경고(빌드 통과), 규칙 위반은 오류(실패).
const root = projectRoot();
let errors = 0;
let missing = 0;
let present = 0;
for (const id of listPackIds(root)) {
  const report = inspectPack(root, id);
  printReport(report);
  errors += report.errors.length;
  missing += report.missing;
  present += report.present;
}
console.log(`\nTotal: ${present} recorded, ${missing} missing, ${errors} error(s)`);
process.exit(errors > 0 ? 1 : 0);
