/**
 * @file CalDAV REPORT handlers: calendar-query and calendar-multiget.
 */
import type { PersistAdapter } from "../webdav/persist/types";
import { parseICalendar, overlapsTimeRange } from "./ical";

type Query = { comp?: string; start?: string; end?: string };
type TextMatch = { value: string; collation?: string; negate?: boolean };
type ParamFilter = { name: string; isNotDefined?: boolean; textMatch?: TextMatch };
type PropFilter = { name: string; isNotDefined?: boolean; textMatch?: TextMatch; paramFilters?: ParamFilter[] };
type Filters = { props: PropFilter[] };

function extractTimeRange(input: string): { start?: string; end?: string } {
  const m = /time-range[^>]*\bstart\s*=\s*"([^"]+)"/i.exec(input);
  const n = /time-range[^>]*\bend\s*=\s*"([^"]+)"/i.exec(input);
  const start = m?.[1];
  const end = n?.[1];
  return { start, end };
}

function extractComp(input: string): string | undefined {
  // Prefer VEVENT if present anywhere; otherwise take the first comp-filter name
  if (/comp-filter[^>]*\bname\s*=\s*"VEVENT"/i.test(input)) { return "VEVENT"; }
  const m = /comp-filter[^>]*\bname\s*=\s*"([^"]+)"/i.exec(input);
  const name = m?.[1];
  return name ? name.toUpperCase() : undefined;
}

function parseFilters(xml: string): Filters {
  const props: PropFilter[] = [];
  const re = /<\s*(?:[A-Za-z]+:)?prop-filter\b([^>]*)>([\s\S]*?)<\s*\/\s*(?:[A-Za-z]+:)?prop-filter\s*>/gi;
  for (const m of xml.matchAll(re)) {
    const attrs = m[1] ?? "";
    const inner = m[2] ?? "";
    const nameM = /\bname\s*=\s*"([^"]+)"/i.exec(attrs);
    const name = nameM ? nameM[1].toUpperCase() : "";
    if (!name) { continue; }
    const isNotDefined = /<\s*(?:[A-Za-z]+:)?is-not-defined\b/i.test(inner);
    const tm = parseTextMatch(inner);
    const paramFilters = parseParamFilters(inner);
    props.push({ name, isNotDefined, textMatch: tm, paramFilters });
  }
  return { props };
}

function parseParamFilters(xml: string): ParamFilter[] {
  const out: ParamFilter[] = [];
  const re = /<\s*(?:[A-Za-z]+:)?param-filter\b([^>]*)>([\s\S]*?)<\s*\/\s*(?:[A-Za-z]+:)?param-filter\s*>/gi;
  for (const m of xml.matchAll(re)) {
    const attrs = m[1] ?? "";
    const inner = m[2] ?? "";
    const nameM = /\bname\s*=\s*"([^"]+)"/i.exec(attrs);
    const name = nameM ? nameM[1].toUpperCase() : "";
    if (!name) { continue; }
    const isNotDefined = /<\s*(?:[A-Za-z]+:)?is-not-defined\b/i.test(inner);
    const tm = parseTextMatch(inner);
    out.push({ name, isNotDefined, textMatch: tm });
  }
  return out;
}

function parseTextMatch(xml: string): TextMatch | undefined {
  const m = /<\s*(?:[A-Za-z]+:)?text-match\b([^>]*)>([\s\S]*?)<\s*\/\s*(?:[A-Za-z]+:)?text-match\s*>/i.exec(xml);
  if (!m) { return undefined; }
  const attrs = m[1] ?? "";
  const value = (m[2] ?? "").trim();
  const collM = /\bcollation\s*=\s*"([^"]+)"/i.exec(attrs);
  const neg = /\bnegate-condition\s*=\s*"yes"/i.test(attrs);
  const collation = collM ? collM[1] : undefined;
  return { value, collation, negate: neg };
}

function valueMatches(val: string, tm?: TextMatch): boolean {
  if (!tm) { return true; }
  const col = tm.collation ? tm.collation.toLowerCase() : "i;ascii-casemap";
  const hay = col === "i;octet" ? val : val.toLowerCase();
  const needle = col === "i;octet" ? tm.value : tm.value.toLowerCase();
  const has = hay.indexOf(needle) >= 0;
  if (tm.negate === true) { return !has; }
  return has;
}

function eventMatchesFilters(evt: import("./ical").VCalendarComp, f: Filters): boolean {
  for (const pf of f.props) {
    const name = pf.name.toUpperCase();
    const entries = evt.props[name] ?? [];
    if (pf.isNotDefined === true) {
      if (entries.length > 0) { return false; }
      continue;
    }
    if (entries.length === 0) { return false; }
    const propOk = (() => {
      for (const e of entries) {
        if (!valueMatches(e.value, pf.textMatch)) { continue; }
        if (pf.paramFilters && pf.paramFilters.length > 0) {
          const allParamsOk = pf.paramFilters.every((pfilt) => {
            const val = e.params[pfilt.name];
            if (pfilt.isNotDefined === true) { return typeof val === "undefined"; }
            if (typeof val === "undefined") { return false; }
            return valueMatches(val, pfilt.textMatch);
          });
          if (!allParamsOk) { continue; }
        }
        return true;
      }
      return false;
    })();
    if (!propOk) { return false; }
  }
  return true;
}

function wantsCalendarQuery(body: string): boolean {
  return /<\s*([A-Za-z]+:)?calendar-query\b/i.test(body);
}
function wantsCalendarMultiGet(body: string): boolean {
  return /<\s*([A-Za-z]+:)?calendar-multiget\b/i.test(body);
}
function wantsFreeBusy(body: string): boolean {
  return /<\s*([A-Za-z]+:)?free-busy-query\b/i.test(body);
}

function extractHrefs(input: string): string[] {
  const hrefs: string[] = [];
  for (const m of input.matchAll(/<\s*([A-Za-z]+:)?href\s*>([\s\S]*?)<\s*\/\s*([A-Za-z]+:)?href\s*>/gi)) {
    const val = (m[2] ?? "").trim();
    if (val) { hrefs.push(val); }
  }
  return hrefs;
}

/** Read calendar object text at WebDAV URL path using PersistAdapter. */
async function readCalendarObject(persist: PersistAdapter, urlPath: string): Promise<{ ok: boolean; data?: string }>
{
  const parts = urlPath.split("/").filter(Boolean);
  try {
    const buf = await persist.readFile(parts);
    return { ok: true, data: new TextDecoder().decode(buf) };
  } catch {
    return { ok: false };
  }
}

/**
 * Handle CalDAV calendar-query: filter .ics files by component and time-range.
 * Returns a DAV:multistatus XML body.
 */
export async function handleCalendarQuery(urlPath: string, bodyText: string, persist: PersistAdapter, opts?: { depth?: string; strictFilters?: boolean }): Promise<string>
{
  const query: Query = (() => {
    const comp = extractComp(bodyText);
    const { start, end } = extractTimeRange(bodyText);
    return { comp, start, end };
  })();
  const header = `<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">`;
  const footer = "</D:multistatus>";
  if (opts?.strictFilters === true && query.comp) {
    const nested = new RegExp(`<\\s*(?:[A-Za-z]+:)?comp-filter\\b[^>]*name\\s*=\\s*\"VCALENDAR\"[\\s\\S]*?<\\s*(?:[A-Za-z]+:)?comp-filter\\b[^>]*name\\s*=\\s*\"${query.comp}\"`, "i");
    if (!nested.test(bodyText)) {
      return `${header}${footer}`;
    }
  }
  async function listAll(basePath: string[], baseHref: string, recursive: boolean): Promise<Array<{ href: string; data: string }>> {
    const results: Array<{ href: string; data: string }> = [];
    const names = await persist.readdir(basePath).catch(() => [] as string[]);
    for (const name of names) {
      const childParts = [...basePath, name];
      const href = `${baseHref}${encodeURIComponent(name)}`;
      const maybe = await persist.stat(childParts).then((s) => s.type).catch(() => null);
      if (maybe === "file" && name.toLowerCase().endsWith(".ics")) {
        const r = await readCalendarObject(persist, `${href}`);
        if (r.ok && r.data) { results.push({ href, data: r.data }); }
      } else if (maybe === "dir" && recursive) {
        const sub = await listAll(childParts, href + "/", true);
        results.push(...sub);
      }
    }
    return results;
  }

  const parts = urlPath.split("/").filter(Boolean);
  const baseHref = urlPath.endsWith("/") ? urlPath : urlPath + "/";
  const depth = (opts?.depth ?? "1").toLowerCase();
  function makeCandidatesList(): Promise<Array<{ href: string; data: string }>> {
    if (depth === "infinity") {
      return listAll(parts, baseHref, true);
    }
    if (depth === "0") {
      return (async () => {
        const st = await persist.stat(parts).catch(() => null);
        if (st) {
          if (st.type === "file" && urlPath.toLowerCase().endsWith(".ics")) {
            const r = await readCalendarObject(persist, urlPath);
            if (r.ok) {
              if (r.data) { return [{ href: urlPath, data: r.data }]; }
            }
          }
        }
        return [] as Array<{ href: string; data: string }>;
      })();
    }
    return listAll(parts, baseHref, false);
  }
  const candidates = await makeCandidatesList();
  const entries: string[] = [];
  for (const item of candidates) {
    const events = parseICalendar(item.data);
    const anyMatch = events.some((evt) => {
      const comp = query.comp ? query.comp.toUpperCase() : undefined;
      if (typeof comp === "string") {
        if (comp !== evt.type) {
          return false;
        }
      }
      const timeOk = overlapsTimeRange(evt, query.start, query.end);
      if (!timeOk) { return false; }
      const filters = parseFilters(bodyText);
      const filterOk = eventMatchesFilters(evt, filters);
      if (!filterOk) { return false; }
      return true;
    });
    if (!anyMatch) { continue; }
    const prop = `<D:prop><C:calendar-data>${escapeXml(item.data)}</C:calendar-data></D:prop>`;
    const ok = `<D:propstat>${prop}<D:status>HTTP/1.1 200 OK</D:status></D:propstat>`;
    entries.push(`\n<D:response>\n  <D:href>${item.href}</D:href>\n  ${ok}\n</D:response>`);
  }
  return [header, ...entries, footer].join("");
}

/**
 * Handle CalDAV calendar-multiget: return specified href objects.
 * Returns a DAV:multistatus XML body.
 */
export async function handleCalendarMultiGet(urlPath: string, bodyText: string, persist: PersistAdapter): Promise<string>
{
  const header = `<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">`;
  const footer = "</D:multistatus>";
  const hrefs = extractHrefs(bodyText);
  const entries: string[] = [];
  for (const href of hrefs) {
    const read = await readCalendarObject(persist, href);
    if (!read.ok || !read.data) { continue; }
    const prop = `<D:prop><C:calendar-data>${escapeXml(read.data)}</C:calendar-data></D:prop>`;
    const ok = `<D:propstat>${prop}<D:status>HTTP/1.1 200 OK</D:status></D:propstat>`;
    entries.push(`\n<D:response>\n  <D:href>${href}</D:href>\n  ${ok}\n</D:response>`);
  }
  return [header, ...entries, footer].join("");
}

/** Dispatch a CalDAV REPORT body to the appropriate handler. */
export function dispatchCalDavReport(urlPath: string, bodyText: string, persist: PersistAdapter, opts?: { depth?: string; strictFilters?: boolean }): Promise<string> {
  if (wantsFreeBusy(bodyText)) {
    return handleFreeBusy(urlPath, bodyText, persist, opts);
  }
  if (wantsCalendarMultiGet(bodyText)) {
    return handleCalendarMultiGet(urlPath, bodyText, persist);
  }
  if (wantsCalendarQuery(bodyText)) {
    return handleCalendarQuery(urlPath, bodyText, persist, opts);
  }
  return Promise.resolve(`<?xml version="1.0"?><D:multistatus xmlns:D="DAV:"/>`);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Build minimal VFREEBUSY from VEVENTs over the requested time-range. */
export async function handleFreeBusy(urlPath: string, bodyText: string, persist: PersistAdapter, opts?: { depth?: string }): Promise<string> {
  const { start, end } = extractTimeRange(bodyText);
  const depth = (opts?.depth ?? "1").toLowerCase();
  const parts = urlPath.split("/").filter(Boolean);
  const baseHref = urlPath.endsWith("/") ? urlPath : urlPath + "/";

  async function listAllFiles(recursive: boolean): Promise<string[]> {
    const out: string[] = [];
    const names = await persist.readdir(parts).catch(() => [] as string[]);
    for (const name of names) {
      const child = [...parts, name];
      const st = await persist.stat(child).catch(() => null);
      if (!st) { continue; }
      if (st.type === "file" && name.toLowerCase().endsWith(".ics")) {
        out.push(`${baseHref}${encodeURIComponent(name)}`);
      } else if (st.type === "dir" && recursive) {
        const subNames = await persist.readdir(child).catch(() => [] as string[]);
        for (const s of subNames) {
          const subChild = [...child, s];
          const subSt = await persist.stat(subChild).catch(() => null);
          if (subSt) {
            if (subSt.type === "file") {
              if (s.toLowerCase().endsWith(".ics")) {
                out.push(`${baseHref}${encodeURIComponent(name)}/${encodeURIComponent(s)}`);
              }
            }
          }
        }
      }
    }
    return out;
  }

  const hrefs: string[] = await (async () => {
    if (depth === "infinity") { return await listAllFiles(true); }
    if (depth === "0") { return urlPath.toLowerCase().endsWith(".ics") ? [urlPath] : []; }
    return await listAllFiles(false);
  })();

  const periods: string[] = [];
  for (const href of hrefs) {
    const r = await readCalendarObject(persist, href);
    if (!r.ok || !r.data) { continue; }
    const comps = parseICalendar(r.data);
    for (const c of comps) {
      if (c.type !== "VEVENT") { continue; }
      const s = c.dtstart ?? "";
      const e = c.dtend ?? s;
      const inRange = overlapsTimeRange(c, start, end);
      if (!inRange) { continue; }
      if (s && e) {
        periods.push(`${s}/${e}`);
      }
    }
  }
  const cal = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VFREEBUSY",
    start ? `DTSTART:${start}` : "",
    end ? `DTEND:${end}` : "",
    ...periods.map((p) => `FREEBUSY:${p}`),
    "END:VFREEBUSY",
    "END:VCALENDAR",
  ].filter((l) => l.length > 0).join("\n");
  return cal;
}
