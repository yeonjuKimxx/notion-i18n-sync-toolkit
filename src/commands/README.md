# Commands Implementation Guide

이 디렉토리의 명령어들은 아직 구현이 완료되지 않았습니다.

## 구현 필요 파일

다음 파일들을 기존 `stepin-website-tournament/scripts/translation/` 코드를 참조하여 구현하세요:

### 1. upload.js
기존: `scripts/translation/upload.ts`
- Notion 업로드 로직
- 배치 처리
- retry 로직

### 2. download.js
기존: `scripts/translation/download.ts`
- Notion 다운로드 로직
- 빈 값 처리
- JSON 파일 생성

### 3. validate.js
기존: `scripts/translation/validate.ts`
- 번역 파일 검증
- 키 일관성 체크
- 빈 값 감지

### 4. clear.js
기존: `scripts/translation/clear.ts`
- Notion DB 클리어

### 5. status.js
새로 구현:
- 번역 통계
- 도메인별 번역 개수
- 언어별 번역 완성도

## 구현 시 주의사항

1. **ESM 형식** 사용 (`import/export`)
2. **config-loader** 사용하여 설정 로드
3. **chalk** 사용하여 컬러 출력
4. **에러 핸들링** 철저히
5. **progressbar** 표시

## 예시 구조

```javascript
import { loadConfig } from '../utils/config-loader.js'
import chalk from 'chalk'

export async function uploadCommand(options) {
  try {
    const config = loadConfig(options.config)

    // 업로드 로직
    console.log(chalk.green('✅ Upload complete!'))
  } catch (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }
}
```

## 다음 단계

1. 기존 TypeScript 코드를 JavaScript로 변환
2. config-loader 통합
3. CLI 옵션 처리
4. 테스트
