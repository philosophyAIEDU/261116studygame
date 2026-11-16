# 배포와 업데이트 — 릴리스 안내

사용자가 받는 경로는 두 가지입니다.

| 경로 | 대상 | 설치 | 자동 업데이트 |
|---|---|---|---|
| **PWA** (웹 주소) | PC · 안드로이드 · 아이폰 | 주소를 열고 "설치 / 홈 화면에 추가" | 서비스 워커가 새 버전을 받아 두고, 마을 화면에서 "✨ New update!" 배너로 알림 |
| **PC 설치형** (Tauri) | Windows · macOS | GitHub Releases 의 설치 파일 | 앱이 `latest.json` 을 확인 → 앱 안에서 내려받고 다시 시작 |

## 처음 한 번만 하는 준비

### 1. GitHub Pages 켜기 (PWA)
저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꿉니다.
배포 주소는 `https://<계정>.github.io/<저장소>/` 입니다. (Cloudflare Pages 를 쓰려면 `dist/` 를 그대로 올리면 됩니다)

### 2. 업데이트 서명 키 만들기 (PC 설치형)
PC 앱은 서명이 맞는 업데이트만 설치합니다. 키쌍을 한 번 만들어 둡니다.
```bash
npm run tauri signer generate -- -w ~/.tauri/school-quest.key
```
- **공개 키**(화면에 출력되는 긴 문자열) → 저장소 **Settings → Secrets and variables → Actions → Variables** 에 `TAURI_UPDATER_PUBKEY` 로 등록
- **개인 키**(`~/.tauri/school-quest.key` 파일 내용) → 같은 화면의 **Secrets** 에 `TAURI_SIGNING_PRIVATE_KEY` 로 등록
- 키에 비밀번호를 걸었다면 → Secrets 에 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

> ⚠️ 개인 키는 GitHub Secrets 와 안전한 백업 장소에만 둡니다. 저장소에 커밋하지 마세요.
> 개인 키를 잃어버리면 이미 설치된 앱에 업데이트를 보낼 수 없습니다(사용자가 새로 설치해야 함).

`TAURI_UPDATER_PUBKEY` 변수를 등록하지 않으면 PC 설치 파일 단계는 건너뛰고 PWA 만 배포됩니다.

### 3. (선택) 코드 서명 인증서
인증서가 없어도 설치는 됩니다. 다만
- **Windows**: 처음 실행할 때 SmartScreen 이 "Windows 의 PC 보호" 경고를 띄울 수 있습니다 → "추가 정보 → 실행".
- **macOS**: "확인되지 않은 개발자" 경고가 뜰 수 있습니다 → 시스템 설정 → 개인정보 보호 및 보안 → "확인 없이 열기".

보호자에게 이 점을 미리 알려 주세요. 경고를 없애려면 Windows 코드 서명 인증서, Apple Developer 계정(공증)이 필요합니다.

## 새 버전 내보내기 (매번)
```bash
npm run version:set -- 0.2.0
```
package.json, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` 의 버전이 한 번에 맞춰집니다. 앱 화면의 버전은 빌드할 때 package.json 에서 읽습니다.

1. `CHANGELOG.md` 맨 위에 `## 0.2.0 — 한 줄 설명` 과 변경 내용을 한국어로 적습니다 (설정 화면에 그대로 보입니다).
2. 확인: `npm test` → `npm run audio:check` → `npm run build`
3. 커밋하고 태그를 push 합니다.

```bash
git commit -am "Release v0.2.0"
```
```bash
git tag v0.2.0
```
```bash
git push origin main --tags
```

태그가 올라가면 `.github/workflows/release.yml` 이 실행됩니다.
1. 테스트 (태그와 package.json 버전이 다르면 여기서 멈춥니다)
2. PWA 빌드 → GitHub Pages 배포
3. Windows · macOS 설치 파일 빌드
4. GitHub Release 생성 + 설치 파일 + `latest.json` 업로드

## 사용자에게 일어나는 일
- **PWA**: 다음에 앱을 열면(또는 켜 둔 채 1시간마다) 새 버전을 백그라운드로 받습니다. 퀘스트나 Bedtime Listening 중에는 방해하지 않고, 마을 화면에 돌아왔을 때 배너가 뜹니다. "Update now" 를 누르면 새 버전으로 바뀝니다.
- **PC 설치형**: 실행할 때와 6시간마다 `latest.json` 을 확인합니다. 새 버전이 있으면 같은 배너가 뜨고, 누르면 내려받아 설치한 뒤 다시 시작합니다.
- **진행 데이터**는 그대로 유지됩니다. 저장 형식이 바뀐 버전이면 `src/save/migrations/` 의 변환이 자동으로 실행됩니다.

## 새 이야기·오디오를 업데이트로 보내기
1. `content/packs/<새 팩>/` 을 추가합니다 (`/new-story`, `/make-audio` — `docs/AUDIO_PIPELINE.md`).
2. 이미 배포한 팩의 오디오를 바꿨다면 그 팩 `pack.json` 의 `version` 을 1 올립니다 (캐시된 예전 오디오 대신 새 파일을 받게 됩니다).
3. 위의 "새 버전 내보내기"를 그대로 합니다.

## 저장 형식(세이브)을 바꿀 때
1. `src/save/schema.ts` 의 `CURRENT_SCHEMA_VERSION` 을 올립니다.
2. `src/save/migrations/` 에 `vNToV(N+1).ts` 를 만들고 `migrations/index.ts` 의 `MIGRATIONS` 에 등록합니다.
3. `src/save/save.test.ts` 에 예전 형식 샘플 → 새 형식 변환 테스트를 추가합니다.

## 로컬에서 PC 앱 빌드해 보기
Rust(rustup)와 운영체제별 준비물이 필요합니다 → https://tauri.app/start/prerequisites/
```bash
npm run tauri dev
```
```bash
npm run tauri build
```
서명 키 없이 빌드만 해 보려면 `src-tauri/tauri.conf.json` 의 `bundle.createUpdaterArtifacts` 를 잠시 `false` 로 바꾸세요.

## 안드로이드 APK (선택)
기본 모바일 경로는 PWA 입니다. APK 가 꼭 필요하면 Tauri 2 mobile 로 만들 수 있습니다(`npm run tauri android init` → `npm run tauri android build`). Android Studio·NDK 설정이 필요하며, 이 저장소의 CI 에는 포함되어 있지 않습니다.

## Netlify에서 웹 게임과 PC 설치 파일 함께 제공하기

`netlify.toml`은 `npm run build` 결과인 `dist/`를 배포합니다. 웹 게임만 제공할 때는 이 설정 그대로 사용합니다.

PC 앱의 업데이트 주소도 Netlify로 옮기려면 **PC 앱을 빌드하기 전에** 실제 운영 주소를 지정합니다.

```bash
npm run updater:url -- https://your-site.netlify.app
```

이 명령은 공개 키를 유지하고 업데이트 주소를 `/downloads/latest.json`으로 바꿉니다. 서명 키 준비는 위 안내와 같습니다. 이미 배포된 앱은 기존 주소를 계속 사용하므로 기존 업데이트 경로도 유지해야 합니다.

Windows/macOS 빌드 파일과 GitHub Release의 `latest.json`을 `work/desktop-artifacts/`에 모읍니다. 원래 파일명을 유지하고, 현재 버전에 해당하는 파일만 넣습니다. 각 OS 빌드는 해당 운영체제나 기존 GitHub Actions에서 수행합니다.

```bash
npm run build
npm run release:downloads -- work/desktop-artifacts https://your-site.netlify.app
```

- `dist/downloads/`에 설치 파일, 서명 파일, 다운로드 페이지, 업데이트 매니페스트가 만들어집니다.
- 사용자는 `https://your-site.netlify.app/downloads/`에서 설치 파일을 고릅니다.
- 파일 내용과 서명은 유지하며, 매니페스트의 다운로드 주소만 Netlify로 바꿉니다. 파일 누락·이름 충돌·버전 불일치 시 중단합니다.
- 주소 인자를 생략하면 설치 파일 다운로드만 준비하고 업데이트 매니페스트는 만들지 않습니다.
- **완성된 `dist/`를 그대로 배포해야 합니다.** 이후 `npm run build`를 다시 실행하면 다운로드 파일이 지워집니다. Netlify의 기본 Git 빌드는 웹 게임만 만들므로, PC 파일까지 제공할 때는 위 명령으로 준비한 `dist/`를 수동 배포하거나 같은 과정을 CI에 추가하세요.
- PC 파일은 PWA 오프라인 캐시에 포함하지 않습니다. `latest.json`은 캐시하지 않아 새 버전을 확인할 수 있습니다.

이 명령들은 파일 준비와 주소 설정만 수행합니다. 실제 업로드·설치 파일 빌드·서명 키 생성은 별도로 진행합니다.

## 서명 키가 없을 때 설치 파일부터 만들기

GitHub Actions의 **Package installers and website → Run workflow**에서 실행합니다.
`codex/package-release` 브랜치에 push해도 실행됩니다.

1. 테스트·빌드가 성공하면 Windows x64 EXE/MSI와 macOS Universal DMG를 각 OS에서 빌드합니다.
2. `desktop-windows-latest`, `desktop-macos-latest` 아티팩트로 설치 파일을 받습니다.
3. `school-quest-netlify-site` 아티팩트에는 웹 게임과 `/downloads/` 설치 페이지가 함께 들어 있습니다.
4. 이 아티팩트를 풀어 Netlify에 업로드하면 웹 게임과 설치 파일을 함께 제공합니다.

이 경로는 **수동 설치용**이며 자동 업데이트 서명 파일은 만들지 않습니다. 서명 키를 준비한 뒤 기존 Release 워크플로로 업데이트를 배포하세요. 운영체제 코드 서명도 별도 준비가 필요합니다.

자동 Netlify 배포를 쓰려면 저장소 Actions 설정에 Secret `NETLIFY_AUTH_TOKEN`과 Variable `NETLIFY_SITE_ID`를 등록합니다. 토큰을 코드나 채팅에 붙여넣지 마세요. 설정되어 있지 않으면 업로드할 아티팩트까지만 만듭니다. Git 연속 배포가 연결된 사이트에서는 이후 운영 브랜치 push가 이 배포를 대체할 수 있으므로, 설치 파일을 유지하려면 같은 패키징 과정을 연속 배포에도 사용하세요.
