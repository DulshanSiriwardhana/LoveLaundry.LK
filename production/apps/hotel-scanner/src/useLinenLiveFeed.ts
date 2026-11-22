import { useEffect, useRef, useState } from "react";
import { API_BASE, getAuthToken } from "./api";

export type FeedStatus = "live" | "connecting" | "reconnecting" | "offline";

export interface LinenLiveEvent {
  type?: string;
  event?: string;
  action?: string;
  at?: string;
  linen?: { linen_id?: string; status?: string; previous_status?: string };
  linen_ids?: string[];
}

function socketUrl(): string | null {
  const token = getAuthToken();
  if (!token) return null;
  const base = API_BASE.startsWith("http")
    ? API_BASE
    : `${window.location.protocol}//${window.location.host}${API_BASE}`;
  const ws = base.replace(/^http/, "ws").replace(/\/$/, "");
  return `${ws}/ws/linen?token=${encodeURIComponent(token)}`;
}

/** Subscribe to linen realtime events with a backoff; never blocks scanning. */
export function useLinenLiveFeed(onEvent: (event: LinenLiveEvent) => void, enabled: boolean) {
  const [status, setStatus] = useState<FeedStatus>("offline");
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!enabled) {
      setStatus("offline");
      return;
    }
    let stopped = false;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let delay = 1000;

    const connect = () => {
      const url = socketUrl();
      if (!url) {
        setStatus("offline");
        return;
      }
      setStatus((s) => (s === "live" ? "reconnecting" : "connecting"));
      try {
        socket = new WebSocket(url);
      } catch {
        setStatus("offline");
        return;
      }
      socket.onopen = () => {
        delay = 1000;
        setStatus("live");
        socket?.send(JSON.stringify({ subscribe: ["laundry"] }));
      };
      socket.onmessage = (message) => {
        try {
          const payload = JSON.parse(String(message.data)) as LinenLiveEvent;
          if (payload?.type === "linen.event" || payload?.event) {
            handler.current(payload);
          }
        } catch {
          // Ignore non-event heartbeat frames.
        }
      };
      socket.onclose = (close) => {
        if (stopped || close.code === 4401 || close.code === 4403) {
          setStatus("offline");
          return;
        }
        setStatus("reconnecting");
        retry = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 30_000);
      };
      socket.onerror = () => socket?.close();
    };

    const heartbeat = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ ping: true }));
      }
    }, 25_000);

    connect();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      clearInterval(heartbeat);
      socket?.close();
    };
  }, [enabled]);

  return status;
}
