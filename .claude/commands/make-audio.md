---
description: 이야기 팩의 듣기 파일을 로컬 TTS 로 만들고 게임에 넣는다
argument-hint: <packId|all>
---

# /make-audio $ARGUMENTS

이야기 팩 `$ARGUMENTS` 의 오디오를 **이 컴퓨터의 로컬 TTS** 로 만들어 게임에 넣는다.
앱은 TTS 엔진을 모른다. 규칙대로 파일만 놓이면 된다(`docs/AUDIO_PIPELINE.md` 참고).

## 순서

1. **설정 확인**: `scripts/audio/tts.config.json` 을 읽는다.
   - 없으면 멈추고, `scripts/audio/tts.config.example.json` 을 복사해 자기 TTS 에 맞게 고치라고 안내한다. 임의로 만들지 않는다.
2. **할 일 목록**: `npm run audio:todo -- $ARGUMENTS` 실행 → `scripts/audio/audio-todo.json` 을 읽는다.
   - 0개면 "만들 파일이 없다"고 알리고 4번으로 간다.
3. **파일 생성**: todo 의 항목마다 config 의 `command` 템플릿을 채워 실행한다.
   - `{voice}` = `voices[item.speaker]` (없으면 `voices.narrator`)
   - `{speedValue}` = `speeds[item.speed]`
   - `{text}` = `item.text` (셸 인용에 주의) / `{textFile}` = 텍스트를 `scripts/audio/.tmp/<id>.txt` 에 써 두고 그 경로
   - `{outPath}` = `item.outPath` 의 확장자를 config 의 `outputExt` 로 바꾼 경로 (wav 로 만들어도 import 가 mp3 로 바꾼다)
   - `{style}` = `styleHints[item.voiceStyle]`
   - `useNativeText` 가 false 면 native 항목의 텍스트를 story.json 의 `text` 로 바꿔 쓴다.
   - 먼저 **1개만** 만들어 길이가 0 이 아닌지 확인한 뒤 나머지를 진행한다. 실패한 항목은 건너뛰고 끝에 모아 보고한다.
   - `kind: "word"` 항목은 `words/` 폴더가 없으면 만든 뒤 생성한다.
4. **가져오기**: `npm run audio:import -- $ARGUMENTS` (형식 통일·음량 정규화·무음 정리·`audio-manifest.json` 생성)
5. **검사**: `npm run audio:check`
6. **보고**: 만든 파일 수, 실패 목록, 남은 누락, 경고(긴 무음 등)를 한국어로 짧게 정리한다.
   마지막에 "`npm run dev` 로 게임에서 들어 보세요"와 배포 방법(`docs/RELEASE.md`)을 한 줄로 안내한다.

## 주의
- `story.json` 의 문장 `id` 와 텍스트는 이 명령에서 **수정하지 않는다**.
- `audio-manifest.json` 은 손으로 편집하지 않는다(스크립트가 만든다).
- 시중 그림책·CD 등 남의 오디오를 넣지 않는다. 이 프로젝트의 오리지널 문장만 녹음한다.
