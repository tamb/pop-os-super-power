import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  graphicsModeForUi,
  isUnsupportedScsiHostProfileFailure,
  parseGraphicsOutput,
  parseProfileOutput,
  parseSwitchableOutput,
  shouldShowRebootBanner,
} from "./system76-output.ts";

describe("parseProfileOutput", () => {
  it("parses multiline profile output", () => {
    const out = `Power Profile: Battery
CPU: 18% - 50%, No Turbo`;
    assert.equal(parseProfileOutput(out), "battery");
    assert.equal(parseProfileOutput("Power Profile: Balanced"), "balanced");
    assert.equal(
      parseProfileOutput("Power Profile: Performance"),
      "performance",
    );
  });

  it("throws when profile line is missing", () => {
    assert.throws(
      () => parseProfileOutput("CPU only"),
      /Could not read power profile/,
    );
  });

  it("throws on unknown profile name", () => {
    assert.throws(
      () => parseProfileOutput("Power Profile: Turbo"),
      /Could not read power profile/,
    );
  });
});

describe("parseGraphicsOutput", () => {
  it("parses a single-line mode", () => {
    assert.equal(parseGraphicsOutput("hybrid"), "hybrid");
  });

  it("accepts compute", () => {
    assert.equal(parseGraphicsOutput("compute\n"), "compute");
  });

  it("rejects unknown modes", () => {
    assert.throws(
      () => parseGraphicsOutput("unknown"),
      /Unexpected graphics mode/,
    );
  });
});

describe("graphicsModeForUi", () => {
  it("maps compute to integrated", () => {
    assert.equal(graphicsModeForUi("compute"), "integrated");
  });

  it("passes through standard modes", () => {
    assert.equal(graphicsModeForUi("nvidia"), "nvidia");
  });
});

describe("parseSwitchableOutput", () => {
  it("returns true for switchable systems", () => {
    assert.equal(parseSwitchableOutput("switchable"), true);
  });

  it("returns false otherwise", () => {
    assert.equal(parseSwitchableOutput("not switchable\n"), false);
  });
});

describe("isUnsupportedScsiHostProfileFailure", () => {
  const host3 =
    "org.freedesktop.DBus.Error.Failed Errors found when setting profile: - failed to set scsi host profiles: failed to set link time power management policy med_power_with_dipm on host3: Operation not supported (os error 95)";

  it("matches a firmware-locked AHCI host", () => {
    assert.equal(isUnsupportedScsiHostProfileFailure(host3), true);
  });

  it("matches a missing link power policy file", () => {
    const message = `org.freedesktop.DBus.Error.Failed: Errors found when setting profile:
    - failed to set scsi host profiles: failed to set link time power management policy min_power on host0: No such file or directory (os error 2)`;
    assert.equal(isUnsupportedScsiHostProfileFailure(message), true);
  });

  it("rejects a profile error that includes another failure", () => {
    const message = `Errors found when setting profile:
    - failed to set scsi host profiles: failed to set link time power management policy med_power_with_dipm on host3: Operation not supported (os error 95)
    - failed to set pstate profiles: failed to set min_perf_pct: Permission denied (os error 13)`;
    assert.equal(isUnsupportedScsiHostProfileFailure(message), false);
  });

  it("rejects unrelated system76-power errors", () => {
    assert.equal(
      isUnsupportedScsiHostProfileFailure("No such profile 'turbo'"),
      false,
    );
    assert.equal(
      isUnsupportedScsiHostProfileFailure("Errors found when setting profile:"),
      false,
    );
  });
});

describe("shouldShowRebootBanner", () => {
  it("hides when baseline is unset", () => {
    assert.equal(shouldShowRebootBanner(null, "hybrid"), false);
  });

  it("hides when selection matches baseline", () => {
    assert.equal(shouldShowRebootBanner("hybrid", "hybrid"), false);
  });

  it("shows when selection differs from baseline", () => {
    assert.equal(shouldShowRebootBanner("nvidia", "hybrid"), true);
  });
});
