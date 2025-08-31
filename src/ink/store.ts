/**
 * @file Minimal tracker-backed store for Ink UI.
 */
import type { Tracker } from "../logging/tracker";
import { createConsoleTracker } from "../logging/tracker";

export type TrackEvent = { channel: string; payload: unknown; ts: string };

function createMemoryTracker(append: (ev: TrackEvent) => void): Tracker {
  return {
    track(channel, payload) {
      append({ channel, payload, ts: new Date().toISOString() });
    },
  };
}

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
  const tracker: Tracker = useConsole
    ? {
        track(channel, payload) {
          memory.track(channel, payload);
          createConsoleTracker("[TRACK]").track(channel, payload);
        },
      }
    : memory;
  
  const getState = () => ({ ...state });
  const subscribe = (fn: () => void) => {
    subs.add(fn);
    return () => subs.delete(fn);
  };
  const globalStore = { getState, subscribe };
  return { tracker, globalStore };
}

