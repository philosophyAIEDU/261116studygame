# My American School Quest — 모국어처럼 배우는 영어

기본 게임은 **Maple Word Quest (0.3)**입니다. 짧은 단어 듣기 진단 후, 수준에 맞는 단어 5개를 듣고 그림·영어 보기를 맞히며 안개 낀 길을 여는 학습 RPG입니다. 조작 안내도 영어와 아이콘으로 제공합니다.

## 바로 하는 방법
1. **Hear apple**로 영어 음성을 확인하고 **Start my level check**를 누릅니다. 영어 음성 선택·볼륨·미리 듣기를 제공합니다.
2. 3~12개 단어를 듣고 그림/단어를 고릅니다. 모르면 **I don’t know yet**를 누릅니다. 이 진단은 단어 듣기의 시작 수준이며 공인 영어 등급이 아닙니다.
3. 탐험가를 고르고 **Start my adventure**를 누릅니다. **Hear the word → 보기 선택 → Next word**를 반복합니다.
4. 단어 5개를 맞히면 안개가 걷힙니다. 보상을 받아 탐험가 장식을 모으고 다음 모험으로 갑니다.
5. **My learning**에서 단어·쉬운 영어 뜻·다시 듣기·복습 상태를 봅니다. 틀린 단어는 같은 모험에서 다시 나오며 다음 복습 시점도 기록합니다.

## 무엇을 배우나요?
- 영어 소리를 그림·철자와 연결하는 **단어 듣기와 어휘 인식**에 집중합니다. 초급은 그림 보기, 상급은 영어 단어 보기를 씁니다.
- 4개 단계에 총 96개 단어가 있습니다. 두 번 연속 첫 정답률 80% 이상이면 다음 단계로, 40% 이하이면 더 쉬운 단계로 이동합니다.
- 첫 시도 정답과 오답 후 재시도를 구분합니다. 독립적으로 3개 모험에서 맞힌 단어를 따로 표시합니다. 복습은 1·3·7·14일 간격이며, 틀린 단어는 더 빨리 돌아옵니다.
- 자유 대화·발음 평가·문장 쓰기 능력을 이 게임의 점수로 주장하지 않습니다.

## 음성
인위적으로 높였던 pitch를 1.0으로 되돌렸습니다. 영어 음성 목록이 늦게 로드되어도 기다리며, 영어 음성만 고릅니다. 기본 속도와 느린 재생, 음성 선택과 미리 듣기를 제공합니다. 소리가 실제로 끝나야 문제를 풀 수 있고, 무음·오류를 듣기 성공으로 처리하지 않습니다.

음질은 기기/브라우저의 영어 TTS 음성에 따라 달라집니다. 영어 음성이 없으면 설치나 다른 브라우저 사용이 필요합니다. API 키·마이크·로그인이 필요하지 않습니다.

기존 이야기·축제 소스와 저장 데이터는 보존하지만 새 기본 화면에서는 안내하지 않습니다. v3 저장 데이터는 v4로 자동 변환되며 기존 학습 진행을 삭제하지 않습니다.

## 설치와 실행 (개발자용)
Node.js 20 이상이 필요합니다.

```bash
npm install
```
```bash
npm run dev
```
브라우저에서 http://localhost:5173 을 엽니다.

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm run preview` | 배포용 빌드 / 빌드 결과 미리 보기 |
| `npm test` | 단위·컴포넌트 테스트 (Vitest) |
| `npm run test:coverage` | 핵심 로직 커버리지 (기준 80%) |
| `npm run e2e -- --trace off` | 핵심 흐름 E2E (Playwright, 처음 한 번 `npx playwright install chromium`) |
| `npm run typecheck` | 타입 검사 |
| `npm run audio:todo` / `audio:import` / `audio:check` | 오디오 파이프라인 (아래 참고) |
| `npm run pack:new` / `pack:art` | 새 이야기 팩 / placeholder 장면 그림 |
| `npm run version:set -- 0.3.0` | 버전 한 번에 맞추기 |
| `npm run tauri dev` / `npm run tauri build` | PC 설치형 앱 (Rust 필요) |
| `npm run updater:url -- https://your-site.netlify.app` | PC 업데이트 주소 설정 (빌드 전) |
| `npm run release:downloads -- <설치파일 폴더> [사이트주소]` | dist/downloads 설치 파일·다운로드 페이지 준비 |

## 사용자에게 배포하는 방법 (Netlify)
처음 설정은 [`docs/NETLIFY.md`](docs/NETLIFY.md) 를 따라 한 번만 하면 됩니다. 그다음부터는 버전 태그를 push 하면 자동으로 배포됩니다.
한 사이트에 세 가지가 함께 올라갑니다.

| 주소 | 내용 |
|---|---|
| `https://<사이트>.netlify.app/` | 게임 |
| `https://<사이트>.netlify.app/guide/` | **보호자용 설치·사용 안내** (기기에 맞는 설치 방법과 PC 설치 파일) |
| `https://<사이트>.netlify.app/downloads/` | PC 설치 파일 목록 |

보호자에게는 **`/guide/` 주소 하나만** 보내면 됩니다.

### 1) 웹 주소 공유 (PWA) — PC · 안드로이드 · 아이폰 공통
- **안드로이드 · PC(Chrome/Edge)**: 주소를 열고 브라우저의 "앱 설치" 또는 게임 안 ⚙️ → 데이터 · 앱 → "설치 방법 보기" → "지금 설치하기"
- **아이폰 · 아이패드(Safari)**: 공유 버튼 → "홈 화면에 추가"
- 설치하면 인터넷 없이도 플레이할 수 있습니다(이야기 그림 포함, 녹음 오디오는 ⚙️ → 오디오 팩에서 내려받기).

### 2) PC 설치 파일 (Windows · macOS)
안내 페이지(`/guide/#pc`)에서 `.exe`/`.msi`(Windows), `.dmg`(macOS, Apple Silicon·Intel 공용)를 내려받습니다.
- 코드 서명 인증서가 없어 Windows SmartScreen / macOS Gatekeeper 경고가 뜹니다. 넘어가는 방법은 안내 페이지에 적어 두었습니다.
- 새 버전은 안내 페이지에서 다시 받아 설치하면 됩니다(진행 기록 유지). 앱 안 자동 업데이트는 서명 키를 준비하면 켤 수 있습니다(`docs/RELEASE.md`).

## 업데이트 내보내는 방법
```bash
npm run version:set -- 0.3.0
```
`CHANGELOG.md` 에 변경 내용을 적고 커밋한 뒤:
```bash
git tag v0.2.0
```
```bash
git push origin HEAD --tags
```
태그가 올라가면 GitHub Actions 가 테스트 → PC 설치 파일 빌드 → Netlify 배포(게임·안내 페이지·설치 파일)를 합니다.
사용자는 게임의 마을 화면에서 "✨ New update!" 배너를 보게 됩니다(퀘스트나 잠들기 전 듣기 중에는 뜨지 않습니다).
진행 데이터는 업데이트 후에도 유지되며, ⚙️ → 데이터 · 앱에서 JSON 으로 내보내기/가져오기도 할 수 있습니다.

## Gemini 무료 키 발급 (선택)
키가 **없어도 게임 전체가 동작**합니다. 키를 넣으면 AI 멘토 Ms. Harper 와의 대화, Talk Time 음성 대화, 쓰기 첨삭을 쓸 수 있습니다.

1. https://aistudio.google.com 에 구글 계정으로 로그인합니다.
2. **Get API key → Create API key** 로 키를 만듭니다. **결제(Billing)가 연결되지 않은 프로젝트**를 고르세요.
3. 게임에서 ⚙️ → **AI · Talk Time** → API 키 칸에 붙여 넣고 저장합니다.

- 키는 그 기기에만 저장되고, 내보내기 파일에도 들어가지 않습니다. 같은 화면에서 언제든 삭제할 수 있습니다.
- 이 게임은 무료 등급만 씁니다. 하루 한도에 도달하면 호출을 막고, 유료로 넘어가지 않습니다.

| 모델 | 기본 한도 | 쓰는 곳 |
|---|---|---|
| `gemini-3.5-flash-lite` | 분당 10회 · 하루 500회 | Talk Time 대화, 멘토 질문, 롤플레이 |
| `gemini-3.8-flash` | 분당 5회 · 하루 20회 | 쓰기 4~5단계 첨삭, 발음 피드백 |

- 한도는 Google 이 바꿀 수 있습니다. Google AI Studio 에서 실제 한도를 확인하고 ⚙️ 에서 값을 맞춰 주세요(`src/config/geminiLimits.ts` 가 기본값).
- 게임 화면 오른쪽 위의 `🤖 Flash-Lite 37/500 · Flash 4/20` 이 오늘 사용량입니다. 이 숫자는 그 기기에서 센 추정치이고, 미국 태평양 시간 자정(한국 시간 오후 4~5시)에 초기화됩니다.
- Talk Time 1회는 최대 6번 호출합니다. 보호자가 ⚙️ 에서 "하루 Talk Time 최대 횟수"(기본 10회)를 정할 수 있습니다.

### 마이크와 개인정보
- 광고·추적·회원가입이 없습니다. 진행 기록은 기기 안에만 저장됩니다.
- 마이크 권한은 말하기 퀘스트에 들어갈 때만 요청합니다.
- 기본은 인식된 **글자만** Gemini 에 보냅니다. 녹음 오디오는 보호자가 ⚙️ 에서 동의했을 때만 보내며, 기기에 저장하지 않습니다.
- 브라우저의 음성 인식(Web Speech)은 브라우저 제조사(구글·애플 등) 서버를 거칠 수 있습니다.
- Talk Time 대화 원문은 저장하지 않습니다(횟수 같은 통계만 저장).

## 오디오 파일 만들고 넣는 방법
오디오 파일이 없어도 기기 음성(Web Speech)으로 읽어 줍니다. 더 자연스러운 목소리는 **내 컴퓨터의 로컬 TTS** 로 만들어 넣습니다.
전체 안내: [`docs/AUDIO_PIPELINE.md`](docs/AUDIO_PIPELINE.md)

1. ffmpeg 와 로컬 TTS(예: Kokoro, Piper)를 설치합니다.
2. 설정 파일을 만들고 내 TTS 명령에 맞게 고칩니다.
```bash
cp scripts/audio/tts.config.example.json scripts/audio/tts.config.json
```
3. Claude Code 에서 한 번에:
```
/make-audio elem-g1-01-new-school
```
   또는 직접: `npm run audio:todo -- <팩>` 으로 목록을 뽑아 `content/packs/<팩>/audio/` 에 `s001.natural.mp3` 같은 이름으로 넣은 뒤
```bash
npm run audio:import -- elem-g1-01-new-school
```
4. `npm run audio:check` 로 확인하고, `npm run dev` 로 게임에서 들어 봅니다.
5. 커밋하고 새 버전을 내보내면 사용자가 업데이트로 받습니다.

새 이야기는 Claude Code 에서 `/new-story 2 눈 오는 날` 처럼 만들 수 있습니다.

## 기기별 참고 사항
- **그래픽 품질**: 자동 감지(Low/Medium/High). 보급형 휴대폰은 ⚙️ 에서 "낮음"을 권장합니다. WebGL 을 쓸 수 없는 기기는 2D 지도로 대신합니다.
- **음성 인식**: Chrome·Edge·Safari 에서 동작합니다. Firefox 와 일부 iOS, PC 설치형 앱에서는 글자 입력(또는 녹음 후 다시 듣기)으로 대신합니다.
- **iOS(PWA)**: 저장 공간이 제한될 수 있어 오디오는 필요할 때만 내려받습니다. 화면이 꺼진 상태의 재생은 **녹음된 오디오 팩**에서만 안정적으로 이어집니다(기기 음성은 화면이 꺼지면 멈출 수 있습니다). 잠금 화면 컨트롤은 Media Session 으로 표시합니다.
- **키보드만으로 조작**: 방향키/WASD 로 이동, 📜 퀘스트 로그와 🗺️ 지도에서 장소로 바로 이동할 수 있습니다.

## 현재 범위와 한계
- 이야기는 초등 1~2단계 6편입니다. 중등 이후 단계는 맵·시험·난이도 구조가 준비되어 있고, 해당 단계 이야기 팩을 추가하기 전까지는 기존 이야기를 사용합니다.
- 장면 그림은 placeholder(SVG)입니다. 교체 방법은 [`docs/ART_BIBLE.md`](docs/ART_BIBLE.md) 7절.
- 3D 는 프리미티브로 구성되어 있습니다. CC0 모델을 넣는 방법과 출처 기록은 [`ASSETS.md`](ASSETS.md).
- Gemini 모델 ID 와 한도는 `src/config/geminiLimits.ts` 에 있습니다. 모델 이름이 바뀌면 이 파일만 고치면 됩니다.

## 폴더 구조
```
src/            앱 코드 (world: 3D, features: 학습·성장·AI, audio, content, save, i18n/ko: 보호자 화면)
content/packs/  이야기 팩 (텍스트·그림·오디오) — 앱 코드와 분리
scripts/        오디오 파이프라인, 팩 템플릿, 버전 스크립트
.claude/commands/  /make-audio, /new-story
src-tauri/      PC 설치형 (Tauri 2 + updater)
docs/           ART_BIBLE.md, AUDIO_PIPELINE.md, RELEASE.md
```
Claude Code 로 작업할 때의 규칙은 [`CLAUDE.md`](CLAUDE.md) 에 있습니다.
