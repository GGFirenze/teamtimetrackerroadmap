import * as amplitude from '@amplitude/analytics-browser';

export type TimerSource = 'main' | 'pip_widget' | 'calendar';

amplitude.init('ee3c1fe9d2a36f00d52242cee2643bbd', {
  autocapture: {
    attribution: true,
    pageViews: true,
    sessions: false,
    frustrationInteractions: true,
    elementInteractions: false,
    formInteractions: false,
    fileDownloads: false,
  },
});

export function identifyUser(userId: string, email: string, fullName: string | null) {
  amplitude.setUserId(userId);
  const identify = new amplitude.Identify();
  identify.set('email', email);
  if (fullName) identify.set('full_name', fullName);
  amplitude.identify(identify);
}

export function resetUser() {
  amplitude.reset();
}

export function trackSignInCompleted() {
  amplitude.track('Sign In Completed');
}

export function trackTimerStarted(projectName: string, isBillable: boolean, source: TimerSource) {
  amplitude.track('Timer Started', {
    project_name: projectName,
    is_billable: isBillable,
    source,
  });
}

export function trackTimerPaused(projectName: string, isBillable: boolean, durationSeconds: number, source: TimerSource) {
  amplitude.track('Timer Paused', {
    project_name: projectName,
    is_billable: isBillable,
    duration_seconds: durationSeconds,
    source,
  });
}

export function trackTimerStopped(projectName: string, isBillable: boolean, durationSeconds: number, source: TimerSource) {
  amplitude.track('Timer Stopped', {
    project_name: projectName,
    is_billable: isBillable,
    duration_seconds: durationSeconds,
    source,
  });
}

export function trackWidgetPoppedOut() {
  amplitude.track('Widget Popped Out');
}

export function trackWidgetPoppedIn() {
  amplitude.track('Widget Popped In');
}

export function trackNoteViewed(projectName: string, isBillable: boolean) {
  amplitude.track('Note Viewed', {
    project_name: projectName,
    is_billable: isBillable,
  });
}

export function trackNoteSubmitted(projectName: string, isBillable: boolean, noteText: string) {
  amplitude.track('Note Submitted', {
    project_name: projectName,
    is_billable: isBillable,
    note_length: noteText.length,
  });
}

export function trackNoteSkipped(projectName: string, isBillable: boolean) {
  amplitude.track('Note Skipped', {
    project_name: projectName,
    is_billable: isBillable,
  });
}

export function trackProjectRemoved(projectName: string, isBillable: boolean) {
  amplitude.track('Project Removed', {
    project_name: projectName,
    is_billable: isBillable,
  });
}

export function trackCalendarEventLinked(eventTitle: string, projectName: string, keyword: string) {
  amplitude.track('Calendar Event Linked', {
    event_title: eventTitle,
    project_name: projectName,
    keyword,
  });
}

export function trackIdleTimeout(projectName: string, rewindedSeconds: number) {
  amplitude.track('Idle Timeout', {
    project_name: projectName,
    rewinded_seconds: rewindedSeconds,
  });
}
