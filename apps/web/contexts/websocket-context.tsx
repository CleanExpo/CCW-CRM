'use client';

import React, { createContext, useContext } from 'react';

// Minimal stub to satisfy useWebSocketContext calls
// Real-time features not needed for autosave tests

interface WebSocketContextValue {
  connectionState: 'disconnected';
  subscribe: (channel: string, handler: (message: any) => void) => void;
  unsubscribe: (channel: string) => void;
  sendMessage: (channel: string, message: any) => void;
  lastError: Error | null;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const value: WebSocketContextValue = {
    connectionState: 'disconnected',
    subscribe: () => {},
    unsubscribe: () => {},
    sendMessage: () => {},
    lastError: null,
  };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
}
