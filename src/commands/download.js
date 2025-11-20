/**
 * download 명령어: Notion에서 로컬 번역 파일로 다운로드
 */
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import chalk from 'chalk'
import { loadConfig } from '../utils/config-loader.js'
import { unflatten } from '../utils/flatten.js'

export async function downloadCommand(options) {
	const config = loadConfig(options.config)

	console.log(chalk.green('📥 Downloading translations from Notion...\n'))

	// CLI 옵션 파싱
	const selectedDomains = []
	let useIndividualDBs = false
	let useUnifiedDB = false

	if (options.all) {
		selectedDomains.push(...config.domains)
		useIndividualDBs = true
		useUnifiedDB = true
		console.log(chalk.blue('📦 Downloading all domains from both individual & unified DBs\n'))
	} else if (options.unified) {
		selectedDomains.push(...config.domains)
		useUnifiedDB = true
		console.log(chalk.blue('📦 Downloading all domains from unified DB only\n'))
	} else {
		// 개별 도메인 옵션 확인
		for (const domain of config.domains) {
			if (options[domain]) {
				selectedDomains.push(domain)
			}
		}

		if (selectedDomains.length === 0) {
			console.log(chalk.yellow('Usage:'))
			console.log(
				'  notion-i18n download --all              # Download all domains from both individual & unified DBs'
			)
			console.log(
				'  notion-i18n download --unified          # Download all domains from unified DB only'
			)
			console.log('  notion-i18n download --auth             # Download auth from individual DB only')
			console.log(
				'  notion-i18n download --common --auth    # Download common and auth from individual DBs'
			)
			console.log(chalk.cyan('\nAvailable domains:'), config.domains.join(', '))
			return
		}

		useIndividualDBs = true
		console.log(chalk.blue('📦 Downloading from individual DBs:'), selectedDomains.join(', '), '\n')
	}

	let totalCount = 0
	let totalFiles = 0

	// DB 타입별로 처리
	const dbTypesToProcess = []
	if (useIndividualDBs) dbTypesToProcess.push('individual')
	if (useUnifiedDB) dbTypesToProcess.push('unified')

	for (const dbType of dbTypesToProcess) {
		const dbLabel = dbType === 'unified' ? 'Unified DB' : 'Individual DBs'
		console.log(chalk.cyan(`\n${'='.repeat(60)}`))
		console.log(chalk.cyan(`📊 Processing ${dbLabel}`))
		console.log(chalk.cyan('='.repeat(60)))

		for (const domain of selectedDomains) {
			console.log(chalk.yellow(`\n📁 ${domain} → ${dbLabel}...`))

			const databaseId = getDatabaseId(config, domain, dbType)

			// 언어별로 그룹화
			const grouped = {}
			for (const lang of config.languages) {
				grouped[lang.code] = {}
			}

			// Notion DB에서 모든 페이지 가져오기
			let hasMore = true
			let startCursor = undefined
			let domainCount = 0

			while (hasMore) {
				const filter =
					dbType === 'unified'
						? {
								property: config.columns?.domain || 'Domain',
								select: {
									equals: domain,
								},
						  }
						: undefined

				const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${config.notionApiKey}`,
						'Notion-Version': '2022-06-28',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						start_cursor: startCursor,
						page_size: 100,
						...(filter && { filter }),
						sorts: [
							{
								property: config.columns?.order || 'Order',
								direction: 'ascending',
							},
						],
					}),
				})

				const data = await response.json()

				if (!response.ok) {
					throw new Error(`Failed to fetch ${domain}: ${data.message}`)
				}

				for (const page of data.results) {
					if (!('properties' in page)) continue

					const props = page.properties
					const key = props.Key?.title?.[0]?.text?.content

					if (!key) continue

					// 각 언어별 번역 추출
					for (const lang of config.languages) {
						const columnProp = props[lang.column]
						const text = columnProp?.rich_text?.[0]?.text?.content || ''

						// 빈 값이라도 추가하여 모든 언어가 동일한 키 구조를 유지
						grouped[lang.code][key] = text
					}

					domainCount++
				}

				hasMore = data.has_more
				startCursor = data.next_cursor || undefined
			}

			console.log(chalk.gray(`  📊 Fetched ${domainCount} entries`))
			totalCount += domainCount

			// JSON 파일 생성
			const dirPath = resolve(process.cwd(), config.messagesDir, domain)

			if (!existsSync(dirPath)) {
				mkdirSync(dirPath, { recursive: true })
			}

			let domainFiles = 0
			for (const [langCode, flatMessages] of Object.entries(grouped)) {
				const nested = unflatten(flatMessages)
				const filePath = join(dirPath, `${langCode}.json`)

				writeFileSync(filePath, JSON.stringify(nested, null, 2) + '\n')

				console.log(chalk.green(`  ✓ ${domain}/${langCode}.json`))
				domainFiles++
			}

			totalFiles += domainFiles
			console.log('')
		}
	}

	console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
	console.log(chalk.cyan('📊 Download Summary:\n'))
	console.log(chalk.cyan(`   📦 Total entries: ${totalCount}`))
	console.log(chalk.cyan(`   📁 Files updated: ${totalFiles}`))
	console.log(chalk.green('\n✅ Download complete!'))
}

// DB ID 가져오기
function getDatabaseId(config, domain, dbType) {
	if (dbType === 'unified') {
		if (!config.unifiedDatabase) {
			throw new Error('Unified database ID not configured')
		}
		return config.unifiedDatabase
	}

	const dbId = config.databases?.[domain]
	if (!dbId) {
		throw new Error(`Individual database ID for domain "${domain}" not found`)
	}
	return dbId
}
