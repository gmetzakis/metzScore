import { useState } from 'react';
import MatchCard from './MatchCard';
import './LeagueGroupedList.css';

// Country name to flag mapping
const COUNTRY_FLAGS_BY_NAME = {
  'Greece': '🇬🇷', 'England': '🇬🇧', 'Spain': '🇪🇸', 'Germany': '🇩🇪', 'Italy': '🇮🇹',
  'France': '🇫🇷', 'Brazil': '🇧🇷', 'Argentina': '🇦🇷', 'Mexico': '🇲🇽',
  'Portugal': '🇵🇹', 'Netherlands': '🇳🇱', 'Belgium': '🇧🇪', 'Sweden': '🇸🇪',
  'Norway': '🇳🇴', 'Denmark': '🇩🇰', 'Finland': '🇫🇮', 'Poland': '🇵🇱',
  'Russia': '🇷🇺', 'Turkey': '🇹🇷', 'USA': '🇺🇸', 'United States': '🇺🇸',
};

export default function LeagueGroupedList({ matches }) {
  // Group matches by league
  const groupedMatches = {};
  for (const match of matches) {
    const league = match.league || 'Unknown';
    if (!groupedMatches[league]) {
      groupedMatches[league] = [];
    }
    groupedMatches[league].push(match);
  }

  // All leagues collapsed by default
  const [expanded, setExpanded] = useState({});

  if (matches.length === 0) {
    return (
      <div className="no-matches">
        <p>No matches available at the moment.</p>
      </div>
    );
  }

  const toggleLeague = (league) => {
    setExpanded(prev => ({ ...prev, [league]: !prev[league] }));
  };

  // Get country info from first match in league
  const getCountryInfo = (leagueMatches) => {
    const countryName = leagueMatches[0]?.country_name;
    return countryName || null;
  };

  return (
    <div className="league-grouped-list">
      {Object.entries(groupedMatches).map(([league, leagueMatches]) => {
        const isOpen = expanded[league];
        const countryName = getCountryInfo(leagueMatches);
        const flag = countryName && COUNTRY_FLAGS_BY_NAME[countryName] ? COUNTRY_FLAGS_BY_NAME[countryName] : null;
        return (
          <div key={league} className="league-group">
            <div
              className="league-header"
              onClick={() => toggleLeague(league)}
            >
              {flag && <span className="league-flag">{flag}</span>}
              <span className="league-name">{league}</span>
              {countryName && <span className="league-country">{countryName}</span>}
              <span className="league-count">{leagueMatches.length} match{leagueMatches.length !== 1 ? 'es' : ''}</span>
              <span className="league-toggle">{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && (
              <div className="league-matches">
                {leagueMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}