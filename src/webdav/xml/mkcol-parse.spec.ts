/**
 * @file Unit tests for parseMkcolProps
 */
import { parseMkcolProps } from "./mkcol-parse";

describe("parseMkcolProps", () => {
  it("returns null for non-XML content-type or empty body", () => {
    expect(parseMkcolProps("", "application/xml")).toBeNull();
    expect(parseMkcolProps("<mkcol/>", "text/plain")).toBeNull();
  });

  it("parses mkcol+set+prop and returns props", () => {
    const xml = `<?xml version="1.0"?><D:mkcol xmlns:D="DAV:" xmlns:Z="urn:ex">` +
      `<D:set><D:prop><Z:color>blue</Z:color></D:prop></D:set></D:mkcol>`;
    const res = parseMkcolProps(xml, "application/xml");
    expect(res).not.toBeNull();
    expect(res!["Z:color"]).toBe("blue");
  });

  it("parses bare prop block when present", () => {
    const xml = `<D:prop xmlns:D="DAV:" xmlns:Z="urn:ex"><Z:x>1</Z:x></D:prop>`;
    const res = parseMkcolProps(xml, "application/xml");
    expect(res).not.toBeNull();
    expect(res!["Z:x"]).toBe("1");
  });
});

