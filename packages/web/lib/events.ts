import type { DemoEvent } from "@x502/shared";

/// Thin wrapper around browser `EventSource` that:
///   - reconnects automatically on close
///   - hands typed events to consumer callbacks
///   - filters by claimId so each pipeline run gets its own clean stream
export interface DemoEventStream {
  close(): void;
}

export function subscribeDemoEvents(
  url: string,
  opts: {
    claimId?: string;
    onEvent: (event: DemoEvent) => void;
    onError?: (e: Event) => void;
  },
): DemoEventStream {
  let closed = false;
  let es: EventSource | null = null;

  const open = () => {
    if (closed) return;
    es = new EventSource(url);
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as DemoEvent;
        if (opts.claimId) {
          const eventClaim = (event as { claimId?: string }).claimId;
          if (eventClaim && eventClaim !== opts.claimId) return;
        }
        opts.onEvent(event);
      } catch {
        /* skip malformed */
      }
    };
    es.onerror = (e) => {
      opts.onError?.(e);
      es?.close();
      if (!closed) setTimeout(open, 1000);
    };
  };

  open();
  return {
    close: () => {
      closed = true;
      es?.close();
    },
  };
}
