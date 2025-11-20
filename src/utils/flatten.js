/**
 * 번역 스크립트 유틸 함수
 */

/**
 * 중첩 객체를 flat한 key-value 객체로 변환
 *
 * @example
 * flatten({ auth: { login: { title: "Login" } } })
 * // => { "auth.login.title": "Login" }
 */
export function flatten(obj, prefix = '') {
	const result = {}

	for (const key in obj) {
		if (!Object.prototype.hasOwnProperty.call(obj, key)) continue

		const newKey = prefix ? `${prefix}.${key}` : key
		const value = obj[key]

		if (value && typeof value === 'object' && !Array.isArray(value)) {
			// 재귀적으로 flatten
			Object.assign(result, flatten(value, newKey))
		} else {
			// 최종 값
			result[newKey] = String(value)
		}
	}

	return result
}

/**
 * Flat한 객체를 중첩 객체로 변환
 *
 * @example
 * unflatten({ "auth.login.title": "Login" })
 * // => { auth: { login: { title: "Login" } } }
 */
export function unflatten(flatObj) {
	const result = {}

	for (const [key, value] of Object.entries(flatObj)) {
		const parts = key.split('.')
		let current = result

		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i]
			if (!(part in current)) {
				current[part] = {}
			}
			current = current[part]
		}

		const lastKey = parts[parts.length - 1]
		current[lastKey] = value
	}

	return result
}

/**
 * 객체에서 dot notation으로 값 가져오기
 *
 * @example
 * get({ auth: { login: { title: "Login" } } }, "auth.login.title")
 * // => "Login"
 */
export function get(obj, path) {
	const parts = path.split('.')
	let current = obj

	for (const part of parts) {
		if (current && typeof current === 'object' && part in current) {
			current = current[part]
		} else {
			return undefined
		}
	}

	return typeof current === 'string' ? current : undefined
}

/**
 * 객체에 dot notation으로 값 설정
 *
 * @example
 * const obj = {};
 * set(obj, "auth.login.title", "Login");
 * // obj => { auth: { login: { title: "Login" } } }
 */
export function set(obj, path, value) {
	const parts = path.split('.')
	let current = obj

	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i]
		if (!(part in current)) {
			current[part] = {}
		}
		current = current[part]
	}

	const lastKey = parts[parts.length - 1]
	current[lastKey] = value
}

/**
 * 두 객체의 키 차이 계산
 */
export function diff(base, target) {
	const baseKeys = new Set(Object.keys(base))
	const targetKeys = new Set(Object.keys(target))

	const missing = [...baseKeys].filter((key) => !targetKeys.has(key))
	const extra = [...targetKeys].filter((key) => !baseKeys.has(key))

	return { missing, extra }
}
