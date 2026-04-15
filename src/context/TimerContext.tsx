import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { TimeEntry } from '../types';
import { generateId, isToday } from '../hooks/useTimer';
import { useProjectContext } from './ProjectContext';
import { useAuth } from './AuthContext';
import {
  fetchTodayEntries,
  fetchCurrentEntry,
  upsertTimeEntry,
  deleteTimeEntry as deleteTimeEntryDb,
} from '../lib/data';
import {
  trackTimerStarted,
  trackTimerPaused,
  trackTimerStopped,
  type TimerSource,
} from '../analytics';
import { roundDownTo30Min } from '../hooks/useIdleTimeout';

interface PendingStop {
  entry: TimeEntry;
}

interface TimerContextValue {
  currentEntry: TimeEntry | null;
  entries: TimeEntry[];
  pendingStop: PendingStop | null;

  startTimer: (projectId: string, source?: TimerSource) => void;
  pauseTimer: (source?: TimerSource) => void;
  resumeTimer: (source?: TimerSource) => void;
  requestStop: (source?: TimerSource) => void;
  idleStop: () => void;
  confirmStop: (note: string) => void;
  cancelStop: () => void;
  deleteEntry: (entryId: string) => void;

  todayEntries: TimeEntry[];
  todayBillableSeconds: number;
  todayNonBillableSeconds: number;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function useTimerContext(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimerContext must be used within TimerProvider');
  return ctx;
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { getProject } = useProjectContext();
  const { user } = useAuth();

  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [pendingStop, setPendingStop] = useState<PendingStop | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchCurrentEntry(user.id).then((entry) => setCurrentEntry(entry));
    fetchTodayEntries(user.id).then((data) =>
      setEntries(data.filter((e) => e.status === 'completed'))
    );
  }, [user]);

  const persist = useCallback(
    (entry: TimeEntry) => {
      if (!user) return;
      upsertTimeEntry(user.id, entry).catch((err) =>
        console.error('Failed to persist entry:', err)
      );
    },
    [user]
  );

  const startTimer = useCallback(
    (projectId: string, source: TimerSource = 'main') => {
      const newProject = getProject(projectId);

      if (currentEntry) {
        const now = Date.now();
        const effectiveEnd = currentEntry.pausedAt ?? now;
        const elapsedMs =
          effectiveEnd - currentEntry.startTime - currentEntry.totalPausedMs;
        const prevProject = getProject(currentEntry.projectId);
        const completed: TimeEntry = {
          ...currentEntry,
          endTime: now,
          totalSeconds: Math.max(0, Math.floor(elapsedMs / 1000)),
          pausedAt: null,
          status: 'completed',
        };

        persist(completed);

        if (prevProject) {
          trackTimerStopped(
            prevProject.name,
            prevProject.category === 'billable',
            completed.totalSeconds,
            source
          );
        }

        setPendingStop({ entry: completed });

        const newEntry: TimeEntry = {
          id: generateId(),
          projectId,
          startTime: now,
          endTime: null,
          totalSeconds: 0,
          pausedAt: null,
          totalPausedMs: 0,
          status: 'active',
          note: '',
        };
        setCurrentEntry(newEntry);
        persist(newEntry);

        if (newProject) {
          trackTimerStarted(newProject.name, newProject.category === 'billable', source);
        }
        return;
      }

      const newEntry: TimeEntry = {
        id: generateId(),
        projectId,
        startTime: Date.now(),
        endTime: null,
        totalSeconds: 0,
        pausedAt: null,
        totalPausedMs: 0,
        status: 'active',
        note: '',
      };
      setCurrentEntry(newEntry);
      persist(newEntry);

      if (newProject) {
        trackTimerStarted(newProject.name, newProject.category === 'billable', source);
      }
    },
    [currentEntry, getProject, persist]
  );

  const pauseTimer = useCallback(
    (source: TimerSource = 'main') => {
      if (!currentEntry || currentEntry.status !== 'active') return;
      const now = Date.now();
      const elapsedMs = now - currentEntry.startTime - currentEntry.totalPausedMs;
      const durationSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
      const project = getProject(currentEntry.projectId);

      const updated: TimeEntry = {
        ...currentEntry,
        pausedAt: now,
        status: 'paused',
      };
      setCurrentEntry(updated);
      persist(updated);

      if (project) {
        trackTimerPaused(project.name, project.category === 'billable', durationSeconds, source);
      }
    },
    [currentEntry, getProject, persist]
  );

  const resumeTimer = useCallback(
    () => {
      if (!currentEntry || currentEntry.status !== 'paused' || !currentEntry.pausedAt) return;
      const additionalPause = Date.now() - currentEntry.pausedAt;
      const updated: TimeEntry = {
        ...currentEntry,
        pausedAt: null,
        totalPausedMs: currentEntry.totalPausedMs + additionalPause,
        status: 'active',
      };
      setCurrentEntry(updated);
      persist(updated);
    },
    [currentEntry, persist]
  );

  const requestStop = useCallback(
    (source: TimerSource = 'main') => {
      if (!currentEntry) return;
      const now = Date.now();
      const effectiveEnd = currentEntry.pausedAt ?? now;
      const elapsedMs =
        effectiveEnd - currentEntry.startTime - currentEntry.totalPausedMs;
      const completed: TimeEntry = {
        ...currentEntry,
        endTime: now,
        totalSeconds: Math.max(0, Math.floor(elapsedMs / 1000)),
        pausedAt: null,
        status: 'completed',
      };
      const project = getProject(currentEntry.projectId);

      setCurrentEntry(null);
      persist(completed);
      setPendingStop({ entry: completed });

      if (project) {
        trackTimerStopped(
          project.name,
          project.category === 'billable',
          completed.totalSeconds,
          source
        );
      }
    },
    [currentEntry, getProject, persist]
  );

  const idleStop = useCallback(() => {
    if (!currentEntry) return;
    const now = Date.now();
    const rewindedEnd = roundDownTo30Min(now);
    const effectiveEnd = Math.max(currentEntry.startTime, rewindedEnd);
    const elapsedMs = effectiveEnd - currentEntry.startTime - currentEntry.totalPausedMs;
    const project = getProject(currentEntry.projectId);

    const completed: TimeEntry = {
      ...currentEntry,
      endTime: effectiveEnd,
      totalSeconds: Math.max(0, Math.floor(elapsedMs / 1000)),
      pausedAt: null,
      status: 'completed',
      note: '[Auto-stopped due to inactivity]',
    };

    setCurrentEntry(null);
    persist(completed);
    setEntries((prev) => [completed, ...prev]);

    if (project) {
      trackTimerStopped(
        project.name,
        project.category === 'billable',
        completed.totalSeconds,
        'main'
      );
    }
  }, [currentEntry, getProject, persist]);

  const confirmStop = useCallback(
    (note: string) => {
      if (!pendingStop) return;
      const finalEntry: TimeEntry = {
        ...pendingStop.entry,
        note,
      };
      persist(finalEntry);
      setEntries((prev) => [finalEntry, ...prev]);
      setPendingStop(null);
    },
    [pendingStop, persist]
  );

  const cancelStop = useCallback(() => {
    if (!pendingStop) return;
    const finalEntry: TimeEntry = {
      ...pendingStop.entry,
      note: '',
    };
    persist(finalEntry);
    setEntries((prev) => [finalEntry, ...prev]);
    setPendingStop(null);
  }, [pendingStop, persist]);

  const deleteEntry = useCallback(
    (entryId: string) => {
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      deleteTimeEntryDb(entryId).catch((err) =>
        console.error('Failed to delete entry:', err)
      );
    },
    []
  );

  const todayEntries = entries.filter((e) => isToday(e.startTime));

  const todayBillableSeconds = todayEntries
    .filter((e) => {
      const project = getProject(e.projectId);
      return project?.category === 'billable';
    })
    .reduce((sum, e) => sum + e.totalSeconds, 0);

  const todayNonBillableSeconds = todayEntries
    .filter((e) => {
      const project = getProject(e.projectId);
      return project?.category === 'non-billable';
    })
    .reduce((sum, e) => sum + e.totalSeconds, 0);

  return (
    <TimerContext.Provider
      value={{
        currentEntry,
        entries,
        pendingStop,
        startTimer,
        pauseTimer,
        resumeTimer,
        requestStop,
        idleStop,
        confirmStop,
        cancelStop,
        deleteEntry,
        todayEntries,
        todayBillableSeconds,
        todayNonBillableSeconds,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}
