import { execFileSync } from "node:child_process";
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

  it("explicitly exposes one Pi skill", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
          import { DefaultPackageManager, SettingsManager } from "@earendil-works/pi-coding-agent";

          const [repoRoot] = process.argv.slice(1);
          const packageManager = new DefaultPackageManager({
            cwd: repoRoot,
            agentDir: "/tmp/pi-orc-package-metadata-agent",
            settingsManager: SettingsManager.inMemory()
          });
          const resolved = await packageManager.resolveExtensionSources([repoRoot], { temporary: true });
          console.log(JSON.stringify({
            extensions: resolved.extensions.length,
            skills: resolved.skills.map((skill) => skill.path.replace(repoRoot, ".")),
            prompts: resolved.prompts.length,
            themes: resolved.themes.length
          }));
        `,
        repoRoot
      ],
      { cwd: repoRoot, encoding: "utf8" }
    );
    const resolved = JSON.parse(output) as {
      extensions: number;
      skills: string[];
      prompts: number;
      themes: number;
    };

    expect(resolved.skills).toEqual(["./skills/pi-orc-new-project/SKILL.md"]);
    expect(resolved.extensions).toBe(0);
    expect(resolved.prompts).toBe(0);
    expect(resolved.themes).toBe(0);
  });
});
