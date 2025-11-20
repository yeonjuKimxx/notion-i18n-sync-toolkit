/**
 * check-db 명령어: Basic DB를 기준으로 도메인 DB 구조 검증
 */
import chalk from 'chalk'
import { loadConfig } from '../utils/config-loader.js'
import { retryFetch } from '../utils/retry.js'

export async function checkDbCommand(options) {
	const config = loadConfig(options.config)

	console.log(chalk.green('🔍 Checking Database Structure...\n'))

	// 1. Basic DB 구조 가져오기 (표준)
	console.log(chalk.cyan('📋 Fetching Basic DB structure...'))
	const basicDbId = config.basicDatabase || config.unifiedDatabase
	if (!basicDbId) {
		console.error(chalk.red('❌ Basic DB not configured. Please add "basicDatabase" to config.'))
		process.exit(1)
	}

	const basicDbSchema = await fetchDbSchema(config, basicDbId)
	console.log(chalk.green(`✅ Basic DB has ${Object.keys(basicDbSchema).length} columns\n`))

	// 2. 검증할 DB 결정
	const domainsToCheck = []
	if (options.all) {
		domainsToCheck.push(...config.domains)
	} else {
		for (const domain of config.domains) {
			if (options[domain]) {
				domainsToCheck.push(domain)
			}
		}
	}

	if (domainsToCheck.length === 0) {
		console.error(
			chalk.yellow(
				'⚠️  No domains specified. Use --all or specify domains (e.g., --auth --business)'
			)
		)
		process.exit(1)
	}

	// 3. 각 도메인 DB 검증
	let allValid = true

	for (const domain of domainsToCheck) {
		const dbId = config.databases[domain]
		if (!dbId) {
			console.log(chalk.yellow(`⚠️  ${domain}: Not configured in databases`))
			allValid = false
			continue
		}

		console.log(chalk.cyan(`\n📊 Checking ${domain} DB...`))

		try {
			const domainDbSchema = await fetchDbSchema(config, dbId)
			const diff = compareSchemas(basicDbSchema, domainDbSchema)

			if (diff.missing.length === 0 && diff.typeMismatch.length === 0) {
				console.log(chalk.green(`✅ ${domain}: All columns match Basic DB!`))
			} else {
				allValid = false
				console.log(chalk.red(`❌ ${domain}: Schema mismatch detected\n`))

				if (diff.missing.length > 0) {
					console.log(chalk.yellow('  Missing Columns:'))
					for (const col of diff.missing) {
						console.log(chalk.yellow(`    - ${col.name} (${col.type})`))
					}
				}

				if (diff.typeMismatch.length > 0) {
					console.log(chalk.yellow('\n  Type Mismatches:'))
					for (const col of diff.typeMismatch) {
						console.log(
							chalk.yellow(
								`    - ${col.name}: expected ${col.expectedType}, got ${col.actualType}`
							)
						)
					}
				}

				if (diff.extra.length > 0) {
					console.log(chalk.blue('\n  Extra Columns (not in Basic DB):'))
					for (const col of diff.extra) {
						console.log(chalk.blue(`    - ${col.name} (${col.type})`))
					}
				}
			}
		} catch (error) {
			console.error(chalk.red(`❌ ${domain}: Failed to fetch DB schema`))
			console.error(chalk.red(`   Error: ${error.message}`))
			allValid = false
		}
	}

	// 4. 요약
	console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
	if (allValid) {
		console.log(chalk.green('✅ All checked databases match Basic DB structure!'))
	} else {
		console.log(chalk.red('❌ Some databases have schema issues.'))
		console.log(chalk.yellow('\n💡 To fix:'))
		console.log(chalk.yellow('   1. Open the Notion database'))
		console.log(chalk.yellow('   2. Add missing columns with the correct type'))
		console.log(chalk.yellow('   3. Run check-db again to verify'))
	}
	console.log('')
}

/**
 * Notion DB 스키마 가져오기
 */
async function fetchDbSchema(config, databaseId) {
	const response = await retryFetch(
		`https://api.notion.com/v1/databases/${databaseId}`,
		{
			method: 'GET',
			headers: {
				Authorization: `Bearer ${config.notionApiKey}`,
				'Notion-Version': '2022-06-28',
			},
		},
		config.options?.retryAttempts || 3,
		config.options?.retryDelay || 1000
	)

	if (!response.ok) {
		const error = await response.json()
		throw new Error(`Failed to fetch DB schema: ${error.message}`)
	}

	const data = await response.json()
	return data.properties
}

/**
 * 두 스키마 비교
 */
function compareSchemas(basicSchema, domainSchema) {
	const missing = []
	const typeMismatch = []
	const extra = []

	// Basic DB에 있는 컬럼 확인
	for (const [name, prop] of Object.entries(basicSchema)) {
		if (!domainSchema[name]) {
			missing.push({ name, type: prop.type })
		} else if (domainSchema[name].type !== prop.type) {
			typeMismatch.push({
				name,
				expectedType: prop.type,
				actualType: domainSchema[name].type,
			})
		}
	}

	// 도메인 DB에만 있는 컬럼 확인
	for (const [name, prop] of Object.entries(domainSchema)) {
		if (!basicSchema[name]) {
			extra.push({ name, type: prop.type })
		}
	}

	return { missing, typeMismatch, extra }
}
