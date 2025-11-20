/**
 * sync 명령어: Order를 유지하면서 번역 값만 업데이트
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import chalk from 'chalk'
import { loadConfig } from '../utils/config-loader.js'
import { flatten } from '../utils/flatten.js'
import { retryOnConflict } from '../utils/retry.js'

export async function syncCommand(options) {
	const config = loadConfig(options.config)

	console.log(chalk.green('🔄 Syncing translation values (preserving Order)...\n'))

	// CLI 옵션 파싱
	const selectedDomains = []
	let useIndividualDBs = false
	let useUnifiedDB = false

	if (options.all) {
		selectedDomains.push(...config.domains)
		useIndividualDBs = true
		useUnifiedDB = true
		console.log(chalk.blue('📦 Syncing all domains to both individual & unified DBs\n'))
	} else if (options.unified) {
		selectedDomains.push(...config.domains)
		useUnifiedDB = true
		console.log(chalk.blue('📦 Syncing all domains to unified DB only\n'))
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
				'  notion-i18n sync --all              # Sync all domains to both individual & unified DBs'
			)
			console.log('  notion-i18n sync --unified          # Sync all domains to unified DB only')
			console.log('  notion-i18n sync --auth             # Sync auth to individual DB only')
			console.log('  notion-i18n sync --common --auth    # Sync common and auth to individual DBs')
			console.log(chalk.cyan('\nAvailable domains:'), config.domains.join(', '))
			return
		}

		useIndividualDBs = true
		console.log(chalk.blue('📦 Syncing to individual DBs:'), selectedDomains.join(', '), '\n')
	}

	const totalResults = {
		updated: 0,
		notFound: [],
		failed: [],
	}

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

			// 1단계: 기존 데이터 fetch (Key와 PageID 매핑)
			console.log('  📋 Fetching existing keys...')
			const existingMap = await fetchExistingKeys(config, databaseId, domain, dbType)
			console.log(chalk.gray(`     Found ${existingMap.size} existing keys`))

			// 2단계: 로컬 번역 데이터 준비
			console.log('  📦 Preparing translation data...')
			const translations = await prepareTranslations(config, domain)
			console.log(chalk.gray(`     Prepared ${Object.keys(translations).length} keys`))

			// 3단계: 존재하는 키만 업데이트 (배치 병렬 처리)
			console.log('  🔄 Syncing translations...')
			const BATCH_SIZE = config.options?.batchSize || 5
			const results = {
				updated: 0,
				notFound: [],
				failed: [],
			}

			const keysToSync = Object.keys(translations)
			for (let i = 0; i < keysToSync.length; i += BATCH_SIZE) {
				const batch = keysToSync.slice(i, i + BATCH_SIZE)

				await Promise.all(
					batch.map(async (key) => {
						const pageId = existingMap.get(key)

						if (!pageId) {
							// Notion에 없는 키는 건너뜀
							results.notFound.push(key)
							return
						}

						try {
							await retryOnConflict(() => updateTranslations(config, pageId, translations[key]))
							results.updated++

							const total = results.updated + results.notFound.length
							process.stdout.write(
								`\r     Progress: ${total}/${keysToSync.length} (🔄 ${results.updated} updated, ⏭️  ${results.notFound.length} skipped)`
							)
						} catch (error) {
							results.failed.push({
								domain,
								key,
								error: error.message || 'Unknown error',
							})
						}
					})
				)
			}

			console.log('') // newline

			totalResults.updated += results.updated
			totalResults.notFound.push(...results.notFound.map((k) => `${domain}.${k}`))
			totalResults.failed.push(...results.failed)

			console.log(
				chalk.green(
					`  ✅ ${domain}: ${results.updated} updated, ${results.notFound.length} skipped (not in Notion)`
				)
			)
		}
	}

	// 전체 결과 리포트
	console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
	console.log(chalk.cyan('📊 Sync Summary:\n'))
	console.log(chalk.green(`   🔄 Updated:  ${totalResults.updated}`))
	console.log(chalk.yellow(`   ⏭️  Skipped:  ${totalResults.notFound.length}`))
	console.log(chalk.red(`   ❌ Failed:   ${totalResults.failed.length}`))

	if (totalResults.notFound.length > 0) {
		console.log(chalk.yellow('\n⏭️  Skipped keys (not found in Notion):'))
		totalResults.notFound.slice(0, 10).forEach((key) => {
			console.log(chalk.yellow(`   - ${key}`))
		})
		if (totalResults.notFound.length > 10) {
			console.log(chalk.yellow(`   ... and ${totalResults.notFound.length - 10} more`))
		}
	}

	if (totalResults.failed.length > 0) {
		console.log(chalk.red('\n⚠️  Failed entries:'))
		totalResults.failed.forEach(({ domain, key, error }) => {
			console.log(chalk.red(`   - ${domain}.${key}: ${error}`))
		})
	}

	console.log(chalk.green('\n✅ Sync complete!'))
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

// 기존 키 fetch (Key와 PageID 매핑만)
async function fetchExistingKeys(config, databaseId, domain, dbType) {
	const existingMap = new Map()
	let hasMore = true
	let cursor = undefined

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
				start_cursor: cursor,
				page_size: 100,
				...(filter && { filter }),
			}),
		})

		const data = await response.json()

		if (!response.ok) {
			throw new Error(`Failed to fetch: ${data.message}`)
		}

		for (const page of data.results) {
			const props = page.properties
			const key = props.Key?.title?.[0]?.plain_text

			if (key) {
				existingMap.set(key, page.id)
			}
		}

		hasMore = data.has_more
		cursor = data.next_cursor
	}

	return existingMap
}

// 로컬 번역 데이터 준비
async function prepareTranslations(config, domain) {
	const translations = {}

	const basePath = resolve(process.cwd(), config.messagesDir, domain, `${config.baseLocale}.json`)

	if (!existsSync(basePath)) {
		return translations
	}

	const baseMessages = JSON.parse(readFileSync(basePath, 'utf-8'))
	const flatMessages = flatten(baseMessages)

	for (const [key, _] of Object.entries(flatMessages)) {
		const langValues = {}

		for (const lang of config.languages) {
			try {
				const langPath = resolve(process.cwd(), config.messagesDir, domain, `${lang.code}.json`)

				if (!existsSync(langPath)) {
					langValues[lang.column] = ''
					continue
				}

				const messages = JSON.parse(readFileSync(langPath, 'utf-8'))
				const flatted = flatten(messages)
				const value = flatted[key] || ''
				langValues[lang.column] = value
			} catch (e) {
				langValues[lang.column] = ''
			}
		}

		translations[key] = langValues
	}

	return translations
}

// 번역 값만 업데이트 (Order, Domain, Status는 건드리지 않음)
async function updateTranslations(config, pageId, langValues) {
	const properties = {}

	// 언어 컬럼만 업데이트
	for (const [column, text] of Object.entries(langValues)) {
		properties[column] = {
			rich_text: [{ text: { content: text || '' } }],
		}
	}

	const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${config.notionApiKey}`,
			'Notion-Version': '2022-06-28',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			properties,
		}),
	})

	const data = await response.json()

	if (!response.ok) {
		throw new Error(`Failed to update page: ${data.message}`)
	}

	return data
}
