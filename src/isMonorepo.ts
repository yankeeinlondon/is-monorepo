import type { PackageJson } from "@yankeeinlondon/package-json";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import { parsePackageJson } from "@yankeeinlondon/package-json";
import yaml from "yaml";

/**
 * Lookup for Monorepo files and their implied Monorepo
 * solution type
 */
export const MONOREPO_LOOKUP = [
  ["pnpm-workspace.yaml", "pnpm"],
  ["lerna.json", "lerna"],
  ["turbo.json", "turbo"],
  ["nx.json", "nx"],
  ["rush.json", "rush"],
] as const satisfies [string, string][];

export type MonorepoTech = {
  [K in keyof typeof MONOREPO_LOOKUP]: typeof MONOREPO_LOOKUP[K] extends [string, infer Name]
    ? Name
    : never
}[number] | "yarn";


/**
 * **isMonorepo**`(path?) -> false | MonorepoTech`
 * 
 * Tests if the given path is in a monorepo.
 * 
 * - if no path is specified then the _current working directory_ 
 * is used
 * - if path _does not_ appear to be a monorepo then `false` is
 * returned
 * - otherwise the monorepo's _tech_ is provided (e.g., yarn, lerna, etc.)
 * 
 * **Related:** `isMonorepoLike()`, `getMonorepoPackages()`
 */
export function isMonorepo(path?: string): false | MonorepoTech {
  const dir = path || cwd();
  const pkg: PackageJson = parsePackageJson(dir);

  for (const [file, type] of MONOREPO_LOOKUP) {
    if (existsSync(join(dir, file))) {
      return type;
    }
  }

  if (pkg.workspaces) {
    return "yarn";
  }

  return false;
}

/**
 * Tests if common monorepo directory structures exist
 * even though no monorepo configuration file was found.
 */
export function isMonorepoLike(path?: string): boolean {
  const dir = path || cwd();

  const folders = ["packages", "apps"];
  if (folders.some(f => existsSync(join(dir, f)))) {
    return true;
  }

  return false;
}

type RelativePath = `./${string}`;

/**
 * **getMonorepoPackages**`(dir?) -> Record<string, RelativePath>`
 * 
 * Get's the defined _packages_ in a monorepo.
 * 
 * - _keys_ are the package names
 * - _values_ is the _relative_ path to the package's definition
 * 
 * **Related:** `isMonorepo()`, `isMonorepoLike()`
 */
export function getMonorepoPackages(dir?: string): Record<string, RelativePath> {
  dir = dir || cwd();
  const result: Record<string, RelativePath> = {};
  const pkgPath = join(dir, "package.json");
  let workspaces: string[] = [];

  // 1. Try to get workspaces from package.json (Yarn, pnpm, npm)
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (Array.isArray(pkg.workspaces)) {
        workspaces = pkg.workspaces;
      }
      else if (pkg.workspaces && Array.isArray(pkg.workspaces.packages)) {
        workspaces = pkg.workspaces.packages;
      }
    }
    catch {}
  }

  // 2. Try pnpm-workspace.yaml
  const pnpmWorkspacePath = join(dir, "pnpm-workspace.yaml");
  if (existsSync(pnpmWorkspacePath)) {
    try {
      const yamlContent = readFileSync(pnpmWorkspacePath, "utf8");
      const parsed = yaml.parse(yamlContent);
      if (parsed && Array.isArray(parsed.packages)) {
        workspaces.push(...parsed.packages);
      }
    }
    catch {}
  }

  // 3. Fallback to common folders if no workspaces found
  if (workspaces.length === 0) {
    ["packages", "apps"].forEach((folder) => {
      const abs = join(dir, folder);
      if (existsSync(abs) && statSync(abs).isDirectory()) {
        workspaces.push(`${folder}/*`);
      }
    });
  }

  // 4. Expand globs and collect package names/paths
  for (const pattern of workspaces) {
    // Only support simple globs like "packages/*" or "apps/*"
    const base = pattern.replace(/\*.*$/, "");
    const absBase = join(dir, base);
    if (existsSync(absBase) && statSync(absBase).isDirectory()) {
      for (const entry of readdirSync(absBase)) {
        const entryPath = join(absBase, entry);
        const relPath = (`./${base}${entry}`).replace(/\\/g, "/");
        const pkgJson = join(entryPath, "package.json");
        if (existsSync(pkgJson)) {
          try {
            const pkg = JSON.parse(readFileSync(pkgJson, "utf8"));
            if (pkg.name) {
              result[pkg.name] = relPath as RelativePath;
            }
          }
          catch {}
        }
      }
    }
  }

  return result;
}
