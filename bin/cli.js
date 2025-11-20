#!/usr/bin/env node

/**
 * 🌍 Notion i18n Sync CLI
 *
 * Notion 기반 다국어 번역 관리 및 동기화 도구
 */

import { Command } from 'commander'
import chalk from 'chalk'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ES modules에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 패키지 정보 로드
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'))

const program = new Command()

// CLI 설정
program
	.name('notion-i18n')
	.description('Notion 기반 다국어 번역 관리 및 동기화 도구')
	.version(packageJson.version)
	.addHelpText(
		'before',
		chalk.blue.bold(`
🌍 Notion i18n Sync v${packageJson.version}
Notion을 번역 관리 시스템으로 사용하여 다국어를 효율적으로 관리하세요
`)
	)

// init 명령어
program
	.command('init')
	.description('새 프로젝트 초기화 (설정 파일 생성)')
	.option('-f, --force', '기존 파일 덮어쓰기')
	.option('-o, --output <path>', '설정 파일 출력 경로', './notion-i18n.config.json')
	.action(async (options) => {
		console.log(chalk.green('🚀 Notion i18n Sync 초기화...'))
		try {
			const { initCommand } = await import('../src/commands/init.js')
			await initCommand(options)
		} catch (error) {
			console.error(chalk.red('❌ 초기화 실패:'), error.message)
			process.exit(1)
		}
	})

// upload 명령어
program
	.command('upload')
	.description('로컬 번역 파일을 Notion 데이터베이스에 업로드')
	.option('--auth', 'auth 도메인 업로드 (개별 DB)')
	.option('--business', 'business 도메인 업로드 (개별 DB)')
	.option('--tournament', 'tournament 도메인 업로드 (개별 DB)')
	.option('--common', 'common 도메인 업로드 (개별 DB)')
	.option('--unified', '통합 DB에 모든 도메인 업로드')
	.option('--all', '모든 DB (개별 + 통합)에 모든 도메인 업로드')
	.option('-c, --config <path>', '설정 파일 경로', './notion-i18n.config.json')
	.action(async (options) => {
		console.log(chalk.green('📤 Notion에 업로드 중...'))
		try {
			const { uploadCommand } = await import('../src/commands/upload.js')
			await uploadCommand(options)
		} catch (error) {
			console.error(chalk.red('❌ 업로드 실패:'), error.message)
			process.exit(1)
		}
	})

// download 명령어
program
	.command('download')
	.description('Notion 데이터베이스에서 로컬 번역 파일로 다운로드')
	.option('--auth', 'auth 도메인 다운로드 (개별 DB)')
	.option('--business', 'business 도메인 다운로드 (개별 DB)')
	.option('--tournament', 'tournament 도메인 다운로드 (개별 DB)')
	.option('--common', 'common 도메인 다운로드 (개별 DB)')
	.option('--unified', '통합 DB에서 모든 도메인 다운로드')
	.option('--all', '모든 DB에서 모든 도메인 다운로드')
	.option('-c, --config <path>', '설정 파일 경로', './notion-i18n.config.json')
	.action(async (options) => {
		console.log(chalk.green('📥 Notion에서 다운로드 중...'))
		try {
			const { downloadCommand } = await import('../src/commands/download.js')
			await downloadCommand(options)
		} catch (error) {
			console.error(chalk.red('❌ 다운로드 실패:'), error.message)
			process.exit(1)
		}
	})

// validate 명령어
program
	.command('validate')
	.description('번역 파일 검증 (키 일관성, 빈 값 체크)')
	.option('-c, --config <path>', '설정 파일 경로', './notion-i18n.config.json')
	.action(async (options) => {
		console.log(chalk.green('🔍 번역 파일 검증 중...'))
		try {
			const { validateCommand } = await import('../src/commands/validate.js')
			await validateCommand(options)
		} catch (error) {
			console.error(chalk.red('❌ 검증 실패:'), error.message)
			process.exit(1)
		}
	})

// clear 명령어
program
	.command('clear')
	.description('Notion 데이터베이스의 모든 데이터 삭제')
	.option('--auth', 'auth DB 클리어')
	.option('--business', 'business DB 클리어')
	.option('--tournament', 'tournament DB 클리어')
	.option('--common', 'common DB 클리어')
	.option('--unified', '통합 DB 클리어')
	.option('--all', '모든 DB 클리어')
	.option('-c, --config <path>', '설정 파일 경로', './notion-i18n.config.json')
	.option('--yes', '확인 프롬프트 없이 즉시 삭제')
	.action(async (options) => {
		console.log(chalk.yellow('⚠️  Notion 데이터베이스 클리어...'))
		try {
			const { clearCommand } = await import('../src/commands/clear.js')
			await clearCommand(options)
		} catch (error) {
			console.error(chalk.red('❌ 클리어 실패:'), error.message)
			process.exit(1)
		}
	})

// sync 명령어 (download + validate)
program
	.command('sync')
	.description('Notion에서 다운로드 후 검증 (download + validate)')
	.option('--all', '모든 도메인 동기화')
	.option('-c, --config <path>', '설정 파일 경로', './notion-i18n.config.json')
	.action(async (options) => {
		console.log(chalk.green('🔄 동기화 중...'))
		try {
			const { downloadCommand } = await import('../src/commands/download.js')
			const { validateCommand } = await import('../src/commands/validate.js')

			await downloadCommand({ ...options, all: true })
			await validateCommand(options)

			console.log(chalk.green('✅ 동기화 완료!'))
		} catch (error) {
			console.error(chalk.red('❌ 동기화 실패:'), error.message)
			process.exit(1)
		}
	})

// status 명령어 (통계 보기)
program
	.command('status')
	.description('번역 현황 통계 보기')
	.option('-c, --config <path>', '설정 파일 경로', './notion-i18n.config.json')
	.action(async (options) => {
		console.log(chalk.green('📊 번역 현황 확인 중...'))
		try {
			const { statusCommand } = await import('../src/commands/status.js')
			await statusCommand(options)
		} catch (error) {
			console.error(chalk.red('❌ 상태 확인 실패:'), error.message)
			process.exit(1)
		}
	})

// 에러 핸들링
program.exitOverride()

try {
	await program.parseAsync(process.argv)
} catch (err) {
	if (err.code !== 'commander.help' && err.code !== 'commander.version') {
		console.error(chalk.red('❌ 오류 발생:'), err.message)
		process.exit(1)
	}
}
