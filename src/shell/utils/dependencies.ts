// CHANGE: Rework dependency checks to avoid npx implicit downloads and support pnpm/yarn projects
// WHY: `npx biome` can download legacy `biome` package; we must check/execute project-installed peers deterministically
// QUOTE(ISSUE #5): "Надо что бы оно поддерживало pnpm, yarn"
// REF: ISSUE-5
// PURITY: SHELL (executes commands, inspects environment)
// EFFECT: Effect<DependencyCheckResult>
// INVARIANT: Missing list contains only required dependencies that are actually unavailable
// COMPLEXITY: O(n) where n = number of dependencies checked

import { exec } from "node:child_process";
import { promisify } from "node:util";

import { Effect } from "effect";
import { match } from "ts-pattern";

import type { PackageManager } from "../../core/types/index.js";
import { canResolveFromCwd } from "./node-resolve.js";
import { formatInstallDevCommand } from "./package-manager.js";

const execAsync = promisify(exec);

type Dependency =
	| {
			readonly kind: "command";
			readonly name: string;
			readonly checkCommand: string;
			readonly installHint: string;
			readonly required: true;
	  }
	| {
			readonly kind: "package";
			readonly name: string;
			readonly packageJson: string;
			readonly installPackages: readonly string[];
			readonly required: true;
	  };

const DEPENDENCIES: readonly Dependency[] = [
	{
		kind: "command",
		name: "Git",
		checkCommand: "git --version",
		installHint: "Visit https://git-scm.com/downloads",
		required: true,
	},
	{
		kind: "command",
		name: "Node.js",
		checkCommand: "node --version",
		installHint: "Visit https://nodejs.org/",
		required: true,
	},
	{
		kind: "package",
		name: "ESLint",
		packageJson: "eslint/package.json",
		installPackages: ["eslint"],
		required: true,
	},
	{
		kind: "package",
		name: "Biome",
		packageJson: "@biomejs/biome/package.json",
		installPackages: ["@biomejs/biome"],
		required: true,
	},
	{
		kind: "package",
		name: "TypeScript",
		packageJson: "typescript/package.json",
		installPackages: ["typescript"],
		required: true,
	},
];

function isCommandAvailable(checkCommand: string): Effect.Effect<boolean> {
	return Effect.tryPromise({
		try: () => execAsync(checkCommand, { timeout: 5000 }),
		catch: () => false,
	}).pipe(
		Effect.map(() => true),
		Effect.catchAll(() => Effect.succeed(false)),
	);
}

function isDependencyAvailable(
	dep: Dependency,
	cwd: string,
): Effect.Effect<boolean> {
	return match(dep)
		.with({ kind: "command" }, (d) => isCommandAvailable(d.checkCommand))
		.with({ kind: "package" }, (d) =>
			Effect.succeed(canResolveFromCwd(d.packageJson, cwd)),
		)
		.exhaustive();
}

/**
 * Результат проверки зависимостей.
 */
export interface DependencyCheckResult {
	readonly allAvailable: boolean;
	readonly missing: readonly Dependency[];
}

/**
 * Проверяет наличие необходимых зависимостей.
 *
 * @param cwd Project working directory used for peer resolution
 */
export function checkDependencies(
	cwd: string,
): Effect.Effect<DependencyCheckResult> {
	return Effect.gen(function* (_) {
		const missing: Dependency[] = [];

		for (const dep of DEPENDENCIES) {
			const available = yield* _(isDependencyAvailable(dep, cwd));
			if (!available) {
				missing.push(dep);
			}
		}

		return {
			allAvailable: missing.length === 0,
			missing,
		};
	});
}

/**
 * Выводит информацию о недостающих зависимостях.
 */
export function reportMissingDependencies(params: {
	readonly cwd: string;
	readonly packageManager: PackageManager;
	readonly missing: readonly Dependency[];
}): void {
	console.error("\n❌ Missing required dependencies:\n");

	for (const dep of params.missing) {
		match(dep)
			.with({ kind: "command" }, (d) => {
				console.error(`  • ${d.name}`);
				console.error(`    Check: ${d.checkCommand}`);
				console.error(`    Install: ${d.installHint}\n`);
			})
			.with({ kind: "package" }, (d) => {
				console.error(`  • ${d.name} (${d.installPackages.join(", ")})`);
				console.error(`    Resolve: ${d.packageJson}`);
				console.error(
					`    Install: ${formatInstallDevCommand(
						params.packageManager,
						d.installPackages,
					)}\n`,
				);
			})
			.exhaustive();
	}

	console.error("Please install the missing dependencies and try again.\n");
}
