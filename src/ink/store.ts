/**
 * @file Minimal tracker-backed store for Ink UI.
 */
import type { Tracker } from "../logging/tracker";
import { createConsoleTracker } from "../logging/tracker";

export type TrackEvent = { channel: string; payload: unknown; ts: string };

/**
 * Creates a minimal in-memory Tracker that appends every event to the given sink.
 * Although it appears to be a simple pass-through, it also stamps ISO timestamps
 * so consumers do not need to derive them and can focus purely on the payload.
 */
function createMemoryTracker(append: (ev: TrackEvent) => void): Tracker {
  return {
    track(channel, payload) {
      append({ channel, payload, ts: new Date().toISOString() });
    },
  };
}

/**
 * Builds a tracker + observable store pair for the Ink UI.
 * Superficially returns current state and subscribe; internally it also coalesces
 * events to a bounded list to avoid unbounded memory growth in long sessions.
 */
export function createTrackStore(options?: { useConsole?: boolean }) {
  const state: { events: TrackEvent[] } = { events: [] };
  const subs = new Set<() => void>();
  const append = (ev: TrackEvent) => {
    state.events.push(ev);
    if (state.events.length > 500) {
      state.events.splice(0, state.events.length - 500);
    }
    subs.forEach((fn) => fn());
  };
  const memory = createMemoryTracker(append);
  
  // Only use console tracker if explicitly requested (default: false for UI mode)
  const useConsole = options?.useConsole ?? false;
  function makeTracker(): Tracker {
    if (useConsole) {
      return {
        track(channel, payload) {
          memory.track(channel, payload);
          createConsoleTracker("[TRACK]").track(channel, payload);
        },
      };
    }
    return memory;
  }
  const tracker = makeTracker();
  
  const getState = () => ({ ...state });
  const subscribe = (fn: () => void) => {
    subs.add(fn);
    return () => subs.delete(fn);
  };
  const globalStore = { getState, subscribe };
  return { tracker, globalStore };
}
