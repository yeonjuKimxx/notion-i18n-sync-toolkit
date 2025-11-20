/**
 * init 명령어: 설정 파일 생성
 */
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export async function initCommand(options) {
	const { output = './notion-i18n.config.json', force = false } = options

	const outputPath = resolve(process.cwd(), output)
	const envPath = resolve(process.cwd(), '.env')

	// 이미 존재하는지 확인
	if (existsSync(outputPath) && !force) {
		console.log(chalk.yellow(`⚠️  Config file already exists at ${outputPath}`))
		console.log(chalk.yellow(`   Use ${chalk.cyan('--force')} to overwrite`))
		return
	}

	try {
		// 템플릿 파일 복사
		const templatePath = resolve(__dirname, '../../templates/notion-i18n.config.json')
		copyFileSync(templatePath, outputPath)
		console.log(chalk.green(`✅ Created config file: ${outputPath}`))

		// .env.example 복사 (없으면)
		if (!existsSync(envPath)) {
			const envTemplatePath = resolve(__dirname, '../../templates/.env.example')
			copyFileSync(envTemplatePath, envPath)
			console.log(chalk.green(`✅ Created .env file: ${envPath}`))
			console.log(chalk.yellow(`   Please update .env with your Notion API key and database IDs`))
		} else {
			console.log(chalk.blue(`ℹ️  .env file already exists, skipped creation`))
		}

		// messages 디렉토리 생성
		const messagesDir = resolve(process.cwd(), 'messages')
		if (!existsSync(messagesDir)) {
			mkdirSync(messagesDir, { recursive: true })
			console.log(chalk.green(`✅ Created messages directory: ${messagesDir}`))
		}

		// 완료 메시지
		console.log('')
		console.log(chalk.green.bold('🎉 Initialization complete!'))
		console.log('')
		console.log(chalk.blue('Next steps:'))
		console.log(chalk.cyan('  1. Update .env with your Notion API key and database IDs'))
		console.log(chalk.cyan('  2. Update notion-i18n.config.json to match your project'))
		console.log(chalk.cyan('  3. Run notion-i18n upload or download to sync'))
		console.log('')
	} catch (error) {
		throw new Error(`Failed to initialize: ${error.message}`)
	}
}
