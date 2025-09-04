/**
 * @file CalDAV: MKCALENDAR handler
 */
import type { HandlerOptions, HandlerResult } from "../webdav/handlers/types";
import { handleMkcolRequest } from "../webdav/handlers/mkcol";
import { createDavStateStore } from "../webdav/dav-state";
import { parseMkcolProps } from "../webdav/xml/mkcol-parse";

/** CalDAV XML namespace URI */
const NS_CALDAV = "urn:ietf:params:xml:ns:caldav";

/**
 * Handle MKCALENDAR by creating a collection and marking D:resourcetype with C:calendar.
 * Also applies any provided properties from the request body (same parsing as Extended MKCOL).
 */
export async function handleMkcalendarRequest(
  urlPath: string,
  contentType: string | undefined,
  bodyText: string | undefined,
  options: HandlerOptions,
): Promise<HandlerResult> {
  const { persist, logger } = options;
  logger?.logInput("MKCALENDAR", urlPath);

  // Create the collection as per MKCOL semantics
  const createRes = await handleMkcolRequest(urlPath, { ...options });
  if (createRes.response.status !== 201) {
    return createRes;
  }

  // Apply properties (Optional body)
  const ct = (contentType ?? "").toLowerCase();
  const body = bodyText ?? "";
  const props = body.length > 0 && ct.includes("xml") ? (parseMkcolProps(body, ct) ?? {}) : {};

  // Ensure resourcetype indicates a calendar collection.
  const resType = `<D:collection/><C:calendar xmlns:C="${NS_CALDAV}"/>`;
  // Default CalDAV capability properties (RFC 4791 server-defined limits)
  const defaults: Record<string, string> = {
    "C:supported-calendar-component-set": "<C:comp name=\"VEVENT\"/><C:comp name=\"VTODO\"/>",
    "C:supported-calendar-data": "<C:calendar-data content-type=\"text/calendar\" version=\"2.0\"/>",
    "C:max-resource-size": String(10 * 1024 * 1024), // 10MB
    "C:min-date-time": "19700101T000000Z",
    "C:max-date-time": "20500101T000000Z",
    "C:max-instances": String(1000),
    "C:max-attendees-per-instance": String(100),
    "C:calendar-timezone": "UTC",
  };
  const merged = { ...defaults, ...props, "D:resourcetype": resType };
  const store = createDavStateStore(persist);
  await store.mergeProps(urlPath, merged);

  return createRes;
}
