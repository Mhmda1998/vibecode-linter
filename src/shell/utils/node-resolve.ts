// CHANGE: Add shared Node module resolution helpers for peer dependency detection
// WHY: Multiple modules (preflight, dependencies) need deterministic "resolve from cwd" without invoking npx
// QUOTE(ISSUE #5): "Надо что бы оно поддерживало pnpm, yarn"
// REF: ISSUE-5
// PURITY: SHELL (uses Node resolver and may throw; wrapped by callers)
// INVARIANT: Resolution attempts never mutate global module paths
// COMPLEXITY: O(1) per resolution attempt

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Resolve a module specifier as-if it was required from a given cwd.
 *
 * @returns Resolved absolute path, or null if resolution fails.
 */
export function resolveModuleFromCwd(
	moduleName: string,
	cwd: string,
): string | null {
	try {
		return require.resolve(moduleName, { paths: [cwd] });
	} catch {
		return null;
	}
}

/**
 * Resolve a module specifier relative to vibecode-linter itself (self node_modules).
 *
 * @returns Resolved absolute path, or null if resolution fails.
 */
export function resolveModuleFromSelf(moduleName: string): string | null {
	try {
		return require.resolve(moduleName);
	} catch {
		return null;
	}
}

/**
 * Predicate wrapper around resolveModuleFromCwd.
 */
export function canResolveFromCwd(moduleName: string, cwd: string): boolean {
	return resolveModuleFromCwd(moduleName, cwd) !== null;
}
