/**
 * status 명령어: 번역 현황 통계
 */
import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import chalk from 'chalk'
import { loadConfig } from '../utils/config-loader.js'
import { flatten } from '../utils/flatten.js'

export async function statusCommand(options) {
	const config = loadConfig(options.config)

	console.log(chalk.green('📊 Translation Status\n'))

	const stats = []

	for (const domain of config.domains) {
		const dirPath = resolve(process.cwd(), config.messagesDir, domain)

		const domainStats = {
			domain,
			total: 0,
			languages: {},
		}

		// 기준 언어 키 개수
		const basePath = join(dirPath, `${config.baseLocale}.json`)
		if (!existsSync(basePath)) {
			console.log(chalk.yellow(`⚠️  ${domain}: Base locale file not found`))
			continue
		}

		const baseContent = JSON.parse(readFileSync(basePath, 'utf-8'))
		const baseFlat = flatten(baseContent)
		const baseKeys = Object.keys(baseFlat)
		domainStats.total = baseKeys.length

		// 각 언어별 통계
		let translatedLanguages = 0 // 100% 번역된 언어 개수
		let baseOnlyLanguages = 0 // base 언어만 번역된 경우

		for (const lang of config.languages) {
			const langPath = join(dirPath, `${lang.code}.json`)

			if (!existsSync(langPath)) {
				domainStats.languages[lang.code] = {
					total: 0,
					translated: 0,
					empty: domainStats.total,
					percentage: 0,
				}
				continue
			}

			const langContent = JSON.parse(readFileSync(langPath, 'utf-8'))
			const langFlat = flatten(langContent)

			// 번역된 키 개수 (빈 값 제외)
			const translated = Object.values(langFlat).filter(
				(value) => value !== '' && value !== null && value !== undefined
			).length

			const empty = domainStats.total - translated
			const percentage = domainStats.total > 0 ? (translated / domainStats.total) * 100 : 0

			domainStats.languages[lang.code] = {
				total: Object.keys(langFlat).length,
				translated,
				empty,
				percentage: Math.round(percentage),
			}

			// 100% 번역된 언어 카운트
			if (percentage === 100) {
				translatedLanguages++
			}
		}

		// 상태 결정:
		// - 시작 전: base 언어만 번역되어 있음 (다른 언어들이 대부분 0%~10% 미만)
		// - 완료: 모든 언어 100%
		// - 진행 중: 그 외
		const totalLanguages = config.languages.length

		// base 언어 외에 50% 이상 번역된 언어 개수 확인
		let substantiallyTranslatedLangs = 0
		for (const lang of config.languages) {
			if (lang.code === config.baseLocale) continue // base 제외
			const langStat = domainStats.languages[lang.code]
			if (langStat && langStat.percentage >= 50) {
				substantiallyTranslatedLangs++
			}
		}

		let status = 'in_progress'
		let statusIcon = '🔄'
		let statusText = '진행 중'
		let statusColor = chalk.yellow

		if (translatedLanguages === totalLanguages) {
			status = 'completed'
			statusIcon = '✅'
			statusText = '완료'
			statusColor = chalk.green
		} else if (substantiallyTranslatedLangs === 0) {
			// base 언어 외에 50% 이상 번역된 언어가 없으면 시작 전
			status = 'not_started'
			statusIcon = '⏸️'
			statusText = '시작 전'
			statusColor = chalk.gray
		}

		domainStats.status = status
		domainStats.statusIcon = statusIcon
		domainStats.statusText = statusText
		domainStats.statusColor = statusColor

		stats.push(domainStats)
	}

	// 테이블 출력
	console.log(chalk.cyan('┌─────────────┬───────┬──────────────┐'))
	console.log(chalk.cyan('│ Domain      │ Keys  │ Status       │'))
	console.log(chalk.cyan('├─────────────┼───────┼──────────────┤'))

	for (const stat of stats) {
		const domainPadded = stat.domain.padEnd(11)
		const totalPadded = String(stat.total).padEnd(5)
		const statusDisplay = `${stat.statusIcon} ${stat.statusText}`.padEnd(12)

		console.log(`│ ${domainPadded} │ ${totalPadded} │ ${stat.statusColor(statusDisplay)} │`)
	}

	console.log(chalk.cyan('└─────────────┴───────┴──────────────┘'))

	// 도메인별 상세 통계
	console.log(chalk.cyan('\n📝 Domain Details:\n'))

	for (const stat of stats) {
		console.log(stat.statusColor(`${stat.statusIcon} ${stat.domain}: ${stat.statusText}`))
		console.log(chalk.gray(`   Total Keys: ${stat.total}`))

		// 번역된 언어 개수
		const translatedLangs = Object.values(stat.languages).filter((l) => l.percentage === 100)
			.length
		const inProgressLangs = Object.values(stat.languages).filter(
			(l) => l.percentage > 0 && l.percentage < 100
		).length
		const notStartedLangs = Object.values(stat.languages).filter((l) => l.percentage === 0)
			.length

		console.log(
			chalk.green(`   ✅ Completed: ${translatedLangs}/${config.languages.length} languages`)
		)
		console.log(chalk.yellow(`   🔄 In Progress: ${inProgressLangs} languages`))
		console.log(chalk.gray(`   ⏸️  Not Started: ${notStartedLangs} languages`))

		// 가장 낮은 완성도 언어 표시 (0% 제외)
		const inProgress = Object.entries(stat.languages)
			.filter(([_, l]) => l.percentage > 0 && l.percentage < 100)
			.sort((a, b) => a[1].percentage - b[1].percentage)

		if (inProgress.length > 0) {
			console.log(chalk.yellow(`\n   Progress Details:`))
			for (const [code, langStat] of inProgress) {
				const bar = createProgressBar(langStat.percentage)
				console.log(
					`     ${code.padEnd(6)} ${bar} ${langStat.percentage}% (${langStat.translated}/${stat.total})`
				)
			}
		}

		console.log('')
	}

	// 전체 요약
	const completedDomains = stats.filter((s) => s.status === 'completed').length
	const inProgressDomains = stats.filter((s) => s.status === 'in_progress').length
	const notStartedDomains = stats.filter((s) => s.status === 'not_started').length

	console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
	console.log(chalk.cyan('📊 Overall Summary:\n'))
	console.log(chalk.green(`   ✅ Completed:    ${completedDomains}/${stats.length} domains`))
	console.log(chalk.yellow(`   🔄 In Progress:  ${inProgressDomains}/${stats.length} domains`))
	console.log(chalk.gray(`   ⏸️  Not Started:  ${notStartedDomains}/${stats.length} domains`))
	console.log('')
}

function createProgressBar(percentage) {
	const total = 20
	const filled = Math.round((percentage / 100) * total)
	const empty = total - filled

	const bar = '█'.repeat(filled) + '░'.repeat(empty)
	return bar
}
