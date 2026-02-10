// CHANGE: Add shared JSON utility types and type guards
// WHY: Multiple modules parse JSON (configs, package.json); shared helpers reduce duplication (jscpd threshold=0)
// QUOTE(ТЗ): "Разумные рефакторинги без дубликатов"
// REF: ISSUE-5 (pnpm/yarn support introduced new JSON parsing)
// PURITY: CORE
// INVARIANT: JSONValue is closed under JSON serialization; guards are total functions
// COMPLEXITY: O(1)

/**
 * Type representing any valid JSON value.
 *
 * @invariant Must be serializable to JSON
 */
export type JSONValue =
	| string
	| number
	| boolean
	| null
	| readonly JSONValue[]
	| { readonly [key: string]: JSONValue };

/**
 * Type guard: JSON object (non-null, not an array).
 */
export function isJSONObject(
	value: JSONValue,
): value is Readonly<Record<string, JSONValue>> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Type guard: string.
 */
export function isString(value: JSONValue): value is string {
	return typeof value === "string";
}

/**
 * Type guard: number.
 */
export function isNumber(value: JSONValue): value is number {
	return typeof value === "number";
}

/**
 * Type guard: array.
 */
export function isArray(value: JSONValue): value is readonly JSONValue[] {
	return Array.isArray(value);
}
