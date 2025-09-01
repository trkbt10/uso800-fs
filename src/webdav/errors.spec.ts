/**
 * @file Unit tests for mapErrorToDav
 */
import { mapErrorToDav } from "./errors";

function err(msg: string): Error { return new Error(msg); }

describe("mapErrorToDav", () => {
  it("maps common fs-like messages to HTTP status", () => {
    expect(mapErrorToDav(err("Permission denied")).status).toBe(403);
    expect(mapErrorToDav(err("Not a directory")).status).toBe(409);
    expect(mapErrorToDav(err("Is a directory")).status).toBe(409);
    expect(mapErrorToDav(err("Directory not empty")).status).toBe(409);
    expect(mapErrorToDav(err("File not found")).status).toBe(404);
    expect(mapErrorToDav(err("Already exists")).status).toBe(412);
    expect(mapErrorToDav(err("Unrecognized problem")).status).toBe(500);
  });
});

