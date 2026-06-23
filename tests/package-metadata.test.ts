import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type PackageJson = {
  pi?: Record<string, string | string[]>;
};

const repoRoot = resolve(import.meta.dirname, "..");

const readPackageJson = (): PackageJson =>
  JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as PackageJson;

const normalizePiPaths = (pi: PackageJson["pi"]): string[] =>
  Object.values(pi ?? {}).flatMap((value) => (Array.isArray(value) ? value : [value]));

describe("package metadata", () => {
  it("does not advertise missing Pi package paths", () => {
    const packageJson = readPackageJson();
    const missingPaths = normalizePiPaths(packageJson.pi).filter((packagePath) => {
      const localPath = packagePath.replace(/^\.\//, "");

      return !existsSync(resolve(repoRoot, localPath));
    });

    expect(missingPaths).toEqual([]);
  });
});
