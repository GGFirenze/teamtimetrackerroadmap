import { useState, useEffect, useRef, useCallback } from 'react';
import { useTimerContext } from '../context/TimerContext';
import { useProjectContext } from '../context/ProjectContext';
import { formatTime } from '../hooks/useTimer';
import { trackNoteViewed, trackNoteSubmitted, trackNoteSkipped } from '../analytics';
import { useSpeechRecognition, isSpeechSupported } from '../hooks/useSpeechRecognition';

export function NotesModal() {
  const { pendingStop, confirmStop, cancelStop } = useTimerContext();
  const { getProject } = useProjectContext();
  const [note, setNote] = useState('');
  const noteRef = useRef(note);
  noteRef.current = note;

  const handleTranscript = useCallback((text: string) => {
    setNote((prev) => {
      const separator = prev && !prev.endsWith(' ') ? ' ' : '';
      return prev + separator + text;
    });
  }, []);

  const { isListening, toggle: toggleMic } = useSpeechRecognition(handleTranscript);

  const prevPendingRef = useRef<string | null>(null);

  useEffect(() => {
    if (pendingStop && pendingStop.entry.id !== prevPendingRef.current) {
      prevPendingRef.current = pendingStop.entry.id;
      const p = getProject(pendingStop.entry.projectId);
      if (p) trackNoteViewed(p.name, p.category === 'billable');
    }
    if (!pendingStop) {
      prevPendingRef.current = null;
    }
  }, [pendingStop, getProject]);

  if (!pendingStop) return null;

  const { entry } = pendingStop;
  const project = getProject(entry.projectId);

  const handleSubmit = () => {
    if (project && note.trim()) {
      trackNoteSubmitted(project.name, project.category === 'billable', note.trim());
    }
    confirmStop(note.trim());
    setNote('');
  };

  const handleSkip = () => {
    if (project) {
      trackNoteSkipped(project.name, project.category === 'billable');
    }
    cancelStop();
    setNote('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleSkip}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Session Complete</h2>
          <button className="modal-close" onClick={handleSkip}>
            &times;
          </button>
        </div>

        <div className="modal-summary">
          <div className="modal-project">
            <span className="modal-project-name">{project?.name}</span>
            <span
              className={`active-timer-badge active-timer-badge--${project?.category}`}
            >
              {project?.category === 'billable' ? 'Billable' : 'Non-Billable'}
            </span>
          </div>
          <div className="modal-duration">
            <span className="modal-duration-value">
              {formatTime(entry.totalSeconds)}
            </span>
            <span className="modal-duration-label">Duration</span>
          </div>
        </div>

        <div className="modal-notes">
          <div className="modal-label-row">
            <label className="modal-label" htmlFor="session-notes">
              Session Notes
              <span className="modal-label-hint">
                What did you work on? Any updates for the biweekly report?
              </span>
            </label>
            {isSpeechSupported && (
              <button
                className={`mic-btn ${isListening ? 'mic-btn--active' : ''}`}
                onClick={toggleMic}
                type="button"
                title={isListening ? 'Stop dictation' : 'Dictate note'}
              >
                <span className="mic-btn-icon">{isListening ? '⏹' : '🎙'}</span>
                {isListening ? 'Listening...' : 'Dictate'}
              </button>
            )}
          </div>
          <textarea
            id="session-notes"
            className={`modal-textarea ${isListening ? 'modal-textarea--listening' : ''}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'Speak now...' : 'E.g., Configured event taxonomy for onboarding flow...'}
            rows={4}
            autoFocus
          />
        </div>

        <div className="modal-actions">
          <button className="modal-btn modal-btn--skip" onClick={handleSkip}>
            Skip
          </button>
          <button
            className="modal-btn modal-btn--submit"
            onClick={handleSubmit}
          >
            Save Note
            <span className="modal-btn-hint">&#8984;+Enter</span>
          </button>
        </div>
      </div>
    </div>
  );
}
