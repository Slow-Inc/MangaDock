import { useEffect, useRef, useState } from "react";
import { throttleDelay } from "./throttle";

/** `value`, passed on at most once per `intervalMs` — the first change at once, the last one always. */
export function useThrottledValue<T>(value: T, intervalMs: number): T {
  const [out, setOut] = useState(value);
  const lastEmit = useRef<number | null>(null);
  useEffect(() => {
    const emit = () => {
      lastEmit.current = performance.now();
      setOut(value);
    };
    const wait = throttleDelay(lastEmit.current, performance.now(), intervalMs);
    if (wait === 0) {
      emit();
      return;
    }
    const timer = setTimeout(emit, wait);
    return () => clearTimeout(timer);
  }, [value, intervalMs]);
  return out;
}
