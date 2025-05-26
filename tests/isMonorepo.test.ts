import { describe, it, expect, afterEach } from "vitest";
import { isMonorepo, getMonorepoPackages } from "~/index";
import { join } from "path";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";

const TMP = join(__dirname, "tmp-monorepo");

function setupMonorepo(structure: Record<string, string | object>) {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  for (const [file, content] of Object.entries(structure)) {
    const filePath = join(TMP, file);
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (typeof content === "string") {
      writeFileSync(filePath, content);
    } else {
      writeFileSync(filePath, JSON.stringify(content, null, 2));
    }
  }
}

describe("isMonoRepo", () => {
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("detects pnpm-workspace.yaml", () => {
    setupMonorepo({ "pnpm-workspace.yaml": "packages:\n  - packages/*\n" });
    expect(isMonorepo(TMP)).toBe("pnpm");
  });

  it("detects lerna.json", () => {
    setupMonorepo({ "lerna.json": "{}" });
    expect(isMonorepo(TMP)).toBe("lerna");
  });

  it("detects yarn workspaces in package.json", () => {
    setupMonorepo({ "package.json": { workspaces: ["packages/*"] } });
    expect(isMonorepo(TMP)).toBe("yarn");
  });

  it("detects nx.json", () => {
    setupMonorepo({ "nx.json": "{}" });
    expect(isMonorepo(TMP)).toBe("nx");
  });

  it("detects turbo.json", () => {
    setupMonorepo({ "turbo.json": "{}" });
    expect(isMonorepo(TMP)).toBe("turbo");
  });

  it("detects rush.json", () => {
    setupMonorepo({ "rush.json": "{}" });
    expect(isMonorepo(TMP)).toBe("rush");
  });

  it("returns false for non-monorepo", () => {
    setupMonorepo({ "package.json": { name: "single" } });
    expect(isMonorepo(TMP)).toBe(false);
  });
});

describe("monorepoModules", () => {
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("finds modules in packages/", () => {
    setupMonorepo({
      "packages/foo/package.json": { name: "foo" },
      "packages/bar/package.json": { name: "bar" },
    });
    const mods = getMonorepoPackages(TMP);
    expect(mods).toHaveProperty("foo");
    expect(mods).toHaveProperty("bar");
    expect(mods.foo).toMatch(/packages\/foo/);
    expect(mods.bar).toMatch(/packages\/bar/);
  });

  it("finds modules from yarn workspaces", () => {
    setupMonorepo({
      "package.json": { workspaces: ["modules/*"] },
      "modules/alpha/package.json": { name: "alpha" },
    });
    const mods = getMonorepoPackages(TMP);
    expect(mods).toHaveProperty("alpha");
    expect(mods.alpha).toMatch(/modules\/alpha/);
  });

  it("finds modules from pnpm-workspace.yaml", () => {
    setupMonorepo({
      "pnpm-workspace.yaml": "packages:\n  - libs/*\n",
      "libs/lib1/package.json": { name: "lib1" },
    });
    const mods = getMonorepoPackages(TMP);
    expect(mods).toHaveProperty("lib1");
    expect(mods.lib1).toMatch(/libs\/lib1/);
  });

  it("returns empty object for non-monorepo", () => {
    setupMonorepo({ "package.json": { name: "single" } });
    const mods = getMonorepoPackages(TMP);
    expect(mods).toEqual({});
  });

  it("returns modules for maybe monorepo", () => {
    setupMonorepo({ "packages/foo/package.json": { name: "foo" } });
    const mods = getMonorepoPackages(TMP);
    expect(mods).toHaveProperty("foo");
    expect(mods.foo).toMatch(/packages\/foo/);
  });
});
