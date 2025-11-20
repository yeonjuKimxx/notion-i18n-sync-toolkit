/**
 * clear 명령어: Notion 데이터베이스 클리어
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import chalk from 'chalk'
import { loadConfig } from '../utils/config-loader.js'
import { unflatten } from '../utils/flatten.js'

export async function clearCommand(options) {
	const config = loadConfig(options.config)

	console.log(chalk.yellow('⚠️  Notion Database Clear\n'))

	// 선택된 도메인/DB 확인
	const targets = []

	if (options.all) {
		// 개별 DB 전부 + 통합 DB
		for (const domain of config.domains) {
			if (config.databases?.[domain]) {
				targets.push({ type: 'individual', domain, dbId: config.databases[domain] })
			}
		}
		if (config.unifiedDatabase) {
			targets.push({ type: 'unified', domain: 'all', dbId: config.unifiedDatabase })
		}
	} else if (options.unified) {
		if (config.unifiedDatabase) {
			targets.push({ type: 'unified', domain: 'all', dbId: config.unifiedDatabase })
		} else {
			console.log(chalk.red('❌ Unified database not configured'))
			return
		}
	} else {
		// 개별 도메인 선택
		for (const domain of config.domains) {
			if (options[domain]) {
				const dbId = config.databases?.[domain]
				if (dbId) {
					targets.push({ type: 'individual', domain, dbId })
				} else {
					console.log(chalk.red(`❌ Database for ${domain} not configured`))
					return
				}
			}
		}
	}

	if (targets.length === 0) {
		console.log(chalk.yellow('Usage:'))
		console.log('  notion-i18n clear --all        # Clear all databases')
		console.log('  notion-i18n clear --unified    # Clear unified DB only')
		console.log('  notion-i18n clear --auth       # Clear auth DB only')
		console.log('\nAvailable options: --all, --unified, --' + config.domains.join(', --'))
		return
	}

	// 확인 프롬프트 (--yes 없으면)
	if (!options.yes) {
		console.log(chalk.red.bold('⚠️  WARNING: This will DELETE ALL data from the following databases:\n'))
		for (const target of targets) {
			const label =
				target.type === 'unified'
					? `Unified DB (all domains)`
					: `${target.domain} (individual DB)`
			console.log(chalk.red(`   - ${label}`))
		}
		console.log(
			chalk.yellow(
				'\n   To proceed, run with --yes flag:\n   notion-i18n clear --auth --yes\n'
			)
		)
		return
	}

	// 백업 실행 (삭제 전)
	console.log(chalk.cyan('\n💾 Backing up Notion data before clearing...\n'))

	for (const target of targets) {
		if (target.type === 'unified') {
			// 통합 DB는 모든 도메인 백업
			for (const domain of config.domains) {
				await backupNotionData(config, target.dbId, domain, 'unified')
			}
		} else {
			// 개별 DB는 해당 도메인만 백업
			await backupNotionData(config, target.dbId, target.domain, 'individual')
		}
	}

	console.log(chalk.green('✅ Backup complete!\n'))

	// 클리어 실행
	let totalDeleted = 0

	for (const target of targets) {
		const label =
			target.type === 'unified' ? `Unified DB` : `${target.domain} (individual DB)`
		console.log(chalk.yellow(`\n🗑️  Clearing ${label}...`))

		try {
			const deleted = await clearDatabase(config, target.dbId, target.domain, target.type)
			console.log(chalk.green(`   ✅ Deleted ${deleted} entries`))
			totalDeleted += deleted
		} catch (error) {
			console.log(chalk.red(`   ❌ Failed: ${error.message}`))
		}
	}

	console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
	console.log(chalk.cyan(`📊 Total deleted: ${totalDeleted} entries`))
	console.log(chalk.green('\n✅ Clear complete!'))
}

async function clearDatabase(config, databaseId, domain, dbType) {
	// 모든 페이지 조회
	const pageIds = []
	let hasMore = true
	let cursor = undefined

	while (hasMore) {
		const filter =
			dbType === 'unified' && domain !== 'all'
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
			throw new Error(`Failed to fetch pages: ${data.message}`)
		}

		pageIds.push(...data.results.map((page) => page.id))
		hasMore = data.has_more
		cursor = data.next_cursor
	}

	console.log(chalk.gray(`   Found ${pageIds.length} pages to delete`))

	// 배치 삭제 (5개씩)
	const BATCH_SIZE = 5
	let deleted = 0

	for (let i = 0; i < pageIds.length; i += BATCH_SIZE) {
		const batch = pageIds.slice(i, i + BATCH_SIZE)

		await Promise.all(
			batch.map(async (pageId) => {
				const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
					method: 'PATCH',
					headers: {
						Authorization: `Bearer ${config.notionApiKey}`,
						'Notion-Version': '2022-06-28',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						archived: true,
					}),
				})

				if (response.ok) {
					deleted++
				}
			})
		)

		process.stdout.write(`\r   Deleting: ${deleted}/${pageIds.length}`)
	}

	console.log('') // newline
	return deleted
}

async function backupNotionData(config, databaseId, domain, dbType) {
	console.log(chalk.gray(`   📦 Backing up ${domain}...`))

	// Notion에서 데이터 가져오기
	const data = {}
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

		const result = await response.json()

		if (!response.ok) {
			throw new Error(`Failed to fetch backup data: ${result.message}`)
		}

		for (const page of result.results) {
			const props = page.properties
			const key = props.Key?.title?.[0]?.plain_text

			if (!key) continue

			// 각 언어별로 데이터 수집
			for (const lang of config.languages) {
				const columnName = lang.column
				const value = props[columnName]?.rich_text?.[0]?.plain_text || ''

				if (!data[lang.code]) {
					data[lang.code] = {}
				}

				data[lang.code][key] = value
			}
		}

		hasMore = result.has_more
		cursor = result.next_cursor
	}

	// notion_backup/{domain}/{lang}.json 형태로 저장
	const backupDir = resolve(process.cwd(), 'notion_backup', domain)

	if (!existsSync(backupDir)) {
		mkdirSync(backupDir, { recursive: true })
	}

	let savedFiles = 0
	for (const lang of config.languages) {
		const langData = data[lang.code] || {}
		const nestedData = unflatten(langData)
		const filePath = join(backupDir, `${lang.code}.json`)

		writeFileSync(filePath, JSON.stringify(nestedData, null, 2), 'utf-8')
		savedFiles++
	}

	console.log(
		chalk.green(`      ✓ Saved ${savedFiles} language files to notion_backup/${domain}/`)
	)
}
