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

function buildQuickStats(score, results) {

  const formatters = {
    possession: value => value != null ? `${value}%` : '-',
  };

  return Object.entries(results || {})
    .filter(([key]) => key.toLowerCase() !== 'sportid')
    .filter(([key]) => key.toLowerCase() !== 'scorers')
    .map(([key, value]) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      home: formatters[key]
        ? formatters[key](value?.home)
        : value?.home ?? '-',
      away: formatters[key]
        ? formatters[key](value?.away)
        : value?.away ?? '-',
    }));
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

function StatsSection({ statistics, homeTeamId, awayTeamId, results, score, isLive }) {
  const teamsStats  = statistics?.teams || {};
  const eventStats  = statistics?.event || {};
  const liveResults = results || {};
  const scores      = score   || {};

  const sbStats = getSideBySideStats(teamsStats, homeTeamId, awayTeamId, eventStats, liveResults, scores);

  if (sbStats.length === 0) {
    return (
      <div className="section-empty">
        <p>
          {isLive
            ? 'Statistics are being collected and will appear shortly.'
            : 'Statistics are not available for this match.'}
        </p>
      </div>
    );
  }

  return (
    <div className="stats-section">
      <table className="stats-table">
        <thead>
          <tr>
            <th />
            <th className="stat-home">{homeTeamId ? 'Home' : ''}</th>
            <th className="stat-away">{awayTeamId ? 'Away' : ''}</th>
          </tr>
        </thead>
        <tbody>
          {sbStats.map(stat => (
            <tr key={stat.label}>
              <td className="stat-label">{stat.label}</td>
              <td className={parseInt(stat.home) > parseInt(stat.away) ? 'stat-highlight' : ''}>
                {stat.home}
              </td>
              <td className={parseInt(stat.away) > parseInt(stat.home) ? 'stat-highlight' : ''}>
                {stat.away}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  const quickStats = buildQuickStats(score, results);

  return (
    <div className="summary-strip">
      {quickStats.map(item => (
        <div key={item.label} className="summary-stat-card">
          <span className="summary-stat-label">{item.label}</span>
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
  const isInitialLoad         = useRef(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isInitialLoad.current) setLoading(true);
      setError(null);

      try {
        const res = await apiService.getMatchDetail(matchId);
        if (!cancelled) setData(res);
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

  const [activePanel, setActivePanel] = useState('odds');

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
  const hasLineups = roster && (
    Boolean(roster.lineups?.homeLineup) ||
    Boolean(roster.lineups?.awayLineup) ||
    Boolean(roster.benchPlayers?.length)
  );
  const hasStats = (statistics && Object.keys(statistics).length > 0) ||
    (results && Object.keys(results).length > 0) ||
    (score && (score.home != null || score.away != null));
  const hasEvents = Array.isArray(data.incidents) && data.incidents.length > 0;

  const availablePanels = [
    { id: 'odds', label: 'Odds' },
    hasStats && { id: 'stats', label: 'Statistics' },
    hasEvents && { id: 'events', label: 'Events' },
    hasLineups && { id: 'lineups', label: 'Lineups' },
  ].filter(Boolean);

  const hasPitch = Boolean(is_live && pitchAvailable && !pitchLoading);
  const activePanelLabel = availablePanels.find(panel => panel.id === activePanel)?.label || 'Odds';

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
            <div className="hero-team hero-team--home">
              <div className="hero-team__name">{home_team?.name || 'Home'}</div>
            </div>

            <div className="hero-score">
              <div className="hero-score__value">{score?.home ?? '-'}</div>
              <div className="hero-score__separator">:</div>
              <div className="hero-score__value">{score?.away ?? '-'}</div>
            </div>

            <div className="hero-team hero-team--away">
              <div className="hero-team__name">{away_team?.name || 'Away'}</div>
            </div>

            <div className="hero-time">
              {is_live ? formatClock(score?.seconds_since_start) : '—'}
            </div>
          </div>


          <div className="detail-hero__facts">
            
          </div>

          <SummaryStrip score={score} results={results} isLive={is_live} />

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
                  <div className="section-head section-head--compact">
                    <div>
                      <div className="section-kicker">Match view</div>
                      <h2 className="section-title">{activePanelLabel}</h2>
                    </div>
                  </div>
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
                  </div>
                </div>
              </div>

              <div className="match-layout__pitch">
                {hasPitch && (
                  <div className="match-block match-block--pitch" ref={pitchRef}>
                    <div className="section-head section-head--compact">
                      <div>
                        <div className="section-kicker">Live match</div>
                        <h2 className="section-title">Pitch coverage</h2>
                      </div>
                      <div className="section-badges">
                        {betradarMatchId && <span className="section-badge section-badge--live">LIVE</span>}
                      </div>
                    </div>
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