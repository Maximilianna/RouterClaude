import { useEffect, useCallback, useState } from "react";
import { API_BASE } from "../config";

type MessageCallback = (data: unknown) => void;

const WS_BASE = API_BASE.replace(/^http/, "ws") + "/ws";
const MAX_RECONNECT_DELAY = 30000;

let globalWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
const listeners = new Map<string, Set<MessageCallback>>();
let connectionCount = 0;

function getWsUrl(): string {
  return WS_BASE;
}

function connect() {
  if (globalWs && (globalWs.readyState === WebSocket.OPEN || globalWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const ws = new WebSocket(getWsUrl());
  globalWs = ws;

  ws.onopen = () => {
    reconnectDelay = 1000;
    notifyStatus(true);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type && listeners.has(msg.type)) {
        for (const cb of listeners.get(msg.type)!) {
          cb(msg.data);
        }
      }
    } catch {
      // ignore non-JSON messages
    }
  };

  ws.onclose = () => {
    globalWs = null;
    notifyStatus(false);
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws.close();
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  if (connectionCount <= 0) return; // no active subscribers
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    connect();
  }, reconnectDelay);
}

const statusListeners = new Set<(connected: boolean) => void>();

function notifyStatus(connected: boolean) {
  for (const cb of statusListeners) cb(connected);
}

function subscribe(type: string, callback: MessageCallback) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type)!.add(callback);
  connectionCount++;
  if (!globalWs || globalWs.readyState === WebSocket.CLOSED) {
    connect();
  }
  return () => {
    listeners.get(type)?.delete(callback);
    connectionCount--;
    if (connectionCount <= 0 && globalWs) {
      globalWs.close();
      globalWs = null;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }
  };
}

function onStatusChange(callback: (connected: boolean) => void) {
  statusListeners.add(callback);
  // Immediately report current state
  callback(globalWs?.readyState === WebSocket.OPEN);
  return () => {
    statusListeners.delete(callback);
  };
}

export function useWebSocket() {
  const [connected, setConnected] = useState(globalWs?.readyState === WebSocket.OPEN);

  useEffect(() => {
    const unsub = onStatusChange(setConnected);
    return unsub;
  }, []);

  const subscribeCb = useCallback((type: string, callback: MessageCallback) => {
    return subscribe(type, callback);
  }, []);

  return { connected, subscribe: subscribeCb };
}
