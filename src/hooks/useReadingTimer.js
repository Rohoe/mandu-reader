import { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch } from '../context/useAppSelector';
import { actions } from '../context/actions';

/**
 * Tracks active reading time for a lesson key.
 * Pauses when the tab is hidden or the user goes idle (60s no interaction).
 * Flushes accumulated seconds on pause, visibility change, and unmount.
 */
export function useReadingTimer(lessonKey) {
  const dispatch = useAppDispatch();
  const act = actions(dispatch);

  const startRef = useRef(null);       // timestamp when current active window started
  const accumulatedRef = useRef(0);    // seconds accumulated but not yet flushed
  const idleTimerRef = useRef(null);
  const IDLE_TIMEOUT = 60_000;         // 60 seconds of no interaction → pause

  const flush = useCallback(() => {
    if (startRef.current != null) {
      const elapsed = (Date.now() - startRef.current) / 1000;
      accumulatedRef.current += elapsed;
      startRef.current = null;
    }
    if (accumulatedRef.current > 0 && lessonKey) {
      const seconds = Math.round(accumulatedRef.current);
      if (seconds > 0) {
        act.updateReadingTime(lessonKey, seconds);
        act.logReadingSession(lessonKey, seconds);
      }
      accumulatedRef.current = 0;
    }
  }, [lessonKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const startTimer = useCallback(() => {
    if (startRef.current == null) {
      startRef.current = Date.now();
    }
  }, []);

  const pauseTimer = useCallback(() => {
    flush();
  }, [flush]);

  const resetIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    startTimer();
    idleTimerRef.current = setTimeout(pauseTimer, IDLE_TIMEOUT);
  }, [startTimer, pauseTimer]);

  useEffect(() => {
    if (!lessonKey) return;

    // Start tracking
    startTimer();
    idleTimerRef.current = setTimeout(pauseTimer, IDLE_TIMEOUT);

    // User interaction resets idle timer
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    for (const e of events) document.addEventListener(e, resetIdle, { passive: true });

    // Visibility change
    function handleVisibility() {
      if (document.hidden) pauseTimer();
      else resetIdle();
    }
    document.addEventListener('visibilitychange', handleVisibility);

    // Flush before unload
    function handleBeforeUnload() {
      flush();
    }
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      flush();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      for (const e of events) document.removeEventListener(e, resetIdle);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [lessonKey]); // eslint-disable-line react-hooks/exhaustive-deps
}
