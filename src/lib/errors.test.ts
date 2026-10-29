import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { messageFromError } from "./errors.ts";

describe("messageFromError", () => {
  it("returns message from Error", () => {
    assert.equal(messageFromError(new Error("boom")), "boom");
  });

  it("stringifies non-errors", () => {
    assert.equal(messageFromError(404), "404");
  });
});
