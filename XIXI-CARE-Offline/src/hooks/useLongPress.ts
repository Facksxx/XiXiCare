import { useCallback, useRef, useEffect } from 'react';

export function useLongPress(
  callback: () => void,
  delay: number = 300,
  interval: number = 100
) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const isLongPressRef = useRef(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const start = useCallback(() => {
    isLongPressRef.current = false;

    delayRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      callbackRef.current();
      timerRef.current = setInterval(() => {
        callbackRef.current();
      }, interval);
    }, delay);
  }, [delay, interval]);

  const stop = useCallback(() => {
    const wasShortPress = !isLongPressRef.current && delayRef.current !== null;

    if (delayRef.current) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // 单击：长按延迟未触发，且定时器存在（说明是本次按下后抬起）
    if (wasShortPress) {
      callbackRef.current();
    }

    isLongPressRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      if (delayRef.current) clearTimeout(delayRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handlers = {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  return { handlers, isLongPress: isLongPressRef };
}