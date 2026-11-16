# My American School Quest — 모국어처럼 배우는 영어

미국 초등학교에 전학 온 한국인 학생이 되어, 아이가 모국어를 배우듯이 영어를 배우는 3D RPG 입니다.
그림책을 **듣고 → 읽고 → 그림으로 이해하고 → 잠들기 전 편하게 듣고 → 쌓인 표현으로 말하고 쓰는** 과정을 반복하며
초등 → 중등 → 고등 → 대학 → 커리어까지 성장합니다.

## 새 모험: Maple Festival (0.2)

마을 왼쪽의 **다음 목표 카드**에서 시작합니다. 처음에는 `Meet Leo`를 누르세요.

1. **듣기**: 친구의 단서를 듣고 학교에 흩어진 별 꾸러미 3개를 찾습니다. `Follow the stars`를 누르면 목적지로 걸어가며, 가까워지면 열기 버튼으로 바뀝니다. PC에서는 E 키도 쓸 수 있습니다.
2. **읽기**: Ava의 초대장을 읽고 만날 장소를 찾습니다.
3. **입력 쌓기**: 이야기 1편의 ①~④를 완료하고 3번 들으며 이야기 등불을 밝힙니다. 단계마다 다음 행동이 표시됩니다.
4. **말하기**: 친구에게 초대 문장을 직접 말합니다. 음성 인식은 단어 일치율 피드백을 주며, 인식이 어려우면 녹음해서 듣고 자기 점검을 합니다. 마이크도 쓸 수 없으면 소리 내어 연습 후 자기 점검을 합니다(자동 채점으로 표시하지 않음).
5. **쓰기**: 짧은 초대장을 직접 써 친구들을 축제에 초대합니다.

완료한 의뢰는 해당 친구에게 돌아가 보상을 받습니다. 별로 리본·꽃핀·안경을 구입하면 2D 초상화와 3D 캐릭터에 함께 적용됩니다. 진행과 의상은 저장되며 v2 저장 데이터는 v3로 자동 변환됩니다. 축제 이후에는 기존 이야기 6편·자유 대화·스킬 퀘스트를 계속 이용할 수 있습니다.

## 학습 철학
1. **한국어를 거치지 않는다** — 뜻은 그림, 쉬운 영어, 상황으로 전달합니다. 게임 화면에는 한국어가 없습니다.
2. **입력이 먼저, 출력은 나중** — 충분히 듣고 읽어야 말하기·쓰기 퀘스트가 열립니다.
3. **한 권을 깊게** — 같은 이야기를 반복해 들어도 XP 가 줄지 않고, 5·10회째에 보너스를 받습니다.
4. **잠들기 전 편하게 듣기** — 글자·퀴즈·점수 없이 이야기만 듣는 밤 시간.
5. **원어민 속도에 익숙해지기** — 🐢 Slow → 🚶 Natural → 🚀 Native.
6. **책 속 표현이 말이 된다** — 이야기에서 모은 표현(Phrase Pocket)이 대화와 글쓰기의 재료가 됩니다.

한국어는 보호자 안내·설정·설치 안내 화면에만 나옵니다.

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
| `npm run version:set -- 0.2.0` | 버전 한 번에 맞추기 |
| `npm run tauri dev` / `npm run tauri build` | PC 설치형 앱 (Rust 필요) |
| `npm run updater:url -- https://your-site.netlify.app` | PC 업데이트 주소 설정 (빌드 전) |
| `npm run release:downloads -- <설치파일 폴더> [사이트주소]` | dist/downloads 설치 파일·다운로드 페이지 준비 |

## 사용자에게 배포하는 방법
자세한 준비 과정은 [`docs/RELEASE.md`](docs/RELEASE.md) 에 있습니다.

### 1) 웹 주소 공유 (PWA) — PC · 안드로이드 · 아이폰 공통
버전 태그를 push 하면 GitHub Pages 에 자동 배포됩니다. 배포 주소(`https://<계정>.github.io/<저장소>/`)를 보호자에게 보내면 됩니다.
- **안드로이드 · PC(Chrome/Edge)**: 주소를 열고 브라우저의 "앱 설치" 또는 게임 안 ⚙️ → 데이터 · 앱 → "설치 방법 보기" → "지금 설치하기"
- **아이폰 · 아이패드(Safari)**: 공유 버튼 → "홈 화면에 추가"
- 설치하면 인터넷 없이도 플레이할 수 있습니다(이야기 그림 포함, 녹음 오디오는 ⚙️ → 오디오 팩에서 내려받기).

Netlify에서 웹 게임과 설치 파일을 함께 제공하는 절차도 [`docs/RELEASE.md`](docs/RELEASE.md)에 있습니다.

### 2) PC 설치 파일 (Windows · macOS)
GitHub Releases 페이지에서 `.exe`/`.msi`(Windows), `.dmg`(macOS)를 내려받게 안내합니다.
- 코드 서명 인증서가 없으면 Windows SmartScreen / macOS Gatekeeper 경고가 뜰 수 있습니다. `docs/RELEASE.md` 의 안내 문구를 함께 전달하세요.
- 설치형 앱은 실행할 때 새 버전을 확인하고 앱 안에서 스스로 업데이트합니다.

## 업데이트 내보내는 방법
```bash
npm run version:set -- 0.2.0
```
`CHANGELOG.md` 에 변경 내용을 적고 커밋한 뒤:
```bash
git tag v0.2.0
```
```bash
git push origin main --tags
```
태그가 올라가면 GitHub Actions 가 테스트 → PWA 배포 → PC 설치 파일 빌드 → Release 업로드를 합니다.
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
