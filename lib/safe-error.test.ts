import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSafeDatabaseErrorDetails,
  getSafeDatabaseErrorDetails,
} from "./safe-error.ts";

test("extracts a short D1 code without retaining query parameters", () => {
  const error = new Error("Failed query: insert into travelers params: Mary, mary@example.com D1_ERROR: UNIQUE constraint failed: SQLITE_CONSTRAINT");

  assert.deepEqual(getSafeDatabaseErrorDetails(error), {
    errorName: "Error",
    d1ErrorCode: "UNIQUE constraint failed",
  });
  assert.equal(formatSafeDatabaseErrorDetails(error), "Error: UNIQUE constraint failed");
});

test("finds a D1 code on a wrapped cause", () => {
  const wrapped = new Error("Failed query: insert into travelers params: private data", {
    cause: new Error("D1_ERROR: database is locked: SQLITE_BUSY"),
  });

  assert.deepEqual(getSafeDatabaseErrorDetails(wrapped), {
    errorName: "Error",
    d1ErrorCode: "database is locked",
  });
});

test("returns only the error name when no D1 code is available", () => {
  const error = new TypeError("A provider response included private data");

  assert.deepEqual(getSafeDatabaseErrorDetails(error), {
    errorName: "TypeError",
    d1ErrorCode: null,
  });
  assert.equal(formatSafeDatabaseErrorDetails(error), "TypeError");
});
