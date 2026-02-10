// CHANGE: Build deterministic tool invocation commands without npx downloads
// WHY: `npx biome` may download the legacy `biome` package instead of using `@biomejs/biome`; pnpm/yarn need stable local execution
// QUOTE(ISSUE #5): "Надо что бы оно поддерживало pnpm, yarn"
// REF: ISSUE-5
// PURITY: SHELL (depends on filesystem layout and chosen package manager)
// INVARIANT: If a local binary exists in node_modules/.bin, we always prefer it (no network)
// COMPLEXITY: O(h) where h is directory height (find local bin upwards)

import { match } from "ts-pattern";

import type { PackageManager } from "../../core/types/index.js";
import { fs, path } from "./node-mods.js";

function shellQuote(arg: string): string {
	// CHANGE: Minimal quoting for shell command safety with spaces
	// WHY: Many paths may contain spaces; double quotes are sufficient for our usage
	// REF: ISSUE-5 (avoid brittle command rendering)
	return `"${arg.replaceAll('"', '\\"')}"`;
}

function binCandidates(binName: string): readonly string[] {
	// CHANGE: Add Windows-compatible bin name candidates
	// WHY: node_modules/.bin uses .cmd shims on Windows
	// REF: Cross-platform Node tooling conventions
	return process.platform === "win32"
		? [`${binName}.cmd`, `${binName}.exe`, `${binName}.ps1`, binName]
		: [binName];
}

function findLocalBinUpwards(binName: string, startDir: string): string | null {
	let dir = path.resolve(startDir);
	for (;;) {
		const binDir = path.join(dir, "node_modules", ".bin");
		for (const candidate of binCandidates(binName)) {
			const p = path.join(binDir, candidate);
			if (fs.existsSync(p)) return p;
		}

		const parent = path.dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

/**
 * Build a command string for executing a tool in the current project.
 *
 * Strategy:
 * 1) Prefer a local binary found in node_modules/.bin (walk up from cwd).
 * 2) If absent, fall back to the selected package manager:
 *    - pnpm: `pnpm exec <bin> ...`
 *    - yarn: `yarn run <bin> ...` (works with Yarn PnP)
 *
 * For npm when node_modules/.bin is missing, we render a local .bin fallback path; execution will fail fast
 * if dependencies are not installed, without triggering implicit downloads.
 */
export function buildToolCommand(params: {
	readonly cwd: string;
	readonly packageManager: PackageManager;
	readonly bin: string;
	readonly args: readonly string[];
}): string {
	const local = findLocalBinUpwards(params.bin, params.cwd);
	const renderedArgs =
		params.args.length === 0 ? "" : ` ${params.args.map(shellQuote).join(" ")}`;

	if (local !== null) {
		return `${shellQuote(local)}${renderedArgs}`;
	}

	return match(params.packageManager)
		.with("pnpm", () => `pnpm exec ${params.bin}${renderedArgs}`)
		.with("yarn", () => `yarn run ${params.bin}${renderedArgs}`)
		.with("npm", () => {
			// CHANGE: Avoid `npx`/`npm exec` because they may implicitly download packages
			// WHY: We want deterministic execution; if the binary isn't present locally, execution should fail fast
			// REF: ISSUE-5
			const fallback = path.join(
				params.cwd,
				"node_modules",
				".bin",
				binCandidates(params.bin)[0] ?? params.bin,
			);
			return `${shellQuote(fallback)}${renderedArgs}`;
		})
		.exhaustive();
}
