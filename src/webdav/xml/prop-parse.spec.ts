/**
 * @file Unit tests for parsePropElements
 */
import { parsePropElements } from "./prop-parse";

describe("parsePropElements", () => {
  it("parses namespaced props with values", () => {
    const xml = `<D:prop xmlns:D="DAV:" xmlns:Z="urn:x"><Z:color>blue</Z:color><D:displayname>Name</D:displayname></D:prop>`;
    const res = parsePropElements(xml);
    expect(res["Z:color"]).toBe("blue");
    expect(res["D:displayname"]).toBe("Name");
  });
  it("parses empty elements as empty string", () => {
    const xml = `<D:prop xmlns:D="DAV:"><D:getetag/></D:prop>`;
    const res = parsePropElements(xml);
    expect(res["D:getetag"]).toBe("");
  });
  it("returns empty map with no prop block", () => {
    expect(Object.keys(parsePropElements("<x/>"))).toHaveLength(0);
  });
});

