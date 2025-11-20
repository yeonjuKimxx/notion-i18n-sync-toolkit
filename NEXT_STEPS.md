# 🎯 Next Steps

notion-i18n-sync 패키지의 기본 구조가 완성되었습니다!

## ✅ 완료된 항목

- [x] 패키지 구조 생성
- [x] package.json 설정
- [x] CLI 진입점 (bin/cli.js)
- [x] 템플릿 파일 (config, .env.example)
- [x] 유틸리티 함수 (flatten, retry, config-loader)
- [x] init 명령어 완성
- [x] README.md 작성
- [x] LICENSE, .gitignore, CONTRIBUTING.md

## 📝 TODO: 명령어 구현

다음 명령어들을 `stepin-website-tournament/scripts/translation/` 코드를 참조하여 구현하세요:

### 1. upload.js

**참조:** `stepin-website-tournament/scripts/translation/upload.ts`

**필요한 작업:**
1. TypeScript → JavaScript 변환
2. `loadConfig()` 통합
3. CLI 옵션 파싱 (`--auth`, `--unified`, `--all`)
4. DB 타입 결정 로직
5. chalk로 컬러 출력

**핵심 로직:**
- `getDatabaseId(domain, dbType)` - DB ID 가져오기
- `fetchExistingData(databaseId, domain, dbType)` - 기존 데이터 조회
- `prepareUploadTasks(domain)` - 업로드 데이터 준비
- `createPage(databaseId, domain, task)` - 페이지 생성
- `updatePage(pageId, domain, task)` - 페이지 업데이트

### 2. download.js

**참조:** `stepin-website-tournament/scripts/translation/download.ts`

**핵심 로직:**
- Domain 필터 쿼리
- 언어별 그룹화
- **빈 값도 `""` 로 저장** (중요!)
- JSON 파일 생성

### 3. validate.js

**참조:** `stepin-website-tournament/scripts/translation/validate.ts`

**핵심 로직:**
- 모든 도메인/언어 파일 존재 확인
- 키 일관성 체크
- 빈 값 검출

### 4. clear.js

**참조:** `stepin-website-tournament/scripts/translation/clear.ts`

**핵심 로직:**
- 확인 프롬프트 (--yes 옵션 없으면)
- 모든 페이지 조회
- 배치 삭제

### 5. status.js

**새로 구현:**
- 도메인별 번역 개수
- 언어별 번역 완성도
- 빈 값 통계
- 테이블 형식 출력

## 🚀 GitHub에 배포

### 1. Git 초기화

```bash
cd /Users/kim-yeonju/Github/notion-i18n-sync
git init
git add .
git commit -m "Initial commit: notion-i18n-sync package structure"
```

### 2. GitHub 레포지토리 생성

1. https://github.com/new 에서 새 레포지토리 생성
2. 레포지토리 이름: `notion-i18n-sync`
3. Public 또는 Private 선택

### 3. Remote 연결 및 Push

```bash
git remote add origin https://github.com/yeonjuKimxx/notion-i18n-sync.git
git branch -M main
git push -u origin main
```

## 📦 stepin-website-tournament에서 사용하기

### 1. package.json 수정

```json
{
  "devDependencies": {
    "@stepin/notion-i18n-sync": "github:yeonjuKimxx/notion-i18n-sync"
  },
  "scripts": {
    "notion:init": "notion-i18n init",
    "notion:upload": "notion-i18n upload",
    "notion:download": "notion-i18n download",
    "notion:validate": "notion-i18n validate",
    "notion:sync": "notion-i18n sync"
  }
}
```

### 2. 설치

```bash
cd /Users/kim-yeonju/Github/stepin-website-tournament
npm install
```

### 3. 초기화

```bash
npm run notion:init
```

### 4. 기존 설정 마이그레이션

`notion-i18n.config.json` 파일을 수정:
- 기존 `.env`의 값들을 그대로 사용
- `messagesDir`을 `./messages`로 설정
- `domains`, `languages` 설정 확인

### 5. 사용

```bash
npm run notion:upload -- --auth
npm run notion:download -- --unified
npm run notion:validate
```

## 🔧 개발 팁

### 로컬에서 테스트

```bash
cd /Users/kim-yeonju/Github/notion-i18n-sync
npm link

# 다른 프로젝트에서
cd /Users/kim-yeonju/Github/stepin-website-tournament
npm link @stepin/notion-i18n-sync

# 이제 notion-i18n 명령어 사용 가능
notion-i18n --help
```

### 변경사항 반영

`notion-i18n-sync` 패키지를 수정한 후:
- Git commit & push
- `stepin-website-tournament`에서 `npm update @stepin/notion-i18n-sync`

## 📚 참고 자료

- **기존 코드:** `/Users/kim-yeonju/Github/stepin-website-tournament/scripts/translation/`
- **문서:** `/Users/kim-yeonju/Github/stepin-website-tournament/docs/translation-system.md`
- **asset-codegen 참조:** `/Users/kim-yeonju/Github/stepin-website-tournament/node_modules/@stepin/asset-codegen/`

## 🎉 완성 체크리스트

- [ ] upload.js 구현
- [ ] download.js 구현
- [ ] validate.js 구현
- [ ] clear.js 구현
- [ ] status.js 구현
- [ ] GitHub 레포지토리 생성
- [ ] Git push
- [ ] stepin-website-tournament에서 테스트
- [ ] 문서 업데이트
- [ ] npm publish (선택사항)

Good luck! 🚀
