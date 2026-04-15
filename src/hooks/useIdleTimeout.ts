import { useState, useEffect, useRef, useCallback } from 'react';

const IDLE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export interface IdleState {
  isWarning: boolean;
  warningSecondsLeft: number;
  dismissWarning: () => void;
}

/**
 * Monitors user activity (mouse, keyboard, touch, scroll).
 * When no activity is detected for IDLE_THRESHOLD_MS while a timer
 * is running, enters warning state. If the user doesn't respond
 * within WARNING_DURATION_MS, calls onIdleTimeout.
 */
export function useIdleTimeout(
  isTimerRunning: boolean,
  onIdleTimeout: () => void
): IdleState {
  const [isWarning, setIsWarning] = useState(false);
  const [warningSecondsLeft, setWarningSecondsLeft] = useState(0);

  const lastActivityRef = useRef(Date.now());
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningDeadlineRef = useRef<number>(0);
  const onIdleTimeoutRef = useRef(onIdleTimeout);
  onIdleTimeoutRef.current = onIdleTimeout;

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const clearAllTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearInterval(warningTimerRef.current);
      warningTimerRef.current = null;
    }
  }, []);

  const dismissWarning = useCallback(() => {
    setIsWarning(false);
    setWarningSecondsLeft(0);
    clearAllTimers();
    resetActivity();
  }, [clearAllTimers, resetActivity]);

  const startWarningCountdown = useCallback(() => {
    setIsWarning(true);
    warningDeadlineRef.current = Date.now() + WARNING_DURATION_MS;
    setWarningSecondsLeft(Math.ceil(WARNING_DURATION_MS / 1000));

    warningTimerRef.current = setInterval(() => {
      const remaining = warningDeadlineRef.current - Date.now();
      if (remaining <= 0) {
        clearAllTimers();
        setIsWarning(false);
        setWarningSecondsLeft(0);
        onIdleTimeoutRef.current();
      } else {
        setWarningSecondsLeft(Math.ceil(remaining / 1000));
      }
    }, 1000);
  }, [clearAllTimers]);

  const scheduleIdleCheck = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    idleTimerRef.current = setTimeout(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_THRESHOLD_MS) {
        startWarningCountdown();
      } else {
        scheduleIdleCheck();
      }
    }, IDLE_THRESHOLD_MS);
  }, [startWarningCountdown]);

  useEffect(() => {
    if (!isTimerRunning) {
      clearAllTimers();
      setIsWarning(false);
      setWarningSecondsLeft(0);
      return;
    }

    resetActivity();
    scheduleIdleCheck();

    const onActivity = () => {
      resetActivity();
      if (isWarning) {
        dismissWarning();
        scheduleIdleCheck();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, onActivity));
      clearAllTimers();
    };
  }, [isTimerRunning, isWarning, clearAllTimers, resetActivity, scheduleIdleCheck, dismissWarning]);

  return { isWarning, warningSecondsLeft, dismissWarning };
}

/**
 * Given a timestamp, round it down to the nearest 30-minute boundary.
 * E.g., 11:20 -> 11:00, 11:40 -> 11:30, 12:05 -> 12:00
 */
export function roundDownTo30Min(timestamp: number): number {
  const date = new Date(timestamp);
  const minutes = date.getMinutes();
  const roundedMinutes = minutes < 30 ? 0 : 30;
  date.setMinutes(roundedMinutes, 0, 0);
  return date.getTime();
}
