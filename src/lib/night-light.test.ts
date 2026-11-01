import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultNightLightSettings,
  encodeNightLightString,
  encodeNightLightTemperature,
  nightLightConfigDir,
  nightLightDaemonLaunch,
  nightLightResetEnabled,
  nightLightResetKelvin,
  nightLightScheduleNote,
  nightLightTintOn,
  parseNightLightMinutes,
  parseNightLightOverride,
  parseNightLightSchedule,
  parseNightLightTemperature,
} from "./night-light.ts";

describe("nightLightConfigDir", () => {
  it("points at the Night Light COSMIC config version", () => {
    assert.equal(
      nightLightConfigDir("/home/user"),
      "/home/user/.config/cosmic/io.github.cosmic_nightlight/v1",
    );
  });
});

describe("parseNightLightOverride", () => {
  it("reads quoted COSMIC config values", () => {
    assert.equal(parseNightLightOverride('"on"\n'), "on");
    assert.equal(parseNightLightOverride('"off"'), "off");
    assert.equal(parseNightLightOverride('"auto"'), "auto");
  });

  it("falls back to auto when the file is missing or unknown", () => {
    assert.equal(parseNightLightOverride(null), "auto");
    assert.equal(parseNightLightOverride("warm"), "auto");
  });
});

describe("parseNightLightSchedule", () => {
  it("keeps the older sunset key as a custom schedule", () => {
    assert.equal(parseNightLightSchedule('"sunset"'), "custom");
    assert.equal(parseNightLightSchedule('"solar"'), "solar");
    assert.equal(parseNightLightSchedule(null), "manual");
  });
});

describe("parseNightLightTemperature", () => {
  it("keeps a temperature inside the slider range", () => {
    assert.equal(parseNightLightTemperature("3500"), 3500);
  });

  it("uses the default when the file is missing or out of range", () => {
    assert.equal(parseNightLightTemperature(null), 4500);
    assert.equal(parseNightLightTemperature("900"), 4500);
  });
});

describe("parseNightLightMinutes", () => {
  it("rejects a value past the end of the day", () => {
    assert.equal(parseNightLightMinutes("1440", 360), 360);
    assert.equal(parseNightLightMinutes("1080", 360), 1080);
  });
});

describe("nightLightTintOn", () => {
  it("follows a manual override", () => {
    const settings = {
      ...defaultNightLightSettings(),
      override: "on" as const,
    };
    assert.equal(nightLightTintOn(settings, 12 * 60), true);
    assert.equal(
      nightLightTintOn({ ...settings, override: "off" }, 23 * 60),
      false,
    );
  });

  it("stays off in manual mode until someone turns it on", () => {
    assert.equal(nightLightTintOn(defaultNightLightSettings(), 23 * 60), false);
  });

  it("uses an overnight custom window", () => {
    const settings = {
      ...defaultNightLightSettings(),
      schedule: "custom" as const,
      sunsetMinutes: 18 * 60,
      sunriseMinutes: 6 * 60,
    };
    assert.equal(nightLightTintOn(settings, 18 * 60), true);
    assert.equal(nightLightTintOn(settings, 5 * 60 + 59), true);
    assert.equal(nightLightTintOn(settings, 6 * 60), false);
    assert.equal(nightLightTintOn(settings, 12 * 60), false);
  });

  it("uses a daytime custom window without wrapping past midnight", () => {
    const settings = {
      ...defaultNightLightSettings(),
      schedule: "custom" as const,
      sunsetMinutes: 9 * 60,
      sunriseMinutes: 17 * 60,
    };
    assert.equal(nightLightTintOn(settings, 9 * 60), true);
    assert.equal(nightLightTintOn(settings, 16 * 60 + 59), true);
    assert.equal(nightLightTintOn(settings, 17 * 60), false);
    assert.equal(nightLightTintOn(settings, 8 * 60), false);
  });

  it("does not guess the sun position", () => {
    const settings = {
      ...defaultNightLightSettings(),
      schedule: "solar" as const,
    };
    assert.equal(nightLightTintOn(settings, 12 * 60), null);
  });
});

describe("nightLightScheduleNote", () => {
  it("explains a schedule only while the override is automatic", () => {
    const custom = {
      ...defaultNightLightSettings(),
      schedule: "custom" as const,
    };
    assert.match(nightLightScheduleNote(custom) ?? "", /custom schedule/);
    assert.equal(nightLightScheduleNote({ ...custom, override: "on" }), null);
  });
});

describe("night light temperature reset", () => {
  it("resets to Night Light's default of 4500 K", () => {
    assert.equal(nightLightResetKelvin(), 4500);
    assert.equal(encodeNightLightTemperature(nightLightResetKelvin()), "4500");
  });

  it("enables Reset only when the slider is away from the default", () => {
    assert.equal(nightLightResetEnabled(3500, true), true);
    assert.equal(nightLightResetEnabled(6500, true), true);
    assert.equal(nightLightResetEnabled(nightLightResetKelvin(), true), false);
  });

  it("keeps Reset off when Night Light cannot be changed", () => {
    assert.equal(nightLightResetEnabled(3500, false), false);
    assert.equal(nightLightResetEnabled(nightLightResetKelvin(), false), false);
  });
});

describe("encode helpers", () => {
  it("writes the same text COSMIC config stores", () => {
    assert.equal(encodeNightLightString("on"), '"on"');
    assert.equal(encodeNightLightTemperature(3490), "3490");
    assert.equal(encodeNightLightTemperature(9000), "6500");
  });

  it("launches the Night Light daemon in the background", () => {
    assert.equal(
      nightLightDaemonLaunch(),
      "nohup cosmic-nightlight --daemon >/dev/null 2>&1 &",
    );
  });
});
