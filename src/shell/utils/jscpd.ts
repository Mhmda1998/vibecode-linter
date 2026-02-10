// CHANGE: Add internal jscpd command builder resolved from vibecode-linter dependencies
// WHY: Do not rely on `npx jscpd` (may download packages, breaks pnpm/yarn expectations)
// QUOTE(ISSUE #5): "Надо что бы оно поддерживало pnpm, yarn"
// REF: ISSUE-5
// PURITY: SHELL (reads filesystem, resolves modules)
// INVARIANT: If jscpd is installed as a dependency, we run its bin via `node <bin>`
// COMPLEXITY: O(1)

import { isJSONObject, isString, type JSONValue } from "../../core/json.js";
import { fs, path } from "./node-mods.js";
import { resolveModuleFromSelf } from "./node-resolve.js";

function shellQuote(arg: string): string {
	return `"${arg.replaceAll('"', '\\"')}"`;
}

function extractJscpdBinFromParsed(
	parsed: Readonly<Record<string, JSONValue>>,
	pkgJsonPath: string,
): string | null {
	const withBin: { readonly bin?: JSONValue } = parsed;
	const bin = withBin.bin;
	if (bin === undefined) return null;

	if (isString(bin)) {
		return path.resolve(path.dirname(pkgJsonPath), bin);
	}

	if (!isJSONObject(bin)) {
		return null;
	}

	const withJscpd: { readonly jscpd?: JSONValue } = bin;
	const jscpdBin = withJscpd.jscpd;
	if (jscpdBin === undefined) return null;
	if (!isString(jscpdBin)) return null;
	return path.resolve(path.dirname(pkgJsonPath), jscpdBin);
}

function resolveJscpdBin(): string | null {
	const pkgJsonPath = resolveModuleFromSelf("jscpd/package.json");
	if (pkgJsonPath === null) return null;

	try {
		const raw = fs.readFileSync(pkgJsonPath, "utf8");
		const parsed = JSON.parse(raw) as JSONValue;
		if (!isJSONObject(parsed)) return null;
		return extractJscpdBinFromParsed(parsed, pkgJsonPath);
	} catch {
		return null;
	}
}

export function buildJscpdCommand(params: {
	readonly reportsDir: string;
	readonly targetPath: string;
}): string {
	const bin = resolveJscpdBin();
	if (bin === null) {
		// Fail fast with an obvious command. Caller will handle non-zero.
		return `jscpd --reporters sarif --output ${shellQuote(
			params.reportsDir,
		)} ${shellQuote(params.targetPath)}`;
	}

	return `node ${shellQuote(bin)} --reporters sarif --output ${shellQuote(
		params.reportsDir,
	)} ${shellQuote(params.targetPath)}`;
}
