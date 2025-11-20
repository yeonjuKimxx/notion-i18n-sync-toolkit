# 🌍 Notion i18n Sync

Notion을 번역 관리 시스템으로 사용하여 다국어를 효율적으로 관리하는 CLI 도구입니다.

## ✨ 주요 기능

- 🔄 **양방향 동기화**: Notion ↔ 로컬 JSON 파일 간 자동 동기화
- 🌐 **13개 언어 지원**: EN, KO, JA, DE, FR, ES, ID, MS, TH, VI, ZH-TW, ZH-CN, MN
- 📁 **도메인 관리**: common, auth, business, tournament 등 도메인별 번역 관리
- 🗂️ **유연한 DB 구조**: 개별 DB 또는 통합 DB 선택 가능
- ✅ **자동 검증**: 키 일관성, 빈 값, 스키마 검증
- 🔁 **순서 보존**: Order 컬럼으로 번역 순서 유지
- 🛡️ **빈 값 처리**: 모든 언어 파일이 동일한 키 구조 유지

## 📦 설치

### GitHub에서 직접 설치

```bash
npm install github:yeonjuKimxx/notion-i18n-sync --save-dev
```

또는 package.json에 추가:

```json
{
  "devDependencies": {
    "@stepin/notion-i18n-sync": "github:yeonjuKimxx/notion-i18n-sync"
  }
}
```

## 🚀 빠른 시작

### 1. 초기화

```bash
npx notion-i18n init
```

다음 파일들이 생성됩니다:
- `notion-i18n.config.json` - 설정 파일
- `.env` - 환경 변수 (Notion API 키 등)
- `messages/` - 번역 파일 디렉토리

### 2. Notion 설정

1. [Notion Integrations](https://www.notion.so/my-integrations)에서 새 Integration 생성
2. API 키를 `.env` 파일에 추가:
   ```bash
   NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
3. Notion 데이터베이스 생성 및 Integration 연결
4. 데이터베이스 ID를 `.env`에 추가:
   ```bash
   NOTION_DB_UNIFIED=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### 3. Notion 데이터베이스 구조

다음 컬럼들을 추가하세요:

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `Key` | Title | 번역 키 (예: `auth.login.title`) |
| `Domain` | Select | 도메인 구분 (`auth`, `business`, `tournament`, `common`) |
| `Order` | Number | 정렬 순서 |
| `EN` | Rich Text | 영어 번역 |
| `KO` | Rich Text | 한국어 번역 |
| `JA` | Rich Text | 일본어 번역 |
| ... | ... | (나머지 언어들) |

### 4. 사용

```bash
# Notion에 업로드
npx notion-i18n upload --auth

# Notion에서 다운로드
npx notion-i18n download --auth

# 검증
npx notion-i18n validate

# 동기화 (download + validate)
npx notion-i18n sync

# 상태 확인
npx notion-i18n status
```

## 📖 명령어

### `init`

설정 파일 생성

```bash
notion-i18n init [options]

Options:
  -f, --force              기존 파일 덮어쓰기
  -o, --output <path>      설정 파일 출력 경로 (default: ./notion-i18n.config.json)
```

### `upload`

로컬 번역 파일을 Notion에 업로드

```bash
notion-i18n upload [options]

Options:
  --auth                   auth 도메인 업로드 (개별 DB)
  --business               business 도메인 업로드
  --tournament             tournament 도메인 업로드
  --common                 common 도메인 업로드
  --unified                통합 DB에 모든 도메인 업로드
  --all                    모든 DB에 모든 도메인 업로드
  -c, --config <path>      설정 파일 경로
```

**예시:**

```bash
# auth 도메인만 개별 DB에 업로드
notion-i18n upload --auth

# 여러 도메인을 개별 DB에 업로드
notion-i18n upload --auth --business

# 통합 DB에 모든 도메인 업로드
notion-i18n upload --unified

# 모든 DB (개별 + 통합)에 모든 도메인 업로드
notion-i18n upload --all
```

### `download`

Notion에서 로컬 번역 파일로 다운로드

```bash
notion-i18n download [options]

Options:
  --auth                   auth 도메인 다운로드 (개별 DB)
  --business               business 도메인 다운로드
  --tournament             tournament 도메인 다운로드
  --common                 common 도메인 다운로드
  --unified                통합 DB에서 모든 도메인 다운로드
  --all                    모든 DB에서 모든 도메인 다운로드
  -c, --config <path>      설정 파일 경로
```

### `validate`

번역 파일 검증

```bash
notion-i18n validate [options]

Options:
  -c, --config <path>      설정 파일 경로
```

검증 항목:
- 모든 언어 파일이 동일한 키를 가지는지
- 빈 값이 있는지
- 파일 구조가 올바른지

### `clear`

Notion 데이터베이스의 모든 데이터 삭제

```bash
notion-i18n clear [options]

Options:
  --auth                   auth DB 클리어
  --unified                통합 DB 클리어
  --all                    모든 DB 클리어
  --yes                    확인 프롬프트 없이 즉시 삭제
  -c, --config <path>      설정 파일 경로
```

### `sync`

Notion에서 다운로드 후 검증

```bash
notion-i18n sync [options]

Options:
  --all                    모든 도메인 동기화
  -c, --config <path>      설정 파일 경로
```

### `status`

번역 현황 통계

```bash
notion-i18n status [options]

Options:
  -c, --config <path>      설정 파일 경로
```

### `check-db`

Basic DB를 기준으로 도메인 DB 구조 검증

```bash
notion-i18n check-db [options]

Options:
  --auth                   auth DB 검증
  --business               business DB 검증
  --tournament             tournament DB 검증
  --common                 common DB 검증
  --all                    모든 도메인 DB 검증
  -c, --config <path>      설정 파일 경로
```

**사용 시나리오:**
1. Basic DB에 완벽한 컬럼 구조를 먼저 만듭니다 (Key, Domain, Order, EN, KO, ...)
2. 새로운 도메인 DB를 만들 때, Basic DB를 복제하거나 수동으로 컬럼을 추가합니다
3. `check-db` 명령어로 도메인 DB가 Basic DB와 동일한 구조인지 검증합니다

**예시 출력:**
```
✅ auth: All columns match Basic DB!
❌ common: Schema mismatch detected
  Missing Columns:
    - 생성자 (created_by)
    - 생성 일시 (created_time)
```

## ⚙️ 설정 파일 (notion-i18n.config.json)

```json
{
  "projectName": "my-project",
  "notionApiKey": "${NOTION_API_KEY}",
  "basicDatabase": "${NOTION_DB_BASIC}",
  "unifiedDatabase": "${NOTION_DB_UNIFIED}",
  "databases": {
    "auth": "${NOTION_DB_AUTH}",
    "business": "${NOTION_DB_BUSINESS}"
  },
  "messagesDir": "./messages",
  "baseLocale": "en",
  "languages": [
    { "code": "en", "column": "EN", "name": "English" },
    { "code": "ko", "column": "KO", "name": "Korean" }
  ],
  "domains": ["auth", "business"],
  "columns": {
    "key": "Key",
    "domain": "Domain",
    "order": "Order"
  },
  "options": {
    "batchSize": 5,
    "retryAttempts": 5,
    "preserveEmptyValues": true
  }
}
```

### 설정 옵션

| 옵션 | 타입 | 설명 |
|------|------|------|
| `projectName` | string | 프로젝트 이름 |
| `notionApiKey` | string | Notion API 키 (환경 변수 사용 권장) |
| `basicDatabase` | string | Basic DB ID (check-db 명령어용 표준 템플릿) |
| `unifiedDatabase` | string | 통합 DB ID (선택사항) |
| `databases` | object | 도메인별 DB ID (선택사항) |
| `messagesDir` | string | 번역 파일 디렉토리 경로 |
| `baseLocale` | string | 기준 언어 코드 |
| `languages` | array | 지원 언어 목록 |
| `domains` | array | 도메인 목록 |
| `columns` | object | Notion 컬럼 매핑 |
| `options.batchSize` | number | 배치 처리 크기 (기본: 5) |
| `options.retryAttempts` | number | 재시도 횟수 (기본: 5) |
| `options.preserveEmptyValues` | boolean | 빈 값 유지 여부 (기본: true) |

## 🏗️ 프로젝트 구조

```
my-project/
├── messages/                    # 번역 파일
│   ├── auth/
│   │   ├── en.json
│   │   ├── ko.json
│   │   └── ...
│   ├── business/
│   └── tournament/
├── notion-i18n.config.json      # 설정 파일
└── .env                         # 환경 변수
```

## 🔧 개발

### 기여하기

```bash
# 레포지토리 클론
git clone https://github.com/yeonjuKimxx/notion-i18n-sync.git
cd notion-i18n-sync

# 의존성 설치
npm install

# 로컬에서 테스트
npm link
notion-i18n --help
```

### 구조

```
notion-i18n-sync/
├── bin/
│   └── cli.js              # CLI 진입점
├── src/
│   ├── commands/           # 명령어 구현
│   │   ├── init.js
│   │   ├── upload.js
│   │   ├── download.js
│   │   ├── validate.js
│   │   ├── clear.js
│   │   └── status.js
│   ├── core/               # 핵심 로직
│   │   ├── uploader.js
│   │   ├── downloader.js
│   │   └── validator.js
│   └── utils/              # 유틸리티
│       ├── config-loader.js
│       ├── flatten.js
│       └── retry.js
├── templates/              # 템플릿 파일
│   ├── notion-i18n.config.json
│   └── .env.example
└── README.md
```

## 📝 워크플로우

### 번역 추가 워크플로우

#### 방법 1: 로컬 우선
1. 로컬 JSON 파일 수정 (`messages/{domain}/{lang}.json`)
2. Notion에 업로드: `notion-i18n upload --auth`
3. 검증: `notion-i18n validate`

#### 방법 2: Notion 우선
1. Notion 데이터베이스에서 직접 수정
2. 로컬로 다운로드: `notion-i18n download --auth`
3. 검증: `notion-i18n validate`

## 🐛 트러블슈팅

### "Config file not found"
```bash
# init 명령어 실행
notion-i18n init
```

### "NOTION_API_KEY is required"
`.env` 파일에 API 키를 추가하세요:
```bash
NOTION_API_KEY=secret_xxxxxxxxxxxxx
```

### "conflict_error" 발생 시
자동 재시도 로직이 있으므로 대기하세요. 지속되면 `batchSize`를 줄이세요.

## 📄 라이선스

MIT License

## 🙏 Credits

Made with ❤️ by StepIn Team

---

## 🔗 관련 링크

- [Notion API Documentation](https://developers.notion.com/)
- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [GitHub Repository](https://github.com/yeonjuKimxx/notion-i18n-sync)
