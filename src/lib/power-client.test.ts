import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyGraphics,
  type CommandRunner,
  commandExists,
  type ExecResult,
  fetchGraphicsMode,
  fetchProfile,
  fetchSwitchable,
  rebootSystem,
  runSystem76Power,
} from "./power-client.ts";

function ok(stdOut: string): ExecResult {
  return { exitCode: 0, stdOut, stdErr: "" };
}

function fail(stdErr: string, stdOut = ""): ExecResult {
  return { exitCode: 1, stdOut, stdErr };
}

function scripted(results: ExecResult[]): CommandRunner & { calls: string[] } {
  const calls: string[] = [];
  const run: CommandRunner & { calls: string[] } = async (command) => {
    calls.push(command);
    const next = results.shift();
    if (!next) {
      throw new Error(`Unexpected command: ${command}`);
    }
    return next;
  };
  run.calls = calls;
  return run;
}

describe("runSystem76Power", () => {
  it("returns trimmed stdout on success", async () => {
    const run = scripted([ok("hybrid\n")]);
    assert.equal(await runSystem76Power("graphics", {}, run), "hybrid");
    assert.deepEqual(run.calls, ["system76-power graphics"]);
  });

  it("retries with pkexec after a permission error", async () => {
    const run = scripted([
      fail("Operation not permitted"),
      ok("Power Profile: Balanced\n"),
    ]);
    assert.equal(
      await runSystem76Power("profile balanced", { display: ":0" }, run),
      "Power Profile: Balanced",
    );
    assert.deepEqual(run.calls, [
      "env DISPLAY=':0' system76-power profile balanced",
      "env DISPLAY=':0' pkexec system76-power profile balanced",
    ]);
  });

  it("does not retry unrelated failures", async () => {
    const run = scripted([fail("No such profile 'turbo'")]);
    await assert.rejects(
      () => runSystem76Power("profile turbo", {}, run),
      /No such profile 'turbo'/,
    );
    assert.equal(run.calls.length, 1);
  });

  it("throws a fallback message when both streams are empty", async () => {
    const run = scripted([fail("", "")]);
    await assert.rejects(
      () => runSystem76Power("profile battery", {}, run),
      /system76-power failed \(exit 1\)/,
    );
  });
});

describe("commandExists", () => {
  it("quotes the command name and treats exit 0 as present", async () => {
    const run = scripted([ok("0\n")]);
    assert.equal(await commandExists("system76-power", run), true);
    assert.equal(
      run.calls[0],
      "command -v 'system76-power' >/dev/null 2>&1; echo $?",
    );
  });

  it("returns false when the command is missing", async () => {
    const run = scripted([ok("1\n")]);
    assert.equal(await commandExists("missing", run), false);
  });
});

describe("rebootSystem", () => {
  it("stops after a successful loginctl reboot", async () => {
    const run = scripted([ok("")]);
    await rebootSystem(run);
    assert.deepEqual(run.calls, ["loginctl reboot"]);
  });

  it("falls back to pkexec and reports loginctl failures", async () => {
    const run = scripted([
      fail("Interactive authentication required"),
      fail("Authentication failed"),
    ]);
    await assert.rejects(() => rebootSystem(run), /Authentication failed/);
    assert.deepEqual(run.calls, ["loginctl reboot", "pkexec loginctl reboot"]);
  });

  it("uses a loginctl fallback when pkexec prints nothing", async () => {
    const run = scripted([fail("denied"), fail("", "")]);
    await assert.rejects(
      () => rebootSystem(run),
      /loginctl reboot failed \(exit 1\)/,
    );
  });
});

describe("fetch helpers", () => {
  it("parses the active profile", async () => {
    const run = scripted([ok("Power Profile: Performance\nCPU: uncapped")]);
    assert.equal(await fetchProfile({}, run), "performance");
  });

  it("maps compute graphics to integrated", async () => {
    const run = scripted([ok("compute")]);
    assert.equal(await fetchGraphicsMode({}, run), "integrated");
  });

  it("sends the selected graphics mode", async () => {
    const run = scripted([ok("")]);
    await applyGraphics("nvidia", {}, run);
    assert.deepEqual(run.calls, ["system76-power graphics nvidia"]);
  });

  it("treats only an exact switchable line as switchable", async () => {
    const present = scripted([ok("switchable\n")]);
    const absent = scripted([ok("not switchable\n")]);
    assert.equal(await fetchSwitchable({}, present), true);
    assert.equal(await fetchSwitchable({}, absent), false);
  });
});
