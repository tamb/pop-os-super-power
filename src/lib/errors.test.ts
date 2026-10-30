import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { messageFromError } from "./errors.ts";

describe("messageFromError", () => {
  it("returns message from Error", () => {
    assert.equal(messageFromError(new Error("boom")), "boom");
  });

  it("stringifies non-errors", () => {
    assert.equal(messageFromError(404), "404");
  });

  it("reads message from Neutralino error objects", () => {
    assert.equal(
      messageFromError({ code: "NE_FS_FILWRER", message: "denied" }),
      "denied",
    );
  });
});
