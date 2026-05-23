import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorDisplay from '../components/ErrorDisplay';
import OddsDisplay from '../components/OddsDisplay';
import { apiService } from '../services/api';
import './MatchDetailPage.css';

// ── Formatters ────────────────────────────────────────────────────────────────

function formatEpochTime(epochMs) {
  if (!epochMs) return 'TBD';
  return new Date(epochMs).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatClock(seconds) {
  if (seconds == null || seconds <= 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// ── Incident Timeline ─────────────────────────────────────────────────────────

const INCIDENT_ICONS = {
  GOAL:   '⚽',
  YELL:   '🟨',
  SUBS:   '🔄',
  OFFS:   '📐',
  PENL:   '🎯',
  CRNR:   '🚩',
  EBEG:   '▶',
  PEND:   '⏸',
  PBEG:   '▶',
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

// ── Statistics ───────────────────────────────────────────────────────────────

// Maps liveData.results field names to display labels
const RESULTS_LABEL_MAP = {
  yellow: 'Yellow Cards',
  corners: 'Corners',
  penalties: 'Penalties',
  xGoals: 'Expected Goals',
  shots: 'Shots',
  shotsOnTarget: 'Shots on Target',
  attacks: 'Attacks',
  dangerousAttacks: 'Dangerous Attacks',
  possession: 'Possession %',
  fouls: 'Fouls',
  offsides: 'Offsides',
};

// Order of display for stats
const STATS_PRIORITY = ['Goals', 'Expected Goals', 'Shots', 'Shots on Target', 'Corners', 'Yellow Cards', 'Fouls', 'Offsides', 'Possession %', 'Penalties'];

function getSideBySideStats(
  statsTeams,
  homeTeamId,
  awayTeamId,
  eventStats,
  liveResults,   // liveData.results  (corners, yellow, penalties …)
  score,         // liveData.score    (home, away)
) {
  const result = [];
  const seenLabels = new Set();

  // Goals from liveData.score
  if (score?.home != null && score?.away != null) {
    result.push({
      label: 'Goals',
      home: score.home,
      away: score.away,
      kind: 'live-score',
    });
    seenLabels.add('Goals');
  }

  // All other stats from liveData.results - iterate dynamically
  if (liveResults && typeof liveResults === 'object') {
    for (const [field, sides] of Object.entries(liveResults)) {
      // Skip non-object values (like scorers array) and sportId
      if (!sides || typeof sides !== 'object' || Array.isArray(sides)) continue;
      if (seenLabels.has(field)) continue;

      const homeVal = sides.home;
      const awayVal = sides.away;
      if (homeVal == null && awayVal == null) continue;

      const label = RESULTS_LABEL_MAP[field] || field;
      seenLabels.add(field);
      result.push({
        label,
        home: homeVal ?? 0,
        away: awayVal ?? 0,
        kind: 'live-results',
      });
    }
  }

  // ── Sort ─────────────────────────────────────────────────────────────────
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

function StatsSection({ statistics, homeTeamId, awayTeamId, results, score, isPitchAvailable, isStatsAvailable, isLive }) {
  const teamsStats   = statistics?.teams   || {};
  const eventStats   = statistics?.event   || {};
  const liveResults  = results             || {};
  const scores       = score               || {};

  const sbStats = getSideBySideStats(
    teamsStats, homeTeamId, awayTeamId, eventStats, liveResults, scores,
  );

  // Collect sub-sections depending on what data we have
  const sections = [];

  if (isPitchAvailable && sbStats.some(s => ['Goals', 'Corners', 'Yellow Cards'].includes(s.label))) {
    if (isStatsAvailable) {
      sections.push(
        <div key="tech" className="sub-section">
          <h3 className="sub-title">Technical Statistics</h3>
          <p className="sub-hint">Detailed in-play stats and pitch positioning are available for this match.</p>
        </div>
      );
    }
  }

  if (sbStats.length > 0) {
    sections.push((
      <div key="table" className="sub-section">
        <h3 className="sub-title">Match Statistics</h3>
        <table className="stats-table">
          <thead>
            <tr>
              <th></th>
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
    ));
  }

  if (sections.length === 0) {
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
      {sections}
    </div>
  );
}

// ── Roster Section ───────────────────────────────────────────────────────────

function RosterSection({ roster, incidents }) {
  if (!roster) return null;

  const homeRoster = roster.homeRoster;
  const awayRoster = roster.awayRoster;
  const lineups = roster.lineups;

  if (!homeRoster && !awayRoster) return null;

  const parseSubstitution = (description) => {
    const match = description?.match(/(\d+)η\s*Αλλαγή:\s*\(?([^)]+)\)?/i);
    if (match) {
      return { playerName: match[2].trim(), order: parseInt(match[1]) };
    }
    return null;
  };

  const extractSubstitutions = (incidents, teamSide) => {
    if (!incidents) return {};
    const subs = {};
    for (const inc of incidents) {
      if (inc.type === 'SUBS' && inc.teamSide === teamSide) {
        const parsed = parseSubstitution(inc.description);
        if (parsed) {
          subs[parsed.playerName] = { minute: inc.time || '', order: parsed.order };
        }
      }
    }
    return subs;
  };

  const renderStartingAndBench = (rosterData, lineupData, teamSide, incidents) => {
    if (!rosterData?.players) return null;

    const players = rosterData.players;
    const benchPlayers = lineupData?.benchPlayers || [];
    const substitutions = extractSubstitutions(incidents, teamSide);

    const startingIds = new Set();
    if (lineupData?.lineup) {
      for (const row of lineupData.lineup) {
        for (const player of row) {
          startingIds.add(player.playerId);
        }
      }
    }

    const starters = [];
    const bench = [];

    for (const player of Object.values(players)) {
      if (startingIds.has(player.id)) {
        starters.push(player);
      } else if (benchPlayers.some(bp => bp.playerId === player.id)) {
        bench.push(player);
      }
    }

    const sortedStarters = starters.sort((a, b) => {
      const posOrder = { GK: 0, DF: 1, MF: 2, FW: 3 };
      const aPos = a.position || '';
      const bPos = b.position || '';
      if (posOrder[aPos] !== posOrder[bPos]) return (posOrder[aPos] || 99) - (posOrder[bPos] || 99);
      return (a.shirtNumber || 999) - (b.shirtNumber || 999);
    });

    const sortedBench = bench.sort((a, b) => {
      const aSub = substitutions[a.shortName || a.name];
      const bSub = substitutions[b.shortName || b.name];
      if (aSub && bSub) return aSub.order - bSub.order;
      if (aSub) return -1;
      if (bSub) return 1;
      return (a.shirtNumber || 999) - (b.shirtNumber || 999);
    });

    return (
      <div className="roster-details">
        {sortedStarters.length > 0 && (
          <div className="roster-starters">
            <div className="roster-subsection-title">Starting XI</div>
            <div className="roster-players">
              {sortedStarters.map(player => (
                <div key={player.id} className="roster-player">
                  <span className="player-number">{player.shirtNumber || ''}</span>
                  <span className="player-name">{player.shortName || player.name}</span>
                  {player.isCaptain && <span className="player-captain">©</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {sortedBench.length > 0 && (
          <div className="roster-bench">
            <div className="roster-subsection-title">Bench</div>
            <div className="roster-players">
              {sortedBench.map(player => {
                const subInfo = substitutions[player.shortName || player.name];
                return (
                  <div key={player.id} className="roster-player roster-bench-player">
                    <span className="player-number">{player.shirtNumber || ''}</span>
                    <span className="player-name">{player.shortName || player.name}</span>
                    {subInfo && <span className="player-sub-minute">{subInfo.minute}</span>}
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
    <div className="detail-section">
      <h2 className="section-title">Lineups</h2>
      <div className="roster-container">
        <div className="roster-team">
          <h3 className="roster-team-name">{homeRoster?.name || 'Home'}</h3>
          {homeRoster && renderStartingAndBench(homeRoster, lineups?.homeLineup, 0, incidents)}
        </div>
        <div className="roster-team">
          <h3 className="roster-team-name">{awayRoster?.name || 'Away'}</h3>
          {awayRoster && renderStartingAndBench(awayRoster, lineups?.awayLineup, 1, incidents)}
        </div>
      </div>
    </div>
  );
}

// ── Match Info ────────────────────────────────────────────────────────────────

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
        {is_pitch_available != null && (
          <div className="info-row">
            <span className="info-label">Pitch View</span>
            <span className={`info-value info-${is_pitch_available ? 'yes' : 'no'}`}>
              {is_pitch_available ? 'Available' : 'Not Available'}
            </span>
          </div>
        )}
        {is_stats_available != null && (
          <div className="info-row">
            <span className="info-label">Tech Stats</span>
            <span className={`info-value info-${is_stats_available ? 'yes' : 'no'}`}>
              {is_stats_available ? 'Available' : 'Not Available'}
            </span>
          </div>
        )}
        {betradar_id && (
          <div className="info-row">
            <span className="info-label">Betradar ID</span>
            <span className="info-value">{betradar_id}</span>
          </div>
        )}
        {url && (
          <div className="info-row">
            <span className="info-label">URL</span>
            <a href={`https://www.stoiximan.gr${url}`} target="_blank" rel="noopener noreferrer" className="info-link">
              {url}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function MatchDetailPage() {
  const { matchId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiService.getMatchDetail(matchId);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [matchId]);

  // Filter the incident list (All / Goals / Corners / Cards)
  const [activeFilter, setActiveFilter] = useState(null);

  const filteredIncidents = useMemo(() => {
    if (!data || !data.incidents) return [];
    if (!activeFilter) return data.incidents;
    return data.incidents.filter(inc =>
      (inc.props?.filterIds || []).includes(activeFilter)
    );
  }, [data, activeFilter]);

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
        <div className="detail-back-header">
          <Link to="/" className="back-link">← All Matches</Link>
        </div>
        <ErrorDisplay error={error} />
      </div>
    );
  }

  if (!data) return null;

  const { league, home_team, away_team, score, results, odds, incident_filters, statistics, is_live, status, is_pitch_available, is_stats_available, roster } = data;

  return (
    <div className="detail-page">
      {/* ── Navigation bar ── */}
      <div className="detail-nav">
        <Link to="/" className="back-link">← Back to All Matches</Link>
        <Link to="/" className="back-link-mobile">← Back</Link>
      </div>

      {/* ── Header ── */}
      <div className="detail-header">
        <div className="detail-top-row">
          <span className="detail-league">{league?.name || 'Unknown League'}</span>
          <span className={`detail-status status-${String(status).toLowerCase().replace(' ', '-')}`}>
            {status}
          </span>
        </div>
      </div>

      {/* ── Scoreboard ── */}
      <div className="scoreboard">
        <div className="scoreboard-team">
          <span className="team-name">{home_team?.name || 'Home'}</span>
        </div>

        <div className="scoreboard-center">
          <div className="scoreboard-score">
            <span className="score-num">{score?.home ?? '-'}</span>
            <span className="score-divider">:</span>
            <span className="score-num">{score?.away ?? '-'}</span>
          </div>
          {is_live && (
            <span className="scoreboard-clock">{formatClock(score?.seconds_since_start)}</span>
          )}
          {(results?.yellow?.home != null || results?.corners?.home != null) && (
            <div className="scoreboard-meta">
              {results.yellow?.home != null && Number(results.yellow.home) > 0 && <span className="meta-yellow">🟨</span>}
              {results.corners?.home != null && Number(results.corners.home) > 0 && <span className="meta-corners">🚩</span>}
              <span className="meta-text">
                {results.yellow?.home != null && `${results.yellow.home}Y `}
                {results.corners?.home != null && `${results.corners.home} Corners`}
              </span>
            </div>
          )}
        </div>

        <div className="scoreboard-team away">
          <span className="team-name">{away_team?.name || 'Away'}</span>
        </div>
      </div>

      {/* ── Match Info ── */}
      <MatchInfoSection matchData={data} />

      {/* ── Odds ── */}
      {odds && Object.keys(odds).length > 0 && (
        <div className="detail-section">
          <h2 className="section-title">Odds &amp; Markets</h2>
          <OddsDisplay odds={odds} />
        </div>
      )}

      {/* ── Incidents ── */}
      <div className="detail-section">
        <h2 className="section-title">Match Events</h2>

        {Array.isArray(incident_filters) && incident_filters.length > 1 && (
          <div className="inc-filter-pills">
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

        {filteredIncidents.length > 0 ? (
          <div className="incident-list">
            {filteredIncidents.map((inc, i) => (
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
            <p>No match events recorded yet. {is_live ? 'Check back during the match.' : 'The match has ended.'}</p>
          </div>
        )}
      </div>

      {/* ── Statistics ── */}
      <div className="detail-section">
        <StatsSection
          statistics={statistics}
          homeTeamId={home_team?.id}
          awayTeamId={away_team?.id}
          results={results}
          isPitchAvailable={is_pitch_available}
          isStatsAvailable={is_stats_available}
          isLive={is_live}
        />
      </div>

{/* ── Roster ── */}
       <RosterSection roster={roster} incidents={data.incidents} />
    </div>
  );
}
