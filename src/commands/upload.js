/**
 * upload 명령어: 로컬 번역 파일을 Notion에 업로드
 */
import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import chalk from 'chalk'
import { loadConfig } from '../utils/config-loader.js'
import { flatten } from '../utils/flatten.js'
import { retryOnConflict } from '../utils/retry.js'

export async function uploadCommand(options) {
	const config = loadConfig(options.config)

	console.log(chalk.green('📤 Uploading translations to Notion...\n'))

	// CLI 옵션 파싱
	const selectedDomains = []
	let useIndividualDBs = false
	let useUnifiedDB = false

	if (options.all) {
		selectedDomains.push(...config.domains)
		useIndividualDBs = true
		useUnifiedDB = true
		console.log(chalk.blue('📦 Uploading all domains to both individual & unified DBs\n'))
	} else if (options.unified) {
		selectedDomains.push(...config.domains)
		useUnifiedDB = true
		console.log(chalk.blue('📦 Uploading all domains to unified DB only\n'))
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
				'  notion-i18n upload --all              # Upload all domains to both individual & unified DBs'
			)
			console.log('  notion-i18n upload --unified          # Upload all domains to unified DB only')
			console.log('  notion-i18n upload --auth             # Upload auth to individual DB only')
			console.log(
				'  notion-i18n upload --common --auth    # Upload common and auth to individual DBs'
			)
			console.log(chalk.cyan('\nAvailable domains:'), config.domains.join(', '))
			return
		}

		useIndividualDBs = true
		console.log(chalk.blue('📦 Uploading to individual DBs:'), selectedDomains.join(', '), '\n')
	}

	const totalResults = {
		created: 0,
		updated: 0,
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

			// 1단계: 기존 데이터 fetch
			console.log('  📋 Fetching existing data...')
			const existingMap = await fetchExistingData(config, databaseId, domain, dbType)
			console.log(chalk.gray(`     Found ${existingMap.size} existing entries`))

			// 2단계: 업로드할 데이터 준비
			console.log('  📦 Preparing upload data...')
			const allTasks = await prepareUploadTasks(config, domain)
			console.log(chalk.gray(`     Prepared ${allTasks.length} entries`))

			if (allTasks.length === 0) {
				console.log(chalk.yellow('  ⚠️  No data to upload!'))
				continue
			}

			// 3단계: 배치 병렬 처리
			console.log('  🚀 Uploading...')
			const BATCH_SIZE = config.options?.batchSize || 5
			const results = {
				created: 0,
				updated: 0,
				failed: [],
			}

			for (let i = 0; i < allTasks.length; i += BATCH_SIZE) {
				const batch = allTasks.slice(i, i + BATCH_SIZE)

				await Promise.all(
					batch.map(async (task) => {
						const existingPageId = existingMap.get(task.key)

						try {
							if (existingPageId) {
								await retryOnConflict(() => updatePage(config, existingPageId, domain, task))
								results.updated++
							} else {
								await retryOnConflict(() => createPage(config, databaseId, domain, task))
								results.created++
							}

							const total = results.created + results.updated
							process.stdout.write(
								`\r     Progress: ${total}/${allTasks.length} (✨ ${results.created} created, 🔄 ${results.updated} updated)`
							)
						} catch (error) {
							results.failed.push({
								domain,
								key: task.key,
								error: error.message || 'Unknown error',
							})
						}
					})
				)
			}

			console.log('') // newline

			totalResults.created += results.created
			totalResults.updated += results.updated
			totalResults.failed.push(...results.failed)

			console.log(
				chalk.green(`  ✅ ${domain}: ${results.created} created, ${results.updated} updated`)
			)
		}
	}

	// 전체 결과 리포트
	console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
	console.log(chalk.cyan('📊 Upload Summary:\n'))
	console.log(chalk.green(`   ✨ Created:  ${totalResults.created}`))
	console.log(chalk.blue(`   🔄 Updated:  ${totalResults.updated}`))
	console.log(chalk.red(`   ❌ Failed:   ${totalResults.failed.length}`))
	console.log(chalk.cyan(`   📦 Total:    ${totalResults.created + totalResults.updated}`))

	if (totalResults.failed.length > 0) {
		console.log(chalk.red('\n⚠️  Failed entries:'))
		totalResults.failed.forEach(({ domain, key, error }) => {
			console.log(chalk.red(`   - ${domain}.${key}: ${error}`))
		})
	}

	console.log(chalk.green('\n✅ Upload complete!'))
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

// 기존 데이터 fetch
async function fetchExistingData(config, databaseId, domain, dbType) {
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

// 업로드할 데이터 준비
async function prepareUploadTasks(config, domain) {
	const tasks = []

	const basePath = resolve(
		process.cwd(),
		config.messagesDir,
		domain,
		`${config.baseLocale}.json`
	)

	if (!existsSync(basePath)) {
		return tasks
	}

	const baseMessages = JSON.parse(readFileSync(basePath, 'utf-8'))
	const flatMessages = flatten(baseMessages)

	let order = 0
	for (const [key, _] of Object.entries(flatMessages)) {
		const translations = {}

		for (const lang of config.languages) {
			try {
				const langPath = resolve(process.cwd(), config.messagesDir, domain, `${lang.code}.json`)

				if (!existsSync(langPath)) {
					translations[lang.column] = ''
					continue
				}

				const messages = JSON.parse(readFileSync(langPath, 'utf-8'))
				const flatted = flatten(messages)
				translations[lang.column] = flatted[key] || ''
			} catch (e) {
				translations[lang.column] = ''
			}
		}

		tasks.push({ key, order, translations })
		order++
	}

	return tasks
}

// 페이지 생성
async function createPage(config, databaseId, domain, task) {
	const { key, order, translations } = task

	const properties = {
		Key: { title: [{ text: { content: key } }] },
		[config.columns?.order || 'Order']: { number: order },
		[config.columns?.domain || 'Domain']: { select: { name: domain } },
	}

	for (const [column, text] of Object.entries(translations)) {
		properties[column] = {
			rich_text: [{ text: { content: text || '' } }],
		}
	}

	const response = await fetch('https://api.notion.com/v1/pages', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${config.notionApiKey}`,
			'Notion-Version': '2022-06-28',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			parent: { database_id: databaseId },
			properties,
		}),
	})

	const data = await response.json()

	if (!response.ok) {
		throw new Error(`Failed to create page: ${data.message}`)
	}

	return data
}

// 페이지 업데이트
async function updatePage(config, pageId, domain, task) {
	const { order, translations } = task

	const properties = {
		[config.columns?.order || 'Order']: { number: order },
		[config.columns?.domain || 'Domain']: { select: { name: domain } },
	}

	for (const [column, text] of Object.entries(translations)) {
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
