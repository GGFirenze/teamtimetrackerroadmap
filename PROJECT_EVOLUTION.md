# PS Time Tracker -- Project Evolution Guide

## Overview

The PS Time Tracker started as a personal time-tracking tool and evolved into a team-wide platform for Amplitude's Professional Services organization. This document covers the full journey from V1 to the current Team Edition, including the analytics strategy and automated reporting pipeline.

---

## Phase 1: Personal Tracker (V1)

**Location:** `~/Desktop/time-tracker/`
**Deployed:** [https://ggfirenze.github.io/PSTimeTracker/](https://ggfirenze.github.io/PSTimeTracker/)

### What it does
A single-page web app for tracking time against billable and non-billable PS projects. Built for personal use -- one user, browser-only, no backend.

### Tech stack
- React 18 + TypeScript + Vite
- LocalStorage for persistence
- Custom CSS (dark theme)
- Amplitude Browser SDK for event tracking

### Features
- Timer controls: start, pause, resume, stop per project
- Hardcoded project list (JPMC, Snyk, Pleo, ManoMano, etc.)
- Billable vs. non-billable categorization with visual indicators
- Session notes capture on timer stop (for biweekly reports)
- Daily summary: total billable and non-billable hours
- Time log: today's completed entries with durations and notes
- Google Calendar embed widget
- Tab title shows running timer
- Data persists across page refresh via LocalStorage

### Amplitude instrumentation
Events tracked:
- `Timer Started` (project_name, is_billable)
- `Timer Paused` (project_name, is_billable, duration_seconds)
- `Timer Stopped` (project_name, is_billable, duration_seconds)
- `Note Viewed` (project_name, is_billable)
- `Note Submitted` (project_name, is_billable, note_text)
- `Note Skipped` (project_name, is_billable)
- `Project Added` (project_name, is_billable)
- `Project Deleted` (project_name, is_billable)
- `Calendar Opened`
- `Calendar Collapsed`

Autocapture enabled for: attribution, page views, frustration interactions.
Session Replay enabled at 100% sample rate.

---

## Phase 2: Floating Widget (V2)

**Location:** `~/Desktop/time-tracker-v2/`
**Deployed:** Same GitHub Pages URL (merged via PR #1 to GGFirenze/PSTimeTracker)

### What changed
Added a floating always-on-top Picture-in-Picture (PiP) timer widget using the Document Picture-in-Picture API (Chrome/Edge 116+).

### New features
- **Pop Out button** in the header opens a compact floating window
- Floating widget shows: active timer with controls + quick-start project picker
- Notes modal renders inside the PiP window on timer stop
- Widget stays on top of all desktop windows (browser-managed)
- State fully synced between main app and widget via React context + createPortal

### New files
- `src/hooks/usePictureInPicture.ts` -- PiP window lifecycle (open, close, stylesheet cloning)
- `src/components/FloatingWidget.tsx` -- compact timer + project picker UI

### New analytics
- **New event:** `Pop Out Clicked`
- **New property:** `source` ("main" or "pip_widget") added to `Timer Started`, `Timer Paused`, `Timer Stopped`

This lets you answer: "Do people actually use the floating widget to control timers, or do they switch back to the main tab?"

---

## Phase 3: Team Edition (Current)

**Location:** `~/Desktop/time-tracker-team/`
**Status:** Working locally, not yet deployed

### What changed
Replaced the localStorage data layer with Supabase (Postgres + Auth + Row Level Security). Added Google SSO, user management, and an admin panel. Removed the hardcoded project list -- projects are now created and assigned by admins.

### Tech stack additions
- Supabase (hosted Postgres, Auth, RLS)
- Google OAuth via GCP project "PS Time Tracker" (internal to amplitude.com)
- `@supabase/supabase-js` client library

### Architecture

```
Browser (React)
  |
  |-- AuthContext (Google SSO via Supabase Auth)
  |-- ProjectContext (fetches user's assigned projects from Supabase)
  |-- TimerContext (reads/writes time_entries to Supabase)
  |
  v
Supabase
  |-- auth.users (managed by Supabase Auth)
  |-- profiles (id, email, full_name, is_admin)
  |-- projects (id, name, category, archived)
  |-- user_projects (user_id, project_id) -- assignment join table
  |-- time_entries (id, user_id, project_id, start_time, end_time, total_seconds, status, note, ...)
  |
  Row Level Security:
    - Users can only read/write their own time_entries
    - Users can only see their own project assignments
    - Admins can manage all projects and assignments
```

### Database schema
- **profiles:** Auto-created on first Google sign-in via database trigger. `is_admin` flag controls access to the admin panel.
- **projects:** Created by admins. Can be archived (soft delete). Categorized as billable or non-billable.
- **user_projects:** Join table mapping users to their assigned projects. Admins manage these via the admin panel.
- **time_entries:** One row per timer session. Status transitions: active -> paused -> active -> completed. Notes attached on stop.

### New features
- **Google SSO login** -- restricted to @amplitude.com accounts
- **Admin panel** -- create/archive projects, assign projects to team members
- **Per-user project lists** -- each person sees only their assigned projects
- **Server-side persistence** -- timer state survives browser clears, works across devices
- **User profiles** -- name and email pulled from Google account

### What was removed
- Hardcoded project list (`src/data/projects.ts`)
- LocalStorage persistence (replaced by Supabase)
- Amplitude SDK (stubs in place, ready for a new API key)
- Add/delete project buttons for regular users (admin-only now)

### What was preserved
- Entire UI (dark theme, project grid, timer bar, modals)
- PiP floating widget with notes modal
- Timer logic (start/pause/resume/stop)
- All CSS styles and animations

---

## Amplitude Analytics Strategy (Planned)

### Events taxonomy

| Event | Properties | Triggered when |
|-------|-----------|----------------|
| `Timer Started` | project_name, is_billable, source | User starts a timer |
| `Timer Paused` | project_name, is_billable, duration_seconds, source | User pauses a timer |
| `Timer Stopped` | project_name, is_billable, duration_seconds, source | User stops a timer |
| `Note Submitted` | project_name, is_billable, note_text | User saves a session note |
| `Note Skipped` | project_name, is_billable | User skips the note |
| `Pop Out Clicked` | -- | User opens the floating widget |
| `Project Created` | project_name, is_billable | Admin creates a project |
| `Project Assigned` | project_name, user_email | Admin assigns a project |
| `User Signed In` | auth_provider | User completes login |

The `source` property ("main" or "pip_widget") on timer events enables segmentation by interaction surface.

### Key charts to build in Amplitude

**1. Daily Time Tracked (Stacked Bar)**
- Metric: SUM of `duration_seconds` from `Timer Stopped` events
- Segmented by: `is_billable` (true/false)
- Group by: Day
- Purpose: See daily billable vs. non-billable hours at a glance

**2. Time by Project (Horizontal Bar)**
- Metric: SUM of `duration_seconds` from `Timer Stopped`
- Segmented by: `project_name`
- Filter: Last 14 days
- Purpose: Identify which projects consume the most time

**3. Team Utilization (Line Chart)**
- Metric: COUNT of unique users who fired `Timer Started`
- Group by: Day
- Purpose: Track adoption and daily active usage across the team

**4. Billable Ratio (KPI / Number)**
- Metric: SUM(duration_seconds WHERE is_billable=true) / SUM(duration_seconds)
- Purpose: Track the team's billable utilization rate

**5. PiP Widget Adoption (Funnel)**
- Step 1: `Pop Out Clicked`
- Step 2: `Timer Started` WHERE source = "pip_widget"
- Purpose: Measure conversion from opening the widget to actually using it

**6. Notes Completion Rate (Funnel)**
- Step 1: `Timer Stopped`
- Step 2: `Note Submitted` (conversion) vs. `Note Skipped` (drop-off)
- Purpose: Track how consistently people capture session notes

**7. Time by User (Table)**
- Metric: SUM of `duration_seconds` from `Timer Stopped`
- Group by: User
- Segmented by: `is_billable`
- Purpose: Individual time breakdown for biweekly reports

---

## Automated Reporting via Amplitude

### Weekly Report (Every Friday)

**Delivery:** Slack channel (e.g., #ps-time-tracking) via Amplitude Automated Reports

**Contents:**
- This week's total billable hours (team aggregate)
- This week's total non-billable hours
- Billable ratio percentage
- Top 5 projects by time spent
- Team utilization (number of active users / total team size)
- Comparison vs. previous week (delta)

**Setup in Amplitude:**
1. Create a Dashboard with the charts above (Daily Time Tracked, Time by Project, Team Utilization, Billable Ratio)
2. Go to the Dashboard > click "..." menu > "Schedule Report"
3. Set frequency: Weekly, every Friday at 9:00 AM
4. Delivery: Slack integration (select #ps-time-tracking channel)
5. Recipients: PS team leads

### Biweekly Notes Report (Every Other Friday)

**Delivery:** Slack DM to Giuliano (or #ps-leads) via Amplitude AI Agent

**Purpose:** Aggregate session notes for biweekly report preparation. This is the key workflow -- instead of manually reviewing time logs, the AI agent summarizes what the team worked on.

**Setup using Amplitude AI Agents:**
1. Create an AI Agent in Amplitude (Settings > AI Agents)
2. Configure the agent with access to the `Note Submitted` event
3. Prompt template:

```
Summarize the session notes submitted by the PS team over the last 2 weeks.
Group by project (project_name). For each project, provide:
- Total hours tracked
- Key activities and themes from the notes
- Any notable patterns or concerns

Format as a concise biweekly report suitable for leadership review.
```

4. Schedule: Biweekly, every other Friday at 8:00 AM (ahead of the team sync)
5. Delivery: Slack DM or channel post

**What this enables:**
- Zero manual effort to compile biweekly reports
- Consistent format every cycle
- Notes captured in real-time (not recalled from memory days later)
- AI identifies patterns humans might miss (e.g., "Snyk consumed 40% more hours this sprint")

---

## Next Steps

### Immediate (before team rollout)
1. **Deploy** to Netlify or Vercel
   - Add production URL to Google OAuth Authorized Redirect URIs
   - Add production URL to Supabase Auth Redirect URLs in dashboard
   - Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the hosting platform
2. **Push to GitHub** -- new repo (e.g., `GGFirenze/PSTimeTracker-Team`)
3. **Add Amplitude SDK** with a new API key for the team project
4. **Seed projects** -- create all current PS projects via the admin panel
5. **Invite the team** -- share the URL, people sign in with Google and get assigned projects

### Short-term enhancements
- Keyboard shortcuts in the PiP widget (Space to pause/resume)
- CSV/Google Sheets export for time entries
- Date range picker for time log (not just today)
- Bulk project assignment in admin panel (assign a project to all users at once)

### Medium-term
- Team dashboard (manager view of everyone's time)
- Mavenlink/PSA tool integration for time entry sync (biweekly reports in Mavenlink transcribe to SFDC -- potential to automate that chain)
- Daily/weekly email digest per user
- Mobile-responsive PiP alternative for phone/tablet

### Long-term
- Amplitude AI agent for automated biweekly report generation
- Smart project suggestions based on calendar events
- Budget tracking (estimated vs. actual hours per project)
- Client-facing time reports
