/**
 * @file Minimal iCalendar parsing utilities for CalDAV filtering.
 * This is intentionally lightweight: extracts VEVENT blocks and DTSTART/DTEND.
 */

export type VCalendarProp = { name: string; params: Record<string, string>; value: string };
export type VCalendarComp = {
  raw: string;
  type: "VEVENT" | "VTODO";
  dtstart?: string;
  dtend?: string;
  due?: string;
  uid?: string;
  props: Record<string, VCalendarProp[]>;
};

/** Parse iCalendar text and extract VEVENT blocks with basic fields. */
export function parseICalendar(text: string): VCalendarComp[] {
  if (!text || text.trim().length === 0) { return []; }
  const events: VCalendarComp[] = [];
  const lower = text.toLowerCase();
  const hasEvent = lower.includes("begin:vevent");
  const hasTodo = lower.includes("begin:vtodo");
  if (!hasEvent && !hasTodo) { return []; }
  for (const m of text.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)) {
    const seg = (m[1] ?? "").trim();
    const block = `BEGIN:VEVENT\n${seg}\nEND:VEVENT`;
    const dtstart = (/^DTSTART[^:]*:([^\r\n]+)/mi.exec(seg)?.[1] ?? undefined);
    const dtend = (/^DTEND[^:]*:([^\r\n]+)/mi.exec(seg)?.[1] ?? undefined);
    const uid = (/^UID[^:]*:([^\r\n]+)/mi.exec(seg)?.[1] ?? undefined);
    const props = parseProps(seg);
    events.push({ raw: block, type: "VEVENT", dtstart, dtend, uid, props });
  }
  for (const m of text.matchAll(/BEGIN:VTODO([\s\S]*?)END:VTODO/g)) {
    const seg = (m[1] ?? "").trim();
    const block = `BEGIN:VTODO\n${seg}\nEND:VTODO`;
    const dtstart = (/^DTSTART[^:]*:([^\r\n]+)/mi.exec(seg)?.[1] ?? undefined);
    const due = (/^DUE[^:]*:([^\r\n]+)/mi.exec(seg)?.[1] ?? undefined);
    const uid = (/^UID[^:]*:([^\r\n]+)/mi.exec(seg)?.[1] ?? undefined);
    const props = parseProps(seg);
    events.push({ raw: block, type: "VTODO", dtstart, due, uid, props });
  }
  return events;
}

/**
 * Check if a VEVENT time window overlaps [start, end].
 * Values are compared lexicographically (YYYYMMDD[ThhmmssZ]).
 */
export function overlapsTimeRange(evt: VCalendarComp, start?: string, end?: string): boolean {
  // Basic string comparison on YYYYMMDD or YYYYMMDDThhmmssZ works lexicographically for our minimal case.
  const s = (() => { if (evt.type === "VTODO") { return evt.dtstart ?? evt.due ?? ""; } return evt.dtstart ?? ""; })();
  const e = (() => { if (evt.type === "VTODO") { return evt.due ?? evt.dtstart ?? ""; } return evt.dtend ?? evt.dtstart ?? ""; })();
  const hasStart = typeof start === "string" && start.length > 0;
  const hasEnd = typeof end === "string" && end.length > 0;
  if (!hasStart && !hasEnd) { return true; }
  if (hasStart) {
    if (e && start) {
      // No overlap if event ends at or before the start
      if (e <= start) { return false; }
    }
  }
  if (hasEnd) {
    if (s && end) {
      // No overlap if event starts at or after the end
      if (s >= end) { return false; }
    }
  }
  return true;
}

function parseProps(seg: string): Record<string, VCalendarProp[]> {
  const out: Record<string, VCalendarProp[]> = {};
  const lines = seg.split(/\r?\n/);
  for (const ln of lines) {
    const m = /^([A-Za-z0-9-]+)(;[^:]+)?:([\s\S]*)$/.exec(ln);
    if (!m) { continue; }
    const name = (m[1] ?? "").toUpperCase();
    const paramStr = (m[2] ?? "");
    const value = (m[3] ?? "").trim();
    const params = parseParams(paramStr);
    const prop: VCalendarProp = { name, params, value };
    if (!Object.prototype.hasOwnProperty.call(out, name)) {
      out[name] = [prop];
    } else {
      out[name] = [...out[name], prop];
    }
  }
  return out;
}

function parseParams(paramStr: string): Record<string, string> {
  if (!paramStr || paramStr.length === 0) { return {}; }
  const body = paramStr.startsWith(";") ? paramStr.slice(1) : paramStr;
  const parts = body.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
  const acc: Record<string, string> = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq <= 0) { continue; }
    const k = p.slice(0, eq).toUpperCase();
    const v = p.slice(eq + 1);
    acc[k] = v;
  }
  return acc;
}
