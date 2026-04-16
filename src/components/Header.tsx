import { useState } from 'react';
import { useTimerContext } from '../context/TimerContext';
import { useAuth } from '../context/AuthContext';
import { formatTimeCompact } from '../hooks/useTimer';
import { trackWidgetPoppedOut, trackWidgetPoppedIn } from '../analytics';
import { AdminPanel } from './AdminPanel';
import { ManageProjectsModal } from './BrowseProjectsModal';
import { useProjectContext } from '../context/ProjectContext';

interface HeaderProps {
  pipSupported: boolean;
  pipOpen: boolean;
  onTogglePiP: () => void;
}

export function Header({ pipSupported, pipOpen, onTogglePiP }: HeaderProps) {
  const { todayBillableSeconds, todayNonBillableSeconds } = useTimerContext();
  const { profile, isAdmin, signOut } = useAuth();
  const { refreshProjects } = useProjectContext();
  const [showAdmin, setShowAdmin] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);
  const totalSeconds = todayBillableSeconds + todayNonBillableSeconds;

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const displayName = profile?.full_name || profile?.email?.split('@')[0] || '';

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="header-title">
          <span className="header-icon">&#9201;</span>
          PS Time Tracker
        </h1>
        <p className="header-date">{today}</p>
      </div>
      <div className="header-right">
        <div className="header-stats">
          <div className="stat">
            <span className="stat-value">{formatTimeCompact(totalSeconds)}</span>
            <span className="stat-label">Total Today</span>
          </div>
          <div className="stat stat-billable">
            <span className="stat-value">
              {formatTimeCompact(todayBillableSeconds)}
            </span>
            <span className="stat-label">Billable</span>
          </div>
          <div className="stat stat-nonbillable">
            <span className="stat-value">
              {formatTimeCompact(todayNonBillableSeconds)}
            </span>
            <span className="stat-label">Non-Billable</span>
          </div>
        </div>
        <div className="header-actions">
          {pipSupported && (
            <button
              className={`pip-toggle-btn ${pipOpen ? 'pip-toggle-btn--active' : ''}`}
              onClick={() => {
                if (!pipOpen) trackWidgetPoppedOut();
                else trackWidgetPoppedIn();
                onTogglePiP();
              }}
              title={pipOpen ? 'Close floating widget' : 'Open floating widget'}
            >
              <span className="pip-toggle-icon">
                {pipOpen ? '\u2B73' : '\u2197'}
              </span>
              {pipOpen ? 'Pop In' : 'Pop Out'}
            </button>
          )}
          <button
            className="browse-btn"
            onClick={() => setShowBrowse(true)}
            title="Manage your project list"
          >
            Manage Projects
          </button>
          {isAdmin && (
            <button
              className="admin-btn"
              onClick={() => setShowAdmin(true)}
            >
              Admin
            </button>
          )}
          <div className="header-user">
            <span className="header-user-name">{displayName}</span>
            <button className="header-signout" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
        {showAdmin && (
          <AdminPanel
            onClose={() => {
              setShowAdmin(false);
              refreshProjects();
            }}
          />
        )}
        {showBrowse && (
          <ManageProjectsModal
            onClose={() => {
              setShowBrowse(false);
              refreshProjects();
            }}
          />
        )}
      </div>
    </header>
  );
}
