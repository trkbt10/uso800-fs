/**
 * @file Unit tests for iCalendar parser and time range checks
 */
import { parseICalendar, overlapsTimeRange } from "./ical";

describe("iCal parser", () => {
  it("parses multiple VEVENT and extracts fields", () => {
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nDTSTART:20250101T000000Z\nDTEND:20250101T010000Z\nEND:VEVENT\nBEGIN:VEVENT\nUID:2\nDTSTART:20260101T000000Z\nEND:VEVENT\nEND:VCALENDAR`;
    const events = parseICalendar(ics);
    expect(events.length).toBe(2);
    expect(events[0].uid).toBe("1");
    expect(events[0].dtstart).toBe("20250101T000000Z");
    expect(events[0].dtend).toBe("20250101T010000Z");
    expect(events[1].uid).toBe("2");
    expect(events[1].dtend).toBeUndefined();
  });

  it("time range overlap checks boundary conditions", () => {
    const evt = { raw: "", type: "VEVENT" as const, dtstart: "20250101T120000Z", dtend: "20250101T130000Z", props: {} };
    expect(overlapsTimeRange(evt, undefined, undefined)).toBe(true);
    expect(overlapsTimeRange(evt, "20250101T000000Z", "20250101T235959Z")).toBe(true);
    expect(overlapsTimeRange(evt, "20260101T000000Z", undefined)).toBe(false);
    expect(overlapsTimeRange(evt, undefined, "20240101T000000Z")).toBe(false);
    // Edge equality
    expect(overlapsTimeRange(evt, "20250101T130000Z", undefined)).toBe(false);
    expect(overlapsTimeRange(evt, undefined, "20250101T120000Z")).toBe(false);
  });
});
