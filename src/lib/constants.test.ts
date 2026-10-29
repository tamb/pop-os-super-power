import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isGraphicsMode, isPowerProfile } from "./constants.ts";

describe("isPowerProfile", () => {
  it("accepts the three system76-power profiles", () => {
    assert.equal(isPowerProfile("battery"), true);
    assert.equal(isPowerProfile("balanced"), true);
    assert.equal(isPowerProfile("performance"), true);
  });

  it("rejects unknown and differently cased names", () => {
    assert.equal(isPowerProfile("Battery"), false);
    assert.equal(isPowerProfile("turbo"), false);
  });
});

describe("isGraphicsMode", () => {
  it("accepts integrated, discrete, and hybrid ids", () => {
    assert.equal(isGraphicsMode("integrated"), true);
    assert.equal(isGraphicsMode("nvidia"), true);
    assert.equal(isGraphicsMode("hybrid"), true);
  });

  it("rejects compute and unknown modes", () => {
    assert.equal(isGraphicsMode("compute"), false);
    assert.equal(isGraphicsMode("amd"), false);
  });
});
