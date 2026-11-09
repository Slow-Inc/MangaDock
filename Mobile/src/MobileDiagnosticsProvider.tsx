import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  appendMobileDiagnosticsEvent,
  createMobileDiagnosticsEvent,
  formatMobileDiagnosticsLog,
  maskMobileHardwareId,
  type MobileDiagnosticsEvent,
} from './mobileDiagnostics';

type DiagnosticsState = {
  events: MobileDiagnosticsEvent[];
  hardwareId?: string;
  webViewHealth: string;
  lastError?: string;
};

type DiagnosticsActions = {
  appendEvent: (event: MobileDiagnosticsEvent) => void;
  setHardwareId: (hardwareId?: string) => void;
  registerReload: (reload: () => void) => () => void;
  reloadWebView: () => void;
  clearEvents: () => void;
};

const StateContext = createContext<DiagnosticsState | null>(null);
const ActionsContext = createContext<DiagnosticsActions | null>(null);

export const useMobileDiagnosticsState = () => useContext(StateContext);
export const useMobileDiagnosticsActions = () => useContext(ActionsContext);

export function MobileDiagnosticsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<DiagnosticsState>({
    events: [],
    webViewHealth: 'Waiting for WebView',
  });
  const reloadRef = useRef<(() => void) | null>(null);
  const maskedHardwareIdRef = useRef<string | undefined>(undefined);

  const appendEvent = useCallback((event: MobileDiagnosticsEvent) => {
    setState(current => {
      const next = {
        ...current,
        events: appendMobileDiagnosticsEvent(current.events, event),
      };
      switch (event.type) {
        case 'webview_reload_requested':
          next.webViewHealth = 'Loading';
          next.lastError = undefined;
          break;
        case 'webview_load_start':
          next.webViewHealth = 'Loading';
          break;
        case 'webview_load_end':
          // Android can emit HTTP error -> load_start -> load_end. Finishing
          // a load is not proof of success; keep the last error visible.
          next.webViewHealth = 'Load finished';
          break;
        case 'webview_http_error':
          next.lastError = `HTTP error ${event.statusCode ?? 'unknown'}`;
          break;
        case 'webview_error':
          next.webViewHealth = 'Load failed';
          next.lastError = event.message ?? 'WebView error';
          break;
      }
      return next;
    });
  }, []);

  const setHardwareId = useCallback((hardwareId?: string) => {
    const masked = maskMobileHardwareId(hardwareId);
    maskedHardwareIdRef.current = masked;
    setState(current => ({ ...current, hardwareId: masked }));
  }, []);

  const registerReload = useCallback((reload: () => void) => {
    reloadRef.current = reload;
    return () => {
      if (reloadRef.current === reload) {
        reloadRef.current = null;
      }
    };
  }, []);

  const reloadWebView = useCallback(() => {
    if (!reloadRef.current) {
      return;
    }
    const event = createMobileDiagnosticsEvent({
      type: 'webview_reload_requested',
      hardwareId: maskedHardwareIdRef.current,
    });
    console.log(formatMobileDiagnosticsLog(event));
    appendEvent(event);
    reloadRef.current();
  }, [appendEvent]);

  const clearEvents = useCallback(() => {
    setState(current => ({ ...current, events: [] }));
  }, []);

  // WebView consumes only stable actions, so event arrivals do not recreate
  // its source/bridge or the navigator's screen components.
  const actions = useMemo(
    () => ({
      appendEvent,
      setHardwareId,
      registerReload,
      reloadWebView,
      clearEvents,
    }),
    [appendEvent, setHardwareId, registerReload, reloadWebView, clearEvents],
  );

  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ActionsContext.Provider>
  );
}
