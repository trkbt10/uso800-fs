/**
 * @file CalDAV integration via WebDAV hooks and custom methods.
 */
import type { WebDavHooks } from "../webdav/hooks";
import type { DavResponse } from "../webdav/handlers/types";
import type { WebDAVLogger } from "../logging/webdav-logger";
import type { PersistAdapter } from "../webdav/persist/types";
import { createDavStateStore } from "../webdav/dav-state";
import { handleMkcalendarRequest } from "./mkcalendar";
import { dispatchCalDavReport, handleFreeBusy } from "./report-handlers";

const NS_CALDAV = "urn:ietf:params:xml:ns:caldav";

function ensureCalendarInResourcetype(xml: string): string {
  if (xml.toLowerCase().includes(":calendar")) {
    return xml;
  }
  return xml.replace(/<\s*D:resourcetype\s*>([\s\S]*?)<\s*\/\s*D:resourcetype\s*>/i, (seg, inner) => {
    const cal = `<C:calendar xmlns:C="${NS_CALDAV}"/>`;
    return `<D:resourcetype>${inner}${cal}</D:resourcetype>`;
  });
}

function injectCalendarCollectionProps(xml: string, href: string): string {
  // For the collection's own response entry, add supported-calendar-component-set and supported-calendar-data
  const compSet = "<C:supported-calendar-component-set><C:comp name=\"VEVENT\"/></C:supported-calendar-component-set>";
  const calData = "<C:supported-calendar-data><C:calendar-data content-type=\"text/calendar\"/></C:supported-calendar-data>";
  const add = `\n  <D:propstat>\n    <D:prop>${compSet}${calData}</D:prop>\n    <D:status>HTTP/1.1 200 OK</D:status>\n  </D:propstat>`;
  const pattern = new RegExp(`<D:response>\\s*<D:href>${href.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}<\\/D:href>`, "i");
  const idx = xml.search(pattern);
  if (idx < 0) { return xml; }
  // Insert before closing </D:response> of the first (self) response
  return xml.replace(/(<\s*\/\s*D:response\s*>)/i, `${add}$1`);
}

async function isWithinCalendarCollection(persist: import("../webdav/persist/types").PersistAdapter, urlPath: string): Promise<boolean> {
  const parts = urlPath.split("/").filter(Boolean);
  if (parts.length === 0) { return false; }
  const parent = "/" + parts.slice(0, -1).join("/");
  const store = createDavStateStore(persist);
  const props = await store.getProps(parent);
  const rt = (props["D:resourcetype"] ?? "").toLowerCase();
  return rt.includes("calendar");
}

function containsCalDavReport(body: string): boolean {
  const b = body.toLowerCase();
  if (b.includes("calendar-query")) { return true; }
  if (b.includes("calendar-multiget")) { return true; }
  return false;
}

/**
 * Build CalDAV integration as hooks + custom methods.
 * Returns hooks to augment OPTIONS/PROPFIND/REPORT and a custom MKCALENDAR handler.
 */
export type CalDavConfig = { strictFilters?: boolean; calendarHomeSetPath?: string };
export function createCalDavHooks(config?: CalDavConfig): { hooks: WebDavHooks; customMethods: Record<string, (ctx: { method: string; urlPath: string; headers: Record<string, string>; bodyText: string; persist: PersistAdapter; hooks?: WebDavHooks; logger?: WebDAVLogger; }) => Promise<DavResponse>> } {
  const strictFilters = config?.strictFilters === true;
  const calendarHomeSetPath = config?.calendarHomeSetPath ?? "/cal/";
  const hooks: WebDavHooks = {
    async beforePut(ctx) {
      // Enforce text/calendar for resources under a calendar collection
      if (await isWithinCalendarCollection(ctx.persist, ctx.urlPath)) {
        // Only allow .ics files and text/calendar
        const isIcs = ctx.urlPath.toLowerCase().endsWith(".ics");
        if (!isIcs) { return { status: 415 }; }
        // best-effort: no header access here; rely on server handler to set mime, else accept
        // We could re-write content type via ctx.setBody if needed; skipping for now.
      }
      return undefined;
    },
    async afterOptions(ctx, headers) {
      const allowAdd = "MKCALENDAR";
      const davToken = "calendar-access";
      const out: Record<string, string> = {};
      if (headers.Allow) {
        out.Allow = headers.Allow + ", " + allowAdd;
      } else {
        out.Allow = allowAdd;
      }
      if (headers.DAV) {
        out.DAV = headers.DAV + ", " + davToken;
      } else {
        out.DAV = davToken;
      }
      return out;
    },
    async afterPropfind(ctx, res) {
      try {
        const store = createDavStateStore(ctx.persist);
        const keyA = ctx.urlPath;
        const keyB = ctx.urlPath.endsWith("/") ? ctx.urlPath.slice(0, -1) : ctx.urlPath + "/";
        const propsA = await store.getProps(keyA);
        const propsB = await store.getProps(keyB);
        const props = { ...propsB, ...propsA } as Record<string, string>;
        const rt = props["D:resourcetype"] ?? "";
        // Principal-like path: advertise calendar-home-set
        if (ctx.urlPath === "/" || ctx.urlPath === "") {
          const body = typeof res.body === "string" ? res.body : undefined;
          if (body && body.includes("propname") || body?.includes("C:calendar-home-set")) {
            const inject = `\n  <D:propstat>\n    <D:prop><C:calendar-home-set xmlns:C=\"urn:ietf:params:xml:ns:caldav\"><D:href xmlns:D=\"DAV:\">${calendarHomeSetPath}</D:href></C:calendar-home-set></D:prop>\n    <D:status>HTTP/1.1 200 OK</D:status>\n  </D:propstat>`;
            const withHome = body.replace(/(<\s*\/\s*D:response\s*>)/i, inject + "$1");
            return { ...res, body: withHome };
          }
        }
        if (rt.toLowerCase().includes("calendar")) {
          const body = typeof res.body === "string" ? res.body : undefined;
          if (!body) { return undefined; }
          const withRt = ensureCalendarInResourcetype(body);
          const href = ctx.urlPath.endsWith("/") ? ctx.urlPath : ctx.urlPath + "/";
          const next = injectCalendarCollectionProps(withRt, href);
          return { ...res, body: next };
        }
      } catch {
        // ignore
      }
      return undefined;
    },
    async beforeReport(ctx) {
      const isFb = /<\s*([A-Za-z]+:)?free-busy-query\b/i.test(ctx.bodyText);
      if (isFb) {
        const depth = ctx.getHeader ? ctx.getHeader("Depth") : "";
        const body = await handleFreeBusy(ctx.urlPath, ctx.bodyText, ctx.persist, { depth });
        return { status: 200, headers: { "Content-Type": "text/calendar" }, body };
      }
      if (containsCalDavReport(ctx.bodyText)) {
        const depth = ctx.getHeader ? ctx.getHeader("Depth") : "";
        const xml = await dispatchCalDavReport(ctx.urlPath, ctx.bodyText, ctx.persist, { depth, strictFilters });
        return { status: 207, headers: { "Content-Type": "application/xml" }, body: xml };
      }
      return undefined;
    },
  };

  const customMethods: Record<string, (ctx: { method: string; urlPath: string; headers: Record<string, string>; bodyText: string; persist: PersistAdapter; hooks?: WebDavHooks; logger?: WebDAVLogger; }) => Promise<DavResponse>> = {
    async MKCALENDAR(ctx) {
      const ct = (ctx.headers["Content-Type"] ?? ctx.headers["content-type"] ?? "").toLowerCase();
      const result = await handleMkcalendarRequest(ctx.urlPath, ct, ctx.bodyText, { persist: ctx.persist, hooks: ctx.hooks, logger: ctx.logger });
      return result.response;
    },
  };

  return { hooks, customMethods };
}
