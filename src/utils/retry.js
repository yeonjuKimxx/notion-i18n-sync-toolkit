/**
 * Retry helper for Notion API transient errors
 */
export async function retryOnConflict(fn, maxRetries = 5, delayMs = 1000) {
	for (let i = 0; i < maxRetries; i++) {
		try {
			return await fn()
		} catch (error) {
			// Retry on transient errors
			const retryableErrors = [
				'conflict_error',
				'rate_limited',
				'internal_server_error',
				'service_unavailable',
			]
			const isRetryable = retryableErrors.includes(error.code)
			const isLastAttempt = i === maxRetries - 1

			if (!isRetryable || isLastAttempt) {
				throw error
			}

			// Exponential backoff
			const delay = delayMs * Math.pow(2, i)
			await new Promise((resolve) => setTimeout(resolve, delay))
		}
	}
	throw new Error('Retry failed')
}
