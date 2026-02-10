// CHANGE: Add package manager detection and command formatting (npm/pnpm/yarn)
// WHY: vibecode-linter must not rely on npx auto-download behavior; support pnpm/yarn projects deterministically
// QUOTE(ISSUE #5): "Надо что бы оно поддерживало pnpm, yarn"
// REF: ISSUE-5
// PURITY: SHELL (reads filesystem to detect lockfiles/package.json)
// INVARIANT: Returned package manager is always one of {"npm","pnpm","yarn"}
// COMPLEXITY: O(h) where h is directory height (find project root)

import { match } from "ts-pattern";

import { isJSONObject, isString, type JSONValue } from "../../core/json.js";
import { parsePackageManagerField } from "../../core/package-manager.js";
import type {
	PackageManager,
	PackageManagerSelection,
} from "../../core/types/index.js";
import { fs, path } from "./node-mods.js";

function readPackageManagerField(projectRoot: string): PackageManager | null {
	const pkgPath = path.join(projectRoot, "package.json");
	if (!fs.existsSync(pkgPath)) return null;

	try {
		const raw = fs.readFileSync(pkgPath, "utf8");
		const parsed = JSON.parse(raw) as JSONValue;
		if (!isJSONObject(parsed)) return null;

		const withPm: { readonly packageManager?: JSONValue } = parsed;
		const pm = withPm.packageManager;
		if (pm === undefined) return null;
		if (!isString(pm)) return null;

		return parsePackageManagerField(pm);
	} catch {
		return null;
	}
}

function detectFromLockfiles(projectRoot: string): PackageManager | null {
	const pnpmLock = fs.existsSync(path.join(projectRoot, "pnpm-lock.yaml"));
	const yarnLock = fs.existsSync(path.join(projectRoot, "yarn.lock"));
	const npmLock =
		fs.existsSync(path.join(projectRoot, "package-lock.json")) ||
		fs.existsSync(path.join(projectRoot, "npm-shrinkwrap.json"));

	// CHANGE: Deterministic priority order for mixed lockfiles
	// WHY: Some repos accidentally commit multiple lockfiles; choose the most specific first
	// REF: ISSUE-5 (pm selection)
	return pnpmLock ? "pnpm" : yarnLock ? "yarn" : npmLock ? "npm" : null;
}

/**
 * Find nearest ancestor directory that contains package.json.
 *
 * Postcondition: returns an absolute path.
 */
export function findProjectRoot(startDir: string): string {
	let dir = path.resolve(startDir);
	for (;;) {
		const pkg = path.join(dir, "package.json");
		if (fs.existsSync(pkg)) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) return path.resolve(startDir);
		dir = parent;
	}
}

/**
 * Resolve effective package manager for a given cwd and optional user selection.
 *
 * Invariant: if selection ∈ {npm,pnpm,yarn} it always wins over auto detection.
 */
export function resolvePackageManager(params: {
	readonly cwd: string;
	readonly selection?: PackageManagerSelection;
}): { readonly projectRoot: string; readonly packageManager: PackageManager } {
	const projectRoot = findProjectRoot(params.cwd);

	const forced = params.selection;
	if (forced !== undefined && forced !== "auto") {
		return { projectRoot, packageManager: forced };
	}

	const fromField = readPackageManagerField(projectRoot);
	if (fromField !== null) {
		return { projectRoot, packageManager: fromField };
	}

	const fromLocks = detectFromLockfiles(projectRoot);
	return { projectRoot, packageManager: fromLocks ?? "npm" };
}

/**
 * Format a dev-dependency install command for a package manager.
 */
export function formatInstallDevCommand(
	packageManager: PackageManager,
	packages: readonly string[],
): string {
	const pkgs = packages.join(" ");
	return match(packageManager)
		.with("npm", () => `npm install --save-dev ${pkgs}`)
		.with("pnpm", () => `pnpm add --save-dev ${pkgs}`)
		.with("yarn", () => `yarn add --dev ${pkgs}`)
		.exhaustive();
}
