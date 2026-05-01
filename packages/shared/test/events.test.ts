import { describe, expect, it } from "vitest";

import { type DemoEvent, EventBus, formatSse } from "../src/events.js";

const sampleEvent: DemoEvent = {
  type: "claim.opened",
  claimId: `0x${"ab".repeat(32)}` as `0x${string}`,
  repoSlug: "owner/repo",
  kind: 0,
  recipient: "0x1111111111111111111111111111111111111111",
  ts: 1,
};

describe("EventBus", () => {
  it("publishes events to all subscribers", () => {
    const bus = new EventBus();
    const a: DemoEvent[] = [];
    const b: DemoEvent[] = [];
    bus.subscribe((e) => a.push(e));
    bus.subscribe((e) => b.push(e));
    bus.publish(sampleEvent);
    expect(a).toEqual([sampleEvent]);
    expect(b).toEqual([sampleEvent]);
  });

  it("close() removes a subscriber so subsequent publishes are not delivered", () => {
    const bus = new EventBus();
    const seen: DemoEvent[] = [];
    const sub = bus.subscribe((e) => seen.push(e));
    bus.publish(sampleEvent);
    sub.close();
    bus.publish({ ...sampleEvent, ts: 2 });
    expect(seen).toHaveLength(1);
  });

  it("a subscriber that throws does not block other subscribers", () => {
    const bus = new EventBus();
    const seen: DemoEvent[] = [];
    bus.subscribe(() => {
      throw new Error("boom");
    });
    bus.subscribe((e) => seen.push(e));
    expect(() => bus.publish(sampleEvent)).not.toThrow();
    expect(seen).toEqual([sampleEvent]);
  });
});

describe("formatSse", () => {
  it("wraps events in the text/event-stream wire format", () => {
    const out = formatSse(sampleEvent);
    expect(out.startsWith("data: ")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(true);
    const data = JSON.parse(out.slice("data: ".length).trim()) as DemoEvent;
    expect(data).toEqual(sampleEvent);
  });
});
