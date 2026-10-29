import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  execResultLooksLikePermissionDenied,
  formatExecFailure,
  pkexecSystem76PowerCommand,
  sessionEnvFromStrings,
  sessionEnvPrefix,
  shellQuote,
  system76PowerCommand,
} from "./shell.ts";

describe("shellQuote", () => {
  it("wraps simple strings", () => {
    assert.equal(shellQuote("hello"), "'hello'");
  });

  it("escapes single quotes", () => {
    assert.equal(shellQuote("a'b"), "'a'\\''b'");
  });
});

describe("sessionEnvPrefix", () => {
  it("returns empty when no session vars", () => {
    assert.equal(sessionEnvPrefix({}), "");
  });

  it("includes only the vars that are set", () => {
    assert.equal(
      sessionEnvPrefix({ xauthority: "/tmp/X0" }),
      "env XAUTHORITY='/tmp/X0' ",
    );
  });

  it("includes DISPLAY and XAUTHORITY when set", () => {
    assert.equal(
      sessionEnvPrefix({ display: ":0", xauthority: "/tmp/X0" }),
      "env DISPLAY=':0' XAUTHORITY='/tmp/X0' ",
    );
  });
});

describe("sessionEnvFromStrings", () => {
  it("omits empty Neutralino env values", () => {
    assert.deepEqual(sessionEnvFromStrings("", ""), {});
    assert.deepEqual(sessionEnvFromStrings(":0", ""), { display: ":0" });
  });
});

describe("formatExecFailure", () => {
  it("prefers stderr and falls back to a command label", () => {
    assert.equal(formatExecFailure(1, "stdout", "stderr"), "stderr");
    assert.equal(
      formatExecFailure(2, "", "  "),
      "system76-power failed (exit 2)",
    );
    assert.equal(
      formatExecFailure(3, "", "", "loginctl reboot"),
      "loginctl reboot failed (exit 3)",
    );
  });
});

describe("system76PowerCommand", () => {
  it("builds a plain command", () => {
    assert.equal(
      system76PowerCommand("profile battery"),
      "system76-power profile battery",
    );
  });

  it("prefixes session env", () => {
    assert.equal(
      system76PowerCommand("graphics hybrid", { display: ":1" }),
      "env DISPLAY=':1' system76-power graphics hybrid",
    );
  });
});

describe("pkexecSystem76PowerCommand", () => {
  it("wraps with pkexec", () => {
    assert.equal(
      pkexecSystem76PowerCommand("graphics integrated"),
      "pkexec system76-power graphics integrated",
    );
  });
});

describe("execResultLooksLikePermissionDenied", () => {
  it("detects polkit errors", () => {
    assert.equal(
      execResultLooksLikePermissionDenied("", "Operation not permitted"),
      true,
    );
  });

  it("ignores unrelated failures", () => {
    assert.equal(
      execResultLooksLikePermissionDenied("No such profile", ""),
      false,
    );
  });
});
