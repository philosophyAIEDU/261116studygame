# My American School Quest — 프로젝트 안내 (Claude Code용)

## 현재 기본 학습 방식 (0.3.0, 사용자 요청으로 변경)
- 기본 진입점: `WordQuestGame`. 소리 확인 → 짧은 적응형 단어 듣기 진단 → 수준에 맞는 5단어 RPG.
- 정답을 맞히면 안개를 걷고, 오답은 두 문제 뒤에 다시 만난다. 첫 정답과 재시도 정답을 구분하며 복습 시점을 기록한다.
- 사용자 선택에 따라 조작 안내도 영어·아이콘으로 유지하며 `src/i18n/wordQuest.ts`에서 관리한다. 단어·문제 보기·뜻 설명은 영어/그림만 사용하며 한국어 뜻 필드는 추가하지 않는다.
- 음성은 영어 voice 목록 로딩을 기다리고 pitch=1로 재생한다. 실제 onend 없이 듣기 완료를 만들지 않는다.
- 레벨은 게임 안 단어 듣기의 시작 단계이며 공인 영어 등급이 아니다. 모험 성적에 따라 계속 조정한다.
- 이전 이야기/축제 기능과 저장 데이터는 보존하지만 신규 사용자의 기본 흐름으로 안내하지 않는다.

아래 학습 철학은 이전 이야기 모드의 기준이며, 기본 모드와 충돌하면 위의 최신 요청을 우선한다.

## 학습 철학 6원칙 (기능이 충돌하면 이 원칙이 우선)
1. **한국어를 거치지 않는다.** 학습 콘텐츠에 한국어 뜻·번역 금지. 뜻은 그림·쉬운 영어·상황으로 전달.
2. **입력(듣기·읽기)이 먼저, 출력(말하기·쓰기)은 나중.** 입력이 쌓여야 출력 퀘스트가 열린다. 지름길 금지.
3. **한 권을 깊게.** 같은 이야기를 반복해 들어도 XP가 줄지 않고, 5·10회째 보너스.
4. **잠들기 전 편하게 듣기.** Bedtime Listening 에는 글자·퀴즈·점수·확인 버튼이 없다.
5. **원어민 속도에 익숙해지기.** Slow → Natural → Native (연음·축약 포함).
6. **책 속 표현이 말이 된다.** Phrase Pocket 표현이 Talk Time·쓰기의 재료.

## 절대 규칙
- `content/packs/**/story.json` 과 게임 화면 문자열에 **한글 금지** (`src/test/noKorean.test.ts` 가 검사).
  한국어는 `src/i18n/ko*.ts`(조작 안내·보호자·설정·설치 안내)와 주석, 문서에만 쓴다. 영어 단어의 한국어 번역은 넣지 않는다.
- 스키마에 한국어 뜻 필드를 만들지 않는다.
- Gemini 는 무료 등급만. 한도 도달 시 무조건 차단. API 키 하드코딩 금지. 키가 없어도 게임 전체가 돌아가야 한다.
- 녹음 오디오는 보호자 동의(`settings.sendAudioToGemini`) 없이는 절대 전송하지 않는다.
- Talk Time 대화 원문은 저장하지 않는다(통계만).
- 시중 그림책·캐릭터·브랜드 모방 금지. 이야기·인물·학교명은 모두 오리지널.
- TypeScript strict, `any` 금지. 게임 규칙은 React 와 분리된 순수 함수 + 한글 주석 + 테스트.

## 구조
```
src/
  app/            화면 전환, 업데이트 배너, 설치 안내
  world/          3D (r3f): 맵, 캐릭터, NPC, 카메라, 낮/밤
  features/
    story/        Story Quest 5단계 (unlock.ts = 해금 규칙)
    bedtime/      Bedtime Listening, 수면 타이머, Media Session
    dictionary/   My Picture Dictionary, 그리기 캔버스, SRS, 한글 차단
    skills/       듣기·읽기·말하기·쓰기 미니게임, 채점
    progression/  xp.ts, levels.ts, lifeStages.ts, inputHours.ts, badges.ts
    gemini/       클라이언트, 사용량, 레이트리미터, 캐시
    talktime/     음성 대화 (인식 → Gemini → 음성 대답)
    mentor/ mbti/ quests/ guardian/
  audio/          player, manifest, TTS 폴백, speedLadder
  content/        팩 로더 + Zod 스키마
  save/           store, schema, migrations/
  config/ ui/ i18n/ types/
content/packs/    이야기 팩 (앱 코드와 분리)
scripts/audio/    todo / import / check, tts.config.example.json
src-tauri/        PC 설치형 (Tauri 2 + updater)
```

## 자주 쓰는 명령
| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` / `npm run typecheck` | 단위 테스트 / 타입 검사 |
| `npm run e2e -- --trace off` | Playwright E2E |
| `npm run pack:new -- <packId>` | 새 이야기 팩 템플릿 |
| `npm run pack:art -- <packId\|all>` | 장면 placeholder SVG 생성 |
| `npm run audio:todo -- <packId\|all>` | 오디오가 없는 문장 목록 → `scripts/audio/audio-todo.json` |
| `npm run audio:import -- <packId>` | 오디오 검사·정규화(ffmpeg)·`audio-manifest.json` 생성 |
| `npm run audio:check` | 모든 팩 오디오 누락 리포트 (누락은 경고, 오류만 실패) |
| `npm run version:set -- 0.3.0` | package.json / tauri.conf.json / Cargo.toml 버전 맞추기 |

## 콘텐츠 팩 규칙 (`content/packs/<packId>/`)
- `pack.json`(메타) · `story.json`(장면·문장·단어·Phrase Pocket) · `images/` · `audio/` · `audio-manifest.json`(자동 생성, 손으로 편집 X)
- 문장 `id` 는 `s001` 형식으로 **고정**(오디오 파일명과 연결). 문장을 지우면 번호를 재사용하지 않는다.
- 오디오 파일명: `{sentenceId}.{slow|natural|native}.{mp3|m4a|wav}`, 단어 발음 `words/{word}.mp3`, 전체 낭독 `full.natural.mp3`.
- Native 속도는 `nativeText`(gonna, wanna 등 구어체)가 있으면 그 텍스트로 녹음한다.
- 스키마: `src/content/schema.ts` (Zod). 새 필드를 넣을 때는 스키마와 `scripts/pack-new.ts` 템플릿을 함께 고친다.

## 오디오 파이프라인 요약
`/make-audio <packId>` → `audio:todo` → 로컬 TTS(`scripts/audio/tts.config.json`) → `audio:import` → `audio:check`.
자세한 내용은 `docs/AUDIO_PIPELINE.md`. 앱은 특정 TTS 엔진에 의존하지 않고, 파일이 없으면 Web Speech 로 대체한다.

## 릴리스 (Netlify)
`npm run version:set -- x.y.z` → `CHANGELOG.md` 수정 → 커밋 → `git tag vx.y.z && git push origin HEAD --tags`.
태그를 push 하면 `.github/workflows/package.yml` 이 설치 파일을 빌드해 게임·`/guide/`(보호자 안내)·`/downloads/` 를 Netlify 에 올린다.
처음 설정은 `docs/NETLIFY.md`, PC 앱 자동 업데이트(서명 키)는 `docs/RELEASE.md`.
- `public/guide/index.html` 은 보호자용 한국어 정적 페이지다(게임 화면이 아니므로 한글 허용). `/downloads/index.json` 을 읽는다.
- 서비스 워커의 `navigateFallbackDenylist`(vite.config.ts)에서 `/guide`, `/downloads` 를 빼면 안 된다(게임 화면으로 바뀐다).
- Netlify 사이트를 Git 저장소에 연결하지 않는다(연결하면 push 때마다 설치 파일이 사라진다).
