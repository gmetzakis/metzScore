import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorDisplay from '../components/ErrorDisplay';
import OddsDisplay from '../components/OddsDisplay';
import { apiService } from '../services/api';
import LivePitch from '../components/LivePitch';
import useBetradarPitch from '../hooks/useBetradarPitch';
import './MatchDetailPage.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEpochTime(epochMs) {
  if (!epochMs) return 'TBD';
  return new Date(epochMs).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatClock(seconds) {
  if (seconds == null || seconds <= 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatCompactTime(epochMs) {
  if (!epochMs) return 'TBD';
  return new Date(epochMs).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTeamInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function getMomentumValue(results) {
  const attacks = Number(results?.attacks?.home || 0) + Number(results?.dangerousAttacks?.home || 0);
  const awayAttacks = Number(results?.attacks?.away || 0) + Number(results?.dangerousAttacks?.away || 0);
  if (!attacks && !awayAttacks) return null;
  return attacks >= awayAttacks ? 'home' : 'away';
}

function formatHeroStatLabel(key) {
  const labelMap = {
    corners: 'Corners',
    yellow: 'Yellow cards',
    yellow_cards: 'Yellow cards',
    red: 'Red cards',
    red_cards: 'Red cards',
    xGoals: 'xG',
    x_goals_live: 'xG',
    possession: 'Possession',
    shots: 'Shots',
    shotsOnTarget: 'Shots on target',
    shots_off_target: 'Shots off target',
    shots_blocked: 'Shots blocked',
    fouls: 'Fouls',
    offsides: 'Offsides',
    penalties: 'Penalties',
    attacks: 'Attacks',
    dangerousAttacks: 'Dangerous attacks',
  };

  return labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function getResultSideValue(results, ...keys) {
  for (const key of keys) {
    const value = results?.[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return {
        home: value.home ?? 0,
        away: value.away ?? 0,
        present: true,
      };
    }
  }

  return { home: 0, away: 0, present: false };
}

function buildQuickStats(results) {
  const stats = [];
  const seenKeys = new Set();
  const source = results && typeof results === 'object' ? results : {};
  const iconByKey = {
    red: '🟥',
    red_cards: '🟥',
  };

  const addFixedStat = (key, label, icon, keys) => {
    const value = getResultSideValue(source, ...keys);
    seenKeys.add(key);
    keys.forEach(alias => seenKeys.add(String(alias).toLowerCase()));
    stats.push({
      key,
      label,
      icon,
      home: value.home,
      away: value.away,
      fixed: true,
    });
  };

  addFixedStat('corners', 'Corners', '🚩', ['corners']);
  addFixedStat('yellow', 'Yellow cards', '🟨', ['yellow', 'yellow_cards']);

  for (const [key, value] of Object.entries(source)) {
    const lowerKey = key.toLowerCase();
    if (['sportid', 'scorers', 'injurytime'].includes(lowerKey)) continue;
    if (seenKeys.has(key) || seenKeys.has(lowerKey)) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

    stats.push({
      key,
      label: formatHeroStatLabel(key),
      icon: iconByKey[key] || null,
      home: value.home ?? 0,
      away: value.away ?? 0,
      fixed: false,
    });
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Incident row
// ---------------------------------------------------------------------------

const INCIDENT_ICONS = {
  GOAL: '⚽',
  YELL: '🟨',
  RED: '🟥️',
  SUBS: '🔄',
  OFFS: '📐',
  PENL: '🎯',
  CRNR: '🚩',
  EBEG: '▶',
  PEND: '⏸',
  PBEG: '▶',
  Aggregated: '📊',
};

function IncidentRow({ incident, homeName, awayName }) {
  const { description, type, time, teamSide } = incident;
  const sideLabel = teamSide === 0 ? homeName : teamSide === 1 ? awayName : '';
  const cls = [
    'incident-row',
    type === 'GOAL' && 'inc-goal',
    type === 'YELL' && 'inc-yellow',
    type === 'SUBS' && 'inc-subs',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <div className="inc-time">{time || ''}</div>
      <span className="inc-icon">{INCIDENT_ICONS[type] || '•'}</span>
      <div className="inc-body">
        <span className="inc-desc">{description}</span>
        {sideLabel && <span className="inc-team"> · {sideLabel}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats section
// ---------------------------------------------------------------------------

const RESULTS_LABEL_MAP = {
  yellow:           'Yellow Cards',
  corners:          'Corners',
  penalties:        'Penalties',
  xGoals:           'Expected Goals',
  shots:            'Shots',
  shotsOnTarget:    'Shots on Target',
  attacks:          'Attacks',
  dangerousAttacks: 'Dangerous Attacks',
  possession:       'Possession %',
  fouls:            'Fouls',
  offsides:         'Offsides',
};

const STATS_PRIORITY = [
  'Goals', 'Expected Goals', 'Shots', 'Shots on Target',
  'Corners', 'Yellow Cards', 'Fouls', 'Offsides', 'Possession %', 'Penalties',
];

function getSideBySideStats(statsTeams, homeTeamId, awayTeamId, eventStats, liveResults, score) {
  const result = [];
  const seenLabels = new Set();

  if (score?.home != null && score?.away != null) {
    result.push({ label: 'Goals', home: score.home, away: score.away, kind: 'live-score' });
    seenLabels.add('Goals');
  }

  if (liveResults && typeof liveResults === 'object') {
    for (const [field, sides] of Object.entries(liveResults)) {
      if (!sides || typeof sides !== 'object' || Array.isArray(sides)) continue;
      if (seenLabels.has(field)) continue;
      const homeVal = sides.home;
      const awayVal = sides.away;
      if (homeVal == null && awayVal == null) continue;
      const label = RESULTS_LABEL_MAP[field] || field;
      seenLabels.add(field);
      result.push({ label, home: homeVal ?? 0, away: awayVal ?? 0, kind: 'live-results' });
    }
  }

  result.sort((a, b) => {
    const pa = STATS_PRIORITY.indexOf(a.label);
    const pb = STATS_PRIORITY.indexOf(b.label);
    if (pa === -1 && pb === -1) return a.label.localeCompare(b.label);
    if (pa === -1) return 1;
    if (pb === -1) return -1;
    return pa - pb;
  });

  return result;
}

function StatsSection({ statistics, homeTeamId, awayTeamId, results, score, isLive, statsStreamDetailed, statsStreamIsFallback, statsStreamLoading, statsStreamError, incidents }) {
  return (
    <div className="stats-section">
      {statsStreamError && (
        <div className="section-empty section-empty--tight">
          <p>Statsstream fetch failed: {statsStreamError}</p>
        </div>
      )}

      {statsStreamDetailed ? (
        <>
          <StatsstreamDetailedSection
            statsStreamDetailed={statsStreamDetailed}
            incidents={incidents}
            score={score}
            isFallbackStats={statsStreamIsFallback || statsStreamDetailed?.fallback === 'report'}
          />
        </>
      ) : (
        <div className="section-empty">
          <p>
            {isLive
              ? 'Statistics are being collected and will appear shortly.'
              : 'Statistics are not available for this match.'}
          </p>
        </div>
      )}
    </div>
  );
}

function parseIncidentMinute(time) {
  if (!time) return null;
  const value = String(time).trim();
  const plusMatch = value.match(/^(\d+)\+(\d+)$/);
  if (plusMatch) return Number(plusMatch[1]) + Number(plusMatch[2]);
  const minuteMatch = value.match(/(\d{1,3})/);
  return minuteMatch ? Number(minuteMatch[1]) : null;
}

function getIncidentImpact(type) {
  switch (type) {
    case 'GOAL': return 6;
    case 'RED': return 5;
    case 'PENL': return 4;
    case 'YELL': return 2;
    case 'CRNR': return 2;
    case 'SUBS': return 1;
    case 'OFFS': return 1;
    default: return 1;
  }
}

function getIncidentIcon(type) {
  return INCIDENT_ICONS[type] || '•';
}

function StatsstreamDetailedSection({ statsStreamDetailed, incidents, score, isFallbackStats }) {
  const [showAllStats, setShowAllStats] = useState(false);
  const homeTotals = statsStreamDetailed?.data?.home?.total || {};
  const awayTotals = statsStreamDetailed?.data?.away?.total || {};
  const homeGoals = (isFallbackStats || homeTotals.goals == null) ? (score?.home ?? homeTotals.goals ?? 0) : homeTotals.goals;
  const awayGoals = (isFallbackStats || awayTotals.goals == null) ? (score?.away ?? awayTotals.goals ?? 0) : awayTotals.goals;

  const displayHomeTotals = {
    ...homeTotals,
    goals: homeGoals,
  };

  const displayAwayTotals = {
    ...awayTotals,
    goals: awayGoals,
  };

  const totalShotsHome = Number(displayHomeTotals.total_shots || 0);
  const totalShotsAway = Number(displayAwayTotals.total_shots || 0);

  const attackHome = Number(displayHomeTotals.attacks || 0);
  const attackAway = Number(displayAwayTotals.attacks || 0);
  const attackTotal = Math.max(attackHome + attackAway, 1);

  const dangerHome = Number(displayHomeTotals.dangerous_attacks || 0);
  const dangerAway = Number(displayAwayTotals.dangerous_attacks || 0);
  const dangerTotal = Math.max(dangerHome + dangerAway, 1);

  const possessionHome = Number(displayHomeTotals.possession || 0);
  const possessionAway = Number(displayAwayTotals.possession || 0);
  const possessionTotal = Math.max(possessionHome + possessionAway, 100);

  const cornersHome = Number(displayHomeTotals.corners || 0);
  const cornersAway = Number(displayAwayTotals.corners || 0);

  const allStatEntries = Object.keys({ ...displayHomeTotals, ...displayAwayTotals })
    .filter(key => !['first_half', 'second_half', 'extra_time', 'possession'].includes(key))
    .map(key => ({
      key,
      label: formatStatLabel(key),
      home: displayHomeTotals[key],
      away: displayAwayTotals[key],
    }))
    .filter(item => item.home != null || item.away != null)
    .sort((a, b) => {
      const priority = [
        'goals',
        'total_shots',
        'shots_on_target',
        'shots_off_target',
        'shots_blocked',
        'corners',
        'fouls',
        'yellow_cards',
        'red_cards',
        'attacks',
        'dangerous_attacks',
      ];
      const pa = priority.indexOf(a.key);
      const pb = priority.indexOf(b.key);
      if (pa === -1 && pb === -1) return a.label.localeCompare(b.label);
      if (pa === -1) return 1;
      if (pb === -1) return -1;
      return pa - pb;
    });

  const defaultStatKeys = [
    'goals',
    'total_shots',
    'shots_on_target',
    'shots_off_target',
    'shots_blocked',
    'corners',
    'fouls',
    'yellow_cards',
    'red_cards',
    'attacks',
    'dangerous_attacks',
  ];

  const defaultDisplayedStatEntries = allStatEntries.filter(entry => defaultStatKeys.includes(entry.key));
  const hasExtraStats = defaultDisplayedStatEntries.length < allStatEntries.length;

  const displayedStatEntries = showAllStats
    ? allStatEntries
    : defaultDisplayedStatEntries;

  const summaryCards = [
    { label: 'Goals', home: displayHomeTotals.goals, away: displayAwayTotals.goals, accent: 'rose', icon: '⚽' },
    { label: 'Yellow', home: displayHomeTotals.yellow_cards, away: displayAwayTotals.yellow_cards, accent: 'amber', icon: '■' },
    { label: 'Red', home: displayHomeTotals.red_cards, away: displayAwayTotals.red_cards, accent: 'rose', icon: '■' },
    { label: 'Corners', home: cornersHome, away: cornersAway, accent: 'sky', icon: '⚑' },
    { label: 'Shots', home: totalShotsHome, away: totalShotsAway, accent: 'blue', icon: '◌' },
    { label: 'On target', home: displayHomeTotals.shots_on_target, away: displayAwayTotals.shots_on_target, accent: 'emerald', icon: '◎' },
  ];

  const comparisonMetrics = [
    {
      label: 'Επιθέσεις',
      home: attackHome,
      away: attackAway,
      total: attackTotal,
      leftColor: '#2563eb',
      rightColor: '#dc2626',
    },
    {
      label: 'Σουτ εντός εστίας',
      home: totalShotsHome,
      away: totalShotsAway,
      total: Math.max(totalShotsHome + totalShotsAway, 1),
      leftColor: '#2563eb',
      rightColor: '#dc2626',
    },
    {
      label: 'Επικίνδυνες επιθέσεις',
      home: dangerHome,
      away: dangerAway,
      total: dangerTotal,
      leftColor: '#2563eb',
      rightColor: '#dc2626',
    },
    {
      label: 'Possession',
      home: possessionHome,
      away: possessionAway,
      total: possessionTotal,
      leftColor: '#2563eb',
      rightColor: '#dc2626',
      suffix: '%',
    },
  ];

  const keyEvents = [];

  for (const incident of Array.isArray(incidents) ? incidents : []) {
    const minute = parseIncidentMinute(incident?.time);
    if (minute == null) continue;
    if (['GOAL', 'RED', 'YELL'].includes(incident?.type)) {
      keyEvents.push({
        minute,
        type: incident?.type,
        icon: getIncidentIcon(incident?.type),
        rawTime: incident?.time,
        teamSide: incident?.teamSide,
      });
    }
  }

  return (
    <div className="statsstream-block">
      <div className="statsstream-preview">
        <div className="statsstream-summary-grid">
          {summaryCards.map(card => (
            <div key={card.label} className={`statsstream-summary-card statsstream-summary-card--${card.accent}`}>
              <div className="statsstream-summary-icon">{card.icon}</div>
              <div className="statsstream-summary-label">{card.label}</div>
              <div className="statsstream-summary-values">
                <div className="statsstream-summary-value-row">
                  <span className="statsstream-summary-value">{card.home ?? 0}</span>
                </div>
                <div className="statsstream-summary-value-row">
                  <span className="statsstream-summary-value">{card.away ?? 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="statsstream-rings">
          {comparisonMetrics.map(metric => {
            const homeWidth = metric.total ? (metric.home / metric.total) * 100 : 0;
            const ringStyle = {
              background: `conic-gradient(#2563eb 0 ${homeWidth}%, #dc2626 ${homeWidth}% 100%)`,
            };

            return (
              <div key={metric.label} className="statsstream-ring-card">
                <div className="statsstream-ring-shell">
                  <span className="statsstream-ring-value statsstream-ring-value--home">{metric.home}{metric.suffix || ''}</span>
                  <div className="statsstream-ring" style={ringStyle}>
                    <div className="statsstream-ring-core" />
                  </div>
                  <span className="statsstream-ring-value statsstream-ring-value--away">{metric.away}{metric.suffix || ''}</span>
                </div>
                <div className="statsstream-ring-label">{metric.label}</div>
              </div>
            );
          })}
        </div>

        <div className="statsstream-timeline-card">
          <div className="statsstream-timeline-chart">
            <div className="statsstream-timeline-midline" />
            <div className="statsstream-timeline-clock">{formatClock(score?.seconds_since_start)}</div>

            {keyEvents.map((event, index) => {
              const left = Math.min((event.minute / 90) * 100, 100);
              return (
                <div
                  key={`${event.type}-${event.minute}-${index}`}
                  className={`statsstream-timeline-event ${event.teamSide === 0 ? 'statsstream-timeline-event--home' : event.teamSide === 1 ? 'statsstream-timeline-event--away' : ''}`}
                  style={{ left: `${left}%` }}
                  title={`${event.type} ${event.rawTime || `${event.minute}'`}`}
                >
                  {event.icon}
                </div>
              );
            })}
          </div>
        </div>

        <div className="statsstream-possession-card">
          <div className="statsstream-possession-title">Επίδοση</div>
          <div className="statsstream-possession-row">
            <span className="statsstream-possession-value statsstream-possession-value--home">{possessionHome}%</span>
            <span className="statsstream-possession-label">Κατοχή</span>
            <span className="statsstream-possession-value statsstream-possession-value--away">{possessionAway}%</span>
          </div>
          <div className="statsstream-possession-track">
            <div className="statsstream-possession-fill statsstream-possession-fill--home" style={{ width: `${possessionHome}%` }} />
            <div className="statsstream-possession-fill statsstream-possession-fill--away" style={{ width: `${possessionAway}%` }} />
          </div>

          <div className="statsstream-all-stats">
            {displayedStatEntries.map(stat => {
              const homeValue = Number(stat.home ?? 0);
              const awayValue = Number(stat.away ?? 0);
              const maxValue = Math.max(homeValue, awayValue, 1);
              const homeWidth = (homeValue / maxValue) * 100;
              const awayWidth = (awayValue / maxValue) * 100;

              return (
                <div key={stat.key} className="statsstream-all-stat-row">
                  <div className="statsstream-all-stat-side statsstream-all-stat-side--home">
                    <span className="statsstream-all-stat-value statsstream-all-stat-value--home">{formatStatOutput(stat.home)}</span>
                    <div className="statsstream-all-stat-track">
                      <div className="statsstream-all-stat-bar statsstream-all-stat-bar--home" style={{ width: `${homeWidth}%` }} />
                    </div>
                  </div>

                  <span className="statsstream-all-stat-label">{stat.label}</span>

                  <div className="statsstream-all-stat-side statsstream-all-stat-side--away">
                    <span className="statsstream-all-stat-value statsstream-all-stat-value--away">{formatStatOutput(stat.away)}</span>
                    <div className="statsstream-all-stat-track">
                      <div className="statsstream-all-stat-bar statsstream-all-stat-bar--away" style={{ width: `${awayWidth}%` }} />
                    </div>
                    <div className="statsstream-all-stat-bar statsstream-all-stat-bar--away" style={{ width: `${awayWidth}%` }} />
                  </div>
              </div>
              );
            })}
          </div>

          {hasExtraStats && (
            <button
              type="button"
              className="statsstream-expand-button"
              onClick={() => setShowAllStats(prev => !prev)}
            >
              {showAllStats ? 'Show less' : 'Show all statistics'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StandingsSection({ standings }) {
  const rows = Array.isArray(standings?.data) ? standings.data : [];

  if (!rows.length) return null;

  return (
    <div className="statsstream-standings-card">
      {/* Standings header intentionally removed per UI request */}

      <div className="statsstream-standings-scroll">
        <table className="statsstream-standings-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>P</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>GF</th>
              <th>GA</th>
              <th>GD</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.rank ?? index}-${row.team || index}`} title={row.raw_name || row.team || ''}>
                <td>{row.rank ?? index + 1}</td>
                <td className="statsstream-standings-team">{row.team ?? '-'}</td>
                <td>{formatStatOutput(row.played)}</td>
                <td>{formatStatOutput(row.wins)}</td>
                <td>{formatStatOutput(row.draws)}</td>
                <td>{formatStatOutput(row.losses)}</td>
                <td>{formatStatOutput(row.goals_for)}</td>
                <td>{formatStatOutput(row.goals_against)}</td>
                <td>{formatStatOutput(row.goal_diff)}</td>
                <td>{formatStatOutput(row.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatStatLabel(key) {
  const labelMap = {
    goals: 'Goals',
    total_shots: 'Total shots',
    shots_on_target: 'Shots on target',
    shots_off_target: 'Shots off target',
    shots_blocked: 'Shots blocked',
    throw_ins: 'Throw ins',
    corners: 'Corners',
    offsides: 'Offsides',
    big_chances: 'Big chances',
    big_chances_missed: 'Big chances missed',
    woodwork: 'Woodwork',
    shots_inside_box: 'Shots inside box',
    shots_outside_box: 'Shots outside box',
    x_goals_live: 'xG live',
    attacks: 'Attacks',
    dangerous_attacks: 'Dangerous attacks',
    fouls: 'Fouls',
    yellow_cards: 'Yellow cards',
    red_cards: 'Red cards',
    goalkeeper_saves: 'Goalkeeper saves',
    tackles: 'Tackles',
    interceptions: 'Interceptions',
    clearances: 'Clearances',
    aerials_won: 'Aerials won',
    duels_won: 'Duels won',
    possession_lost: 'Possession lost',
    dribbles: 'Dribbles',
    possession: 'Possession',
    passing_accuracy: 'Passing accuracy',
    passes_attempted: 'Passes attempted',
    passes_completed: 'Passes completed',
    acc_long_balls: 'Acc. long balls',
    acc_crosses: 'Acc. crosses',
  };

  return labelMap[key] || key.replace(/_/g, ' ');
}

function formatStatOutput(value) {
  if (value == null || value === '') return '-';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '-';
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && String(value).trim() !== '') {
    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2);
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Roster section
// ---------------------------------------------------------------------------

function RosterSection({ roster, results, incidents, homeName, awayName }) {
  if (!roster) return null;

  const homeLineup = roster.lineups?.homeLineup;
  const awayLineup = roster.lineups?.awayLineup;
  const subs       = roster.subs || {};

  const buildGoalCounts = () => {
    const goalCounts = new Map();

    if (results?.scorers && Array.isArray(results.scorers)) {
      for (const s of results.scorers) {
        if (s.description) {
          const parts = s.description.split("' ");
          if (parts.length >= 2) {
            const name = parts.slice(1).join("' ").trim();
            if (name) goalCounts.set(name, (goalCounts.get(name) || 0) + 1);
          }
        }
      }
    }

    if (incidents && Array.isArray(incidents)) {
      for (const inc of incidents) {
        if (inc.type === 'GOAL' && inc.description) {
          let desc = inc.description
            .replace(/\s*\([^)]*\)\s*$/, '')
            .trim()
            .replace(/^\d+-\d+\s*/, '')
            .trim();
          if (homeName && desc.startsWith(homeName)) desc = desc.slice(homeName.length).trim();
          else if (awayName && desc.startsWith(awayName)) desc = desc.slice(awayName.length).trim();
          if (desc) goalCounts.set(desc, (goalCounts.get(desc) || 0) + 1);
        }
      }
    }

    return goalCounts;
  };

  const goalCounts = buildGoalCounts();
  if (!homeLineup && !awayLineup) return null;

  const renderTeamLineup = (lineupData, teamSide) => {
    if (!lineupData) return null;
    const teamSubs = teamSide === 0 ? subs.homeSubs : subs.awaySubs;
    const subbedInByName  = {};
    const subbedOutByName = {};

    if (teamSubs) {
      for (const sub of teamSubs) {
        const inName  = sub.playerIn?.name;
        const outName = sub.playerOut?.name;
        const minute  = sub.substitutedOnMinute;
        if (inName && minute)  subbedInByName[inName]   = minute;
        if (outName && minute) subbedOutByName[outName] = minute;
      }
    }

    const starters = [];
    if (lineupData.lineup) {
      for (const row of lineupData.lineup)
        for (const p of row)
          starters.push({ id: p.playerId || p.unknownPlayerId, name: p.name });
    }

    const bench = [];
    if (lineupData.benchPlayers)
      for (const bp of lineupData.benchPlayers)
        bench.push({ id: bp.playerId || bp.unknownPlayerId, name: bp.name });

    return (
      <div className="roster-details">
        {starters.length > 0 && (
          <div className="roster-starters">
            <div className="roster-subsection-title">Starting XI</div>
            <div className="roster-players">
              {starters.map((p, i) => {
                const outMinute = subbedOutByName[p.name];
                const goals     = goalCounts.get(p.name) || 0;
                return (
                  <div key={`${p.id || p.name}-${i}`} className="roster-player">
                    <span className="player-name">{p.name}</span>
                    {goals > 0 && <span className="player-goal">{'⚽'.repeat(goals)}</span>}
                    {outMinute && <span className="player-sub-out">{outMinute}'</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {bench.length > 0 && (
          <div className="roster-bench">
            <div className="roster-subsection-title">Bench</div>
            <div className="roster-players">
              {bench.map((p, i) => {
                const minuteStr = subbedInByName[p.name] || null;
                const goals     = goalCounts.get(p.name) || 0;
                return (
                  <div key={`${p.id || p.name}-${i}`} className="roster-player roster-bench-player">
                    <span className="player-name">{p.name}</span>
                    {goals > 0 && <span className="player-goal">{'⚽'.repeat(goals)}</span>}
                    {minuteStr && <span className="player-sub-minute">{minuteStr}'</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="roster-container">
      <div className="roster-team">
        <h3 className="roster-team-name">Home</h3>
        {renderTeamLineup(homeLineup, 0)}
      </div>
      <div className="roster-team">
        <h3 className="roster-team-name">Away</h3>
        {renderTeamLineup(awayLineup, 1)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match info section
// ---------------------------------------------------------------------------

function MatchInfoSection({ matchData }) {
  const { league, zone, start_time, url, betradar_id, total_markets, is_pitch_available, is_stats_available } = matchData;

  return (
    <div className="detail-section">
      <h2 className="section-title">Match Info</h2>
      <div className="info-grid">
        {league?.name && (
          <div className="info-row">
            <span className="info-label">League</span>
            <span className="info-value">{league.name}</span>
          </div>
        )}
        {zone?.name && (
          <div className="info-row">
            <span className="info-label">Zone</span>
            <span className="info-value">{zone.name}</span>
          </div>
        )}
        {start_time && (
          <div className="info-row">
            <span className="info-label">Kick-off</span>
            <span className="info-value">{formatEpochTime(start_time)}</span>
          </div>
        )}
        {total_markets != null && (
          <div className="info-row">
            <span className="info-label">Markets</span>
            <span className="info-value">{total_markets}</span>
          </div>
        )}
        {url && (
          <div className="info-row">
            <span className="info-label">URL</span>
            <a
              href={`https://www.stoiximan.gr${url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="info-link"
            >
              {url}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryStrip({ score, results, isLive }) {
  const quickStats = buildQuickStats(results);

  return (
    <div className="summary-strip">
      {quickStats.map(item => (
        <div
          key={item.key}
          className={`summary-stat-card ${item.fixed ? 'summary-stat-card--fixed' : 'summary-stat-card--dynamic'}`}
        >
          {item.icon ? (
            <span className="summary-stat-icon" aria-hidden="true">{item.icon}</span>
          ) : (
            <span className="summary-stat-label">{item.label}</span>
          )}
          <div className="summary-stat-values">
            <span className="summary-stat-value">{item.home}</span>
            <span className="summary-stat-divider">-</span>
            <span className="summary-stat-value">{item.away}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MatchDetailPage() {
  const { matchId } = useParams();

  // ── Match detail polling (score / incidents / odds …) ────────────────────
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [activePanel, setActivePanel] = useState('odds');
  const [statsStreamDetailed, setStatsStreamDetailed] = useState(null);
  const [statsStreamIsFallback, setStatsStreamIsFallback] = useState(false);
  const [statsStreamLoading, setStatsStreamLoading] = useState(false);
  const [statsStreamError, setStatsStreamError] = useState(null);
  const isInitialLoad         = useRef(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isInitialLoad.current) setLoading(true);
      setError(null);
      setStatsStreamLoading(true);
      setStatsStreamError(null);

      try {
        const matchResult = await apiService.getMatchDetail(matchId);

        if (!cancelled) {
          setData(matchResult);
        }

        // Try original statsstream endpoint first
        try {
          const statsResult = await apiService.getStatsstreamDetailed(matchId);
          if (!cancelled) {
            setStatsStreamDetailed(statsResult);
            setStatsStreamIsFallback(Boolean(statsResult?.fallback === 'report'));
            console.log('[statsstream/detailed]', statsResult);
          }
        } catch (detailError) {
          // Fallback: try Betradar report if available
          if (!cancelled) {
            console.warn('[statsstream/detailed] failed, trying Betradar fallback', detailError);
            try {
              // Resolve Betradar ID
              let betradarId = matchResult?.betradar_id;
              if (!betradarId) {
                const statsRes = await apiService.statsplayer(matchId);
                const statModels = statsRes?.data?.statPlayerModels || [];
                betradarId = statModels[0]?.matchId;
              }

              if (betradarId) {
                const reportResult = await apiService.getStatsstreamReport(betradarId);
                if (!cancelled) {
                  setStatsStreamDetailed({ ...reportResult, fallback: 'report' });
                  setStatsStreamIsFallback(true);
                  console.log('[statsstream/report fallback]', reportResult);
                }
              } else {
                throw new Error('Could not resolve Betradar ID');
              }
            } catch (fallbackError) {
              if (!cancelled) {
                setStatsStreamDetailed(null);
                setStatsStreamIsFallback(false);
                setStatsStreamError(fallbackError.message || 'Failed to fetch stats details');
                console.error('[stats fallback] error', fallbackError);
              }
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          if (!isInitialLoad.current) setData(null);
        }
      } finally {
        if (!cancelled && isInitialLoad.current) {
          setLoading(false);
          isInitialLoad.current = false;
        }
        if (!cancelled) {
          setStatsStreamLoading(false);
        }
      }
    }

    load();
    const interval = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [matchId]);

  // ── Betradar pitch hook ───────────────────────────────────────────────────
  // Only activate when the match is live — saves unnecessary polling for
  // finished/not-started matches.  Remove the `data?.is_live` guard if you
  // always want to attempt the Betradar connection.
  const betradarActive = data?.is_live ?? false;

  const {
    pitchState,
    isAvailable: pitchAvailable,
    isLoading: pitchLoading,
    betradarMatchId,
  } = useBetradarPitch(betradarActive ? matchId : null);

  // ── Incident filters ──────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState(null);
  const summaryRef = useRef(null);
  const pitchRef = useRef(null);
  const eventsRef = useRef(null);
  const statsRef = useRef(null);
  const lineupRef = useRef(null);
  const infoRef = useRef(null);

  const sectionRefs = {
    summary: summaryRef,
    pitch: pitchRef,
    events: eventsRef,
    stats: statsRef,
    lineups: lineupRef,
    info: infoRef,
  };

  const scrollToSection = (section) => {
    sectionRefs[section]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const filteredIncidents = data?.incidents
    ? (activeFilter
        ? data.incidents.filter(inc => (inc.props?.filterIds || []).includes(activeFilter))
        : data.incidents)
    : [];
  const displayedIncidents = [...filteredIncidents].reverse();

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="detail-page">
        <div className="detail-loading"><LoadingSpinner /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="detail-page">
        <div className="detail-nav">
          <Link to="/" className="back-link">← Upcoming Matches</Link>
        </div>
        <ErrorDisplay error={error} />
      </div>
    );
  }

  if (!data) return null;

  const {
    league, zone, home_team, away_team, score, results, odds,
    incident_filters, statistics, is_live, status,
    roster, start_time,
  } = data;
  console.log("ENA: ", data);

  const hasOdds = odds && Object.keys(odds).length > 0;
  const hasHomeLineup = Array.isArray(roster?.lineups?.homeLineup?.lineup) && roster.lineups.homeLineup.lineup.some(row => Array.isArray(row) && row.length > 0);
  const hasAwayLineup = Array.isArray(roster?.lineups?.awayLineup?.lineup) && roster.lineups.awayLineup.lineup.some(row => Array.isArray(row) && row.length > 0);
  const hasHomeBench = Array.isArray(roster?.lineups?.homeLineup?.benchPlayers) && roster.lineups.homeLineup.benchPlayers.length > 0;
  const hasAwayBench = Array.isArray(roster?.lineups?.awayLineup?.benchPlayers) && roster.lineups.awayLineup.benchPlayers.length > 0;
  const hasLineups = Boolean(roster && (hasHomeLineup || hasAwayLineup || hasHomeBench || hasAwayBench));
  const hasStats = (statistics && Object.keys(statistics).length > 0) ||
    (results && Object.keys(results).length > 0) ||
    (score && (score.home != null || score.away != null));
  const hasStandings = Array.isArray(statsStreamDetailed?.standings?.data) && statsStreamDetailed.standings.data.length > 0;
  const hasEvents = Array.isArray(data.incidents) && data.incidents.length > 0;

  const availablePanels = [
    { id: 'odds', label: 'Odds' },
    hasStats && { id: 'stats', label: 'Statistics' },
    hasStandings && { id: 'standings', label: 'Standings' },
    hasEvents && { id: 'events', label: 'Events' },
    hasLineups && { id: 'lineups', label: 'Lineups' },
  ].filter(Boolean);

  const hasPitch = Boolean(is_live && pitchAvailable && !pitchLoading);
  return (
    <div className="detail-page">

      <div className="detail-shell">
        {/* ── Top bar ── */}
        

        <section className="detail-hero" ref={summaryRef}>
          <div className="detail-hero__meta-row">
            <div className="detail-hero__league">
              <div className="detail-nav">
                <Link to="/" className="back-link">← Back to Matches</Link>
                <Link to="/" className="back-link-mobile">← Back</Link>
              </div>
            </div>
            <div className={`detail-hero__status detail-hero__status--${String(status).toLowerCase().replace(' ', '-')}`}>
              <span className="detail-hero__league-badge">{league?.name || 'Unknown League'}</span>
              <span className="detail-hero__kickoff">{formatCompactTime(start_time)}</span>
            </div>
          </div>

          <div className="detail-hero__teams">
            

            <div className="hero-score-stack">
              <div className="hero-time">
                {is_live ? formatClock(score?.seconds_since_start) : '—'}
              </div>

              <div className="hero-score">
                <div className="hero-team hero-team--home">
                  <div className="hero-team__name">{home_team?.name || 'Home'}</div>
                </div>
                
                <div className="hero-score__value">{score?.home ?? '-'}</div>
                <div className="hero-score__separator">-</div>
                <div className="hero-score__value">{score?.away ?? '-'}</div>
                
                <div className="hero-team hero-team--away">
                  <div className="hero-team__name">{away_team?.name || 'Away'}</div>
                </div>
              </div>

             

              <SummaryStrip score={score} results={results} isLive={is_live} />
            </div>

            
          </div>

          {availablePanels.length > 0 && (
            <div className="detail-tabs detail-tabs--panel">
              {availablePanels.map((panel) => (
                <button
                  key={panel.id}
                  type="button"
                  className={`detail-tab ${panel.id === activePanel ? 'active' : ''}`}
                  onClick={() => setActivePanel(panel.id)}
                >
                  {panel.label}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="detail-card detail-card--match-layout">
          <div className="match-layout">
            <div className="match-layout__top">
              <div className="match-layout__content">
                <div className="match-block match-block--content">
                  <div className="panel-body panel-body--views">
                    {activePanel === 'odds' && (
                      hasOdds ? (
                        <OddsDisplay odds={odds} />
                      ) : (
                        <div className="section-empty">
                          <p>Odds are not available for this match.</p>
                        </div>
                      )
                    )}

                    {activePanel === 'stats' && (
                      <StatsSection
                        statistics={statistics}
                        homeTeamId={home_team?.id}
                        awayTeamId={away_team?.id}
                        results={results}
                        score={score}
                        isLive={is_live}
                        statsStreamDetailed={statsStreamDetailed}
                        statsStreamIsFallback={statsStreamIsFallback}
                        statsStreamLoading={statsStreamLoading}
                        statsStreamError={statsStreamError}
                        incidents={data.incidents}
                      />
                    )}

                    {activePanel === 'events' && (
                      <>
                        {Array.isArray(incident_filters) && incident_filters.length > 1 && (
                          <div className="inc-filter-pills inc-filter-pills--soft">
                            <button
                              className={`inc-pill ${activeFilter === null ? 'active' : ''}`}
                              onClick={() => setActiveFilter(null)}
                            >
                              {incident_filters.find(f => f.id === 5)?.name || 'All'}
                            </button>
                            {incident_filters
                              .filter(f => f.id !== 5)
                              .map(f => (
                                <button
                                  key={f.id}
                                  className={`inc-pill ${activeFilter === f.id ? 'active' : ''}`}
                                  onClick={() => setActiveFilter(activeFilter === f.id ? null : f.id)}
                                >
                                  {f.name}
                                </button>
                              ))}
                          </div>
                        )}

                        {displayedIncidents.length > 0 ? (
                          <div className="incident-list incident-list--dense">
                            {displayedIncidents.map((inc, i) => (
                              <IncidentRow
                                key={`${inc.type}-${i}`}
                                incident={inc}
                                homeName={home_team?.name}
                                awayName={away_team?.name}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="section-empty">
                            <p>
                              No match events recorded yet.{' '}
                              {is_live ? 'Check back during the match.' : 'The match has ended.'}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {activePanel === 'standings' && (
                      hasStandings ? (
                        <StandingsSection standings={statsStreamDetailed?.standings} />
                      ) : (
                        <div className="section-empty">
                          <p>Standings are not available for this match.</p>
                        </div>
                      )
                    )}

                    {activePanel === 'lineups' && (
                      hasLineups ? (
                        <RosterSection
                          roster={roster}
                          results={results}
                          incidents={data.incidents}
                          homeName={home_team?.name}
                          awayName={away_team?.name}
                        />
                      ) : (
                        <div className="section-empty">
                          <p>Lineups are not available for this match.</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="match-layout__pitch">
                {hasPitch && (
                  <div className="match-block match-block--pitch" ref={pitchRef}>
                    <LivePitch
                      situation={pitchState.situation}
                      situationTeam={pitchState.situationTeam}
                      ballPos={pitchState.ballPos}
                      ballEnd={pitchState.ballEnd}
                      markers={pitchState.markers}
                      attackPath={pitchState.attackPath}
                      latestMarker={pitchState.latestMarker}
                      isAvailable={pitchAvailable}
                      homeName={home_team?.name}
                      awayName={away_team?.name}
                      homeTeamId={home_team?.id}
                      awayTeamId={away_team?.id}
                    />
                  </div>
                )}

                {!hasPitch && is_live && (
                  <div className="match-block match-block--pitch match-block--muted">
                    <div className="section-head section-head--compact">
                      <div>
                        <div className="section-kicker">Live match</div>
                        <h2 className="section-title">Pitch coverage</h2>
                      </div>
                    </div>
                    <div className="section-empty">
                      <p>Live pitch coverage is unavailable for this match.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}