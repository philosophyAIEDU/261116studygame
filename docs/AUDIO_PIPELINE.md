# 듣기 파일 만들기 — 오디오 파이프라인 안내

이 게임은 오디오 파일이 하나도 없어도 **기기 음성(Web Speech)** 으로 돌아갑니다.
더 자연스러운 목소리를 원하면, 내 컴퓨터의 **로컬 TTS AI** 로 파일을 만들어 넣으면 됩니다.
앱 코드는 특정 TTS 엔진을 모릅니다. **파일이 규칙대로 놓여 있기만 하면** 됩니다.

## 한눈에 보기
```
story.json ──▶ audio:todo ──▶ audio-todo.json ──▶ (로컬 TTS) ──▶ audio/*.wav|mp3
                                                                     │
                게임 ◀── audio-manifest.json ◀── audio:import ◀──────┘
```

## 0. 준비물
- Node.js 20 이상, `npm install`
- **ffmpeg** (형식 통일·음량 정규화에 사용)
  - Windows: `winget install Gyan.FFmpeg` / macOS: `brew install ffmpeg` / Ubuntu: `sudo apt install ffmpeg`
- 로컬 TTS 엔진 하나 (예: Kokoro, Piper 같은 오픈소스 TTS). 명령줄에서 "텍스트 → 오디오 파일"이 되면 무엇이든 됩니다.
- (선택) Claude Code CLI — `/make-audio` 명령으로 아래 과정을 한 번에 실행합니다.

## 1. TTS 설정 파일 만들기
```bash
cp scripts/audio/tts.config.example.json scripts/audio/tts.config.json
```
`tts.config.json` 을 열어 내 TTS 에 맞게 고칩니다. (이 파일은 git 에 올라가지 않습니다)

| 항목 | 설명 |
|---|---|
| `command` | TTS 실행 명령 템플릿. `{voice}` `{speedValue}` `{text}` `{textFile}` `{outPath}` `{style}` 자리표시자를 쓸 수 있습니다 |
| `outputExt` | TTS 가 만드는 형식(`wav`/`mp3`/`m4a`). wav 여도 import 가 mp3 로 바꿉니다 |
| `voices` | story.json 의 `speaker`(narrator, girl, boy, friend, teacher, woman, man, creature) → 내 TTS 의 목소리 이름 |
| `speeds` | 속도별 값. 기본 slow 0.8 / natural 1.0 / native 1.15 |
| `useNativeText` | true 면 Native 속도 파일을 구어체 텍스트(`nativeText`: gonna, wanna…)로 녹음 |

## 2. 파일 만들기

### 방법 A — Claude Code 로 한 번에 (추천)
프로젝트 폴더에서 Claude Code 를 열고:
```
/make-audio elem-g1-01-new-school
```
`all` 을 주면 모든 팩을 처리합니다. Claude 가 todo 생성 → TTS 실행 → import → check 를 차례로 하고 결과를 보고합니다.

### 방법 B — 직접 실행
```bash
npm run audio:todo -- elem-g1-01-new-school
```
`scripts/audio/audio-todo.json` 에 "아직 없는 파일" 목록이 나옵니다. 항목 하나는 이렇게 생겼습니다.
```json
{ "kind": "sentence", "packId": "elem-g1-01-new-school", "sentenceId": "s002", "speed": "native",
  "text": "Hi! I'm gonna show you your desk.", "speaker": "teacher", "voiceStyle": "warm",
  "outPath": "content/packs/elem-g1-01-new-school/audio/s002.native.mp3" }
```
각 항목의 `text` 를 `speaker` 목소리와 `speed` 로 읽어 `outPath` 에 저장하면 됩니다.

### 파일 이름 규칙
| 종류 | 위치와 이름 | 예 |
|---|---|---|
| 문장 | `audio/{문장id}.{slow\|natural\|native}.{mp3\|m4a\|wav}` | `audio/s001.natural.mp3` |
| 단어 발음 | `audio/words/{단어}.mp3` | `audio/words/bright.mp3` |
| 전체 낭독(선택) | `audio/full.natural.mp3` | Bedtime Listening 용. 없으면 문장 파일을 이어 붙여 자동 생성 |

- **natural 만 있어도 됩니다.** slow·native 파일이 없으면 게임이 natural 파일을 0.75배·1.2배로 재생합니다(음높이 유지).
- native 파일을 따로 녹음하면 연음·축약이 살아 있어 훨씬 실제 같습니다.

## 3. 게임에 넣기 (import)
```bash
npm run audio:import -- elem-g1-01-new-school
```
이 명령이 하는 일:
1. 이름 규칙·빠진 파일·길이 0 검사 (문제가 있으면 파일을 건드리지 않고 멈춥니다)
2. ffmpeg 로 **mp3 / mono / 96kbps / 44.1kHz** 로 통일, **음량 정규화(-16 LUFS)**, 앞뒤 무음 정리
3. 모든 문장의 natural 파일이 있으면 `full.natural.mp3` 와 문장별 시작/끝 타임스탬프 생성
4. `audio-manifest.json` 생성 (파일별 길이·해시·속도). **이 파일은 손으로 고치지 않습니다.**

여러 번 실행해도 안전합니다. 이미 처리한 파일은 다시 인코딩하지 않습니다.

## 4. 확인
```bash
npm run audio:check
npm run dev
```
- `audio:check`: 모든 팩의 누락·오류 리포트. 누락은 경고(⚠️)일 뿐이고, 이름 규칙 위반 같은 오류(❌)만 실패합니다. CI 에서도 실행됩니다.
- 게임에서 이야기를 열어 🐢/🚶/🚀 속도를 바꿔 가며 들어 봅니다.

## 5. 배포
1. `content/packs/<팩>/audio/` 와 `audio-manifest.json` 을 커밋합니다.
2. 이미 배포된 팩의 오디오를 **바꿨다면** `pack.json` 의 `version` 을 1 올립니다 → 사용자 기기에 캐시된 예전 오디오 대신 새 파일을 받습니다.
3. 앱 버전을 올리고 태그를 push 합니다(`docs/RELEASE.md`). 사용자는 앱 업데이트로 새 오디오를 받습니다.

## 새 이야기 추가
```
/new-story 2 눈 오는 날
```
또는 `npm run pack:new -- elem-g2-07-snow-day` 로 템플릿을 만든 뒤 `story.json` 을 채우고,
`npm run pack:art -- elem-g2-07-snow-day` 로 placeholder 그림을 만듭니다. 그다음은 위 2~5 단계와 같습니다.

## 단어 단위 하이라이트(선택, 고급)
`audio-manifest.json` 의 각 파일에 `wordTimings: [{ "w": "Mina", "start": 0.0, "end": 0.31 }, …]` 를 넣을 수 있는 자리가 있습니다.
로컬 forced alignment 도구의 결과를 넣으면 Read Along 이 단어 단위로 하이라이트합니다. import 를 다시 해도 이 값은 유지됩니다.

## 자주 묻는 것
- **저작권**: 시중 그림책·원서·CD 의 오디오를 넣지 마세요. 이 프로젝트의 오리지널 문장만 녹음합니다. 사용하는 TTS 모델의 라이선스(상업적 이용 가능 여부)도 확인하세요.
- **용량**: 문장 1개 ≈ 30~60KB. 이야기 1편(3속도) ≈ 2MB 안팎. iOS 는 저장 공간이 제한될 수 있어 오디오는 필요할 때만 내려받습니다.
- **목소리가 어색하다**: 해당 파일만 지우고 다시 만든 뒤 `audio:import` 를 다시 실행하면 됩니다.
