# Netlify 배포 안내 — 게임 · 설치 파일 · 사용법 안내를 한 사이트에

Netlify 사이트 하나에 아래 세 가지가 함께 올라갑니다.

| 주소 | 내용 | 누구에게 |
|---|---|---|
| `https://<사이트>.netlify.app/` | 게임 (브라우저에서 바로 실행, 휴대폰 "홈 화면에 추가") | 아이 |
| `https://<사이트>.netlify.app/guide/` | **설치·사용 안내 페이지** (한국어). 접속한 기기에 맞는 설치 방법과 설치 파일을 먼저 보여 줍니다 | 보호자 |
| `https://<사이트>.netlify.app/downloads/` | PC 설치 파일 목록 (Windows `.exe` `.msi`, Mac `.dmg`) | 보호자 |

보호자에게는 **`/guide/` 주소 하나만** 보내면 됩니다. `https://<사이트>.netlify.app/install` 로 들어와도 안내 페이지로 이동합니다.

배포는 GitHub Actions 의 **Package installers and website** 워크플로(`.github/workflows/package.yml`)가 합니다.
Windows·Mac 설치 파일은 각 운영체제에서만 만들 수 있어 Netlify 가 직접 만들 수 없기 때문입니다.
워크플로가 하는 일은 다음과 같습니다.
1. 테스트
2. Windows(.exe, .msi)·Mac(.dmg) 설치 파일 빌드
3. 웹 게임 빌드와 설치 파일 정리
4. Netlify 업로드

---

## 처음 한 번만 하는 준비

### 1단계. Netlify 사이트 만들기
1. https://app.netlify.com 에 가입·로그인합니다 (GitHub 계정으로 로그인해도 됩니다).
2. GitHub 저장소의 **Actions** 탭 → 왼쪽 **Package installers and website** → **Run workflow** → 초록 **Run workflow** 를 누릅니다.
   아직 Netlify 정보를 등록하지 않았으므로 업로드 단계는 건너뛰고, 올릴 파일 묶음만 만듭니다. Windows·Mac 빌드 때문에 시간이 꽤 걸립니다.
3. 실행이 끝나면(초록 체크) 그 실행을 눌러 아래 **Artifacts** 에서 **school-quest-netlify-site** 를 내려받아 압축을 풉니다.
4. Netlify 에서 **Add new project → Deploy manually** 를 고르고, 압축을 푼 폴더(안에 `index.html`, `guide`, `downloads` 가 있는 폴더)를 끌어다 놓습니다.
5. 배포가 끝나면 임의의 주소(예: `https://jolly-otter-123.netlify.app`)가 생깁니다.
   **Project configuration → Change project name** 에서 알아보기 쉬운 이름(예: `school-quest`)으로 바꾸면 `https://school-quest.netlify.app` 이 됩니다.

> ⚠️ **"Import from Git"으로 저장소를 Netlify 에 연결하지 마세요.**
> 연결하면 저장소에 push 할 때마다 Netlify 가 웹 게임만 다시 빌드해서, 올려 둔 PC 설치 파일이 사라집니다.
> 이 프로젝트는 GitHub Actions 가 설치 파일까지 함께 올리는 방식(위 4번처럼 "직접 배포" 사이트)을 씁니다.

### 2단계. 자동 배포에 필요한 값 3개 모으기
| 값 | 어디서 찾나요 |
|---|---|
| **Project ID** | Netlify → 내 사이트 → **Project configuration → General → Project details** 의 *Project ID* (긴 영문·숫자) |
| **개인 액세스 토큰** | Netlify 오른쪽 위 내 프로필 → **User settings → Applications → Personal access tokens → New access token**. 이름(예: `github-actions`)과 만료일을 정하고 만든 뒤, 화면에 한 번만 보이는 토큰을 복사합니다 |
| **사이트 주소** | 1단계에서 정한 주소. 예: `https://school-quest.netlify.app` (끝에 `/` 없이) |

> 토큰은 비밀번호와 같습니다. 채팅·메일·코드에 붙여 넣지 말고, 바로 아래 GitHub 설정에만 넣으세요.
> 만료일이 지나면 배포가 멈추므로 그 전에 새 토큰으로 바꿔 주세요.

### 3단계. GitHub 저장소에 등록하기
GitHub 저장소 → **Settings → Secrets and variables → Actions**

| 종류 | 이름 | 값 |
|---|---|---|
| **Secrets** 탭 → New repository secret | `NETLIFY_AUTH_TOKEN` | 개인 액세스 토큰 |
| **Variables** 탭 → New repository variable | `NETLIFY_SITE_ID` | Project ID |
| **Variables** 탭 → New repository variable | `SITE_URL` | 사이트 주소 (선택. 넣으면 PC 앱의 설치 안내 화면과 배포 결과 요약에 이 주소가 나옵니다) |

### 4단계. 첫 자동 배포
**Actions → Package installers and website → Run workflow** 를 한 번 더 누릅니다.
끝나면 실행 요약(Summary)에 "Netlify 배포 완료"와 주소가 나옵니다.
`https://<사이트>.netlify.app/guide/` 를 열어 Windows·Mac 설치 파일이 보이는지 확인하세요.

---

## 새 버전 내보내기 (매번)
1. 버전을 올립니다.
```bash
npm run version:set -- 0.2.0
```
2. `CHANGELOG.md` 맨 위에 `## 0.2.0 — 한 줄 설명` 과 바뀐 점을 한국어로 적습니다 (게임 설정 화면에 그대로 보입니다).
3. 확인합니다: `npm test`, `npm run build`
4. 커밋하고 버전 태그를 올립니다.
```bash
git commit -am "Release v0.2.0"
```
```bash
git tag v0.2.0
```
```bash
git push origin HEAD v0.2.0
```

태그가 올라가면 워크플로가 자동으로 실행되어 Netlify 사이트 전체(게임·안내 페이지·설치 파일)를 새 버전으로 바꿉니다.
태그 이름과 `package.json` 버전이 다르면 테스트 단계에서 멈춥니다.

### 사용자에게 일어나는 일
- **휴대폰·브라우저**: 다음에 게임을 열면 새 버전을 백그라운드로 받고, 학교 화면에 **✨ New update!** 배너가 뜹니다. 이야기를 듣는 중에는 뜨지 않습니다.
- **PC 설치 프로그램**: 안내 페이지에서 새 설치 파일을 받아 그대로 설치하면 됩니다. 진행 기록은 유지됩니다.
  (PC 앱 안에서 저절로 업데이트되게 하려면 아래 "PC 앱 자동 업데이트"를 준비하세요)

---

## 알아 둘 점
- **설치 파일 경고**: 코드 서명 인증서가 없어서 Windows 는 "Windows의 PC 보호", Mac 은 "확인되지 않은 개발자" 경고가 뜹니다. 넘어가는 방법은 안내 페이지(`/guide/#pc`)에 단계별로 적어 두었습니다.
- **Mac 설치 파일**은 Apple Silicon·Intel 공용(universal) 하나입니다.
- **Netlify 사용량**: 무료 플랜에는 월 사용 한도(대역폭 등)가 있습니다. 설치 파일은 한 개에 수~수십 MB 라서 많이 내려받으면 사용량이 빨리 늘어납니다. Netlify 대시보드의 사용량을 가끔 확인하세요.
- **수동 배포도 가능**: 자동 배포 값이 없거나 잘못되어도, 실행 결과의 **school-quest-netlify-site** 묶음을 Netlify 의 **Deploys → 직접 배포 영역**에 끌어다 놓으면 같은 결과가 됩니다.
- **오래된 설치 파일**은 남지 않습니다. 배포할 때마다 사이트 전체가 새 버전으로 바뀝니다.

## PC 앱 자동 업데이트 (선택, 나중에)
지금 Netlify 에 올라가는 PC 설치 파일은 "다시 받아 설치하는" 방식입니다.
앱이 스스로 새 버전을 받게 하려면 업데이트 서명 키가 필요합니다. `docs/RELEASE.md` 의 "업데이트 서명 키 만들기"와 "Netlify에서 웹 게임과 PC 설치 파일 함께 제공하기"를 따르세요.
서명 키는 한 번 정하면 바꾸기 어려우니(잃어버리면 기존 설치본에 업데이트를 보낼 수 없음) 운영 방식을 정한 뒤 준비하는 것을 권합니다.

## 문제 해결
| 증상 | 확인할 것 |
|---|---|
| 워크플로가 "Netlify credentials absent"로 끝남 | 3단계의 `NETLIFY_AUTH_TOKEN`(Secret)과 `NETLIFY_SITE_ID`(Variable) 이름·위치. Variable 을 Secret 에 넣지 않았는지 |
| 업로드 단계에서 401/403 오류 | 토큰이 만료되었거나 지워짐 → 새 토큰으로 바꾸기 |
| 업로드 단계에서 404 오류 | Project ID 가 다른 사이트의 것 |
| `/guide/` 에 "PC 설치 파일을 준비하고 있습니다"라고 나옴 | Windows·Mac 빌드 단계가 실패했는지 Actions 기록 확인 |
| 안내 페이지 대신 게임 화면이 나옴 | 예전 버전의 서비스 워커가 남아 있는 경우. 게임을 한 번 열어 **Update now** 를 누르거나 브라우저를 새로고침 |
| push 할 때마다 설치 파일이 사라짐 | Netlify 에 Git 저장소가 연결되어 있음 → Netlify 의 **Project configuration → Build & deploy → Continuous deployment** 에서 저장소 연결을 끊기 |
