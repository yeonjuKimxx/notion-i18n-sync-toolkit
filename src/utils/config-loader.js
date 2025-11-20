/**
 * 설정 파일 로더
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import dotenv from 'dotenv'
import chalk from 'chalk'

/**
 * 설정 파일 로드
 */
export function loadConfig(configPath = './notion-i18n.config.json') {
	const fullPath = resolve(process.cwd(), configPath)

	if (!existsSync(fullPath)) {
		throw new Error(
			`Config file not found at ${fullPath}\n` +
				`Run ${chalk.cyan('notion-i18n init')} to create one.`
		)
	}

	let config
	try {
		const content = readFileSync(fullPath, 'utf-8')
		config = JSON.parse(content)
	} catch (error) {
		throw new Error(`Failed to parse config file: ${error.message}`)
	}

	// .env 파일 로드 (있으면)
	dotenv.config()

	// 환경 변수로 치환
	config = replaceEnvVariables(config)

	// 검증
	validateConfig(config)

	return config
}

/**
 * 설정 내 환경 변수 치환
 */
function replaceEnvVariables(obj) {
	if (typeof obj === 'string') {
		// ${ENV_VAR} 형식 치환
		return obj.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
			return process.env[envVar] || match
		})
	}

	if (Array.isArray(obj)) {
		return obj.map(replaceEnvVariables)
	}

	if (obj && typeof obj === 'object') {
		const result = {}
		for (const [key, value] of Object.entries(obj)) {
			result[key] = replaceEnvVariables(value)
		}
		return result
	}

	return obj
}

/**
 * 설정 검증
 */
function validateConfig(config) {
	// Notion API Key 필수
	if (!config.notionApiKey || config.notionApiKey.includes('${')) {
		throw new Error(
			'NOTION_API_KEY is required. Please set it in your .env file or config.'
		)
	}

	// 통합 DB 또는 개별 DB 중 하나는 필수
	const hasUnifiedDb = config.unifiedDatabase && !config.unifiedDatabase.includes('${')
	const hasIndividualDbs =
		config.databases &&
		Object.values(config.databases).some((id) => id && !id.includes('${'))

	if (!hasUnifiedDb && !hasIndividualDbs) {
		throw new Error(
			'Either unifiedDatabase or at least one database in databases is required.\n' +
				'Please configure your database IDs in .env file.'
		)
	}

	// 필수 필드
	if (!config.languages || config.languages.length === 0) {
		throw new Error('languages array is required in config')
	}

	if (!config.domains || config.domains.length === 0) {
		throw new Error('domains array is required in config')
	}

	if (!config.messagesDir) {
		throw new Error('messagesDir is required in config')
	}
}
