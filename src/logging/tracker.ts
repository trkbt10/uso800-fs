/**
 * @file Minimal tracker interface for routing structured logs to a sink.
 */

export type Tracker = {
  track: (channel: string, payload: unknown) => void;
};

/**
 * Console-backed tracker printing JSON lines with a channel prefix.
 */
export function createConsoleTracker(prefix = "[TRACK]"): Tracker {
  return {
    track(channel, payload) {
      console.log(`${prefix} ${channel} ${JSON.stringify(payload)}`);
    },
  };
}

/**
 * Composite tracker that fans out to multiple sinks. Sinks can be added later.
 */
export function createCompositeTracker(initial: Tracker[] = []) {
  const sinks: Tracker[] = [...initial];
  const tracker: Tracker & { add: (t: Tracker) => void } = {
    track(channel, payload) {
      for (const s of sinks) {
        s.track(channel, payload);
      }
    },
    add(t: Tracker) {
      sinks.push(t);
    },
  };
  return tracker;
}
