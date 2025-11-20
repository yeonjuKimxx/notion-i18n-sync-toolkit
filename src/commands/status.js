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
			completion: {},
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
		}

		stats.push(domainStats)
	}

	// 테이블 출력
	console.log(chalk.cyan('┌─────────────┬───────┬─────────────────────────────────────────┐'))
	console.log(chalk.cyan('│ Domain      │ Total │ Completion (%)                          │'))
	console.log(chalk.cyan('├─────────────┼───────┼─────────────────────────────────────────┤'))

	for (const stat of stats) {
		const domainPadded = stat.domain.padEnd(11)
		const totalPadded = String(stat.total).padEnd(5)

		// 평균 완성도 계산
		const percentages = Object.values(stat.languages).map((l) => l.percentage)
		const avgPercentage =
			percentages.length > 0
				? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
				: 0

		const bar = createProgressBar(avgPercentage)

		console.log(`│ ${domainPadded} │ ${totalPadded} │ ${bar} │`)
	}

	console.log(chalk.cyan('└─────────────┴───────┴─────────────────────────────────────────┘'))

	// 언어별 상세 통계
	console.log(chalk.cyan('\n📝 Language Details:\n'))

	for (const stat of stats) {
		console.log(chalk.yellow(`${stat.domain}:`))

		for (const lang of config.languages) {
			const langStat = stat.languages[lang.code]
			if (!langStat) continue

			const percentage = langStat.percentage
			const color =
				percentage === 100 ? chalk.green : percentage >= 80 ? chalk.blue : chalk.yellow

			const progressBar = createProgressBar(percentage)
			const statusIcon = percentage === 100 ? '✅' : percentage >= 80 ? '🟢' : '🟡'

			console.log(
				`  ${statusIcon} ${lang.code.padEnd(6)} ${progressBar} ${color(
					String(percentage).padStart(3)
				)}% (${langStat.translated}/${stat.total})`
			)
		}
		console.log('')
	}

	// 전체 요약
	const totalKeys = stats.reduce((sum, s) => sum + s.total, 0)
	const totalLanguages = config.languages.length
	const totalTranslations = totalKeys * totalLanguages

	let translatedCount = 0
	for (const stat of stats) {
		for (const langStat of Object.values(stat.languages)) {
			translatedCount += langStat.translated
		}
	}

	const overallPercentage =
		totalTranslations > 0 ? Math.round((translatedCount / totalTranslations) * 100) : 0

	console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
	console.log(chalk.cyan('📊 Overall Summary:\n'))
	console.log(chalk.cyan(`   Total Keys:          ${totalKeys}`))
	console.log(chalk.cyan(`   Languages:           ${totalLanguages}`))
	console.log(chalk.cyan(`   Total Translations:  ${totalTranslations}`))
	console.log(chalk.green(`   Translated:          ${translatedCount}`))
	console.log(chalk.yellow(`   Missing:             ${totalTranslations - translatedCount}`))
	console.log(chalk.blue(`   Completion:          ${overallPercentage}%`))
	console.log('')
}

function createProgressBar(percentage) {
	const total = 30
	const filled = Math.round((percentage / 100) * total)
	const empty = total - filled

	const bar = '█'.repeat(filled) + '░'.repeat(empty)
	return bar
}
