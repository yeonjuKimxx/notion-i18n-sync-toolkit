/**
 * validate 명령어: 번역 파일 검증
 */
import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import chalk from 'chalk'
import { loadConfig } from '../utils/config-loader.js'
import { flatten } from '../utils/flatten.js'

export async function validateCommand(options) {
	const config = loadConfig(options.config)

	console.log(chalk.green('🔍 Validating translation files...\n'))

	let hasErrors = false
	const issues = []

	for (const domain of config.domains) {
		console.log(chalk.cyan(`\n📁 Validating ${domain}...`))

		const dirPath = resolve(process.cwd(), config.messagesDir, domain)

		// 1. 모든 언어 파일 존재 확인
		const missingFiles = []
		const existingFiles = {}

		for (const lang of config.languages) {
			const filePath = join(dirPath, `${lang.code}.json`)

			if (!existsSync(filePath)) {
				missingFiles.push(lang.code)
			} else {
				try {
					const content = readFileSync(filePath, 'utf-8')
					existingFiles[lang.code] = JSON.parse(content)
				} catch (error) {
					issues.push({
						domain,
						type: 'parse_error',
						lang: lang.code,
						message: `Failed to parse JSON: ${error.message}`,
					})
					hasErrors = true
				}
			}
		}

		if (missingFiles.length > 0) {
			console.log(chalk.red(`  ❌ Missing language files: ${missingFiles.join(', ')}`))
			issues.push({
				domain,
				type: 'missing_files',
				files: missingFiles,
			})
			hasErrors = true
		} else {
			console.log(chalk.green(`  ✅ All language files exist`))
		}

		// 2. 키 일관성 체크
		const flatFiles = {}
		for (const [lang, content] of Object.entries(existingFiles)) {
			flatFiles[lang] = flatten(content)
		}

		const baseLang = config.baseLocale
		if (!flatFiles[baseLang]) {
			console.log(chalk.red(`  ❌ Base locale file (${baseLang}) not found`))
			hasErrors = true
			continue
		}

		const baseKeys = new Set(Object.keys(flatFiles[baseLang]))

		for (const lang of Object.keys(flatFiles)) {
			if (lang === baseLang) continue

			const langKeys = new Set(Object.keys(flatFiles[lang]))

			// 기준 언어에는 있지만 현재 언어에는 없는 키
			const missingKeys = [...baseKeys].filter((key) => !langKeys.has(key))

			// 현재 언어에는 있지만 기준 언어에는 없는 키
			const extraKeys = [...langKeys].filter((key) => !baseKeys.has(key))

			if (missingKeys.length > 0) {
				console.log(chalk.yellow(`  ⚠️  ${lang}: Missing ${missingKeys.length} keys`))
				issues.push({
					domain,
					type: 'missing_keys',
					lang,
					keys: missingKeys,
				})
				hasErrors = true
			}

			if (extraKeys.length > 0) {
				console.log(chalk.yellow(`  ⚠️  ${lang}: ${extraKeys.length} extra keys`))
				issues.push({
					domain,
					type: 'extra_keys',
					lang,
					keys: extraKeys,
				})
				hasErrors = true
			}

			if (missingKeys.length === 0 && extraKeys.length === 0) {
				console.log(chalk.green(`  ✅ ${lang}: All keys match`))
			}
		}

		// 3. 빈 값 체크
		const emptyValues = {}

		for (const [lang, flatContent] of Object.entries(flatFiles)) {
			const empty = Object.entries(flatContent)
				.filter(([_, value]) => value === '' || value === null || value === undefined)
				.map(([key]) => key)

			if (empty.length > 0) {
				emptyValues[lang] = empty
			}
		}

		if (Object.keys(emptyValues).length > 0) {
			console.log(chalk.yellow(`  ⚠️  Empty values detected:`))
			for (const [lang, keys] of Object.entries(emptyValues)) {
				console.log(chalk.gray(`     ${lang}: ${keys.length} empty values`))
			}
			issues.push({
				domain,
				type: 'empty_values',
				values: emptyValues,
			})
		} else {
			console.log(chalk.green(`  ✅ No empty values`))
		}
	}

	// 최종 결과
	console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
	console.log(chalk.cyan('📊 Validation Summary:\n'))

	if (hasErrors) {
		console.log(chalk.red(`   ❌ Validation failed with ${issues.length} issues\n`))

		// 이슈 타입별로 그룹화
		const byType = {}
		for (const issue of issues) {
			if (!byType[issue.type]) {
				byType[issue.type] = []
			}
			byType[issue.type].push(issue)
		}

		if (byType.missing_files) {
			console.log(chalk.red('   Missing Files:'))
			byType.missing_files.forEach((issue) => {
				console.log(chalk.red(`     - ${issue.domain}: ${issue.files.join(', ')}`))
			})
		}

		if (byType.missing_keys) {
			console.log(chalk.yellow('\n   Missing Keys:'))
			byType.missing_keys.forEach((issue) => {
				console.log(chalk.yellow(`     - ${issue.domain}/${issue.lang}: ${issue.keys.length} keys`))
			})
		}

		if (byType.extra_keys) {
			console.log(chalk.yellow('\n   Extra Keys:'))
			byType.extra_keys.forEach((issue) => {
				console.log(chalk.yellow(`     - ${issue.domain}/${issue.lang}: ${issue.keys.length} keys`))
			})
		}

		if (byType.empty_values) {
			console.log(chalk.yellow('\n   Empty Values:'))
			byType.empty_values.forEach((issue) => {
				const totalEmpty = Object.values(issue.values).reduce(
					(sum, keys) => sum + keys.length,
					0
				)
				console.log(chalk.yellow(`     - ${issue.domain}: ${totalEmpty} empty values`))
			})
		}

		console.log('')
		process.exit(1)
	} else {
		console.log(chalk.green('   ✅ All validation checks passed!'))
		console.log('')
	}
}
