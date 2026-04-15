import { useProjectContext } from '../context/ProjectContext';
import { useTimerContext } from '../context/TimerContext';
import { formatTime } from '../hooks/useTimer';

interface Props {
  secondsLeft: number;
  onDismiss: () => void;
}

export function IdleWarningModal({ secondsLeft, onDismiss }: Props) {
  const { currentEntry } = useTimerContext();
  const { getProject } = useProjectContext();

  const project = currentEntry ? getProject(currentEntry.projectId) : null;
  const minutes = Math.ceil(secondsLeft / 60);

  return (
    <div className="modal-overlay idle-warning-overlay">
      <div className="modal idle-warning-modal" onClick={(e) => e.stopPropagation()}>
        <div className="idle-warning-icon">&#9888;</div>
        <h2 className="idle-warning-title">Are you still there?</h2>
        <p className="idle-warning-text">
          Your timer for <strong>{project?.name ?? 'this project'}</strong> has
          been running with no activity detected.
        </p>
        <p className="idle-warning-countdown">
          Timer will auto-stop in{' '}
          <strong>{minutes > 1 ? `${minutes} minutes` : formatTime(secondsLeft)}</strong>
        </p>
        <p className="idle-warning-hint">
          Time will be rounded back to the last 30-minute mark.
        </p>
        <button className="modal-btn modal-btn--submit idle-warning-btn" onClick={onDismiss}>
          I'm still here
        </button>
      </div>
    </div>
  );
}
