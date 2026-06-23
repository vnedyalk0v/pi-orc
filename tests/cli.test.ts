import { describe, expect, it } from "vitest";

import { runPiOrcCli } from "../src/cli/pi-orc.js";

function run(args: readonly string[]) {
  let stdout = "";
  let stderr = "";
  const exitCode = runPiOrcCli(args, {
    stdout: {
      write: (chunk: string) => {
        stdout += chunk;
        return true;
      }
    },
    stderr: {
      write: (chunk: string) => {
        stderr += chunk;
        return true;
      }
    }
  });

  return { exitCode, stdout, stderr };
}

describe("pi-orc CLI", () => {
  it("prints a new-project dry-run plan without executing mutations", () => {
    const result = run(["new-project", "--dry-run"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("# Bootstrap Plan: Example TypeScript App");
    expect(result.stdout).toContain("## GitHub Actions");
    expect(result.stdout).toContain("## Policy Gates");
    expect(result.stdout).toContain("Dry run: no GitHub, git, or file mutations executed.");
  });

  it("rejects new-project without dry-run", () => {
    const result = run(["new-project"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("new-project currently requires --dry-run");
  });
});
