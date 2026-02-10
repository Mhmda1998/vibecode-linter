// CHANGE: Add pure package manager parsing helpers
// WHY: CLI parsing and package.json parsing must share the same normalization without duplication (jscpd threshold=0)
// QUOTE(ISSUE #5): "Надо что бы оно поддерживало pnpm, yarn"
// REF: ISSUE-5
// PURITY: CORE
// INVARIANT: Returned values are members of the finite set {"npm","pnpm","yarn","auto"}
// COMPLEXITY: O(1)

import { match } from "ts-pattern";

import type { PackageManager, PackageManagerSelection } from "./types/index.js";

export function parsePackageManagerSelection(
	value: string,
): PackageManagerSelection | null {
	const v = value.trim().toLowerCase();
	if (v === "auto") return "auto";
	const pm = parsePackageManagerField(v);
	return pm === null ? null : pm;
}

export function parsePackageManagerField(value: string): PackageManager | null {
	const trimmed = value.trim();
	const at = trimmed.indexOf("@");
	const name = (at === -1 ? trimmed : trimmed.slice(0, at)).toLowerCase();

	const NPM: PackageManager = "npm";
	const PNPM: PackageManager = "pnpm";
	const YARN: PackageManager = "yarn";

	return match(name)
		.with("npm", () => NPM)
		.with("pnpm", () => PNPM)
		.with("yarn", () => YARN)
		.otherwise(() => null);
}
