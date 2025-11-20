# Contributing to Notion i18n Sync

먼저 이 프로젝트에 기여해주셔서 감사합니다! 🎉

## 개발 환경 설정

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

## 구조

```
notion-i18n-sync/
├── bin/cli.js              # CLI 진입점
├── src/
│   ├── commands/           # 각 명령어 구현
│   ├── core/               # 핵심 로직 (uploader, downloader 등)
│   └── utils/              # 유틸리티 함수
├── templates/              # 설정 파일 템플릿
└── README.md
```

## 명령어 추가하기

1. `src/commands/` 에 새 파일 생성
2. `bin/cli.js` 에 명령어 등록
3. README.md 업데이트

## 코딩 스타일

- ESM (ES Modules) 사용
- Tab 대신 스페이스 사용
- 명확한 변수명과 함수명
- JSDoc 주석 추가

## Pull Request

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 이슈 보고

버그를 발견하거나 기능 요청이 있으면 [GitHub Issues](https://github.com/yeonjuKimxx/notion-i18n-sync/issues)에 등록해주세요.

## 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 참조
