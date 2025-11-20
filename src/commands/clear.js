/**
 * clear 명령어: Notion 데이터베이스 클리어
 */
import chalk from 'chalk'
import { loadConfig } from '../utils/config-loader.js'

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
